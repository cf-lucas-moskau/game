import { LANE, DT, KIND, RULES, isStructure } from '../constants.js';
import { ORDER } from '../entity.js';
import { moveSpeed, canMove } from '../stats.js';
import { blockingWall } from '../zones.js';
import { atan2, sq } from '../../core/dmath.js';

function tryMove(world, e, dx, dy) {
  const x0 = e.x, y0 = e.y;
  let x1 = x0 + dx, y1 = y0 + dy;
  const w = blockingWall(world, e, x0, y0, x1, y1);
  if (w) {
    // slide along the wall direction
    const wx = w.bx - w.ax, wy = w.by - w.ay, wl = Math.sqrt(sq(wx) + sq(wy)) || 1;
    const ux = wx / wl, uy = wy / wl, d = dx * ux + dy * uy;
    x1 = x0 + ux * d; y1 = y0 + uy * d;
    if (blockingWall(world, e, x0, y0, x1, y1)) return false;
  }
  e.x = x1; e.y = y1; return true;
}

export function movementSystem(world) {
  const t = world.tick, es = world.entities, whale = world.state.whale;
  const rolling = whale.phase === 'roll';
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (!e.alive || e.dead || isStructure(e.kind)) continue;
    if (e.dashUntil > t) {
      tryMove(world, e, e.dashVx, e.dashVy);
      if (e.onDashTick) e.onDashTick(world, e);
    } else if (e.knockUntil > t) {
      if (!tryMove(world, e, e.knockVx, e.knockVy)) e.knockUntil = t; // slammed into a wall
    } else if (canMove(world, e)) {
      let tx = 0, ty = 0, go = false, stopDist = 2;
      if (e.order === ORDER.MOVE || e.order === ORDER.ATTACK_MOVE) { tx = e.moveX; ty = e.moveY; go = true; }
      if (e.targetId >= 0 && (e.order === ORDER.ATTACK || e.order === ORDER.ATTACK_MOVE)) {
        const tg = world.get(e.targetId);
        if (tg && !tg.dead) { tx = tg.x; ty = tg.y; go = true; stopDist = e.range + e.radius + tg.radius - 8; }
      }
      if (go && e.windup === 0) {
        const dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(sq(dx) + sq(dy));
        if (d > stopDist) {
          const step = Math.min(d - stopDist + 1, moveSpeed(world, e) * DT);
          let ux = dx / d, uy = dy / d;
          if (!(e.targetId >= 0 && d < stopDist + 150)) { avoidStructures(world, e, ux, uy, ty); ux = AV.x; uy = AV.y; }
          tryMove(world, e, ux * step, uy * step);
          e.facing = atan2(uy, ux);
          e.moving = true;
        } else { e.moving = false; if (e.order === ORDER.MOVE) e.order = ORDER.IDLE; }
      } else e.moving = false;
    } else e.moving = false;
    if (rolling && !(e.itemState && e.itemState.magnet) && e.airborneUntil <= t) {
      tryMove(world, e, 0, whale.dir * RULES.WHALE_SLIDE * DT);
    }
    // lane bounds
    if (e.y < LANE.MIN_Y) e.y = LANE.MIN_Y; else if (e.y > LANE.MAX_Y) e.y = LANE.MAX_Y;
    if (e.x < 40) e.x = 40; else if (e.x > LANE.W - 40) e.x = LANE.W - 40;
  }
  separation(world);
}

const AV = { x: 0, y: 0 };
/** Steer around structures ahead so units flow around towers instead of piling up. */
function avoidStructures(world, e, ux, uy, goalY) {
  let ax = ux, ay = uy;
  for (const s of world.structures) {
    if (!s.alive) continue;
    const sx = s.x - e.x, sy = s.y - e.y, along = sx * ux + sy * uy;
    if (along <= 0 || along > 320) continue;
    const lateral = sx * -uy + sy * ux, clear = s.radius + e.radius + 20;
    if (Math.abs(lateral) >= clear) continue;
    let side = lateral > 0 ? -1 : 1;
    if (Math.abs(lateral) < 4) side = goalY >= s.y ? (ux > 0 ? 1 : -1) : (ux > 0 ? -1 : 1);
    const k = ((clear - Math.abs(lateral)) / clear) * 1.6;
    ax += -uy * side * k; ay += ux * side * k;
  }
  const l = Math.sqrt(sq(ax) + sq(ay)) || 1; AV.x = ax / l; AV.y = ay / l;
}
const MASS = { [KIND.HERO]: 3, [KIND.PEBBLE]: 5, [KIND.MELEE]: 1, [KIND.RANGED]: 1, [KIND.SIEGE]: 2 };
function separation(world) {
  const es = world.entities, out = world.scratch2, t = world.tick;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (!a.alive || a.dead || a.dashUntil > t) continue;
    const n = world.hash.query(a.x, a.y, a.radius + 130, out);
    for (let k = 0; k < n; k++) {
      const b = es[out[k]];
      if (b === a || !b.alive || b.dead) continue;
      const sa = isStructure(a.kind), sb = isStructure(b.kind);
      if (sa && sb) continue;
      if (!sa && !sb && b.id < a.id) continue; // each pair once
      if (sa) continue; // only move the non-structure side, handled when it is 'a'
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.radius + b.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01, overlap = rr - d, nx = d2 ? dx / d : 1, ny = d2 ? dy / d : 0;
      if (sb) { a.x -= nx * overlap; a.y -= ny * overlap; continue; }
      // heroes pass loosely through minions (soft), minions separate fully
      const soft = (a.kind === KIND.HERO || b.kind === KIND.HERO) ? 0.35 : 0.5;
      const ma = MASS[a.kind] || 1, mb = MASS[b.kind] || 1, tot = ma + mb;
      const push = overlap * soft;
      if (b.dashUntil <= t) { b.x += nx * push * (ma / tot); b.y += ny * push * (ma / tot); }
      a.x -= nx * push * (mb / tot); a.y -= ny * push * (mb / tot);
    }
  }
}
