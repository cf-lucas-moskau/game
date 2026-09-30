import { EV } from '../core/events.js';
import { DT } from './constants.js';
import { sq } from '../core/dmath.js';

// Projectiles live outside the entity table (they are not targetable).
// Straight skillshots, homing auto-attacks, boomerangs and piercing lines share one record.
let nextId = 1;
const HITS = [];
export function spawnProjectile(world, o) {
  const p = {
    id: nextId++, alive: true, kind: o.kind || 'bolt', owner: o.owner ?? -1, team: o.team,
    x: o.x, y: o.y, px: o.x, py: o.y, dirX: 0, dirY: 0, speed: o.speed || 1000,
    radius: o.radius ?? 20, maxDist: o.range ?? 1000, traveled: 0,
    targetId: o.targetId ?? -1, pierce: !!(o.pierce || o.boomerang), hits: (o.pierce || o.boomerang) ? [] : null,
    hitStructures: o.hitStructures ?? false, hitMinions: o.hitMinions ?? true,
    onHit: o.onHit || null, onEnd: o.onEnd || null, data: o.data || null,
    returning: false, boomerang: !!o.boomerang, arc: o.arc || 0, tx: o.tx ?? o.x, ty: o.ty ?? o.y, ground: !!o.ground,
    born: world.tick,
  };
  if (p.targetId < 0) {
    const dx = (o.tx ?? o.x + 1) - o.x, dy = (o.ty ?? o.y) - o.y, l = Math.sqrt(sq(dx) + sq(dy)) || 1;
    p.dirX = dx / l; p.dirY = dy / l;
  }
  world.projectiles.push(p);
  return p;
}
export function projectileSystem(world) {
  const list = world.projectiles;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]; if (!p.alive) continue;
    const step = p.speed * DT;
    if (p.targetId >= 0) { // homing
      const t = world.get(p.targetId);
      if (!t || t.dead) { p.alive = false; continue; }
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.sqrt(sq(dx) + sq(dy));
      if (d <= step + t.radius * 0.5) { p.x = t.x; p.y = t.y; if (p.onHit) p.onHit(world, p, t); p.alive = false; continue; }
      p.dirX = dx / d; p.dirY = dy / d; p.x += p.dirX * step; p.y += p.dirY * step;
      continue;
    }
    if (p.boomerang && p.returning) {
      const o = world.get(p.owner);
      if (!o || o.dead) { p.alive = false; continue; }
      const dx = o.x - p.x, dy = o.y - p.y, d = Math.sqrt(sq(dx) + sq(dy));
      if (d <= step + o.radius) { p.alive = false; if (p.onEnd) p.onEnd(world, p); continue; }
      p.dirX = dx / d; p.dirY = dy / d;
    }
    p.x += p.dirX * step; p.y += p.dirY * step; p.traveled += step;
    if (!p.ground) {
      world.query(p.x, p.y, p.radius, p.team, 1, HITS);
      for (let k = 0; k < HITS.length && p.alive; k++) {
        const e = HITS[k];
        if (!p.hitMinions && e.kind >= 2 && e.kind <= 4) continue;
        if (!p.hitStructures && (e.kind === 5 || e.kind === 6)) continue;
        if (p.pierce) { if (p.hits.includes(e.id)) continue; p.hits.push(e.id); if (p.onHit) p.onHit(world, p, e); }
        else { if (p.onHit) p.onHit(world, p, e); p.alive = false; world.events.push(EV.PROJECTILE_HIT, world.tick, e.id, p.owner, p.x, p.y, 0, p.kind); }
      }
    }
    if (p.alive && p.traveled >= p.maxDist) {
      if (p.boomerang && !p.returning) { p.returning = true; p.hits.length = 0; }
      else if (!p.boomerang || p.returning === false) { p.alive = false; if (p.onEnd) p.onEnd(world, p); }
    }
  }
  // compact without allocation churn
  let w = 0; for (let i = 0; i < list.length; i++) if (list[i].alive) list[w++] = list[i]; list.length = w;
}
