// Read-only helpers bots use to understand the world. Never mutate sim state here.
import { KIND, isMinion, isStructure, LANE } from '../sim/constants.js';

export const alive = (e) => e && e.alive && !e.dead;
export const d = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
export const hpr = (e) => e.hp / Math.max(1, e.maxHp);
export const fwd = (team) => (team === 0 ? 1 : -1);

export function velocity(e) { return { vx: (e.x - e.px) * 30, vy: (e.y - e.py) * 30 }; }
/** Predict position after t seconds from last-tick velocity. */
export function predict(e, t) { const v = velocity(e); return { x: e.x + v.vx * t, y: Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, e.y + v.vy * t)) }; }

/** Fill (and reuse) a snapshot object; arrays are cleared, never reallocated. */
export function snapshot(world, me, snap = { enemies: [], allies: [], enemyMinions: [], allyMinions: [] }) {
  const { enemies, allies, enemyMinions, allyMinions } = snap;
  enemies.length = allies.length = enemyMinions.length = allyMinions.length = 0;
  for (const h of world.heroes) if (alive(h) && h !== me) (h.team === me.team ? allies : enemies).push(h);
  let allyFront = null, enemyFront = null;
  const f = fwd(me.team);
  for (const e of world.entities) {
    if (!alive(e) || !isMinion(e.kind)) continue;
    if (e.team === me.team) { allyMinions.push(e); if (!allyFront || e.x * f > allyFront.x * f) allyFront = e; }
    else { enemyMinions.push(e); if (!enemyFront || e.x * f < enemyFront.x * f) enemyFront = e; }
  }
  snap.me = me; snap.allyFront = allyFront; snap.enemyFront = enemyFront;
  snap.enemyTower = nearestStructure(world, me, true); snap.allyTower = nearestStructure(world, me, false);
  return snap;
}
function nearestStructure(world, me, enemy) {
  let best = null, bd = Infinity;
  for (const s of world.structures) {
    if (!alive(s) || (s.team !== me.team) !== enemy) continue;
    if (enemy && !s.vulnerable) continue;
    const dd = d(s, me); if (dd < bd) { bd = dd; best = s; }
  }
  return best;
}
/** Rough fighting power: health * damage output, normalized. */
export const power = (h) => (h.hp + h.shield) * (h.ad * h.as + h.ap * 0.6 + 60) / 1000 * (1 + (h.level - 3) * 0.06);
export function underTower(snap, pt, margin = 0) {
  const t = snap.enemyTower; if (!t) return false;
  return Math.sqrt((pt.x - t.x) ** 2 + (pt.y - t.y) ** 2) < t.range + t.radius + margin;
}
export function minionsTankingTower(snap) {
  const t = snap.enemyTower; if (!t) return 0;
  let n = 0; for (const m of snap.allyMinions) if (Math.sqrt((m.x - t.x) ** 2 + (m.y - t.y) ** 2) < t.range + t.radius) n++;
  return n;
}
/** Going to `pt` means taking tower shots: inside the enemy tower's range with fewer than two allied minions tanking it. */
export const towerCovers = (snap, pt, margin = 0) => underTower(snap, pt, margin) && minionsTankingTower(snap) < 2;
export const isHero = (e) => e && e.kind === KIND.HERO;
export const structureTarget = (s) => s && isStructure(s.kind);
