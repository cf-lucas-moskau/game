// Targeting helpers shared by mouse/keyboard and touch input.
import { KIND, LANE } from '../sim/constants.js';

const alive = (e) => e && e.alive && !e.dead;
// Visual height of each kind of unit (render units), for picking what is drawn rather than the ground under it.
const BODY = { [KIND.HERO]: 1.4, [KIND.PEBBLE]: 1.3, [KIND.MELEE]: 1, [KIND.RANGED]: 1, [KIND.SIEGE]: 1.1, [KIND.TOWER]: 5, [KIND.HEART]: 2.6, [KIND.CRAB]: 0.9 };
// when a click falls inside several silhouettes, the smaller, more specific unit wins (a hero in front of a tower)
const RANK = { [KIND.HERO]: 0, [KIND.PEBBLE]: 1, [KIND.MELEE]: 2, [KIND.RANGED]: 2, [KIND.SIEGE]: 2, [KIND.CRAB]: 2, [KIND.TOWER]: 3, [KIND.HEART]: 3 };
const _a = { x: 0, y: 0, visible: false }, _b = { x: 0, y: 0, visible: false }, _c = { x: 0, y: 0, visible: false };
/**
 * Unit under a screen point, picked in screen space: each unit is a vertical segment from its feet to the top of
 * its body, as wide as it looks. A click on a hero's head picks the hero (a ground ray would land behind it).
 * sx, sy: canvas-relative CSS pixels. me: the player (allies score lower, so enemies win ties); any: include
 * untargetable units and everything else (inspection).
 */
export function screenPick(renderer, world, me, sx, sy, any = false, padPx = 10) {
  let best = null, bs = Infinity;
  for (const e of world.entities) {
    if (!alive(e) || e === me || (!any && e.untargetableUntil > world.tick)) continue;
    const top = BODY[e.kind] || 1;
    renderer.project(e.x, e.y, 0, _a); if (!_a.visible) continue;
    renderer.project(e.x, e.y, top, _b); renderer.project(e.x + e.radius, e.y, top * 0.5, _c);
    const half = Math.max(12, Math.abs(_c.x - (_a.x + _b.x) / 2) * 1.1);
    // distance from the point to the feet-to-head segment
    const vx = _b.x - _a.x, vy = _b.y - _a.y, l2 = vx * vx + vy * vy || 1, k = Math.max(0, Math.min(1, ((sx - _a.x) * vx + (sy - _a.y) * vy) / l2));
    const d = Math.hypot(sx - (_a.x + vx * k), sy - (_a.y + vy * k)) - half;
    if (d > padPx) continue;
    let s = d <= 0 ? -1000 + (RANK[e.kind] ?? 2) * 100 + d : d; if (me && e.team === me.team) s += 400;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
/** Auto-aim for touch quick casts and the attack button: nearest enemy hero in range, else nearest unit. */
export function autoTarget(world, me, range, { heroesOnly = false, allies = false } = {}) {
  let best = null, bs = Infinity;
  for (const e of world.entities) {
    if (!alive(e) || e === me || e.untargetableUntil > world.tick) continue;
    if (allies ? e.team !== me.team || e.kind !== KIND.HERO : e.team === me.team) continue;
    if (heroesOnly && e.kind !== KIND.HERO) continue;
    if ((e.kind === KIND.TOWER || e.kind === KIND.HEART) && !e.vulnerable) continue;
    const d = Math.sqrt((e.x - me.x) ** 2 + (e.y - me.y) ** 2);
    if (d > range + e.radius) continue;
    let s = d; if (e.kind === KIND.HERO) s -= 600; if (e.kind === KIND.TOWER || e.kind === KIND.HEART) s += 300;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
/** Lead a moving target by the projectile/cast delay. */
export function lead(e, seconds) { return { x: e.x + (e.x - e.px) * 30 * seconds, y: Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, e.y + (e.y - e.py) * 30 * seconds)) }; }
export function clampToRange(me, x, y, range) {
  const dx = x - me.x, dy = y - me.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d <= range || d === 0) return { x, y };
  return { x: me.x + dx / d * range, y: me.y + dy / d * range };
}
/** Point in front of the hero (touch quick cast with nothing in range). */
export const forward = (me, dist) => ({ x: me.x + Math.cos(me.facing) * dist, y: me.y + Math.sin(me.facing) * dist });
