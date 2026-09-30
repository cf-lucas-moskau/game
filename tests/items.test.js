import { describe, it, expect } from 'vitest';
import { createMatch, buy, purchasePlan } from '../src/sim/match.js';
import { castCmd, buyCmd, moveCmd } from '../src/sim/commands.js';
import { CONTENT } from '../src/sim/content.js';
import { ITEMS } from '../src/sim/items/index.js';
import { dealDamage, DMG, stun } from '../src/sim/damage.js';
import { sec } from '../src/sim/constants.js';

const duel = (a, b) => createMatch({ seed: 3, content: CONTENT, roster: [{ playerId: 0, heroKey: a, team: 0 }, { playerId: 1, heroKey: b, team: 1 }] });
const steps = (w, n, f = () => []) => { for (let i = 0; i < n; i++) w.step(f(i)); };
const place = (e, x, y) => { e.x = e.px = x; e.y = e.py = y; };

describe('items', () => {
  it('buying applies stats and is only allowed in base or while dead', () => {
    const w = duel('morrow', 'saffi'); const m = w.heroes[0];
    const ad = m.ad; steps(w, 1, () => [buyCmd(0, 'iron-fin')]);
    expect(m.ad).toBe(ad + 35); expect(m.gold).toBeLessThan(1400 - 1000);
    place(m, 2000, 450); m.gold = 5000; steps(w, 1, () => [buyCmd(0, 'iron-fin')]);
    expect(m.items.length).toBe(1);
  });
  it('unique items cannot be stacked and inventory caps at 6', () => {
    const w = duel('morrow', 'saffi'); const m = w.heroes[0]; m.gold = 1e5;
    expect(buy(w, m, 'cursed-coin')).toBe(true); expect(buy(w, m, 'cursed-coin')).toBe(false);
    for (let i = 0; i < 6; i++) buy(w, m, 'iron-fin');
    expect(m.items.length).toBe(6);
  });
  it('Borrowed Seconds delays a lethal hit by 2 s, and healing in time saves you', () => {
    const w = duel('morrow', 'saffi'); const m = w.heroes[0], s = w.heroes[1]; m.gold = 1e4; buy(w, m, 'borrowed-seconds');
    place(m, 2000, 450); place(s, 2100, 450);
    m.hp = 100; dealDamage(w, s, m, 400, DMG.TRUE);
    expect(m.dead).toBe(false); expect(m.hp).toBe(1);
    steps(w, sec(2.2)); expect(m.dead).toBe(true);
    const w2 = duel('morrow', 'saffi'); const m2 = w2.heroes[0]; m2.gold = 1e4; buy(w2, m2, 'borrowed-seconds');
    place(m2, 2000, 450); m2.hp = 100; dealDamage(w2, w2.heroes[1], m2, 300, DMG.TRUE);
    m2.hp = m2.maxHp; steps(w2, sec(2.2)); expect(m2.dead).toBe(false);
  });
  it('Barnacle Plate stacks armor while standing still', () => {
    const w = duel('gus', 'saffi'); const g = w.heroes[0]; g.gold = 1e4; buy(w, g, 'barnacle-plate');
    const a0 = g.armor; steps(w, sec(5)); expect(g.armor).toBeGreaterThan(a0 + 20);
  });
  it('Magnet Boots grant whale-roll immunity', () => {
    const w = duel('gus', 'saffi'); const g = w.heroes[0], s = w.heroes[1]; g.gold = 1e4; buy(w, g, 'magnet-boots');
    place(g, 2000, 450); place(s, 2000, 600); w.state.whale.phase = 'roll'; w.state.whale.dir = 1; w.state.whale.until = w.tick + 60;
    steps(w, sec(1));
    expect(Math.abs(g.y - 450)).toBeLessThan(15); expect(s.y).toBeGreaterThan(640);
  });
  it('Auctioneer Repossess takes the priciest item for 8 s and returns it', () => {
    const w = duel('auctioneer', 'saffi'); const a = w.heroes[0], s = w.heroes[1]; a.ranks.R = 1; a.gold = 5000; s.gold = 1e4;
    buy(w, s, 'tidal-heart'); buy(w, s, 'cursed-coin');
    place(a, 2000, 450); place(s, 2300, 450);
    steps(w, 1, () => [castCmd(0, 3, 2300, 450)]);
    expect(s.items).toEqual(['tidal-heart']); expect(a.items).toContain('cursed-coin');
    steps(w, sec(8.2));
    expect(s.items).toEqual(['tidal-heart', 'cursed-coin']); expect(a.items).not.toContain('cursed-coin');
  });
  it('every item has a name, cost and stats; recipes cost more than their parts; tiers follow the tree', () => {
    expect(Object.keys(ITEMS).length).toBe(40);
    for (const it of Object.values(ITEMS)) {
      expect(it.name).toBeTruthy(); expect(it.cost).toBeGreaterThan(0); expect(it.stats).toBeTruthy();
      for (const c of it.from) { expect(ITEMS[c]).toBeTruthy(); expect(ITEMS[c].into).toContain(it.key); }
      if (it.from.length) expect(it.cost).toBeGreaterThan(it.from.reduce((s, c) => s + ITEMS[c].cost, 0));
      expect(it.tier).toBe(it.from.length ? Math.min(3, 1 + Math.max(...it.from.map((c) => ITEMS[c].tier))) : 1);
    }
    for (const h of Object.values(CONTENT.heroes)) for (const k of h.build) expect(ITEMS[k]).toBeTruthy();
  });
  it('components you own are used up and knock their cost off, all the way down the tree', () => {
    const w = duel('saffi', 'morrow'); const s = w.heroes[0]; s.gold = 1e4;
    buy(w, s, 'shark-tooth'); buy(w, s, 'shark-tooth'); buy(w, s, 'kelp-wrap');
    const plan = purchasePlan(w, s, 'cursed-coin'); // iron-fin (two teeth) + a third tooth
    expect(plan.price).toBe(2400 - 700); expect(plan.consume.length).toBe(2);
    const g0 = s.gold; expect(buy(w, s, 'cursed-coin')).toBe(true);
    expect(g0 - s.gold).toBe(1700); expect(s.items).toEqual(['kelp-wrap', 'cursed-coin']);
  });
  it('a full inventory can still combine components into an item', () => {
    const w = duel('saffi', 'morrow'); const s = w.heroes[0]; s.gold = 1e4;
    for (const k of ['shark-tooth', 'shark-tooth', 'kelp-wrap', 'kelp-wrap', 'sea-glass', 'sea-glass']) buy(w, s, k);
    expect(purchasePlan(w, s, 'pearl-shard').reason).toBe('full');
    expect(buy(w, s, 'iron-fin')).toBe(true); expect(s.items.length).toBe(5);
  });
  it('one pair of boots; boots upgrade from Driftwood Boots', () => {
    const w = duel('saffi', 'morrow'); const s = w.heroes[0]; s.gold = 1e4;
    buy(w, s, 'driftwood-boots'); expect(purchasePlan(w, s, 'swiftfin-treads').price).toBe(700);
    buy(w, s, 'swiftfin-treads'); expect(s.items).toEqual(['swiftfin-treads']);
    expect(purchasePlan(w, s, 'anchor-boots').reason).toBe('group'); expect(buy(w, s, 'magnet-boots')).toBe(false);
  });
  it('penetration ignores armor; tenacity shortens crowd control; cooldown reduction shortens cooldowns', () => {
    const w = duel('saffi', 'gus'); const s = w.heroes[0], g = w.heroes[1];
    const hit = () => { const hp = g.hp; dealDamage(w, s, g, 200, DMG.PHYS); const d = hp - g.hp; g.hp = g.maxHp; return d; };
    const plain = hit(); s.gold = 1e4; buy(w, s, 'reefbreaker'); const pierced = hit();
    expect(pierced).toBeGreaterThan(plain);
    stun(w, g, 1); const full = g.stunUntil - w.tick; g.stunUntil = 0;
    g.gold = 1e4; buy(w, g, 'stillwater-pendant'); stun(w, g, 1); expect(g.stunUntil - w.tick).toBeLessThan(full);
    expect(g.tenacity).toBeCloseTo(0.3);
    s.gold = 1e4; buy(w, s, 'tide-charm'); expect(s.cdr).toBeCloseTo(0.1);
  });
  it('Storm Cutlass empowers the next attack after a cast; Squall Bell adds magic on hit', () => {
    const w = duel('saffi', 'gus'); const s = w.heroes[0], g = w.heroes[1]; s.gold = 1e4; buy(w, s, 'storm-cutlass');
    const it = ITEMS['storm-cutlass']; it.onAbilityCast(w, s, 0);
    const hp = g.hp; it.onBasicHit(w, s, g); expect(g.hp).toBeLessThan(hp);
    const hp2 = g.hp; it.onBasicHit(w, s, g); expect(g.hp).toBe(hp2); // used up
    const hp3 = g.hp; ITEMS['squall-bell'].onBasicHit(w, s, g); expect(g.hp).toBeLessThan(hp3);
  });
});
