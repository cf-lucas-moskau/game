// Nimbus Kettle, the Stormherd: builds static on every hit; at full charge his attacks chain lightning.
import { KIND } from '../constants.js';
import { spawnZone } from '../zones.js';
import { skillshot, aoe, dealDamage, DMG, sec, fx, amount } from './kit.js';
import { slow, knock } from '../damage.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const P_VAL = { label: 'Chain lightning per target', type: 'magic', base: 30, ratio: 0.3, stat: 'ap', bonus: { ratio: 0.35, stat: 'ad' } };
const Q_VAL = { label: 'Magic damage (forks for 50%)', type: 'magic', base: [70, 105, 140, 175, 210], ratio: 0.6, stat: 'ap' };
const W_VAL = { label: 'Magic damage per strike', type: 'magic', base: [26, 39, 52, 65, 78], ratio: 0.2, stat: 'ap' };
const E_VAL = { label: 'Magic damage', type: 'magic', base: [50, 80, 110, 140, 170], ratio: 0.4, stat: 'ap' };
const R_VAL = { label: 'Magic damage per bolt', type: 'magic', base: [45, 70, 95], ratio: 0.22, stat: 'ap' };

const MAX_STATIC = 3;
/** One static charge per ability hit on a hero (lasts 6 s); at 3 the next basic attack chains. */
function charge(world, e) { const s = e.heroState; s.static = Math.min(MAX_STATIC, s.static + 1); s.staticUntil = world.tick + sec(6); }
/** Up to `n` enemies (heroes first) within r of (x, y), excluding `skip`, deterministic order. */
function nearest(world, e, x, y, r, n, skip) {
  const out = [];
  world.forEachInRadius(x, y, r, e.team, 'enemy', (u) => { if (u.kind !== KIND.TOWER && u.kind !== KIND.HEART && !skip.includes(u)) out.push(u); });
  out.sort((a, b) => (b.kind === KIND.HERO) - (a.kind === KIND.HERO) || ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2) || a.id - b.id);
  return out.slice(0, n);
}
const heroHit = (world, e, u) => { if (u.kind === KIND.HERO) charge(world, e); };

