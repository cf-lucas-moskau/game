import { World } from './world.js';
import { EV } from '../core/events.js';
import { KIND, TEAM, MAP, RULES, MINION, STRUCT, LANE, sec, sideX, xpToNext, TICK_HZ } from './constants.js';
import { ORDER } from './entity.js';
import { CMD } from './commands.js';
import { recomputeHero } from './stats.js';
import { tryCast, trySpell, ranksForLevel } from './abilities.js';
import { dealDamage, heal, DMG, giveGold } from './damage.js';
import { movementSystem } from './systems/movement.js';
import { combatSystem } from './systems/combat.js';
import { projectileSystem } from './projectile.js';
import { zoneSystem } from './zones.js';
import { StateHasher } from '../core/hash.js';
import { sq } from '../core/dmath.js';
import { expireBuffs } from './buffs.js';
import { setupCamps, campSystem } from './camps.js';

/**
 * Build a ready-to-run match.
 * roster: [{ playerId, heroKey, team, isBot }]
 * content: { heroes: {key: def}, items: {key: def} }
 */
export function createMatch({ seed = 1, roster, content }) {
  const w = new World(seed);
  w.registry = content;
  w.players = {};
  w.minionSpec = (kind) => MINION[kind];
  w.levelCheck = (h) => levelCheck(w, h);
  w.onStructureDown = (s) => onStructureDown(w, s);
  w.state.whale.next = sec(RULES.WHALE_FIRST);
  w.state.nextWave = sec(RULES.FIRST_WAVE);
  w.state.nextRelic = sec(20);
  setupStructures(w);
  setupCamps(w);
  roster.forEach((r, i) => spawnHero(w, r, i));
  w.systems = [commandSystem, clockSystem, campSystem, heroSystem, movementSystem, combatSystem, projectileSystem, zoneSystem, economySystem, winSystem];
  return w;
}

// ---- setup ----------------------------------------------------------------------
function setupStructures(w) {
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    const mk = (kind, x, spec) => {
      const s = w.spawn(kind, team, sideX(team, x), 450);
      s.maxHp = s.hp = spec.hp; s.baseHp = spec.hp; s.armor = spec.armor; s.mr = spec.mr; s.radius = spec.radius;
      s.baseAd = spec.ad || 0; s.baseAs = spec.as || 0; s.range = spec.range || 0; s.projectileSpeed = spec.projectile || 0;
      s.vulnerable = false; w.structures.push(s); return s;
    };
    const outer = mk(KIND.TOWER, MAP.TOWER_OUTER_X, STRUCT.TOWER); outer.vulnerable = true; outer.tier = 2;
    const inner = mk(KIND.TOWER, MAP.TOWER_INNER_X, STRUCT.TOWER); inner.tier = 1;
    const heart = mk(KIND.HEART, MAP.HEART_X, STRUCT.HEART); heart.tier = 0;
  }
}
export function spawnHero(w, r, index) {
  const def = w.registry.heroes[r.heroKey];
  if (!def) throw new Error(`unknown hero ${r.heroKey}`);
  const slot = w.heroes.filter((h) => h.team === r.team).length;
  const e = w.spawn(KIND.HERO, r.team, sideX(r.team, MAP.FOUNTAIN_X + 40), 330 + slot * 120);
  e.heroKey = r.heroKey; e.playerId = r.playerId; e.isBot = !!r.isBot;
  e.items = []; e.itemState = {}; e.cds = [0, 0, 0, 0]; e.spellCds = [0, 0]; e.spells = ['dash', 'heal'];
  e.damagers = []; e.buffs = []; e.level = RULES.START_LEVEL; e.gold = RULES.START_GOLD; e.radius = def.base.radius || 36;
  e.projectileSpeed = def.base.projectile || 0; e.ranks = ranksForLevel(e.level, def.rankOrder);
  e.heroState = {};
  if (def.init) def.init(w, e);
  recomputeHero(w, e); e.hp = e.maxHp; e.mana = e.maxMana;
  w.heroes.push(e); w.players[r.playerId] = e.id;
  return e;
}

// ---- systems --------------------------------------------------------------------
function inShop(e) { return Math.abs(e.x - sideX(e.team, MAP.FOUNTAIN_X)) < MAP.FOUNTAIN_R + 80; }
export function canShop(e) { return e.dead || inShop(e); }

