// Targeting helpers shared by mouse/keyboard and touch input.
import { KIND, LANE } from '../sim/constants.js';

const alive = (e) => e && e.alive && !e.dead;
/** Unit under the cursor (enemy preferred), within its radius + pad. */
export function hoverTarget(world, me, x, y, pad = 55) {
  let best = null, bs = Infinity;
  for (const e of world.entities) {
    if (!alive(e) || e === me || e.untargetableUntil > world.tick) continue;
    const d = Math.sqrt((e.x - x) ** 2 + (e.y - y) ** 2) - e.radius;
    if (d > pad) continue;
    let s = d; if (e.team === me.team) s += 400; if (e.kind === KIND.HERO) s -= 25;
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