export default {
  key: 'nimbus', name: 'Nimbus Kettle', title: 'the Stormherd', role: 'Burst mage', resource: 'mana', difficulty: 'Medium',
  rankOrder: ['Q', 'W', 'E'],
  build: ['stormglass-orb', 'lanternfish-lens', 'quickcurrent-boots', 'kelp-crown', 'borrowed-seconds', 'cloudwool-cloak'], // recommended items: shop highlights and bot purchase order
  base: { hp: 555, hpL: 90, ad: 50, adL: 3, armor: 22, armorL: 4, mr: 30, mrL: 1.3, as: 0.64, asL: 0.018, range: 520, speed: 330, mana: 400, manaL: 48, manaRegen: 3.2, projectile: 1700, radius: 32 },
  passive: { name: 'Static Build', desc: 'Ability hits on heroes add static (up to 3, 6 s). At 3, his next attack chains lightning to 3 more enemies.', values: [P_VAL] },
  init(world, e) { e.heroState = { static: 0, staticUntil: 0 }; },
  onTick(world, e) { const s = e.heroState; if (s.static && s.staticUntil <= world.tick) s.static = 0; },
  onRespawn(world, e) { e.heroState.static = 0; },
  onBasicAttack(world, e, target, dmg) {
    const s = e.heroState; if (s.static < MAX_STATIC) return dmg;
    s.static = 0; let from = target; const hit = [target];
    const bolt = amount(e, P_VAL, 1);
    for (let i = 0; i < 3; i++) {
      const next = nearest(world, e, from.x, from.y, 380, 1, hit)[0]; if (!next) break;
      fx(world, e, 'nimbus-chain', next.x, next.y, 0, from.id); hit.push(next);
      dealDamage(world, e, next, bolt, DMG.MAGIC, { ability: true }); from = next;
    }
    dealDamage(world, e, target, bolt, DMG.MAGIC, { ability: true });
    return dmg;
  },
  abilities: {
    Q: { values: [Q_VAL], name: 'Forked Bolt', cd: [6, 5.5, 5, 4.5, 4], cost: [50, 55, 60, 65, 70], range: 850, freeTarget: true,
      desc: 'A bolt that forks on impact to two more enemies nearby for 50% damage.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'nimbus-bolt', speed: 1800, range: 850, radius: 45,
          onHit: (w, p, u) => {
            dealDamage(w, e, u, amount(e, Q_VAL, rank), DMG.MAGIC, { ability: true }); heroHit(w, e, u);
            for (const f of nearest(w, e, u.x, u.y, 320, 2, [u])) { fx(w, e, 'nimbus-chain', f.x, f.y, 0, u.id); dealDamage(w, e, f, amount(e, Q_VAL, rank) * 0.5, DMG.MAGIC, { ability: true }); heroHit(w, e, f); }
          } });
      } },
    W: { values: [W_VAL], name: 'Thunderhead', cd: [12, 11, 10, 9, 8], cost: [60, 65, 70, 75, 80], range: 800,
      desc: 'A storm cloud that strikes the enemy nearest its centre every 0.6 s for 3 s.',
      cast(world, e, c) {
        const rank = c.rank;
        spawnZone(world, { kind: 'nimbus-cloud', team: e.team, owner: e.id, x: c.x, y: c.y, r: 200, duration: 3, every: 0.6,
          onTick: (w, z) => {
            const u = nearest(w, e, z.x, z.y, z.r, 1, [])[0]; if (!u) return;
            fx(w, e, 'nimbus-strike', u.x, u.y);
            dealDamage(w, e, u, amount(e, W_VAL, rank), DMG.MAGIC, { ability: true, dot: true }); heroHit(w, e, u);
          } });
      } },
    E: { values: [E_VAL], name: 'Gale Push', cd: [13, 12, 11, 10, 9], cost: 60, range: 420,
      desc: 'A gust in a cone: damages, knocks enemies back 260 and slows 30% for 1 s.',
      cast(world, e, c) {
        const dir = Math.atan2(c.y - e.y, c.x - e.x), half = Math.PI / 4.5;
        aoe(world, e.team, e.x, e.y, 440, (u) => {
          let a = Math.atan2(u.y - e.y, u.x - e.x) - dir; a = Math.atan2(Math.sin(a), Math.cos(a));
          if (Math.abs(a) > half) return;
          dealDamage(world, e, u, amount(e, E_VAL, c.rank), DMG.MAGIC, { ability: true }); heroHit(world, e, u);
          knock(world, u, u.x - e.x, u.y - e.y, 260, 0.25); slow(world, u, 0.3, 1.25);
        });
        fx(world, e, 'nimbus-gale', e.x, e.y, dir);
      } },
    R: { values: [R_VAL], name: 'Eye of the Storm', cd: [100, 85, 70], cost: 100,
      desc: 'For 4 s a storm rings him: every 0.4 s lightning strikes an enemy within 420, preferring heroes. Enemies inside are slowed 20%.',
      cast(world, e, c) {
        const rank = c.rank;
        spawnZone(world, { kind: 'nimbus-eye', team: e.team, owner: e.id, x: e.x, y: e.y, r: 420, duration: 4, every: 0.4, data: { follow: e.id },
          onTick: (w, z) => {
            if (e.dead) { z.until = w.tick; return; }
            z.x = e.x; z.y = e.y;
            aoe(w, z.team, z.x, z.y, z.r, (u) => slow(w, u, 0.2, 0.5));
            const list = nearest(w, e, z.x, z.y, z.r, 3, []); if (!list.length) return;
            const u = list[(w.tick / 12 | 0) % list.length]; // rotate between the nearest three
            fx(w, e, 'nimbus-strike', u.x, u.y, 1);
            dealDamage(w, e, u, amount(e, R_VAL, rank), DMG.MAGIC, { ability: true }); heroHit(w, e, u);
          } });
        fx(world, e, 'nimbus-eye', e.x, e.y, 4);
      } },
  },
};
