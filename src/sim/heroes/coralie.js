// Coralie Brine, the Reefwarden: the more she is hit, the more reef grows on her.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { aoe, dash, dealDamage, DMG, sec, fx, amount, clampY, enemiesNearPolyline } from './kit.js';
import { slow, root, knockUp, knock, addShield } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL = { label: 'Physical damage', type: 'phys', base: [60, 95, 130, 165, 200], ratio: 0.6, stat: 'ad', bonus: { ratio: 0.03, stat: 'maxHp' } };
const W_VAL = { label: 'Shield', type: 'shield', base: [60, 85, 110, 135, 160], ratio: 0.08, stat: 'maxHp' };
const W_VAL2 = { label: 'Burst when it ends', type: 'magic', base: [35, 50, 65, 80, 95], ratio: 0.03, stat: 'maxHp' };
const E_VAL = { label: 'Physical damage', type: 'phys', base: [40, 65, 90, 115, 140], ratio: 0.45, stat: 'ad' };
const R_VAL = { label: 'Magic damage', type: 'magic', base: [150, 250, 350], ratio: 0.06, stat: 'maxHp' };

const MAX_REEF = 6, PER_STACK = 2;
function grow(world, e, n) { const s = e.heroState; s.reef = Math.min(MAX_REEF, s.reef + n); s.lastGrow = world.tick; e.statsDirty = true; }

export default {
  key: 'coralie', name: 'Coralie Brine', title: 'the Reefwarden', role: 'Tank', resource: 'mana', difficulty: 'Easy',
  rankOrder: ['Q', 'W', 'E'],
  build: ['tidal-heart', 'barnacle-plate', 'magnet-boots', 'molted-shell', 'cloudwool-cloak', 'whalehide-vest'], // recommended items: shop highlights and bot purchase order
  base: { hp: 640, hpL: 104, ad: 58, adL: 3.4, armor: 34, armorL: 4.6, mr: 32, mrL: 1.8, as: 0.63, asL: 0.02, range: 175, speed: 335, mana: 320, manaL: 40, manaRegen: 2.6, radius: 38 },
  passive: { name: 'Living Reef', desc: 'Hits from heroes grow reef on her (up to 6 stacks): each gives 2 armor and magic resist. Out of combat the reef recedes.' },
  init(world, e) { e.heroState = { reef: 0, lastGrow: -999, shieldUntil: 0, shieldRank: 1 }; },
  onTick(world, e) {
    const s = e.heroState, t = world.tick;
    if (s.reef && t - s.lastGrow > sec(4) && t - e.lastCombatTick > sec(3) && t % sec(1.5) === 0) { s.reef--; e.statsDirty = true; }
    // Brine Bulwark bursts when the shield breaks or expires
    if (s.shieldUntil && (e.shield <= 0 || e.shieldUntil <= t || t >= s.shieldUntil)) {
      const rank = s.shieldRank; s.shieldUntil = 0;
      aoe(world, e.team, e.x, e.y, 280, (u) => dealDamage(world, e, u, amount(e, W_VAL2, rank), DMG.MAGIC, { ability: true }));
      fx(world, e, 'coralie-burst', e.x, e.y);
    }
  },
  onTookDamage(world, e, amt, attacker) { if (attacker && attacker.kind === KIND.HERO && amt > 0 && world.tick - e.heroState.lastGrow >= 8) grow(world, e, 1); },
  onRespawn(world, e) { e.heroState.reef = 0; e.heroState.shieldUntil = 0; e.statsDirty = true; },
  modifyStats(world, e) { const n = e.heroState ? e.heroState.reef : 0; return n ? { armor: n * PER_STACK, mr: n * PER_STACK } : null; },
  abilities: {
    Q: { values: [Q_VAL], name: 'Coral Spike', cd: [10, 9.5, 9, 8.5, 8], cost: [50, 55, 60, 65, 70], range: 650,
      desc: 'Coral erupts along a line after 0.4 s: damage and a 0.5 s knock-up.',
      cast(world, e, c) {
        const rank = c.rank, dir = Math.atan2(c.y - e.y, c.x - e.x), x0 = e.x, y0 = e.y, x1 = e.x + Math.cos(dir) * 650, y1 = clampY(e.y + Math.sin(dir) * 650);
        fx(world, e, 'coralie-spike-warn', x1, y1, dir);
        world.schedule(sec(0.4), (w) => {
          for (const u of enemiesNearPolyline(w, e.team, [x0, y0, x1, y1], 70)) { dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.PHYS, { ability: true }); knockUp(w, u, 0.5); }
          fx(w, e, 'coralie-spike', x1, y1, dir, 0);
        });
      } },
    W: { values: [W_VAL, W_VAL2], name: 'Brine Bulwark', cd: [14, 13, 12, 11, 10], cost: 60,
      desc: 'A shield for 3 s (stronger with reef). When it breaks or ends, brine bursts around her.',
      cast(world, e, c) {
        const s = e.heroState; addShield(world, e, amount(e, W_VAL, c.rank) * (1 + s.reef * 0.06), 3);
        s.shieldUntil = world.tick + sec(3); s.shieldRank = c.rank; fx(world, e, 'coralie-bulwark', e.x, e.y, 3);
      } },
    E: { values: [E_VAL], name: 'Undertow', cd: [12, 11, 10, 9, 8], cost: 55, range: 450,
      desc: 'Surge forward; enemies she passes are dragged along, damaged and slowed 35%.',
      cast(world, e, c) {
        const rank = c.rank, x0 = e.x, y0 = e.y, tx = c.x, ty = c.y, hit = [];
        dash(world, e, tx, ty, 0.3, (w, me) => {
          aoe(w, me.team, me.x, me.y, 110, (u) => { if (hit.includes(u.id)) return; hit.push(u.id); knock(w, u, tx - u.x, ty - u.y, Math.max(0, Math.hypot(tx - u.x, ty - u.y) - 60), 0.25); slow(w, u, 0.35, 1.5); dealDamage(w, e, u, amount(e, E_VAL, rank), DMG.PHYS, { ability: true }); });
        }, null, 'coralie-surge');
        fx(world, e, 'coralie-undertow', x0, y0, Math.atan2(ty - y0, tx - x0));
      } },
    R: { values: [R_VAL], name: 'Reef Bloom', cd: [110, 95, 80], cost: 100,
      desc: 'After 0.7 s a ring of coral erupts around her: damage and a 1 s root in 360 units. Her reef grows to full.',
      cast(world, e, c) {
        const rank = c.rank, x = e.x, y = e.y;
        spawnZone(world, { kind: 'coralie-bloom', team: e.team, owner: e.id, x, y, r: 360, duration: 0.7 });
        world.schedule(sec(0.7), (w) => {
          aoe(w, e.team, x, y, 360, (u) => { dealDamage(w, e, u, amount(e, R_VAL, rank), DMG.MAGIC, { ability: true }); root(w, u, 1); });
          if (!e.dead) grow(w, e, MAX_REEF);
          fx(w, e, 'coralie-bloom', x, y);
        });
      } },
  },
};
