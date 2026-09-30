// Brindle, the Beekeeper: every hit grows the swarm; bees are spent on stings, shields and the Hive Dome.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { spawnProjectile } from '../projectile.js';
import { aoe, alliesInRadius, dealDamage, DMG, scale, sec, fx, pickTarget, amount } from './kit.js';
import { addShield, slow, heal } from '../damage.js';
import { hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Magic damage over 3 s', type: 'magic', base: [104, 150, 196, 242, 288], ratio: 0.6, stat: 'ap' };
const W_VAL1 = { label: 'Shield', type: 'shield', base: [104, 143, 182, 221, 260], ratio: 0.6, stat: 'ap' };
const R_VAL1 = { label: 'Heal per second', type: 'heal', base: [72, 108, 144], ratio: 0.2, stat: 'ap' };

const MAX_BEES = 20;
function addBee(world, e, n = 1) { e.resource = Math.min(MAX_BEES, e.resource + n); e.heroState.lastGain = world.tick; }
export default {
  key: 'brindle', name: 'Brindle', title: 'the Beekeeper', role: 'Support', resource: 'swarm', difficulty: 'Easy',
  rankOrder: ['W', 'Q', 'E'],
  build: ['stormcallers-horn', 'stormstep-sandals', 'coral-aegis', 'kelp-crown', 'tidewatch-hourglass', 'molted-shell'], // recommended items: shop highlights and bot purchase order
  passive: { name: 'Swarm', desc: 'Up to 20 bees orbit her. Hits add bees (more on heroes) and fights keep the hive buzzing; her spells spend bees.' },
  base: { hp: 580, hpL: 92, ad: 48, adL: 2.8, armor: 26, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.64, asL: 0.018, range: 500, speed: 335, projectile: 1300, radius: 32, mana: 0 },
  init(world, e) { e.resource = 8; e.maxResource = MAX_BEES; e.heroState = { lastGain: 0, hitTick: {} }; },
  onTick(world, e) {
    const s = e.heroState, t = world.tick, inCombat = t - e.lastCombatTick < sec(4);
    if (inCombat && t % sec(2) === 0) addBee(world, e); // the hive keeps buzzing in a fight
    else if (!inCombat && t - s.lastGain > sec(5) && t % sec(4) === 0 && e.resource > 0) e.resource--;
  },
  onDealtDamage(world, e, target, amount, type, opts) {
    if (opts.dot || target.kind === KIND.TOWER || target.kind === KIND.HEART) return;
    const s = e.heroState, last = s.hitTick[target.id] || -99;
    if (world.tick - last < 6) return; // one bee per target per 0.2 s
    s.hitTick[target.id] = world.tick; addBee(world, e, target.kind === KIND.HERO ? 2 : 1);
  },
  onRespawn(world, e) { e.resource = 8; },
  abilities: {
    Q: { values: [Q_VAL1], name: 'Sting', cd: [3, 3, 3, 3, 3], cost: 2, costType: 'swarm', range: 650, freeTarget: true,
      desc: 'Fling a clutch of bees at a target for damage over 3 s.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 700, false, c.targetId);
        if (!t) return false;
        const rank = c.rank;
        spawnProjectile(world, { kind: 'brindle-sting', owner: e.id, team: e.team, x: e.x, y: e.y, speed: 1100, targetId: t.id,
          onHit: (w, p, u) => {
            const total = amount(e, Q_VAL1, rank);
            dealDamage(w, e, u, total * 0.25, DMG.MAGIC, { ability: true });
            for (let k = 1; k <= 6; k++) w.schedule(sec(0.5 * k), (w2) => { if (u.alive && !u.dead) dealDamage(w2, e, u, total * 0.125, DMG.MAGIC, { dot: true }); });
            spawnZone(w, { kind: 'brindle-sting-dot', team: e.team, owner: e.id, x: u.x, y: u.y, duration: 3, data: { target: u.id } });
          } });
      } },
    W: { values: [W_VAL1], name: 'Buzz Shield', cd: [9, 8.5, 8, 7.5, 7], cost: 3, costType: 'swarm', range: 700, freeTarget: true,
      desc: 'Bees form a shield on an ally (or yourself).',
      cast(world, e, c) {
        let best = e, bd = hypot(c.rawX - e.x, c.rawY - e.y) - 120;
        for (const a of alliesInRadius(world, e.team, e.x, e.y, 700)) { if (a.kind !== KIND.HERO) continue; const d = hypot(a.x - c.rawX, a.y - c.rawY); if (d < bd) { bd = d; best = a; } }
        addShield(world, best, amount(e, W_VAL1, c.rank), 2.5, e);
        fx(world, best, 'brindle-shield', best.x, best.y, 2.5);
      } },
    E: { name: 'Honey Pool', cd: [12, 11.5, 11, 10.5, 10], cost: 0, costType: 'none', range: 700,
      desc: 'Sticky zone that slows enemies 30%.',
      cast(world, e, c) {
        spawnZone(world, { kind: 'brindle-honey', team: e.team, owner: e.id, x: c.x, y: c.y, r: 220, duration: 3, every: 0.2,
          onTick: (w, z) => aoe(w, z.team, z.x, z.y, z.r, (u) => slow(w, u, 0.3, 0.35, e)) });
      } },
    R: { values: [R_VAL1], name: 'Hive Dome', cd: [70, 60, 50], cost: 0, costType: 'none',
      desc: 'Needs 15+ bees. Consumes the swarm for a dome that slows enemies 50% and heals allies for 4 s.',
      cast(world, e, c) {
        if (e.resource < 15) return false;
        const bees = e.resource; e.resource = 0; const rank = c.rank, x = e.x, y = e.y;
        const healPerSec = amount(e, R_VAL1, rank) * (bees / 15);
        spawnZone(world, { kind: 'brindle-dome', team: e.team, owner: e.id, x, y, r: 340, duration: 4, every: 0.25,
          onTick: (w, z) => {
            aoe(w, z.team, z.x, z.y, z.r, (u) => slow(w, u, 0.5, 0.3, e));
            for (const a of alliesInRadius(w, z.team, z.x, z.y, z.r)) heal(w, e, a, healPerSec / 4, true);
          } });
        fx(world, e, 'brindle-dome', x, y, 4);
      } },
  },
};
