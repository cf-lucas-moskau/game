// Old Thorne, the Skygardener: sows seeds that sprout into thornbushes, then makes the garden fight.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { skillshot, aoe, alliesInRadius, dealDamage, DMG, sec, fx, amount } from './kit.js';
import { slow, root, heal } from '../damage.js';
import { sin, cos, hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Thorn damage per shot', type: 'magic', base: [22, 32, 42, 52, 62], ratio: 0.16, stat: 'ap' };
const W_VAL = { label: 'Magic damage', type: 'magic', base: [60, 95, 130, 165, 200], ratio: 0.5, stat: 'ap' };
const E_VAL = { label: 'Damage per bush', type: 'magic', base: [40, 60, 80, 100, 120], ratio: 0.3, stat: 'ap' };
const E_VAL2 = { label: 'Heal per bush', type: 'heal', base: [25, 35, 45, 55, 65], ratio: 0.15, stat: 'ap' };
const R_VAL = { label: 'Magic damage', type: 'magic', base: [150, 240, 330], ratio: 0.6, stat: 'ap' };

const MAX_BUSHES = 3, SPROUT = 1, LIFE = 6, BUSH_R = 520;
/** His live thornbushes (zones), oldest first. */
const bushes = (world, e) => world.zones.filter((z) => z.alive && z.until > world.tick && z.kind === 'thorne-bush' && z.owner === e.id);
/**
 * Plant a seed that sprouts after 1 s into a thornbush shooting the nearest enemy (heroes first) every 1.2 s.
 * Sow keeps three bushes (the oldest withers); Grove Rising adds its five on top, up to eight in all.
 */
function sow(world, e, x, y, rank, keepThree) {
  const mine = bushes(world, e), cap = keepThree ? MAX_BUSHES : MAX_BUSHES + 5;
  for (let i = 0; i <= mine.length - cap; i++) mine[i].until = world.tick;
  return spawnZone(world, { kind: 'thorne-bush', team: e.team, owner: e.id, x, y, r: 60, duration: SPROUT + LIFE, every: 0.2, data: { rank, next: world.tick + sec(SPROUT) },
    onTick: (w, z) => {
      if (w.tick < z.data.next) return;
      let best = null, bs = Infinity;
      w.forEachInRadius(z.x, z.y, BUSH_R, z.team, 'enemy', (u) => { if (u.kind === KIND.TOWER || u.kind === KIND.HEART) return; const s = hypot(u.x - z.x, u.y - z.y) - (u.kind === KIND.HERO ? 300 : 0); if (s < bs || (s === bs && u.id < best.id)) { bs = s; best = u; } });
      if (!best) return;
      z.data.next = w.tick + sec(1.2);
      skillshot(w, e, best.x, best.y, { kind: 'thorne-thorn', x: z.x, y: z.y, speed: 1400, range: BUSH_R + 60, radius: 30,
        onHit: (w2, p, u) => dealDamage(w2, e, u, amount(e, Q_VAL, z.data.rank), DMG.MAGIC, { ability: true }) });
    } });
}
const sprouted = (world, z) => world.tick - z.born >= sec(SPROUT);

export default {
  key: 'thorne', name: 'Old Thorne', short: 'Thorne', title: 'the Skygardener', role: 'Zone mage', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'W', 'E'],
  build: ['kelp-crown', 'stormstep-sandals', 'tidewatch-hourglass', 'lanternfish-lens', 'molted-shell', 'stillwater-pendant'], // recommended items: shop highlights and bot purchase order
  base: { hp: 580, hpL: 94, ad: 48, adL: 3, armor: 26, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.62, asL: 0.018, range: 500, speed: 325, mana: 400, manaL: 46, manaRegen: 3.2, projectile: 1300, radius: 34 },
  passive: { name: 'Green Thumb', desc: 'Up to three thornbushes grow at once; each shoots thorns at the nearest enemy, heroes first.' },
  init(world, e) { e.heroState = {}; },
  abilities: {
    Q: { values: [Q_VAL], name: 'Sow', cd: [5, 4.75, 4.5, 4.25, 4], cost: [45, 50, 55, 60, 65], range: 750,
      desc: 'Throws a seed that sprouts after 1 s into a thornbush for 6 s. Three at most; the oldest withers.',
      cast(world, e, c) { sow(world, e, c.x, c.y, c.rank, true); fx(world, e, 'thorne-sow', c.x, c.y); } },
    W: { values: [W_VAL], name: 'Bramble Snare', cd: [12, 11, 10, 9, 8], cost: 65, range: 800, freeTarget: true,
      desc: 'A creeping vine: the first enemy hit takes damage and is rooted for 1.2 s, 1.8 s if a thornbush stands nearby.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'thorne-vine', speed: 1200, range: 800, radius: 55,
          onHit: (w, p, u) => {
            dealDamage(w, e, u, amount(e, W_VAL, rank), DMG.MAGIC, { ability: true });
            const near = bushes(w, e).some((z) => sprouted(w, z) && hypot(z.x - u.x, z.y - u.y) < 400);
            root(w, u, near ? 1.8 : 1.2, e); fx(w, e, 'thorne-snare', u.x, u.y, near ? 1.8 : 1.2, u.id);
          } });
      } },
    E: { values: [E_VAL, E_VAL2], name: 'Overgrowth', cd: [14, 13, 12, 11, 10], cost: 70,
      desc: 'Every thornbush pulses: damage to enemies near it, a heal to allies near it (and Thorne, per bush).',
      cast(world, e, c) {
        const mine = bushes(world, e).filter((z) => sprouted(world, z)); if (!mine.length) return false;
        for (const z of mine) {
          aoe(world, e.team, z.x, z.y, 260, (u) => { dealDamage(world, e, u, amount(e, E_VAL, c.rank), DMG.MAGIC, { ability: true }); slow(world, u, 0.25, 1, e); });
          for (const a of alliesInRadius(world, e.team, z.x, z.y, 260)) if (a !== e) heal(world, e, a, amount(e, E_VAL2, c.rank));
          heal(world, e, e, amount(e, E_VAL2, c.rank) * 0.6);
          fx(world, e, 'thorne-pulse', z.x, z.y);
        }
      } },
    R: { values: [R_VAL], name: 'Grove Rising', cd: [110, 95, 80], cost: 100, range: 800,
      desc: 'A grove bursts from the ground: damage and a 50% slow in 300 units, and five thornbushes ring the spot for 6 s.',
      cast(world, e, c) {
        const rank = c.rank;
        aoe(world, e.team, c.x, c.y, 300, (u) => { dealDamage(world, e, u, amount(e, R_VAL, rank), DMG.MAGIC, { ability: true }); slow(world, u, 0.5, 2, e); });
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; sow(world, e, c.x + cos(a) * 240, c.y + sin(a) * 240, rank, false); }
        fx(world, e, 'thorne-grove', c.x, c.y);
      } },
  },
};
