import { EV } from '../core/events.js';
import { KIND, RULES, sec, isMinion, isStructure, TEAM } from './constants.js';

export const DMG = { PHYS: 0, MAGIC: 1, TRUE: 2 };
/** What caused a hit, carried on EV.DAMAGE as `c` (statistics, e.g. the simulation lab). */
export const CAUSE = { OTHER: 0, BASIC: 1, ABILITY: 2 };
/** Crowd-control kinds carried on EV.STUN as `b`; the source unit's id is `c` (-1 when unknown). */
export const CC = { STUN: 0, ROOT: 1, AIRBORNE: 2, DISPLACE: 3 };
const sid = (src) => (src ? src.id : -1);

function heroHooks(world, e) { return e.kind === KIND.HERO ? world.registry.heroes[e.heroKey] : null; }
function itemHooks(world, e, name, ...args) {
  if (e.kind !== KIND.HERO) return;
  for (let i = 0; i < e.items.length; i++) { const it = world.registry.items[e.items[i]]; const f = it && it[name]; if (f) f(world, e, ...args); }
}
function itemFilter(world, e, name, value, ...args) {
  if (e.kind !== KIND.HERO) return value;
  for (let i = 0; i < e.items.length; i++) { const it = world.registry.items[e.items[i]]; const f = it && it[name]; if (f) value = f(world, e, value, ...args); }
  return value;
}
/** Owner hero of a unit (Pebble belongs to Gus). */
export const ownerOf = (world, e) => (e && e.kind === KIND.PEBBLE ? world.get(e.ownerId) : e);

/**
 * The one damage pipeline. opts: { ability: bool, basic: bool, source: string, noLifesteal }
 * Returns final damage dealt to health+shield.
 */
export function dealDamage(world, src, target, amount, type = DMG.PHYS, opts = EMPTY) {
  const t = world.tick;
  if (!target || !target.alive || target.dead || amount <= 0) return 0;
  if (target.invulnUntil > t) return 0;
  if (isStructure(target.kind) && !target.vulnerable) return 0;
  const attacker = ownerOf(world, src);
  let amt = amount;
  if (src) {
    amt *= 1 + (src.dmgAmp || 0);
    if (attacker && attacker !== src) amt *= 1 + (attacker.dmgAmp || 0) * 0;
    if (attacker && attacker.kind === KIND.HERO) amt = itemFilter(world, attacker, 'modifyDamageOut', amt, target, type, opts);
    const h = heroHooks(world, attacker); if (h && h.modifyDamageOut) amt = h.modifyDamageOut(world, attacker, amt, target, type, opts);
  }
  if (target.ampUntil > t) amt *= 1 + target.ampPct;
  if (world.state.suddenDeath) amt *= 1 + RULES.SUDDEN_DEATH_DMG_BONUS;
  if (type !== DMG.TRUE) {
    const res = type === DMG.PHYS ? target.armor : target.mr;
    amt *= res >= 0 ? 100 / (100 + res) : 2 - 100 / (100 - res);
  }
  // target-side hooks (can reduce, delay, trigger shields)
  const th = heroHooks(world, target); if (th && th.modifyDamageIn) amt = th.modifyDamageIn(world, target, amt, attacker, type, opts);
  amt = itemFilter(world, target, 'modifyDamageIn', amt, attacker, type, opts);
  if (amt <= 0) return 0;
  amt = Math.round(amt);
  let absorbed = 0;
  if (target.shield > 0 && target.shieldUntil > t) { absorbed = Math.min(target.shield, amt); target.shield -= absorbed; }
  const hpDmg = amt - absorbed;
  // lethal-delay hook (Borrowed Seconds)
  if (hpDmg >= target.hp && target.kind === KIND.HERO) {
    const saved = itemFilter(world, target, 'onLethal', false, hpDmg, attacker);
    if (saved) { recordDamager(world, target, attacker); return amt; }
  }
  target.hp -= hpDmg;
  target.lastCombatTick = t;
  if (attacker) {
    attacker.lastCombatTick = t;
    if (attacker.kind === KIND.HERO && target.kind === KIND.HERO) { target.lastHeroDamageTick = t; attacker.lastHeroHitTick = t; }
    recordDamager(world, target, attacker);
    if (attacker.lifesteal > 0 && !opts.noLifesteal && (opts.basic || opts.ability)) heal(world, attacker, attacker, hpDmg * attacker.lifesteal, true);
    if (attacker.kind === KIND.HERO) {
      const ah = heroHooks(world, attacker); if (ah && ah.onDealtDamage) ah.onDealtDamage(world, attacker, target, hpDmg, type, opts);
      itemHooks(world, attacker, 'onDealtDamage', target, hpDmg, type, opts);
    }
  }
  if (th && th.onTookDamage) th.onTookDamage(world, target, hpDmg, attacker, type, opts);
  itemHooks(world, target, 'onTookDamage', hpDmg, attacker, type, opts);
  world.events.push(EV.DAMAGE, t, target.id, attacker ? attacker.id : -1, target.x, target.y, amt, type === DMG.PHYS ? 'p' : type === DMG.MAGIC ? 'm' : 't', opts.basic ? CAUSE.BASIC : opts.ability ? CAUSE.ABILITY : CAUSE.OTHER);
  if (target.hp <= 0) kill(world, target, attacker);
  return amt;
}
const EMPTY = Object.freeze({});

