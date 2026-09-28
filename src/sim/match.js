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
  roster.forEach((r, i) => spawnHero(w, r, i));
  w.systems = [commandSystem, clockSystem, heroSystem, movementSystem, combatSystem, projectileSystem, zoneSystem, economySystem, winSystem];
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
  e.damagers = []; e.level = RULES.START_LEVEL; e.gold = RULES.START_GOLD; e.radius = def.base.radius || 36;
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
    if (e.dead && c.t !== CMD.BUY && c.t !== CMD.SELL) continue;
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
      case CMD.ITEM_ACTIVE: { const key = e.items[c.i]; const it = key && w.registry.items[key]; if (it && it.active && (e.itemState[key + ':cd'] || 0) <= w.tick) { if (it.active(w, e, c) !== false) e.itemState[key + ':cd'] = w.tick + sec(it.activeCd); } break; }
    }
  }
}
export function buy(w, e, key) {
  const it = w.registry.items[key];
  if (!it || !canShop(e) || e.items.length >= RULES.MAX_ITEMS || e.gold < it.cost) return false;
  if (it.unique && e.items.includes(key)) return false;
  e.gold -= it.cost; e.items.push(key); e.statsDirty = true;
  if (it.onBuy) it.onBuy(w, e);
  w.events.push(EV.ITEM_BOUGHT, w.tick, e.id, 0, e.x, e.y, it.cost, key);
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
    const p = w.pickups[i];
    for (const h of w.heroes) {
      if (h.dead) continue;
      if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 <= (RULES.RELIC_RADIUS + h.radius) ** 2) {
        heal(w, h, h, h.maxHp * RULES.RELIC_HEAL); h.mana = Math.min(h.maxMana, h.mana + h.maxMana * 0.15);
        w.events.push(EV.RELIC, t, h.id, 0, p.x, p.y, 0); w.pickups.splice(i, 1); break;
      }
    }
  }
  if (!st.suddenDeath && t >= sec(RULES.SUDDEN_DEATH)) { st.suddenDeath = true; w.events.push(EV.FX, t, 0, 0, 0, 0, 0, 'sudden-death'); }
  // sudden death: both Heartstones crack and lose health every second, so every match ends
  if (st.suddenDeath && t % TICK_HZ === 0) for (const s of w.structures) if (s.alive && s.kind === KIND.HEART) {
    s.vulnerable = s.vulnerable || true; s.hp -= s.maxHp * RULES.SUDDEN_DEATH_HEART_DECAY; if (s.hp <= 0) { s.hp = 0; w.events.push(EV.DEATH, t, s.id, -1, s.x, s.y); w.onStructureDown(s); w.despawn(s); break; }
  }
}

function spawnWave(w) {
  const st = w.state; st.waveCount++;
  const minutes = w.tick / TICK_HZ / 60;
  const kinds = [KIND.MELEE, KIND.MELEE, KIND.MELEE, KIND.RANGED, KIND.RANGED, KIND.RANGED];
  if (st.waveCount % RULES.SIEGE_EVERY === 0) kinds.splice(3, 0, KIND.SIEGE);
  for (const team of [TEAM.BLUE, TEAM.RED]) {
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
  const t = w.tick;
  for (let i = 0; i < w.heroes.length; i++) {
    const e = w.heroes[i];
    const def = w.registry.heroes[e.heroKey];
    for (let s = 0; s < 4; s++) if (e.cds[s] > 0) e.cds[s]--;
    if (e.spellCds[0] > 0) e.spellCds[0]--; if (e.spellCds[1] > 0) e.spellCds[1]--;
    if (e.dead) continue;
    if (t % TICK_HZ === 0) {
      const outOfCombat = t - e.lastCombatTick > sec(5);
      if (!def.noRegen) heal(w, e, e, e.hpRegen * (outOfCombat ? 2.5 : 1), true);
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
        const slot = w.heroes.filter((x) => x.team === h.team).indexOf(h);
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
    w.forEachInRadius(fx, 450, MAP.FOUNTAIN_R, team, 'any', (u) => {
      if (u.kind !== KIND.HERO && u.kind !== KIND.PEBBLE) { if (u.team !== team && u.kind !== KIND.TOWER && u.kind !== KIND.HEART) dealDamage(w, null, u, RULES.FOUNTAIN_DPS / 10, DMG.TRUE); return; }
      if (u.team === team) { heal(w, null, u, u.maxHp * RULES.FOUNTAIN_HEAL_PCT / 10, true); u.mana = Math.min(u.maxMana, u.mana + u.maxMana * 0.012); }
      else dealDamage(w, null, u, RULES.FOUNTAIN_DPS / 10, DMG.TRUE, { source: 'fountain' });
    }, true);
  }
}
function onStructureDown(w, s) {
  const mine = w.structures.filter((x) => x.team === s.team && x.alive && x !== s);
  if (s.kind === KIND.TOWER) {
    const next = mine.find((x) => x.tier === s.tier - 1);
    if (next) next.vulnerable = true;
  }
  if (s.kind === KIND.HEART) {
    w.state.over = true; w.state.winner = 1 - s.team;
    w.events.push(EV.MATCH_END, w.tick, w.state.winner, 0, s.x, s.y);
  }
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