function commandSystem(w, commands) {
  if (!commands) return;
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    const e = w.get(w.players[c.p]);
    if (!e || w.state.over) continue;
    if (e.dead && c.t !== CMD.BUY && c.t !== CMD.SELL && c.t !== CMD.SURRENDER) continue;
    const def = w.registry.heroes[e.heroKey];
    switch (c.t) {
      case CMD.MOVE: e.order = ORDER.MOVE; e.moveX = c.x; e.moveY = c.y; e.targetId = -1; if (def.onMoveOrder) def.onMoveOrder(w, e, c); break;
      case CMD.ATTACK_MOVE: e.order = ORDER.ATTACK_MOVE; e.moveX = c.x; e.moveY = c.y; break;
      case CMD.ATTACK: { const t = w.get(c.id); if (t && t.team !== e.team) { e.order = ORDER.ATTACK; e.targetId = t.id; if (def.onAttackOrder) def.onAttackOrder(w, e, t); } break; }
      case CMD.STOP: e.order = ORDER.IDLE; e.targetId = -1; e.windup = 0; break;
      case CMD.CAST: tryCast(w, e, c.s, c); break;
      case CMD.SPELL: trySpell(w, e, c.s, c.x, c.y); break;
      case CMD.SWAP: if (def.onSwap) def.onSwap(w, e); break;
      case CMD.BUY: buy(w, e, c.item); break;
      case CMD.SELL: sell(w, e, c.i); break;
      case CMD.SURRENDER: { const heart = w.structures.find((x) => x.kind === KIND.HEART && x.team === e.team); if (!w.state.over) w.state.surrendered = true; endMatch(w, 1 - e.team, heart ? heart.x : e.x, heart ? heart.y : e.y); break; }
      case CMD.ITEM_ACTIVE: { const key = e.items[c.i]; const it = key && w.registry.items[key]; if (it && it.active && (e.itemState[key + ':cd'] || 0) <= w.tick) { if (it.active(w, e, c) !== false) e.itemState[key + ':cd'] = w.tick + sec(it.activeCd); } break; }
    }
  }
}
/**
 * What buying `key` takes right now: components already owned (anywhere down the build tree) are used up and knock
 * their cost off the price. Returns { price, consume: inventory indices, ok, reason } without changing anything;
 * `reason` is one of 'unknown' | 'owned' | 'group' | 'full' | 'gold' | '' (shop, bots and buy() all use this).
 */
export function purchasePlan(w, e, key) {
  const items = w.registry.items, it = items[key];
  if (!it) return { price: 0, consume: [], ok: false, reason: 'unknown' };
  const free = e.items.map(() => true), consume = [];
  const take = (k) => { // claim an owned copy of k, else claim its components
    for (let i = 0; i < e.items.length; i++) if (free[i] && e.items[i] === k) { free[i] = false; consume.push(i); return items[k].cost; }
    let saved = 0; for (const c of items[k].from) saved += take(c); return saved;
  };
  let saved = 0; for (const c of it.from) saved += take(c);
  const price = it.cost - saved;
  const kept = e.items.filter((_, i) => free[i]);
  const reason = it.unique && kept.includes(key) ? 'owned'
    : it.group && kept.some((k) => items[k].group === it.group) ? 'group'
    : kept.length >= RULES.MAX_ITEMS ? 'full'
    : e.gold < price ? 'gold' : '';
  return { price, consume, ok: !reason, reason };
}
export function buy(w, e, key) {
  if (!canShop(e)) return false;
  const plan = purchasePlan(w, e, key); if (!plan.ok) return false;
  const items = w.registry.items, it = items[key];
  // components are used up (their sell effects run, then the new item's buy effect)
  for (const i of [...plan.consume].sort((a, b) => b - a)) { const used = items[e.items[i]]; e.items.splice(i, 1); if (used.onSell) used.onSell(w, e); }
  e.gold -= plan.price; e.items.push(key); e.statsDirty = true;
  if (it.onBuy) it.onBuy(w, e);
  w.events.push(EV.ITEM_BOUGHT, w.tick, e.id, 0, e.x, e.y, plan.price, key);
  recomputeHero(w, e);
  return true;
}
export function sell(w, e, index) {
  if (!canShop(e) || index >= e.items.length) return false;
  const key = e.items[index]; const it = w.registry.items[key];
  if (e.heroState && e.heroState.repo && e.heroState.repo.kept && e.heroState.repo.key === key) return false;
  e.items.splice(index, 1); e.gold += Math.floor(it.cost * RULES.SELL_RATIO);
  if (it.onSell) it.onSell(w, e);
  recomputeHero(w, e); return true;
}

