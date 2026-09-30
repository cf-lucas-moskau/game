import { EV } from '../../core/events.js';
import { KIND, TICK_HZ, sec, isMinion, isStructure, STRUCT, LANE } from '../constants.js';
import { ORDER, isTargetable } from '../entity.js';
import { dealDamage, DMG } from '../damage.js';
import { canAct } from '../stats.js';
import { spawnProjectile } from '../projectile.js';
import { sin, cos, atan2, sq } from '../../core/dmath.js';

const inRange = (a, b, extra = 0) => {
  const r = a.range + a.radius + b.radius + extra; const dx = b.x - a.x, dy = b.y - a.y;
  return dx * dx + dy * dy <= r * r;
};

const BASIC = Object.freeze({ basic: true });
/** Called when a basic attack lands. */
export function basicHit(world, src, target) {
  if (!src.alive || src.dead || !target.alive || target.dead) return;
  let dmg = src.kind === KIND.HERO || src.kind === KIND.PEBBLE ? src.ad : src.baseAd;
  if (src.kind === KIND.TOWER) dmg = src.baseAd + STRUCT.TOWER.adPerMin * (world.tick / TICK_HZ / 60);
  if (isMinion(src.kind) && isStructure(target.kind)) dmg *= src.kind === KIND.SIEGE ? 3 : 1.3;
  if (src.kind === KIND.HERO && isStructure(target.kind)) dmg *= 1.0;
  if (src.kind === KIND.TOWER && isMinion(target.kind)) dmg = target.maxHp * (target.kind === KIND.SIEGE ? 0.14 : target.kind === KIND.MELEE ? 0.45 : 0.7);
  const opts = BASIC;
  const hero = src.kind === KIND.HERO ? world.registry.heroes[src.heroKey] : null;
  if (hero && hero.onBasicAttack) dmg = hero.onBasicAttack(world, src, target, dmg) ?? dmg;
  if (src.kind === KIND.HERO) for (const k of src.items) { const it = world.registry.items[k]; if (it && it.onBasicHit) it.onBasicHit(world, src, target); }
  dealDamage(world, src, target, dmg, DMG.PHYS, opts);
  src.attackCount++;
}

function startAttack(world, e, tg) {
  const period = Math.max(4, Math.round(TICK_HZ / Math.max(0.2, e.kind === KIND.HERO || e.kind === KIND.PEBBLE ? e.as : e.baseAs)));
  e.attackCd = period;
  e.windup = Math.max(2, Math.round(period * (e.kind === KIND.TOWER ? 0.15 : 0.3)));
  e.windupTarget = tg.id;
  e.facing = atan2(tg.y - e.y, tg.x - e.x);
  world.events.push(EV.AUTO_ATTACK, world.tick, e.id, tg.id, e.x, e.y, e.windup);
}
function releaseAttack(world, e) {
  const tg = world.get(e.windupTarget);
  e.windupTarget = -1;
  if (!tg || !isTargetable(tg, world.tick)) return;
  if (!inRange(e, tg, 120)) return;
  if (e.projectileSpeed > 0) {
    const kind = e.kind === KIND.TOWER ? 'tower-bolt' : e.kind === KIND.HERO ? `${e.heroKey}-auto` : e.kind === KIND.SIEGE ? 'siege-shot' : 'minion-bolt';
    spawnProjectile(world, { kind, owner: e.id, team: e.team, x: e.x, y: e.y, speed: e.projectileSpeed, targetId: tg.id, onHit: autoHit });
    if (e.kind === KIND.TOWER) world.events.push(EV.TOWER_SHOT, world.tick, e.id, tg.id, e.x, e.y);
  } else basicHit(world, e, tg);
}

const autoHit = (w, p, t) => { const s = w.get(p.owner); if (s) basicHit(w, s, t); };
export function combatSystem(world) {
  const es = world.entities, t = world.tick;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (!e.alive || e.dead || e.kind === KIND.HEART) continue;
    if (e.attackCd > 0) e.attackCd--;
    if (!canAct(world, e) || e.channelUntil > t || e.dashUntil > t) { e.windup = 0; continue; }
    if (e.windup > 0) { if (--e.windup === 0) releaseAttack(world, e); continue; }
    // AI targeting for non-player units
    if (isMinion(e.kind)) minionThink(world, e);
    else if (e.kind === KIND.TOWER) towerThink(world, e);
    else if (e.kind === KIND.PEBBLE && e.aiControlled) pebbleThink(world, e);
    else if (e.kind === KIND.HERO && e.order === ORDER.ATTACK_MOVE && (t + e.id) % 4 === 0) {
      const cur = world.get(e.targetId);
      if (!cur || !inRange(e, cur, 200)) { const n = world.nearestEnemy(e.x, e.y, e.range + 250, e.team, attackable); e.targetId = n ? n.id : -1; }
    }
    const tg = e.targetId >= 0 ? world.get(e.targetId) : null;
    if (!tg || !isTargetable(tg, t) || tg.team === e.team || (isStructure(tg.kind) && !tg.vulnerable)) {
      if (e.targetId >= 0) { e.targetId = -1; if (e.order === ORDER.ATTACK) e.order = ORDER.IDLE; }
      continue;
    }
    if (e.attackCd === 0 && inRange(e, tg)) startAttack(world, e, tg);
  }
}

