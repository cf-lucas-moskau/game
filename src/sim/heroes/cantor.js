// Cantor Brightbell, the Songkeeper: keeps a beat. Spells cast on the beat ring out stronger.
import { spawnZone } from '../zones.js';
import { aoe, alliesInRadius, dash, dealDamage, DMG, sec, fx, amount, clampY } from './kit.js';
import { slow, stun, heal, haste } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Magic damage (+40% on the beat)', type: 'magic', base: [70, 105, 140, 175, 210], ratio: 0.55, stat: 'ap' };
const W_VAL = { label: 'Heal (+40% on the beat)', type: 'heal', base: [60, 90, 120, 150, 180], ratio: 0.4, stat: 'ap' };
const E_VAL = { label: 'Magic damage', type: 'magic', base: [60, 95, 130, 165, 200], ratio: 0.5, stat: 'ap' };
const R_VAL = { label: 'Magic damage per beat', type: 'magic', base: [55, 85, 115], ratio: 0.25, stat: 'ap' };
const R_VAL2 = { label: 'Heal per beat', type: 'heal', base: [20, 30, 40], ratio: 0.1, stat: 'ap' };

export const BEAT = 30;   // ticks between beats (one per second at 30 Hz)
export const WINDOW = 6;  // +- ticks around a beat that count as on the beat (0.2 s)
/** Ticks since his last beat (0 on the beat). The beat starts when he spawns. */
export const beatPhase = (world, e) => (world.tick - e.heroState.beat0) % BEAT;
export const onBeat = (world, e) => { const p = beatPhase(world, e); return p <= WINDOW || p >= BEAT - WINDOW; };
const empower = (world, e) => { if (!onBeat(world, e)) return 1; fx(world, e, 'cantor-onbeat', e.x, e.y); return 1.4; };

export default {
  key: 'cantor', name: 'Cantor Brightbell', title: 'the Songkeeper', role: 'Battle bard', resource: 'mana', difficulty: 'Hard',
  rankOrder: ['Q', 'W', 'E'],
  build: ['stormglass-orb', 'stormcallers-horn', 'quickcurrent-boots', 'kelp-crown', 'molted-shell', 'whalehide-vest'], // recommended items: shop highlights and bot purchase order
  base: { hp: 610, hpL: 100, ad: 54, adL: 3.2, armor: 30, armorL: 4.6, mr: 30, mrL: 1.5, as: 0.66, asL: 0.02, range: 480, speed: 335, mana: 360, manaL: 44, manaRegen: 3, projectile: 1500, radius: 32 },
  passive: { name: 'Tempo', desc: 'He keeps a beat, once a second. Spells cast within 0.2 s of the beat are 40% stronger and gain a bonus.' },
  init(world, e) { e.heroState = { beat0: world.tick, beat: BEAT, window: WINDOW }; }, // beat length and window are read by the presentation too
  abilities: {
    Q: { values: [Q_VAL], name: 'Crescendo', cd: [7, 6.5, 6, 5.5, 5], cost: [50, 55, 60, 65, 70], range: 460,
      desc: 'A wave of sound in a cone: damage and a 25% slow (45% on the beat).',
      cast(world, e, c) {
        const k = empower(world, e), dir = Math.atan2(c.y - e.y, c.x - e.x), half = Math.PI / 4;
        aoe(world, e.team, e.x, e.y, 480, (u) => {
          let a = Math.atan2(u.y - e.y, u.x - e.x) - dir; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > half) return;
          dealDamage(world, e, u, amount(e, Q_VAL, c.rank) * k, DMG.MAGIC, { ability: true }); slow(world, u, k > 1 ? 0.45 : 0.25, 1.5, e);
        });
        fx(world, e, 'cantor-crescendo', e.x, e.y, dir, k > 1 ? 1 : 0);
      } },
    W: { values: [W_VAL], name: 'Harmony', cd: [13, 12, 11, 10, 9], cost: 75,
      desc: 'Heals himself and allies within 450. On the beat: 40% more and 20% move speed for 1.5 s.',
      cast(world, e, c) {
        const k = empower(world, e);
        for (const a of alliesInRadius(world, e.team, e.x, e.y, 450)) { heal(world, e, a, amount(e, W_VAL, c.rank) * k * (a === e ? 0.7 : 1)); if (k > 1) haste(world, a, 0.2, 1.5); }
        fx(world, e, 'cantor-harmony', e.x, e.y, 0, k > 1 ? 1 : 0);
      } },
    E: { values: [E_VAL], name: 'Staccato', cd: [12, 11, 10, 9, 8], cost: 55, range: 380,
      desc: 'Leaps 380 and lands on a hard note: damage around him. On the beat the note stuns for 0.6 s.',
      cast(world, e, c) {
        const k = empower(world, e), rank = c.rank, a = Math.atan2(c.y - e.y, c.x - e.x);
        dash(world, e, e.x + Math.cos(a) * 380, clampY(e.y + Math.sin(a) * 380), 0.25, null, (w) => {
          aoe(w, e.team, e.x, e.y, 200, (u) => { dealDamage(w, e, u, amount(e, E_VAL, rank), DMG.MAGIC, { ability: true }); if (k > 1) stun(w, u, 0.6, e); });
          fx(w, e, 'cantor-staccato', e.x, e.y, 0, k > 1 ? 1 : 0);
        }, 'cantor-leap');
      } },
    R: { values: [R_VAL, R_VAL2], name: 'Encore', cd: [100, 85, 70], cost: 100,
      desc: 'For 6 s, every beat sends out a shockwave around him: damage to enemies, a heal to allies within 400.',
      cast(world, e, c) {
        const rank = c.rank;
        spawnZone(world, { kind: 'cantor-encore', team: e.team, owner: e.id, x: e.x, y: e.y, r: 400, duration: 6, every: 1, data: { follow: e.id },
          onTick: (w, z) => {
            if (e.dead) { z.until = w.tick; return; }
            if (beatPhase(w, e) !== 0) return;
            z.x = e.x; z.y = e.y;
            aoe(w, z.team, z.x, z.y, z.r, (u) => dealDamage(w, e, u, amount(e, R_VAL, rank), DMG.MAGIC, { ability: true }));
            for (const a of alliesInRadius(w, z.team, z.x, z.y, z.r)) heal(w, e, a, amount(e, R_VAL2, rank), true);
            fx(w, e, 'cantor-wave', z.x, z.y);
          } });
        fx(world, e, 'cantor-encore', e.x, e.y, 6);
      } },
  },
};