function clockSystem(w) {
  const t = w.tick, st = w.state;
  if (t >= st.nextWave) { spawnWave(w); st.nextWave = t + sec(RULES.WAVE_INTERVAL); }
  // whale roll: idle -> warn -> roll -> idle
  const wh = st.whale;
  if (wh.phase === 'idle' && t >= wh.next) {
    wh.phase = 'warn'; wh.dir = w.rng.chance(0.5) ? 1 : -1; wh.until = t + sec(RULES.WHALE_WARN);
    w.events.push(EV.WHALE_WARN, t, 0, 0, 0, 0, wh.dir);
  } else if (wh.phase === 'warn' && t >= wh.until) {
    wh.phase = 'roll'; wh.until = t + sec(RULES.WHALE_DURATION); w.events.push(EV.WHALE_ROLL, t, 0, 0, 0, 0, wh.dir);
  } else if (wh.phase === 'roll') {
    if (t % 6 === 0) for (const e of w.entities) {
      if (!e.alive || e.dead || e.kind === KIND.TOWER || e.kind === KIND.HEART) continue;
      if ((wh.dir > 0 && e.y > LANE.EDGE_MAX) || (wh.dir < 0 && e.y < LANE.EDGE_MIN)) dealDamage(w, null, e, RULES.WHALE_EDGE_DPS * 0.2 * (e.kind === 1 ? 1 : 2.5), DMG.TRUE, { source: 'edge' });
    }
    if (t >= wh.until) { wh.phase = 'idle'; wh.next = t + sec(RULES.WHALE_INTERVAL); w.events.push(EV.WHALE_END, t); }
  }
  // health relics
  if (t >= st.nextRelic) {
    for (const [x, y] of MAP.RELICS) if (!w.pickups.some((p) => p.x === x && p.y === y)) w.pickups.push({ id: t * 10 + w.pickups.length, x, y, born: t });
    st.nextRelic = t + sec(RULES.RELIC_INTERVAL);
    w.events.push(EV.RELIC, t, 0, 0, 0, 0, 1);
  }
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const p = w.pickups[i], nh = w.heroes.length;
    for (let k = 0; k < nh; k++) {
      const h = w.heroes[t & 1 ? nh - 1 - k : k]; // alternate who reaches a contested relic first
      if (h.dead) continue;
      if (sq(h.x - p.x) + sq(h.y - p.y) <= sq(RULES.RELIC_RADIUS + h.radius)) {
        heal(w, h, h, h.maxHp * RULES.RELIC_HEAL); h.mana = Math.min(h.maxMana, h.mana + h.maxMana * 0.15);
        w.events.push(EV.RELIC, t, h.id, 0, p.x, p.y, 0); w.pickups.splice(i, 1); break;
      }
    }
  }
  if (!st.suddenDeath && t >= sec(RULES.SUDDEN_DEATH)) { st.suddenDeath = true; w.events.push(EV.FX, t, 0, 0, 0, 0, 0, 'sudden-death'); }
  // sudden death: both Heartstones crack and lose health every second, so every match ends
  if (st.suddenDeath && t % TICK_HZ === 0) suddenDeathDecay(w, t);
}

/**
 * One second of sudden-death decay for both Heartstones at once. When both would shatter in the same second, only
 * one falls: the side with less Heartstone health before this second, then fewer enemy towers destroyed, fewer kills,
 * less gold earned; a seeded coin decides a perfect tie. (Decaying in structure order broke Blue's first in every
 * tie: 14% of bot matches, all lost by Blue.)
 */
