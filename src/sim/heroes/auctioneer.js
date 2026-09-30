// The Auctioneer: abilities cost gold, and his ultimate repossesses an enemy's best item.
import { KIND } from '../constants.js';
import { skillshot, dealDamage, DMG, scale, sec, fx, pickTarget, amount } from './kit.js';
import { stun, knock, giveGold } from '../damage.js';
import { recomputeHero } from '../stats.js';
import { hypot } from '../../core/dmath.js';

// Ability numbers: one declaration used by the cast and by tooltips (kit.amount).
const Q_VAL1 = { label: 'Magic damage', type: 'magic', base: [70, 110, 150, 190, 230], ratio: 0.6, stat: 'ap' };
const W_VAL1 = { label: 'Magic damage', type: 'magic', base: [30, 45, 60, 75, 90], ratio: 0.25, stat: 'ap' };
const E_VAL1 = { label: 'Magic damage', type: 'magic', base: [60, 90, 120, 150, 180], ratio: 0.45, stat: 'ap' };

export default {
  key: 'auctioneer', name: 'The Auctioneer', short: 'Auctioneer', title: 'Everything Has a Price', role: 'Utility mage', resource: 'gold', difficulty: 'Medium',
  rankOrder: ['Q', 'W', 'E'],
  build: ['lanternfish-lens', 'stormstep-sandals', 'kelp-crown', 'deepwater-codex', 'borrowed-seconds', 'stillwater-pendant'], // recommended items: shop highlights and bot purchase order
  passive: { name: 'Everything Has a Price', desc: 'Abilities cost gold instead of mana. Unspent gold earns interest (0.5% per second, up to 6 gold/s) and every assist pays 25 bonus gold.' },
  base: { hp: 560, hpL: 90, ad: 50, adL: 3, armor: 24, armorL: 4.2, mr: 30, mrL: 1.3, as: 0.65, asL: 0.02, range: 500, speed: 335, projectile: 1500, radius: 34 },
  init(world, e) { e.heroState = { repo: null }; },
  onTick(world, e) { // interest on unspent gold: 0.5% per second, max 6 gold/s
    if (world.tick % 30 === 0) e.gold += Math.min(6, e.gold * 0.005);
  },
  onAssist(world, e) { giveGold(world, e, 25); },
  abilities: {
    Q: { values: [Q_VAL1], name: 'Gavel', cd: 4, cost: 40, range: 900, freeTarget: true,
      desc: 'Skill shot that stuns briefly. Refunds its cost on hitting a hero.',
      cast(world, e, c) {
        const rank = c.rank;
        skillshot(world, e, c.x, c.y, { kind: 'auctioneer-gavel', speed: 1650, range: 900, radius: 45,
          onHit: (w, p, u) => {
            stun(w, u, 0.6, e);
            dealDamage(w, e, u, amount(e, Q_VAL1, rank), DMG.MAGIC, { ability: true });
            if (u.kind === KIND.HERO) { e.gold += 40; fx(w, e, 'auctioneer-refund', u.x, u.y, 40); }
          } });
      } },
    W: { values: [W_VAL1], name: 'Appraise', cd: [10, 9.5, 9, 8.5, 8], cost: 60, range: 800, freeTarget: true,
      desc: 'Mark an enemy: they take 15% more damage for 4 s.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 820, false, c.targetId);
        if (!t) return false;
        t.ampUntil = world.tick + sec(4); t.ampPct = 0.15 + 0.01 * c.rank;
        dealDamage(world, e, t, amount(e, W_VAL1, c.rank), DMG.MAGIC, { ability: true });
        fx(world, t, 'auctioneer-appraise', t.x, t.y, 4);
      } },
    E: { values: [E_VAL1], name: 'Going Once', cd: [14, 13, 12, 11, 10], cost: 80, range: 700, freeTarget: true,
      desc: 'Yank an enemy toward you.',
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 720, false, c.targetId);
        if (!t) return false;
        const d = hypot(e.x - t.x, e.y - t.y), pull = Math.max(0, Math.min(380, d - 160));
        knock(world, t, e.x - t.x, e.y - t.y, pull, 0.25, true, e);
        dealDamage(world, e, t, amount(e, E_VAL1, c.rank), DMG.MAGIC, { ability: true });
        fx(world, e, 'auctioneer-hook', t.x, t.y);
      } },
    R: { name: 'Repossess', cd: [90, 75, 60], cost: 300, range: 700, freeTarget: true,
      desc: "Steal an enemy's most expensive item for 8 s.",
      cast(world, e, c) {
        const t = pickTarget(world, e, c.rawX, c.rawY, 720, true, c.targetId);
        if (!t || !t.items.length || e.heroState.repo) return false;
        let bi = 0; for (let i = 1; i < t.items.length; i++) if (world.registry.items[t.items[i]].cost > world.registry.items[t.items[bi]].cost) bi = i;
        const key = t.items[bi], it = world.registry.items[key];
        t.items.splice(bi, 1); if (it.onSell) it.onSell(world, t); recomputeHero(world, t);
        const kept = e.items.length < 6;
        if (kept) { e.items.push(key); if (it.onBuy) it.onBuy(world, e); recomputeHero(world, e); }
        e.heroState.repo = { key, victim: t.id, index: bi, kept };
        fx(world, e, 'auctioneer-repossess', t.x, t.y, 8, t.id);
        world.schedule(sec(8), (w) => {
          const r = e.heroState.repo; if (!r) return;
          if (r.kept) { const k = e.items.indexOf(r.key); if (k >= 0) { e.items.splice(k, 1); if (it.onSell) it.onSell(w, e); recomputeHero(w, e); } }
          const v = w.get(r.victim);
          if (v) { if (v.items.length < 6) { v.items.splice(Math.min(r.index, v.items.length), 0, r.key); if (it.onBuy) it.onBuy(w, v); recomputeHero(w, v); } else v.gold += it.cost; }
          e.heroState.repo = null;
          fx(w, e, 'auctioneer-return', v ? v.x : e.x, v ? v.y : e.y);
        });
      } },
  },
};
