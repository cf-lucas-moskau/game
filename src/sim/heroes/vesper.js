// Vesper, the Ink Sage: abilities are drawn. Strokes lash, closed loops root, lines become walls.
import { spawnZone, spawnWall } from '../zones.js';
import { enemiesNearPolyline, dealDamage, DMG, scale, sec, fx, clipPolyline, polylineLength, anchorStroke, clampY, amount } from './kit.js';
import { root } from '../damage.js';
import { pointInPoly } from '../../core/math.js';
import { isStructure } from '../constants.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Magic damage', type: 'magic', base: [60, 90, 120, 150, 180], ratio: 0.55, stat: 'ap' };
const W_VAL1 = { label: 'Magic damage', type: 'magic', base: [40, 60, 80, 100, 120], ratio: 0.3, stat: 'ap' };

const INK_MAX = 100, INK_REGEN = 14, CLOSE_DIST = 60;
const masterpiece = (world, e) => e.heroState.mpUntil > world.tick;
function straightStroke(e, x, y, len) {
  const a = Math.atan2(y - e.y, x - e.x);
  return [e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, e.x + Math.cos(a) * (60 + len), clampY(e.y + Math.sin(a) * (60 + len))];
}
function circleStroke(x, y, r, n = 14) { const p = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; p.push(x + Math.cos(a) * r, clampY(y + Math.sin(a) * r)); } return p; }
export const isClosed = (pts) => pts && pts.length >= 8 && Math.hypot(pts[0] - pts[pts.length - 2], pts[1] - pts[pts.length - 1]) <= CLOSE_DIST && polylineLength(pts) > 200;
const lashCost = (world, e, pts) => (masterpiece(world, e) ? 0 : Math.round(8 + polylineLength(pts) / 18));

export default {
  key: 'vesper', name: 'Vesper', title: 'the Ink Sage', role: 'Control mage', resource: 'ink', difficulty: 'Hard',
  rankOrder: ['Q', 'W', 'E'],
  base: { hp: 540, hpL: 88, ad: 50, adL: 3, armor: 22, armorL: 4, mr: 30, mrL: 1.3, as: 0.64, asL: 0.02, range: 550, speed: 330, projectile: 1500, radius: 32 },
  init(world, e) { e.resource = INK_MAX; e.maxResource = INK_MAX; e.heroState = { mpUntil: 0, lastDraw: -999 }; },
  onTick(world, e) {
    if (world.tick - e.heroState.lastDraw > sec(0.8) && world.tick % 3 === 0) e.resource = Math.min(INK_MAX, e.resource + INK_REGEN / 10);
  },
  onCast(world, e) { e.heroState.lastDraw = world.tick; },
  abilities: {
    Q: { values: [Q_VAL1], name: 'Lash', cd: [3, 2.8, 2.6, 2.4, 2.2], range: 550, freeTarget: true, drawn: 'stroke', maxLen: 400,
      cost: 0, desc: 'Drag to draw a stroke up to 400 long. It becomes a whip. Costs ink per length.',
      cast(world, e, c) {
        let pts = c.pts && c.pts.length >= 4 ? anchorStroke(e, c.pts, 550) : straightStroke(e, c.rawX, c.rawY, 380);
        pts = clipPolyline(pts, 400);
        const cost = lashCost(world, e, pts);
        if (e.resource < cost) return false;
        e.resource -= cost;
        const amp = masterpiece(world, e) ? 1.5 : 1;
        const rank = c.rank;
        fx(world, e, 'vesper-lash', pts[0], pts[1], 0); world.lastStroke = { owner: e.id, pts, kind: 'lash', tick: world.tick };
        world.schedule(sec(0.15), (w) => { for (const u of enemiesNearPolyline(w, e.team, pts, 45)) dealDamage(w, e, u, amount(e, Q_VAL1, rank) * amp, DMG.MAGIC, { ability: true }); });
        spawnZone(world, { kind: 'vesper-stroke', team: e.team, owner: e.id, x: pts[0], y: pts[1], duration: 0.6, data: { pts } });
      } },
    W: { values: [W_VAL1], name: 'Loop', cd: [10, 9.5, 9, 8.5, 8], cost: 30, range: 650, freeTarget: true, drawn: 'loop',
      desc: 'Draw a closed shape. Enemies inside are rooted for 1.2 s.',
      cast(world, e, c) {
        let pts = c.pts && c.pts.length >= 2 ? anchorStroke(e, c.pts, 650) : circleStroke(c.x, c.y, 160);
        if (!isClosed(pts)) { fx(world, e, 'vesper-fizzle', pts[0], pts[1]); return false; }
        pts = clipPolyline(pts, 1400);
        const poly = pts; const n = poly.length / 2; const amp = masterpiece(world, e) ? 1.5 : 1;
        let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += poly[i * 2]; cy += poly[i * 2 + 1]; } cx /= n; cy /= n;
        let r = 0; for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(poly[i * 2] - cx, poly[i * 2 + 1] - cy));
        const rank = c.rank;
        world.forEachInRadius(cx, cy, r, e.team, 'enemy', (u) => {
          if (isStructure(u.kind) || !pointInPoly(u.x, u.y, poly, n)) return;
          root(world, u, 1.2); dealDamage(world, e, u, amount(e, W_VAL1, rank) * amp, DMG.MAGIC, { ability: true });
        });
        spawnZone(world, { kind: 'vesper-loop', team: e.team, owner: e.id, x: cx, y: cy, r, duration: 1.2, data: { pts: poly } });
      } },
    E: { name: 'Stroke Wall', cd: [16, 15, 14, 13, 12], cost: 40, range: 600, freeTarget: true, drawn: 'stroke', maxLen: 500,
      desc: 'Draw a line that becomes an impassable wall for enemies for 3 s.',
      cast(world, e, c) {
        let pts;
        if (c.pts && c.pts.length >= 4) pts = clipPolyline(anchorStroke(e, c.pts, 600), 500);
        else { const a = Math.atan2(c.y - e.y, c.x - e.x) + Math.PI / 2; pts = [c.x - Math.cos(a) * 200, clampY(c.y - Math.sin(a) * 200), c.x + Math.cos(a) * 200, clampY(c.y + Math.sin(a) * 200)]; }
        for (let i = 0; i + 3 < pts.length; i += 2) spawnWall(world, { kind: 'ink-wall', team: e.team, owner: e.id, ax: pts[i], ay: pts[i + 1], bx: pts[i + 2], by: pts[i + 3], duration: 3 });
        spawnZone(world, { kind: 'vesper-wall', team: e.team, owner: e.id, x: pts[0], y: pts[1], duration: 3, data: { pts } });
      } },
    R: { name: 'Masterpiece', cd: [100, 85, 70], cost: 0,
      desc: 'For 5 s, every stroke is free and deals 50% more damage.',
      cast(world, e) { e.heroState.mpUntil = world.tick + sec(5); e.resource = INK_MAX; e.cds[0] = 0; e.cds[1] = 0; fx(world, e, 'vesper-masterpiece', e.x, e.y, 5); } },
  },
};