function suddenDeathDecay(w, t) {
  const before = [0, 0], broken = [];
  for (const s of w.structures) if (s.alive && s.kind === KIND.HEART) {
    before[s.team] = s.hp; s.vulnerable = true; s.hp -= s.maxHp * RULES.SUDDEN_DEATH_HEART_DECAY;
    if (s.hp <= 0) broken.push(s);
  }
  if (!broken.length) return;
  const losing = broken.length === 1 ? broken[0].team : tiebreakLoser(w, before);
  const loser = broken.find((s) => s.team === losing);
  for (const s of broken) if (s !== loser) s.hp = 1;
  loser.hp = 0; w.events.push(EV.DEATH, t, loser.id, -1, loser.x, loser.y); w.onStructureDown(loser); w.despawn(loser);
}
/** The team that loses a simultaneous Heartstone break (see suddenDeathDecay). */
export function tiebreakLoser(w, heartHp) {
  const towersDown = [0, 0], kills = [0, 0], gold = [0, 0];
  for (const s of w.structures) if (s.kind === KIND.TOWER && (!s.alive || s.dead)) towersDown[1 - s.team]++;
  for (const h of w.heroes) { kills[h.team] += h.kills; gold[h.team] += h.gold + h.items.reduce((a, k) => a + ((w.registry.items[k] && w.registry.items[k].cost) || 0), 0); }
  for (const [b, r] of [[heartHp[0], heartHp[1]], [towersDown[0], towersDown[1]], [kills[0], kills[1]], [Math.round(gold[0]), Math.round(gold[1])]]) if (b !== r) return b < r ? TEAM.BLUE : TEAM.RED;
  return w.rng.chance(0.5) ? TEAM.BLUE : TEAM.RED;
}

const WAVE_ORDER_A = [TEAM.BLUE, TEAM.RED], WAVE_ORDER_B = [TEAM.RED, TEAM.BLUE];
function spawnWave(w) {
  const st = w.state; st.waveCount++;
  const minutes = w.tick / TICK_HZ / 60;
  const kinds = [KIND.MELEE, KIND.MELEE, KIND.MELEE, KIND.RANGED, KIND.RANGED, KIND.RANGED];
  if (st.waveCount % RULES.SIEGE_EVERY === 0) kinds.splice(3, 0, KIND.SIEGE);
  for (const team of (st.waveCount & 1 ? WAVE_ORDER_A : WAVE_ORDER_B)) { // alternate which side spawns (and gets ids) first
    kinds.forEach((kind, i) => {
      const spec = MINION[kind]; const g = 1 + spec.growth * minutes;
      const row = kind === KIND.MELEE ? 0 : kind === KIND.SIEGE ? 1 : 2;
      const col = i % 3;
      const e = w.spawn(kind, team, sideX(team, MAP.SPAWN_X - row * 70), 360 + col * 90);
      e.maxHp = e.hp = Math.round(spec.hp * g); e.baseAd = spec.ad * g; e.armor = e.baseArmor = spec.armor; e.mr = spec.mr;
      e.baseAs = spec.as; e.range = spec.range; e.baseSpeed = spec.speed; e.radius = spec.radius; e.projectileSpeed = spec.projectile;
      e.laneOffset = (col - 1) * 70; e.order = ORDER.MOVE; e.moveX = sideX(team, LANE.W - 300); e.moveY = 450;
    });
  }
}

