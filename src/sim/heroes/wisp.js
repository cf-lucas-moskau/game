// Wisp Umbrel, the Duskmoth: an assassin of the dusk. Takedowns reset her spells.
import { KIND, LANE } from '../constants.js';
import { skillshot, dash, dealDamage, DMG, sec, fx, amount, pickTarget, clampY, byRank } from './kit.js';
import { haste, heal, slow } from '../damage.js';
import { EV } from '../../core/events.js';
import { sin, cos, atan2, hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Magic damage', type: 'magic', base: [92, 138, 184, 230, 276], ratio: 0.55, stat: 'ap', bonus: { ratio: 0.6, stat: 'ad' } };
const R_VAL = { label: 'Physical damage (+50% on dusk-marked, +50% below 30% health)', type: 'phys', base: [140, 230, 320], ratio: 1.1, stat: 'ad', bonus: { ratio: 0.5, stat: 'ap' } };

const ENERGY = 200, REGEN = 14, MARK_SEC = 4, SHADE_SEC = 3;
const W_CD = [14, 13, 12, 11, 10];

export default {
  key: 'wisp', name: 'Wisp Umbrel', title: 'the Duskmoth', role: 'Assassin', resource: 'energy', difficulty: 'Hard',
  rankOrder: ['Q', 'W', 'E'],
  build: ['storm-cutlass', 'swiftfin-treads', 'reefbreaker', 'cursed-coin', 'leviathans-maw', 'borrowed-seconds'], // recommended items: shop highlights and bot purchase order
  base: { hp: 1000, hpL: 112, ad: 66, adL: 3.8, armor: 30, armorL: 4.5, mr: 30, mrL: 1.4, as: 0.68, asL: 0.028, range: 160, speed: 375, radius: 30 },
  passive: { name: 'Eclipse', desc: 'When an enemy hero she damaged dies, her Q, W and E come off cooldown, she regains 60 energy and heals 12% of her max health.' },
  init(world, e) { e.resource = ENERGY; e.maxResource = ENERGY; e.heroState = { marks: new Map(), shadeUntil: 0, shadeX: 0, shadeY: 0 }; },
  onTick(world, e) {
    if (world.tick % 3 === 0) e.resource = Math.min(ENERGY, e.resource + REGEN / 10);
    if (world.tick % sec(2) === 0) { const t = world.tick; e.heroState.marks.forEach((u, id, m) => { if (u <= t) m.delete(id); }); }
  },
  onRespawn(world, e) { e.resource = ENERGY; e.heroState.shadeUntil = 0; },
  onTakedown(world, e, victim) {
    if (victim.kind !== KIND.HERO) return;
    e.cds[0] = 0; e.cds[1] = 0; e.cds[2] = 0; e.heroState.shadeUntil = 0; e.resource = Math.min(ENERGY, e.resource + 60);
    heal(world, e, e, e.maxHp * 0.12);
    fx(world, e, 'wisp-eclipse', e.x, e.y);
  },
  abilities: {
    Q: { values: [Q_VAL], name: 'Moth Swarm', cd: [7, 6.5, 6, 5.5, 5], cost: 50, range: 650, freeTarget: true,
      desc: 'Moths flutter out: the first enemy hit takes damage, is slowed 25% and is dusk-marked for 4 s.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'wisp-moths', speed: 1400, range: 650, radius: 55,
          onHit: (w, p, u) => {
            dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.MAGIC, { ability: true }); slow(w, u, 0.25, 1.25, e);
            if (u.kind === KIND.HERO) { e.heroState.marks.set(u.id, w.tick + sec(MARK_SEC)); fx(w, e, 'wisp-mark', u.x, u.y, MARK_SEC, u.id); }
          } });
      } },
    W: { name: 'Shadow Swap', range: 650,
      cd: (world, e, rank) => (e.heroState.shadeUntil > world.tick ? 0.4 : byRank(W_CD, rank)),
      cost: (world, e) => (e.heroState.shadeUntil > world.tick ? 0 : 50),
      desc: 'Casts her shade to a spot for 3 s. Cast again to swap places with it.',
      cast(world, e, c) {
        const s = e.heroState, t = world.tick;
        if (s.shadeUntil > t) { // swap with the shade
          const x0 = e.x, y0 = e.y; e.x = e.px = s.shadeX; e.y = e.py = s.shadeY; e.windup = 0; s.shadeUntil = 0;
          world.events.push(EV.BLINK, t, e.id, 0, x0, y0, 0, 'wisp-swap');
          return;
        }
        const a = atan2(c.y - e.y, c.x - e.x), d = Math.min(650, hypot(c.x - e.x, c.y - e.y));
        s.shadeX = Math.max(0, Math.min(LANE.W, e.x + cos(a) * d)); s.shadeY = clampY(e.y + sin(a) * d); s.shadeUntil = t + sec(SHADE_SEC);
        fx(world, e, 'wisp-shade', s.shadeX, s.shadeY, SHADE_SEC);
      } },
    E: { name: 'Dusk Veil', cd: [16, 15, 14, 13, 12], cost: 40,
      desc: 'Wraps herself in dusk: untargetable for 0.75 s and 30% faster for 1.5 s.',
      cast(world, e) { e.untargetableUntil = world.tick + sec(0.75); e.windup = 0; haste(world, e, 0.3, 1.5); fx(world, e, 'wisp-veil', e.x, e.y, 0.75); } },
    R: { values: [R_VAL], name: 'Eclipse Dive', cd: [70, 60, 50], cost: 0, range: 750,
      desc: 'Dives at an enemy hero: heavy damage, 50% more if dusk-marked (consumed) and 50% more below 30% health.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 770, true, c.targetId); if (!t) return false;
        const rank = c.rank, a = atan2(t.y - e.y, t.x - e.x), stop = t.radius + e.radius, d = Math.max(0, hypot(t.x - e.x, t.y - e.y) - stop);
        dash(world, e, e.x + cos(a) * d, e.y + sin(a) * d, 0.18, null, (w) => {
          if (t.dead || !t.alive) return;
          let dmg = amount(e, R_VAL, rank); const marks = e.heroState.marks;
          if ((marks.get(t.id) || 0) > w.tick) { dmg *= 1.5; marks.delete(t.id); }
          if (t.hp < t.maxHp * 0.3) dmg *= 1.5;
          dealDamage(w, e, t, dmg, DMG.PHYS, { ability: true }); fx(w, e, 'wisp-dive', t.x, t.y, 0, t.id);
          e.targetId = t.id; e.order = 2;
        }, 'wisp-dive');
      } },
  },
};
