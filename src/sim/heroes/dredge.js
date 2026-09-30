// Dredge Harrow, the Anchorhand: hooks enemies in with his anchor and gets harder to sink as he bleeds.
import { KIND, LANE } from '../constants.js';
import { skillshot, aoe, dash, dealDamage, DMG, sec, fx, amount, clampY } from './kit.js';
import { slow, stun, knockUp, knock } from '../damage.js';
import { hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Physical damage', type: 'phys', base: [70, 105, 140, 175, 210], ratio: 0.8, stat: 'ad' };
const W_VAL = { label: 'Physical damage', type: 'phys', base: [50, 80, 110, 140, 170], ratio: 0.6, stat: 'ad' };
// Passive numbers (patchable by the simulation lab): damage reduction cap, reduction per missing health.
const T = { drCap: 0.2, drPerMissing: 0.25 };
const E_VAL = { label: 'Bonus damage (+6% of target max health)', type: 'phys', base: [30, 50, 70, 90, 110], ratio: 0.5, stat: 'ad' };
const R_VAL = { label: 'Physical damage', type: 'phys', base: [150, 250, 350], ratio: 1, stat: 'ad' };

export default {
  key: 'dredge', name: 'Dredge Harrow', title: 'the Anchorhand', role: 'Juggernaut', resource: 'none', difficulty: 'Easy',
  rankOrder: ['Q', 'W', 'E'],
  build: ['storm-cutlass', 'anchor-boots', 'barnacle-plate', 'leviathans-maw', 'molted-shell', 'stillwater-pendant'], // recommended items: shop highlights and bot purchase order
  tuning: T,
  base: { hp: 650, hpL: 104, ad: 64, adL: 3.8, armor: 32, armorL: 4.4, mr: 32, mrL: 1.6, as: 0.64, asL: 0.022, range: 180, speed: 335, radius: 38 },
  passive: { name: 'Heavy Chain', get desc() { return `Takes up to ${Math.round(T.drCap * 100)}% less damage the lower his health: 1% for every ${+(1 / T.drPerMissing).toFixed(1)}% missing.`; } },
  init(world, e) { e.heroState = { breachUntil: 0, breachRank: 1 }; },
  modifyDamageIn(world, e, amt) { return amt * (1 - Math.min(T.drCap, (1 - e.hp / e.maxHp) * T.drPerMissing)); },
  onBasicAttack(world, e, target, dmg) {
    const s = e.heroState;
    if (s.breachUntil <= world.tick || target.kind === KIND.TOWER || target.kind === KIND.HEART) return dmg;
    s.breachUntil = 0;
    stun(world, target, 0.75, e); fx(world, e, 'dredge-breach', target.x, target.y, 0, target.id);
    return dmg + amount(e, E_VAL, s.breachRank) + 0.06 * target.maxHp;
  },
  onRespawn(world, e) { e.heroState.breachUntil = 0; },
  abilities: {
    Q: { values: [Q_VAL], name: 'Anchor Toss', cd: [12, 11, 10, 9, 8], cost: 0, range: 800, freeTarget: true,
      desc: 'Hurls his anchor: the first enemy hit takes damage and is dragged 300 towards him.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'dredge-anchor', speed: 1500, range: 800, radius: 50,
          onHit: (w, p, u) => {
            dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.PHYS, { ability: true });
            const d = Math.min(300, Math.max(0, hypot(u.x - e.x, u.y - e.y) - 120));
            knock(w, u, e.x - u.x, e.y - u.y, d, 0.3, false, e); slow(w, u, 0.3, 1, e);
            fx(w, e, 'dredge-drag', u.x, u.y, 0, u.id);
          } });
      } },
    W: { values: [W_VAL], name: 'Deck Sweep', cd: [8, 7.5, 7, 6.5, 6], cost: 0,
      desc: 'Swings the chain around him: damage in 260 and a 30% slow for 1.5 s.',
      cast(world, e, c) {
        aoe(world, e.team, e.x, e.y, 260, (u) => { dealDamage(world, e, u, amount(e, W_VAL, c.rank), DMG.PHYS, { ability: true }); slow(world, u, 0.3, 1.5, e); });
        fx(world, e, 'dredge-sweep', e.x, e.y);
      } },
    E: { values: [E_VAL], name: 'Hull Breach', cd: [10, 9, 8, 7, 6], cost: 0, keepAttack: true,
      desc: 'His next attack within 4 s smashes through: bonus damage (+6% of the target\'s max health) and a 0.75 s stun.',
      cast(world, e, c) { e.heroState.breachUntil = world.tick + sec(4); e.heroState.breachRank = c.rank; e.attackCd = Math.min(e.attackCd, 3); fx(world, e, 'dredge-ready', e.x, e.y, 4); } },
    R: { values: [R_VAL], name: 'Drop Anchor', cd: [100, 85, 70], cost: 0, range: 650,
      desc: 'Leaps onto a spot and slams the anchor down: damage and a 1 s knock-up in 280.',
      cast(world, e, c) {
        const rank = c.rank, tx = Math.max(0, Math.min(LANE.W, c.x)), ty = clampY(c.y);
        e.invulnUntil = Math.max(e.invulnUntil, world.tick + sec(0.4));
        dash(world, e, tx, ty, 0.4, null, (w) => {
          aoe(w, e.team, e.x, e.y, 280, (u) => { dealDamage(w, e, u, amount(e, R_VAL, rank), DMG.PHYS, { ability: true }); knockUp(w, u, 1, e); });
          fx(w, e, 'dredge-slam', e.x, e.y);
        }, 'dredge-leap');
      } },
  },
};
