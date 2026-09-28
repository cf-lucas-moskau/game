import { describe, it, expect } from 'vitest';
import { createMatch, buy } from '../src/sim/match.js';
import { castCmd, buyCmd, moveCmd } from '../src/sim/commands.js';
import { CONTENT } from '../src/sim/content.js';
import { ITEMS } from '../src/sim/items/index.js';
import { dealDamage, DMG } from '../src/sim/damage.js';
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
    buy(w, s, 'iron-fin'); buy(w, s, 'cursed-coin');
    place(a, 2000, 450); place(s, 2300, 450);
    steps(w, 1, () => [castCmd(0, 3, 2300, 450)]);
    expect(s.items).toEqual(['iron-fin']); expect(a.items).toContain('cursed-coin');
    steps(w, sec(8.2));
    expect(s.items).toEqual(['iron-fin', 'cursed-coin']); expect(a.items).not.toContain('cursed-coin');
  });
  it('every item has a name, cost and stats; shop has 15 items', () => {
    expect(Object.keys(ITEMS).length).toBe(15);
    for (const it of Object.values(ITEMS)) { expect(it.name).toBeTruthy(); expect(it.cost).toBeGreaterThan(0); expect(it.stats).toBeTruthy(); }
  });
});
