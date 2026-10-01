import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { BotDirector } from '../src/ai/director.js';
import { KIND, TICK_HZ, LANE, MAP, STRUCT, RULES } from '../src/sim/constants.js';

const roster = ['morrow', 'gus', 'vesper', 'saffi', 'brindle', 'auctioneer'].map((k, p) => ({ playerId: p, heroKey: k, team: p < 3 ? 0 : 1, isBot: true }));

describe('bots', () => {
  it('the outer towers leave open ground in the middle of the lane', () => {
    const reach = STRUCT.TOWER.range + STRUCT.TOWER.radius;
    expect(LANE.W - 2 * (MAP.TOWER_OUTER_X + reach)).toBeGreaterThanOrEqual(500); // 560 at lane 4800 (700 between the range circles)
  });
  it('the map is mirror-symmetric (relics, towers, fountains)', () => {
    const xs = MAP.RELICS.map(([x]) => x).sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i++) expect(xs[i] + xs[xs.length - 1 - i]).toBe(LANE.W);
    const w = createMatch({ seed: 1, roster, content: CONTENT });
    const pos = (team) => w.structures.filter((s) => s.team === team).map((s) => team === 0 ? s.x : LANE.W - s.x).sort((a, b) => a - b);
    expect(pos(1)).toEqual(pos(0));
  });
  it('between waves, bots wait near the middle instead of at their base', () => {
    const w = createMatch({ seed: 5, roster, content: CONTENT });
    const dir = new BotDirector(w, 'medium'); const cmds = [];
    while (w.tick < (RULES.FIRST_WAVE - 0.5) * TICK_HZ) { dir.commands(w, cmds); w.step(cmds); } // no minion has spawned yet
    for (const h of w.heroes) {
      const fromOwnEnd = h.team === 0 ? h.moveX : LANE.W - h.moveX;
      expect(fromOwnEnd).toBeGreaterThan(MAP.TOWER_OUTER_X); // heading past the own towers, towards the middle
      expect(fromOwnEnd).toBeLessThan(LANE.W / 2);
    }
  });
  it('play a full match that ends by sudden death at the latest, and a command log replays it exactly', () => {
    const w = createMatch({ seed: 77, roster, content: CONTENT });
    const dir = new BotDirector(w, 'medium'); const log = []; const cmds = [];
    while (!w.state.over && w.tick < 14 * 60 * TICK_HZ) { dir.commands(w, cmds); log.push(cmds.map((c) => JSON.parse(JSON.stringify(c)))); w.step(cmds); }
    expect(w.state.over).toBe(true);
    expect(w.tick / TICK_HZ / 60).toBeLessThan(12.5);
    expect(w.structures.some((s) => s.kind === KIND.TOWER && !s.alive)).toBe(true);
    for (const h of w.heroes) expect(h.items.length).toBeGreaterThanOrEqual(2); // every bot shops (a stomp can end before a third item)
    // replay only the commands: same final state => sim depends on nothing but seed + inputs
    const r = createMatch({ seed: 77, roster, content: CONTENT });
    for (const c of log) r.step(c);
    expect(stateHash(r)).toBe(stateHash(w));
  }, 60000);
  it('every hero uses all four abilities during a match', () => {
    const w = createMatch({ seed: 9, roster, content: CONTENT });
    const dir = new BotDirector(w, 'hard'); const cmds = []; const used = {};
    while (!w.state.over && w.tick < 9 * 60 * TICK_HZ) {
      dir.commands(w, cmds); w.step(cmds);
      w.events.drain((e) => { if (e.type === 4) { used[e.s] = used[e.s] || new Set(); used[e.s].add(e.b); } });
    }
    for (const k of ['morrow', 'gus', 'vesper', 'saffi', 'brindle', 'auctioneer']) expect([...(used[k] || [])].sort()).toEqual([0, 1, 2, 3]);
  }, 60000);
});