// ---- unit AI --------------------------------------------------------------------
const attackable = (u) => !isStructure(u.kind) || u.vulnerable;
const notFortified = (u) => u.kind !== KIND.HEART && u.kind !== KIND.TOWER;
const Q = [];
function minionThink(world, e) {
  const t = world.tick;
  const goalX = e.team === 0 ? LANE.W - 300 : 300;
  const cur = world.get(e.targetId);
  const valid = cur && isTargetable(cur, t) && cur.team !== e.team && (!isStructure(cur.kind) || cur.vulnerable);
  if ((t + e.id) % 5 === 0 || !valid) {
    // call for help: enemy hero that hit an allied hero nearby recently
    let best = null, bestScore = Infinity;
    world.query(e.x, e.y, 520, e.team, 1, Q);
    for (let i = 0; i < Q.length; i++) {
      const u = Q[i];
      if (isStructure(u.kind) && !u.vulnerable) continue;
      let score = sq(u.x - e.x) + sq(u.y - e.y);
      if (u.kind === KIND.HERO) score += (t - (u.lastHeroHitTick || -9999) < sec(2)) ? -200000 : 400000;
      if (isStructure(u.kind)) score += 150000;
      if (score < bestScore || (score === bestScore && u.id < best.id)) { bestScore = score; best = u; }
    }
    if (best && (!valid || best.id !== e.targetId) && (!valid || bestScore < -100000 || !inRange(e, cur))) e.targetId = best.id;
    else if (!best) e.targetId = -1;
  }
  if (e.targetId >= 0) { e.order = ORDER.ATTACK; }
  else { e.order = ORDER.MOVE; e.moveX = goalX; e.moveY = 450 + (e.laneOffset || 0); }
}
function towerThink(world, e) {
  const t = world.tick;
  const cur = world.get(e.targetId);
  const valid = cur && isTargetable(cur, t) && inRange(e, cur, 0);
  // hero aggro: enemy hero that damaged an allied hero within range in the last 2 s
  let aggro = null;
  if ((t + e.id) % 3 === 0) {
    world.query(e.x, e.y, e.range, e.team, 1, Q);
    outer: for (let i = 0; i < Q.length; i++) {
      const u = Q[i];
      if (u.kind === KIND.HERO && t - (u.lastHeroHitTick || -9999) < sec(2)) {
        // was the hit against an ally inside tower range?
        for (const h of world.heroes) if (h.team === e.team && !h.dead && t - h.lastHeroDamageTick < sec(2) && sq(h.x - e.x) + sq(h.y - e.y) < sq(e.range + 200)) { aggro = u; break outer; }
      }
    }
  }
  if (aggro) { e.targetId = aggro.id; return; }
  if (valid) return;
  let best = null, bd = Infinity;
  world.query(e.x, e.y, e.range, e.team, 1, Q);
  for (let i = 0; i < Q.length; i++) {
    const u = Q[i]; if (u.kind === KIND.HEART) continue;
    let d = sq(u.x - e.x) + sq(u.y - e.y); if (u.kind === KIND.HERO || u.kind === KIND.PEBBLE) d += 1e7;
    if (d < bd || (d === bd && u.id < best.id)) { bd = d; best = u; }
  }
  e.targetId = best ? best.id : -1;
}
function pebbleThink(world, e) {
  const owner = world.get(e.ownerId);
  const t = world.tick;
  if ((t + e.id) % 4) return;
  const tg = world.get(e.targetId);
  if (tg && isTargetable(tg, t) && inRange(e, tg, 150)) return;
  const n = world.nearestEnemy(e.x, e.y, 420, e.team, notFortified);
  if (n) { e.targetId = n.id; e.order = ORDER.ATTACK; }
  else if (owner && !owner.dead) {
    e.targetId = -1;
    const d = Math.sqrt(sq(owner.x - e.x) + sq(owner.y - e.y));
    if (d > 260) { e.order = ORDER.MOVE; e.moveX = owner.x - 120 * cos(owner.facing); e.moveY = owner.y - 120 * sin(owner.facing); }
  }
}
