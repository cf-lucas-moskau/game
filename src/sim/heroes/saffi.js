// Saffi Blinkwick, the Candle: health is a flame that always burns down; hitting heroes relights it.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { aoe, enemiesNearPolyline, dash, dealDamage, DMG, scale, sec, fx, pickTarget, clampY, amount } from './kit.js';
import { slow } from '../damage.js';
import { EV } from '../../core/events.js';
import { sin, cos, atan2, hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Burn every 0.25 s', type: 'magic', base: [8, 12, 16, 20, 24], ratio: 0.06, stat: 'ad' };
const W_VAL1 = { label: 'Physical damage', type: 'phys', base: [55, 85, 115, 145, 175], ratio: 0.5, stat: 'ad' };
const E_VAL1 = { label: 'Physical damage (x2 below 30% health)', type: 'phys', base: [70, 105, 140, 175, 210], ratio: 0.8, stat: 'ad' };

const DRAIN = 0.015, RELIGHT = 0.04;
function relight(world, e, mult) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * RELIGHT * mult); }
export default {
  key: 'saffi', name: 'Saffi Blinkwick', title: 'the Candle', role: 'Assassin', resource: 'flame', difficulty: 'Hard',
  rankOrder: ['Q', 'E', 'W'], noRegen: true, selfHealOnly: true,
  build: ['iron-fin', 'harpoon-chain', 'quickcurrent-boots', 'cursed-coin', 'borrowed-seconds', 'whalehide-vest'], // recommended items: shop highlights and bot purchase order
  passive: { name: 'Wick', desc: 'Her health is a flame that slowly burns down (never below 5%) and ally heals do not reach it. Every hit on a hero relights it; a Wax-marked hero relights twice as much.' },
  base: { hp: 640, hpL: 100, ad: 66, adL: 3.8, armor: 30, armorL: 4.4, mr: 32, mrL: 1.6, as: 0.7, asL: 0.03, range: 150, speed: 350, radius: 32 },
  init(world, e) { e.heroState = { blazeUntil: 0 }; },
  onTick(world, e) {
    const t = world.tick;
    if (e.heroState.blazeUntil <= t && t % 3 === 0) {
      const loss = e.maxHp * DRAIN / 10;
      if (e.hp - loss > e.maxHp * 0.05) e.hp -= loss; // the wick gutters to 5% but never kills
    }
  },
  onDealtDamage(world, e, target, amount, type, opts) {
    if (target.kind !== KIND.HERO || opts.dot) return;
    let mult = 1;
    if (target.markUntil > world.tick && target.markBy === e.id) { mult = 2; target.markUntil = 0; fx(world, target, 'saffi-mark-pop'); }
    relight(world, e, mult);
  },
  onBasicAttack(world, e, target, dmg) {
    if (e.heroState.blazeUntil > world.tick) {
      aoe(world, e.team, target.x, target.y, 200, (u) => { if (u !== target) dealDamage(world, e, u, dmg * 0.4 + 0.3 * e.ap, DMG.MAGIC, { dot: true }); });
      fx(world, e, 'saffi-splash', target.x, target.y);
    }
    return dmg;
  },
  abilities: {
    Q: { values: [Q_VAL1], name: 'Flicker', cd: [5, 4.75, 4.5, 4.25, 4], cost: 0, range: 350,
      desc: 'Short blink that leaves a burning trail.',
      cast(world, e, c) {
        const x0 = e.x, y0 = e.y; e.x = e.px = c.x; e.y = e.py = clampY(c.y); e.windup = 0;
        world.events.push(EV.BLINK, world.tick, e.id, 0, x0, y0, 0, 'saffi-flicker');
        const rank = c.rank;
        spawnZone(world, { kind: 'saffi-trail', team: e.team, owner: e.id, x: x0, y: y0, x2: e.x, y2: e.y, r: 55, duration: 1.5, every: 0.25,
          onTick: (w, z) => { const pts = [z.x, z.y, z.x2, z.y2];
            for (const u of enemiesNearPolyline(w, z.team, pts, z.r)) dealDamage(w, e, u, amount(e, Q_VAL1, rank), DMG.MAGIC, { dot: true }); } });
      } },
    W: { values: [W_VAL1], name: 'Wax Drip', cd: [10, 9.5, 9, 8.5, 8], cost: 0, range: 400,
      desc: 'Cone that slows 40% and marks. Hitting a marked target restores double flame.',
      cast(world, e, c) {
        const dir = atan2(c.y - e.y, c.x - e.x), half = Math.PI / 5;
        aoe(world, e.team, e.x, e.y, 420, (u) => {
          let a = atan2(u.y - e.y, u.x - e.x) - dir; a = atan2(sin(a), cos(a));
          if (Math.abs(a) > half) return;
          slow(world, u, 0.4, 1.5, e); u.markUntil = world.tick + sec(3); u.markBy = e.id;
          dealDamage(world, e, u, amount(e, W_VAL1, c.rank), DMG.PHYS, { ability: true, dot: true });
        });
        fx(world, e, 'saffi-wax', e.x, e.y, dir);
      } },
    E: { values: [E_VAL1], name: 'Snuff', cd: [12, 11, 10, 9, 8], cost: 0, range: 550,
      desc: 'Dash to an enemy. Double damage below 30% health.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 580, false, c.targetId);
        if (!t) return false;
        const ang = atan2(t.y - e.y, t.x - e.x), stop = t.radius + e.radius;
        const d = Math.max(0, hypot(t.x - e.x, t.y - e.y) - stop);
        dash(world, e, e.x + cos(ang) * d, e.y + sin(ang) * d, 0.18, null, (w) => {
          if (t.dead || !t.alive) return;
          let dmg = amount(e, E_VAL1, c.rank);
          if (t.hp / t.maxHp < 0.3) { dmg *= 2; fx(w, t, 'saffi-snuff-exec'); }
          dealDamage(w, e, t, dmg, DMG.PHYS, { ability: true });
          e.targetId = t.id; e.order = 2;
        }, 'saffi-dash');
      } },
    R: { name: 'Blaze Up', cd: [90, 75, 60], cost: 0,
      desc: 'For 6 s the flame stops draining and attacks splash fire.',
      cast(world, e) { e.heroState.blazeUntil = world.tick + sec(6); fx(world, e, 'saffi-blaze', e.x, e.y, 6); } },
  },
  modifyStats(world, e) { return e.heroState && e.heroState.blazeUntil > world.tick ? { as: 0.35, ms: 30 } : null; },
};
