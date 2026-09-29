// Kestrel Vane, the Harpooner: a long-range marksman whose every fourth shot bites deep.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { skillshot, aoe, dash, dealDamage, DMG, sec, fx, amount, clampY } from './kit.js';
import { slow, root } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const P_VAL = { label: 'Deadeye bonus (every 4th attack)', type: 'phys', base: 15, ratio: 0.45, stat: 'ad' };
const Q_VAL = { label: 'Physical damage', type: 'phys', base: [60, 95, 130, 165, 200], ratio: 0.9, stat: 'ad' };
const E_VAL = { label: 'Empowered attack bonus', type: 'phys', base: [30, 50, 70, 90, 110], ratio: 0.4, stat: 'ad' };
const R_VAL = { label: 'Physical damage (+40% below half health)', type: 'phys', base: [220, 360, 500], ratio: 1.6, stat: 'ad' };

export default {
  key: 'kestrel', name: 'Kestrel Vane', title: 'the Harpooner', role: 'Marksman', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'E', 'W'],
  build: ['iron-fin', 'harpoon-chain', 'quickcurrent-boots', 'cursed-coin', 'borrowed-seconds', 'whalehide-vest'], // recommended items: shop highlights and bot purchase order
  base: { hp: 560, hpL: 92, ad: 56, adL: 3.4, armor: 24, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.68, asL: 0.03, range: 560, speed: 330, mana: 320, manaL: 38, manaRegen: 2.6, projectile: 2200, radius: 32 },
  passive: { name: 'Deadeye', desc: 'Every fourth attack deals bonus damage and slows 25% for 1 s.', values: [P_VAL] },
  init(world, e) { e.heroState = { shots: 0, rollUntil: 0, rollRank: 1 }; },
  onRespawn(world, e) { e.heroState.shots = 0; e.heroState.rollUntil = 0; },
  onBasicAttack(world, e, target, dmg) {
    const s = e.heroState, t = world.tick;
    if (s.rollUntil > t) { s.rollUntil = 0; dmg += amount(e, E_VAL, s.rollRank); fx(world, e, 'kestrel-roll-shot', target.x, target.y); }
    if (++s.shots >= 4) { s.shots = 0; dmg += amount(e, P_VAL, 1); slow(world, target, 0.25, 1); fx(world, e, 'kestrel-deadeye', target.x, target.y); }
    return dmg;
  },
  abilities: {
    Q: { values: [Q_VAL], name: 'Tether Harpoon', cd: [12, 11, 10, 9, 8], cost: [45, 50, 55, 60, 65], range: 900, freeTarget: true,
      desc: 'A harpoon: damages the first enemy hit; if it is a hero, she reels in 260 towards it.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'kestrel-harpoon', speed: 2000, range: 900, radius: 40,
          onHit: (w, p, u) => {
            dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.PHYS, { ability: true });
            if (u.kind === KIND.HERO && !e.dead) { const a = Math.atan2(u.y - e.y, u.x - e.x), d = Math.min(260, Math.max(0, Math.hypot(u.x - e.x, u.y - e.y) - 150)); dash(w, e, e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 0.2, null, null, 'kestrel-reel'); }
            fx(w, e, 'kestrel-reel', u.x, u.y, 0, u.id);
          } });
      } },
    W: { name: 'Drift Net', cd: [16, 15, 14, 13, 12], cost: 70, range: 750,
      desc: 'Throws a net that lands after 0.5 s, rooting enemies inside for 1.1 s.',
      cast(world, e, c) {
        const x = c.x, y = c.y;
        spawnZone(world, { kind: 'kestrel-net', team: e.team, owner: e.id, x, y, r: 170, duration: 0.5 });
        world.schedule(sec(0.5), (w) => { aoe(w, e.team, x, y, 170, (u) => root(w, u, 1.1)); fx(w, e, 'kestrel-net', x, y); });
      } },
    E: { values: [E_VAL], name: 'Updraft Roll', cd: [11, 10, 9, 8, 7], cost: 40, range: 320,
      desc: 'Rolls 320 on a gust; her next attack within 3 s deals bonus damage.',
      cast(world, e, c) {
        const a = Math.atan2(c.y - e.y, c.x - e.x);
        dash(world, e, e.x + Math.cos(a) * 320, clampY(e.y + Math.sin(a) * 320), 0.22, null, null, 'kestrel-roll');
        e.heroState.rollUntil = world.tick + sec(3); e.heroState.rollRank = c.rank; e.attackCd = Math.min(e.attackCd, 2);
      } },
    R: { values: [R_VAL], name: 'Skyline Shot', cd: [90, 75, 60], cost: 100, range: 2400, freeTarget: true, castTime: 0.6,
      desc: 'After 0.6 s, a shot across the whole lane that hits the first hero in its path.',
      cast(world, e, c) {
        const rank = c.rank, tx = c.x, ty = c.y;
        fx(world, e, 'kestrel-aim', tx, ty, Math.atan2(ty - e.y, tx - e.x));
        world.schedule(sec(0.6), (w) => {
          if (e.dead) return;
          skillshot(w, e, tx, ty, { kind: 'kestrel-skyline', speed: 4200, range: 2400, radius: 55, hitMinions: false,
            onHit: (w2, p, u) => { let d = amount(e, R_VAL, rank); if (u.hp < u.maxHp * 0.5) d *= 1.4; dealDamage(w2, e, u, d, DMG.PHYS, { ability: true }); } });
        });
      } },
  },
};