function heroSystem(w) {
  const t = w.tick, nh = w.heroes.length;
  for (let k = 0; k < nh; k++) {
    const i = t & 1 ? nh - 1 - k : k, e = w.heroes[i]; // alternate the order every tick (team-neutral)
    const def = w.registry.heroes[e.heroKey];
    for (let s = 0; s < 4; s++) if (e.cds[s] > 0) e.cds[s]--;
    expireBuffs(w, e);
    if (e.spellCds[0] > 0) e.spellCds[0]--; if (e.spellCds[1] > 0) e.spellCds[1]--;
    if (e.dead) continue;
    if (t % TICK_HZ === 0) {
      const outOfCombat = t - e.lastCombatTick > sec(5);
      if (!def.noRegen) heal(w, null, e, e.hpRegen * (outOfCombat ? 2.5 : 1), true);
      e.mana = Math.min(e.maxMana, e.mana + e.manaRegen);
    }
    for (let k = 0; k < e.items.length; k++) { const it = w.registry.items[e.items[k]]; if (it && it.onTick) it.onTick(w, e); }
    if (def.onTick) def.onTick(w, e);
    if (e.statsDirty || t % 10 === i % 10) recomputeHero(w, e);
  }
}
function levelCheck(w, h) {
  const def = w.registry.heroes[h.heroKey];
  while (h.level < RULES.MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level); h.level++;
    h.ranks = ranksForLevel(h.level, def.rankOrder);
    const oldMax = h.maxHp; recomputeHero(w, h); h.hp += Math.max(0, h.maxHp - oldMax);
    if (def.onLevel) def.onLevel(w, h);
    w.events.push(EV.LEVEL_UP, w.tick, h.id, h.level, h.x, h.y);
  }
  if (h.level >= RULES.MAX_LEVEL) h.xp = 0;
}
function economySystem(w) {
  const t = w.tick;
  if (t % 3 === 0 && t > sec(RULES.FIRST_WAVE)) for (const h of w.heroes) h.gold += RULES.PASSIVE_GOLD_PER_SEC / 10;
  for (const h of w.heroes) {
    if (h.dead) {
      if (t >= h.respawnAt) {
        h.dead = false; h.hp = h.maxHp; h.mana = h.maxMana;
        let slot = 0; for (const x of w.heroes) { if (x === h) break; if (x.team === h.team) slot++; }
        h.x = h.px = sideX(h.team, MAP.FOUNTAIN_X + 40); h.y = h.py = 330 + slot * 120;
        h.order = ORDER.IDLE; h.targetId = -1; h.invulnUntil = t + sec(1);
        const def = w.registry.heroes[h.heroKey]; if (def.onRespawn) def.onRespawn(w, h);
        w.events.push(EV.RESPAWN, t, h.id, 0, h.x, h.y);
      }
      continue;
    }
  }
  // fountain: heal allies, shred enemies
  if (t % 3 === 0) for (const team of [TEAM.BLUE, TEAM.RED]) {
    const fx = sideX(team, MAP.FOUNTAIN_X);
    const list = FOUNT; list.length = 0;
    const ids = w.scratch, n = w.hash.query(fx, 450, MAP.FOUNTAIN_R + 130, ids);
    for (let i = 0; i < n; i++) { const u = w.entities[ids[i]]; if (u.alive && !u.dead && sq(u.x - fx) + sq(u.y - 450) <= sq(MAP.FOUNTAIN_R + u.radius)) list.push(u); }
    for (const u of list) {
      if (u.kind !== KIND.HERO && u.kind !== KIND.PEBBLE) { if (u.team !== team && u.kind !== KIND.TOWER && u.kind !== KIND.HEART) dealDamage(w, null, u, RULES.FOUNTAIN_DPS / 10, DMG.TRUE); continue; }
      if (u.team === team) { heal(w, null, u, u.maxHp * RULES.FOUNTAIN_HEAL_PCT / 10, true); u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.012); }
      else dealDamage(w, null, u, RULES.FOUNTAIN_DPS / 10, DMG.TRUE, FOUNTAIN_SRC);
    }
  }
}
const FOUNT = [], FOUNTAIN_SRC = Object.freeze({ source: 'fountain' });
function onStructureDown(w, s) {
  const mine = w.structures.filter((x) => x.team === s.team && x.alive && x !== s);
  if (s.kind === KIND.TOWER) {
    const next = mine.find((x) => x.tier === s.tier - 1);
    if (next) next.vulnerable = true;
  }
  if (s.kind === KIND.HEART) endMatch(w, 1 - s.team, s.x, s.y);
}
function endMatch(w, winner, x, y) {
  if (w.state.over) return;
  w.state.over = true; w.state.winner = winner;
  w.events.push(EV.MATCH_END, w.tick, winner, 0, x, y);
}
function winSystem() {}

/** Deterministic digest of gameplay state (positions, health, gold, rng). */
export function stateHash(w) {
  const h = new StateHasher();
  h.num(w.tick);
  for (const v of w.rng.getState()) h.num(v);
  for (const e of w.entities) {
    if (!e.alive) continue;
    h.num(e.id).num(e.kind).num(Math.round(e.x * 100)).num(Math.round(e.y * 100)).num(Math.round(e.hp)).num(e.dead ? 1 : 0);
    if (e.kind === KIND.HERO) h.num(Math.round(e.gold)).num(e.level).num(e.items.length);
  }
  for (const p of w.projectiles) h.num(Math.round(p.x)).num(Math.round(p.y));
  return h.digest();
}