function recordDamager(world, target, attacker) {
  if (!attacker || attacker.kind !== KIND.HERO || target.kind !== KIND.HERO) return;
  const d = target.damagers; const t = world.tick;
  for (let i = 0; i < d.length; i += 2) if (d[i] === attacker.id) { d[i + 1] = t; return; }
  d.push(attacker.id, t);
}

/** Heal target by amount (capped at max HP); src is the healer or null (regeneration, fountain). Returns the amount healed. */
export function heal(world, src, target, amount, silent = false) {
  if (!target || !target.alive || target.dead || amount <= 0) return 0;
  if (src && src !== target && target.kind === KIND.HERO && world.registry.heroes[target.heroKey].selfHealOnly) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const h = target.hp - before;
  // silent heals (lifesteal, heal-over-time) are still reported for statistics, flagged quiet (c = 1) so presentation
  // skips them; heals without a source (regeneration, fountain) are not reported
  if (!silent) { if (h >= 1) world.events.push(EV.HEAL, world.tick, target.id, src ? src.id : -1, target.x, target.y, Math.round(h)); }
  else if (src && h > 0) world.events.push(EV.HEAL, world.tick, target.id, src.id, target.x, target.y, h, '', 1);
  return h;
}
export function addShield(world, target, amount, durationSec, src = null) {
  const t = world.tick;
  if (target.shieldUntil <= t) target.shield = 0;
  target.shield += amount; target.shieldUntil = Math.max(target.shieldUntil, t + sec(durationSec));
  world.events.push(EV.SHIELD, t, target.id, sid(src), target.x, target.y, amount);
}

// ---- crowd control ---------------------------------------------------------
const tenacity = (e) => (e.kind === KIND.HERO ? 1 : 1);
export function stun(world, e, s, src = null) {
  if (!e.alive || e.invulnUntil > world.tick || isStructure(e.kind)) return;
  e.stunUntil = Math.max(e.stunUntil, world.tick + sec(s * tenacity(e)));
  e.windup = 0; e.channelUntil = 0;
  world.events.push(EV.STUN, world.tick, e.id, CC.STUN, e.x, e.y, s, '', sid(src));
}
export function root(world, e, s, src = null) { if (!isStructure(e.kind) && e.invulnUntil <= world.tick) { e.rootUntil = Math.max(e.rootUntil, world.tick + sec(s)); world.events.push(EV.STUN, world.tick, e.id, CC.ROOT, e.x, e.y, s, '', sid(src)); } }
export function slow(world, e, pct, s, src = null) {
  if (isStructure(e.kind) || e.invulnUntil > world.tick) return;
  const t = world.tick;
  if (e.slowUntil <= t || pct >= e.slowPct) { e.slowPct = pct; e.slowUntil = Math.max(e.slowUntil, t + sec(s)); }
  world.events.push(EV.SLOW, t, e.id, sid(src), e.x, e.y, s, '', pct);
}
export function haste(world, e, pct, s) { const t = world.tick; if (e.hasteUntil <= t || pct >= e.hastePct) { e.hastePct = pct; e.hasteUntil = t + sec(s); } }
/** Knock a unit toward/away with a short forced movement. */
export function knock(world, e, dirX, dirY, distance, s, airborne = false, src = null) {
  if (isStructure(e.kind) || e.invulnUntil > world.tick) return;
  const len = Math.hypot(dirX, dirY) || 1; const ticks = Math.max(1, sec(s));
  e.knockVx = (dirX / len) * distance / ticks; e.knockVy = (dirY / len) * distance / ticks;
  e.knockUntil = world.tick + ticks; e.windup = 0; e.channelUntil = 0;
  if (airborne) e.airborneUntil = world.tick + ticks;
  world.events.push(EV.STUN, world.tick, e.id, airborne ? CC.AIRBORNE : CC.DISPLACE, e.x, e.y, s, '', sid(src));
}
export function knockUp(world, e, s, src = null) { if (!isStructure(e.kind) && e.invulnUntil <= world.tick) { e.airborneUntil = Math.max(e.airborneUntil, world.tick + sec(s)); e.windup = 0; e.channelUntil = 0; world.events.push(EV.STUN, world.tick, e.id, CC.AIRBORNE, e.x, e.y, s, '', sid(src)); } }

