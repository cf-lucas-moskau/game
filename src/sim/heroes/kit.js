// Shared building blocks for hero abilities.
import { EV } from '../../core/events.js';
import { KIND, sec, LANE, isStructure } from '../constants.js';
import { dealDamage, DMG } from '../damage.js';
import { spawnProjectile } from '../projectile.js';
import { segDist2 } from '../../core/math.js';
import { byRank } from '../abilities.js';
export { DMG, dealDamage, byRank, sec };

export const scale = (rank, base, ratio, stat) => byRank(base, rank) + ratio * stat;
export const clampY = (y) => Math.max(LANE.MIN_Y, Math.min(LANE.MAX_Y, y));
export const fx = (world, e, name, x = e.x, y = e.y, v = 0, b = 0) => world.events.push(EV.FX, world.tick, e.id, b, x, y, v, name);
export const isHostileUnit = (u) => !isStructure(u.kind);

/** Straight skillshot. opts: { kind, speed, range, radius, pierce, onHit(world, p, target) } */
export function skillshot(world, e, tx, ty, opts) {
  return spawnProjectile(world, { owner: e.id, team: e.team, x: e.x, y: e.y, tx, ty, ...opts });
}
/** Apply fn to enemies (non-structures by default) in a circle. */
export function aoe(world, team, x, y, r, fn, withStructures = false) {
  const hit = [];
  world.forEachInRadius(x, y, r, team, 'enemy', (u) => { if (withStructures || !isStructure(u.kind)) hit.push(u); });
  for (const u of hit) fn(u); // collect first: fn may kill units and mutate the index
  return hit.length;
}
export function alliesInRadius(world, team, x, y, r) {
  const out = []; world.forEachInRadius(x, y, r, team, 'ally', (u) => { if (u.kind === KIND.HERO || u.kind === KIND.PEBBLE) out.push(u); }); return out;
}
/** Enemies within distance d of polyline pts. */
export function enemiesNearPolyline(world, team, pts, d) {
  const out = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) { minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]); minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, r = Math.hypot(maxX - minX, maxY - minY) / 2 + d;
  world.forEachInRadius(cx, cy, r, team, 'enemy', (u) => {
    if (isStructure(u.kind)) return;
    const rr = (d + u.radius) ** 2;
    for (let i = 0; i + 3 < pts.length; i += 2) if (segDist2(u.x, u.y, pts[i], pts[i + 1], pts[i + 2], pts[i + 3]) <= rr) { out.push(u); return; }
    if (pts.length === 2 && (u.x - pts[0]) ** 2 + (u.y - pts[1]) ** 2 <= rr) out.push(u);
  });
  return out;
}
/** Nearest enemy (hero preferred) to a point within maxRange of the caster. */
export function pickTarget(world, e, x, y, maxRange, heroesOnly = false, cmdTargetId = -1) {
  const direct = world.get(cmdTargetId);
  if (direct && direct.team !== e.team && !direct.dead && (!heroesOnly || direct.kind === KIND.HERO) && Math.hypot(direct.x - e.x, direct.y - e.y) <= maxRange + direct.radius) return direct;
  let best = null, bs = Infinity;
  world.forEachInRadius(e.x, e.y, maxRange, e.team, 'enemy', (u) => {
    if (isStructure(u.kind)) return;
    if (heroesOnly && u.kind !== KIND.HERO) return;
    let s = Math.hypot(u.x - x, u.y - y); if (u.kind === KIND.HERO) s -= 250;
    if (s < bs || (s === bs && u.id < best.id)) { bs = s; best = u; }
  });
  return best;
}
/** Forced dash over `seconds` to (tx,ty). onTick(world,e) runs each tick of the dash. */
export function dash(world, e, tx, ty, seconds, onTick = null, onEnd = null, fxName = '') {
  const ticks = Math.max(1, sec(seconds));
  e.dashVx = (tx - e.x) / ticks; e.dashVy = (clampY(ty) - e.y) / ticks; e.dashUntil = world.tick + ticks;
  e.onDashTick = onTick; e.windup = 0; e.dashFx = fxName;
  if (onEnd) world.schedule(ticks, (w) => { if (e.alive && !e.dead) onEnd(w, e); });
}
/** Clip a flat polyline to a maximum total length. */
export function clipPolyline(pts, maxLen) {
  if (!pts || pts.length < 4) return pts;
  const out = [pts[0], pts[1]]; let len = 0;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = out[out.length - 2], ay = out[out.length - 1], bx = pts[i], by = pts[i + 1];
    const seg = Math.hypot(bx - ax, by - ay);
    if (len + seg >= maxLen) { const k = (maxLen - len) / (seg || 1); out.push(ax + (bx - ax) * k, ay + (by - ay) * k); break; }
    len += seg; out.push(bx, by);
  }
  return out;
}
export function polylineLength(pts) { let l = 0; for (let i = 2; i < pts.length; i += 2) l += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return l; }
/** Shift a stroke drawn in world space so it starts within `range` of the caster. */
export function anchorStroke(e, pts, range) {
  const d = Math.hypot(pts[0] - e.x, pts[1] - e.y);
  if (d <= range) return pts;
  const k = (d - range) / d, ox = (pts[0] - e.x) * k, oy = (pts[1] - e.y) * k;
  const out = new Array(pts.length); for (let i = 0; i < pts.length; i += 2) { out[i] = pts[i] - ox; out[i + 1] = clampY(pts[i + 1] - oy); } return out;
}
