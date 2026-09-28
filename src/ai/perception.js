// Read-only helpers bots use to understand the world. Never mutate sim state here.
import { KIND, isMinion, isStructure, LANE } from '../sim/constants.js';

export const alive = (e) => e && e.alive && !e.dead;
export const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const hpr = (e) => e.hp / Math.max(1, e.maxHp);
export const fwd = (team) => (team === 0 ? 1 : -1);

export function velocity(e) { return { vx: (e.x - e.px) * 30, vy: (e.y - e.py) * 30 }; }
/** Predict position after t seconds from last-tick velocity. */
export function predict(e, t) { const v = velocity(e); return { x: e.x + v.vx * t, y: Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, e.y + v.vy * t)) }; }

export function snapshot(world, me) {
  const enemies = [], allies = [], enemyMinions = [], allyMinions = [];
  for (const h of world.heroes) if (alive(h) && h !== me) (h.team === me.team ? allies : enemies).push(h);
  let allyFront = null, enemyFront = null;
  const f = fwd(me.team);
  for (const e of world.entities) {
    if (!alive(e) || !isMinion(e.kind)) continue;
    if (e.team === me.team) { allyMinions.push(e); if (!allyFront || e.x * f > allyFront.x * f) allyFront = e; }
    else { enemyMinions.push(e); if (!enemyFront || e.x * f < enemyFront.x * f) enemyFront = e; }
  }
  const enemyTower = nearestStructure(world, me, true), allyTower = nearestStructure(world, me, false);
  return { me, enemies, allies, enemyMinions, allyMinions, allyFront, enemyFront, enemyTower, allyTower };
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
  return Math.hypot(pt.x - t.x, pt.y - t.y) < t.range + t.radius + margin;
}
export function minionsTankingTower(snap) {
  const t = snap.enemyTower; if (!t) return 0;
  let n = 0; for (const m of snap.allyMinions) if (Math.hypot(m.x - t.x, m.y - t.y) < t.range + t.radius) n++;
  return n;
}
export const isHero = (e) => e && e.kind === KIND.HERO;
export const structureTarget = (s) => s && isStructure(s.kind);