// ---- death -----------------------------------------------------------------
export function kill(world, victim, killer) {
  const t = world.tick;
  victim.hp = 0;
  if (victim.kind === KIND.HERO) {
    victim.dead = true; victim.deaths++;
    victim.respawnAt = t + sec(RULES.RESPAWN_BASE + RULES.RESPAWN_PER_LEVEL * victim.level);
    victim.targetId = -1; victim.order = 0; victim.windup = 0; victim.shield = 0; victim.channelUntil = 0;
    victim.stunUntil = victim.rootUntil = victim.slowUntil = victim.knockUntil = victim.airborneUntil = victim.dashUntil = 0;
    const def = world.registry.heroes[victim.heroKey]; if (def.onDeath) def.onDeath(world, victim);
    // assists
    const assisters = [];
    for (let i = 0; i < victim.damagers.length; i += 2) {
      const h = world.get(victim.damagers[i]);
      if (h && h !== killer && t - victim.damagers[i + 1] <= sec(RULES.ASSIST_WINDOW) && h.team !== victim.team) assisters.push(h);
    }
    victim.damagers.length = 0;
    const k = killer && killer.kind === KIND.HERO && killer.team !== victim.team ? killer : null;
    if (k) { k.kills++; giveGold(world, k, RULES.KILL_GOLD + 20 * Math.max(0, victim.level - k.level)); giveXp(world, k, RULES.KILL_XP); }
    for (const a of assisters) { a.assists++; giveGold(world, a, RULES.ASSIST_GOLD); giveXp(world, a, RULES.KILL_XP * 0.5); itemsOnAssist(world, a); }
    // takedown hook (kill or assist): resets and stacks that pay off on hero kills
    if (k) takedown(world, k, victim);
    for (const a of assisters) takedown(world, a, victim);
    if (!k && !assisters.length) {
      // executed by minion/tower: shared to nearby enemy heroes
      for (const h of world.heroes) if (h.team !== victim.team && !h.dead) giveGold(world, h, RULES.ASSIST_GOLD);
    }
    world.events.push(EV.DEATH, t, victim.id, killer ? killer.id : -1, victim.x, victim.y, 1, victim.heroKey);
    world.events.push(EV.KILL, t, victim.id, k ? k.id : (killer ? killer.id : -1), victim.x, victim.y, assisters.length);
    return;
  }
  if (isMinion(victim.kind)) {
    const spec = world.minionSpec(victim.kind);
    if (killer && killer.kind === KIND.HERO) { killer.cs++; giveGold(world, killer, spec.gold); if (world.registry.heroes[killer.heroKey].onMinionKill) world.registry.heroes[killer.heroKey].onMinionKill(world, killer, victim); itemsOnMinionKill(world, killer); }
    // xp shared among enemy heroes in radius
    let n = 0; for (const h of world.heroes) if (h.team !== victim.team && !h.dead && (h.x - victim.x) ** 2 + (h.y - victim.y) ** 2 < RULES.XP_SHARE_RADIUS ** 2) n++;
    if (n) for (const h of world.heroes) if (h.team !== victim.team && !h.dead && (h.x - victim.x) ** 2 + (h.y - victim.y) ** 2 < RULES.XP_SHARE_RADIUS ** 2) giveXp(world, h, spec.xp * (n > 1 ? 1.2 / n : 1));
  }
  if (isStructure(victim.kind)) {
    for (const h of world.heroes) if (h.team !== victim.team) giveGold(world, h, RULES.TOWER_GOLD);
    world.events.push(EV.STRUCTURE_DOWN, t, victim.id, victim.kind, victim.x, victim.y, victim.team);
    world.onStructureDown(victim);
  }
  if (victim.kind === KIND.PEBBLE) { const def = world.registry.heroes.gus; def.onPebbleDeath(world, victim); }
  world.events.push(EV.DEATH, t, victim.id, killer ? killer.id : -1, victim.x, victim.y, 0, String(victim.kind));
  world.despawn(victim);
}
function takedown(world, h, victim) { const d = world.registry.heroes[h.heroKey]; if (d.onTakedown) d.onTakedown(world, h, victim); }
function itemsOnAssist(world, h) { for (const k of h.items) { const it = world.registry.items[k]; if (it && it.onAssist) it.onAssist(world, h); } const d = world.registry.heroes[h.heroKey]; if (d.onAssist) d.onAssist(world, h); }
function itemsOnMinionKill(world, h) { for (const k of h.items) { const it = world.registry.items[k]; if (it && it.onMinionKill) it.onMinionKill(world, h); } }

export function giveGold(world, h, amount) {
  h.gold += Math.round(amount);
  world.events.push(EV.GOLD, world.tick, h.id, 0, h.x, h.y, Math.round(amount));
}
export function giveXp(world, h, amount) {
  if (h.level >= RULES.MAX_LEVEL) return;
  h.xp += amount;
  world.levelCheck(h);
}
