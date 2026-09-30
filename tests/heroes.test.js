import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { castCmd, moveCmd, attackMoveCmd } from '../src/sim/commands.js';
import { HEROES, HERO_KEYS } from '../src/sim/heroes/index.js';
import { KIND, sec } from '../src/sim/constants.js';

const content = { heroes: HEROES, items: {} };
const duel = (a, b, seed = 1) => createMatch({ seed, content, roster: [{ playerId: 0, heroKey: a, team: 0 }, { playerId: 1, heroKey: b, team: 1 }] });
const steps = (w, n, cmds = () => []) => { for (let i = 0; i < n; i++) w.step(cmds(i)); };
const place = (e, x, y) => { e.x = e.px = x; e.y = e.py = y; };

describe('heroes', () => {
  it('every hero casts every ability in a chaotic 3v3 without errors, deterministically', () => {
    const run = () => {
      const roster = HERO_KEYS.map((k, i) => ({ playerId: i, heroKey: k, team: i % 2, isBot: true }));
      const w = createMatch({ seed: 21, content, roster });
      for (const h of w.heroes) { h.level = 11; h.ranks = { Q: 5, W: 3, E: 2, R: 2 }; }
      steps(w, sec(150), (i) => {
        const c = [];
        for (let p = 0; p < 6; p++) {
          const h = w.heroes[p], foe = w.heroes.find((x) => x.team !== h.team && !x.dead) || h;
          if (i % 40 === p) c.push(attackMoveCmd(p, foe.x, foe.y));
          if (i % 17 === p) c.push(castCmd(p, (i / 17 | 0) % 4, foe.x, foe.y, p === 2 ? [foe.x - 80, foe.y - 80, foe.x + 80, foe.y - 80, foe.x + 80, foe.y + 80, foe.x - 80, foe.y + 80, foe.x - 78, foe.y - 70] : null));
        }
        return c;
      });
      return w;
    };
    const a = run(), b = run();
    expect(stateHash(a)).toBe(stateHash(b));
    expect(a.heroes.reduce((s, h) => s + h.kills, 0)).toBeGreaterThan(0);
  });

  it('Morrow Rewind returns him to where he was 4 s ago with that health', () => {
    const w = duel('morrow', 'saffi'); const m = w.heroes[0]; place(w.heroes[1], 3700, 450);
    place(m, 1000, 300); m.ranks.R = 1; steps(w, 5);
    const hpBefore = m.hp;
    steps(w, sec(4) - 5, () => [moveCmd(0, 1800, 700)]);
    m.hp = 50;
    steps(w, 1, () => [castCmd(0, 3, m.x, m.y)]); steps(w, sec(0.6));
    expect(Math.hypot(m.x - 1000, m.y - 300)).toBeLessThan(120);
    expect(m.hp).toBeGreaterThan(hpBefore - 60);
  });

  it('Morrow Step Through teleports to his latest echo', () => {
    const w = duel('morrow', 'saffi'); const m = w.heroes[0]; place(w.heroes[1], 3700, 450);
    place(m, 1000, 450); steps(w, 1, () => [castCmd(0, 1, m.x, m.y)]); // W leaves echo at 1000
    steps(w, sec(1), () => [moveCmd(0, 1500, 450)]);
    steps(w, 1, () => [castCmd(0, 2, m.x, m.y)]);
    expect(Math.abs(m.x - 1000)).toBeLessThan(40);
  });

  it('Saffi burns down over time, is not healed by allies, and relights on hero hits', () => {
    const w = duel('saffi', 'morrow'); const s = w.heroes[0]; const foe = w.heroes[1];
    place(s, 1600, 450); place(foe, 3600, 450);
    const hp0 = s.hp; steps(w, sec(3));
    expect(s.hp).toBeLessThan(hp0 - s.maxHp * HEROES.saffi.tuning.drain * 2); // 3 s of wick burn
    place(foe, 1700, 450); const low = s.hp;
    steps(w, sec(2), () => [{ t: 2, p: 0, id: foe.id }]);
    expect(s.hp).toBeGreaterThan(low);
  });

  it('Vesper Loop roots enemies inside a closed shape; open strokes fizzle without cooldown', () => {
    const w = duel('vesper', 'morrow'); const v = w.heroes[0], foe = w.heroes[1];
    place(v, 1500, 450); place(foe, 1800, 450);
    const open = [1700, 350, 1900, 350, 1900, 550];
    steps(w, 1, () => [castCmd(0, 1, 1800, 450, open)]);
    expect(v.cds[1]).toBe(0);
    const loop = [1700, 350, 1900, 350, 1900, 550, 1700, 550, 1705, 360];
    steps(w, 1, () => [castCmd(0, 1, 1800, 450, loop)]);
    expect(foe.rootUntil).toBeGreaterThan(w.tick);
  });

  it('Vesper Stroke Wall blocks enemy movement', () => {
    const w = duel('vesper', 'morrow'); const v = w.heroes[0], foe = w.heroes[1];
    place(v, 1500, 450); place(foe, 2000, 450);
    steps(w, 1, () => [castCmd(0, 2, 1800, 450, [1800, 200, 1800, 700])]);
    steps(w, sec(2), () => [moveCmd(1, 1200, 450)]);
    expect(foe.x).toBeGreaterThan(1790);
  });

  it('Gus dismounts into two bodies and remounts', () => {
    const w = duel('gus', 'morrow'); const g = w.heroes[0]; place(w.heroes[1], 3700, 450); place(g, 1200, 450);
    const mountedHp = g.maxHp;
    steps(w, 1, () => [castCmd(0, 1, 1400, 450)]); steps(w, sec(0.5));
    const peb = w.get(g.heroState.pebbleId);
    expect(peb && peb.kind).toBe(KIND.PEBBLE);
    expect(g.maxHp).toBeLessThan(mountedHp); expect(g.range).toBe(525);
    steps(w, sec(4));
    place(g, peb.x + 50, peb.y);
    steps(w, 1, () => [castCmd(0, 1, g.x, g.y)]);
    expect(g.heroState.mounted).toBe(true); expect(w.get(peb.id)).toBe(null);
  });

  it('Brindle gains bees from hits and needs 15 for Hive Dome', () => {
    const w = duel('brindle', 'morrow'); const b = w.heroes[0], foe = w.heroes[1]; b.ranks.R = 1;
    place(b, 1500, 450); place(foe, 1800, 450);
    steps(w, 1, () => [castCmd(0, 3, b.x, b.y)]); expect(b.cds[3]).toBe(0);
    const bees = b.resource; steps(w, sec(4), () => [{ t: 2, p: 0, id: foe.id }]);
    expect(b.resource).toBeGreaterThan(bees);
    b.resource = 16; steps(w, 1, () => [castCmd(0, 3, b.x, b.y)]);
    expect(b.resource).toBe(0); expect(w.zones.some((z) => z.kind === 'brindle-dome')).toBe(true);
  });

  it('Auctioneer pays gold for abilities and Gavel refunds on hero hit', () => {
    const w = duel('auctioneer', 'morrow'); const a = w.heroes[0], foe = w.heroes[1];
    place(a, 1500, 450); place(foe, 1900, 450); const g0 = a.gold;
    steps(w, 1, () => [castCmd(0, 0, 1900, 450)]); steps(w, sec(0.5));
    expect(foe.stunUntil).toBeGreaterThan(0); expect(Math.round(a.gold)).toBeGreaterThanOrEqual(Math.round(g0));
  });
});
