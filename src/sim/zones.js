import { sec } from './constants.js';
import { segIntersects } from '../core/math.js';

// Ground zones (pools, domes, trails) and walls (drawn strokes that block movement).
let nextZone = 1;
export function spawnZone(world, o) {
  const z = { id: nextZone++, alive: true, kind: o.kind, team: o.team, owner: o.owner ?? -1, x: o.x, y: o.y, r: o.r || 100,
    x2: o.x2 ?? o.x, y2: o.y2 ?? o.y, poly: o.poly || null, born: world.tick, until: world.tick + sec(o.duration || 1),
    every: o.every ? Math.max(1, sec(o.every)) : 1, onTick: o.onTick || null, onEnd: o.onEnd || null, data: o.data || null };
  world.zones.push(z); return z;
}
export function spawnWall(world, o) {
  const w = { id: nextZone++, alive: true, kind: o.kind || 'ink-wall', team: o.team, owner: o.owner ?? -1,
    ax: o.ax, ay: o.ay, bx: o.bx, by: o.by, born: world.tick, until: world.tick + sec(o.duration || 3), blocksAllies: !!o.blocksAllies };
  world.walls.push(w); return w;
}
export function zoneSystem(world) {
  const t = world.tick;
  for (const z of world.zones) {
    if (!z.alive) continue;
    if (t >= z.until) { z.alive = false; if (z.onEnd) z.onEnd(world, z); continue; }
    if (z.onTick && (t - z.born) % z.every === 0) z.onTick(world, z);
  }
  for (const w of world.walls) if (w.alive && t >= w.until) w.alive = false;
  compact(world.zones); compact(world.walls);
}
function compact(a) { let w = 0; for (let i = 0; i < a.length; i++) if (a[i].alive) a[w++] = a[i]; a.length = w; }
/** Does moving e from (x0,y0) to (x1,y1) cross a wall that blocks it? Returns the wall or null. */
export function blockingWall(world, e, x0, y0, x1, y1) {
  for (const w of world.walls) {
    if (!w.alive || (w.team === e.team && !w.blocksAllies)) continue;
    if (segIntersects(x0, y0, x1, y1, w.ax, w.ay, w.bx, w.by)) return w;
  }
  return null;
}
