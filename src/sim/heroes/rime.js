// Rime Holloway, the Frostwright: every spell chills; three chills freeze, and Shatter cashes them in.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { skillshot, aoe, dealDamage, DMG, sec, fx, amount } from './kit.js';
import { slow, stun } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Magic damage', type: 'magic', base: [55, 85, 115, 145, 175], ratio: 0.5, stat: 'ap' };
const W_VAL = { label: 'Magic damage per second', type: 'magic', base: [25, 38, 51, 64, 77], ratio: 0.15, stat: 'ap' };
const E_VAL = { label: 'Magic damage per chill consumed', type: 'magic', base: [45, 70, 95, 120, 145], ratio: 0.35, stat: 'ap' };
const R_VAL = { label: 'Magic damage per second', type: 'magic', base: [60, 90, 120], ratio: 0.26, stat: 'ap' };

const MAX_CHILL = 3, CHILL_SEC = 4, FREEZE_SEC = 0.8, IMMUNE_SEC = 6;
/** Chill an enemy hero (one per call); at 3 it freezes (stun) and cannot be frozen again for 5 s. */
function chill(world, e, u) {
  if (u.kind !== KIND.HERO || u.dead) return;
  const s = e.heroState, t = world.tick; let c = s.chill.get(u.id);
  if (!c) { c = { n: 0, until: 0, immuneUntil: 0 }; s.chill.set(u.id, c); }
  if (c.until <= t) c.n = 0;
  c.n = Math.min(MAX_CHILL, c.n + 1); c.until = t + sec(CHILL_SEC);
  slow(world, u, 0.08 * c.n, CHILL_SEC * 0.5, e);
  if (c.n >= MAX_CHILL && c.immuneUntil <= t) { c.n = 0; c.immuneUntil = t + sec(IMMUNE_SEC); stun(world, u, FREEZE_SEC, e); fx(world, e, 'rime-freeze', u.x, u.y, FREEZE_SEC, u.id); }
}
export const chillOf = (world, e, u) => { const c = e.heroState.chill.get(u.id); return c && c.until > world.tick ? c.n : 0; };

export default {
  key: 'rime', name: 'Rime Holloway', title: 'the Frostwright', role: 'Control mage', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'E', 'W'],
  build: ['kelp-crown', 'stormstep-sandals', 'lanternfish-lens', 'deepwater-codex', 'borrowed-seconds', 'stillwater-pendant'], // recommended items: shop highlights and bot purchase order
  base: { hp: 560, hpL: 92, ad: 50, adL: 3, armor: 24, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.64, asL: 0.018, range: 520, speed: 330, mana: 400, manaL: 48, manaRegen: 3, projectile: 1500, radius: 32 },
  passive: { name: 'Deep Chill', desc: 'His spells chill enemy heroes (up to 3, 4 s; each slows 8%). The third chill freezes them for 0.8 s; frozen heroes cannot freeze again for 6 s.' },
  init(world, e) { e.heroState = { chill: new Map() }; },
  onTick(world, e) { if (world.tick % sec(2) === 0) { const t = world.tick; e.heroState.chill.forEach((c, id, m) => { if (c.until <= t && c.immuneUntil <= t) m.delete(id); }); } },
  abilities: {
    Q: { values: [Q_VAL], name: 'Icicle Lance', cd: [7, 6.5, 6, 5.5, 5], cost: [50, 55, 60, 65, 70], range: 900, freeTarget: true,
      desc: 'An icicle that pierces through everything in a line, chilling heroes it hits.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'rime-icicle', speed: 1600, range: 900, radius: 50, pierce: true,
          onHit: (w, p, u) => { dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.MAGIC, { ability: true }); chill(w, e, u); } });
      } },
    W: { values: [W_VAL], name: 'Frost Field', cd: [14, 13, 12, 11, 10], cost: 70, range: 750,
      desc: 'Frost spreads over an area for 3 s: slows 25%, damages and chills every second.',
      cast(world, e, c) {
        const rank = c.rank;
        spawnZone(world, { kind: 'rime-field', team: e.team, owner: e.id, x: c.x, y: c.y, r: 230, duration: 3, every: 0.25,
          onTick: (w, z) => {
            const second = (w.tick - z.born) % sec(1) === 0;
            aoe(w, z.team, z.x, z.y, z.r, (u) => { slow(w, u, 0.25, 0.4, e); if (second) { dealDamage(w, e, u, amount(e, W_VAL, rank), DMG.MAGIC, { ability: true, dot: true }); chill(w, e, u); } });
          } });
      } },
    E: { values: [E_VAL], name: 'Shatter', cd: [10, 9.5, 9, 8.5, 8], cost: 60,
      desc: 'Shatters the frost on every chilled enemy within 800: damage per chill consumed.',
      cast(world, e, c) {
        const rank = c.rank; let any = false;
        aoe(world, e.team, e.x, e.y, 800, (u) => {
          const n = chillOf(world, e, u); if (!n) return;
          any = true; e.heroState.chill.get(u.id).n = 0;
          dealDamage(world, e, u, amount(e, E_VAL, rank) * n, DMG.MAGIC, { ability: true }); fx(world, e, 'rime-shatter', u.x, u.y, n, u.id);
        });
        if (!any) return false; // nothing chilled: no cast, no cooldown
      } },
    R: { values: [R_VAL], name: 'Whiteout', cd: [100, 85, 70], cost: 100, range: 800,
      desc: 'After 0.8 s a blizzard rages for 3 s: damage and a chill every second, 40% slow.',
      cast(world, e, c) {
        const rank = c.rank;
        spawnZone(world, { kind: 'rime-whiteout', team: e.team, owner: e.id, x: c.x, y: c.y, r: 340, duration: 3.8, every: 0.2,
          onTick: (w, z) => {
            const age = w.tick - z.born; if (age < sec(0.8)) return;
            const second = (age - sec(0.8)) % sec(1) === 0;
            aoe(w, z.team, z.x, z.y, z.r, (u) => { slow(w, u, 0.4, 0.3, e); if (second) { dealDamage(w, e, u, amount(e, R_VAL, rank), DMG.MAGIC, { ability: true }); chill(w, e, u); } });
          } });
        fx(world, e, 'rime-whiteout-warn', c.x, c.y, 0.8);
      } },
  },
};
