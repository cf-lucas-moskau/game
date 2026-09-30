import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { CONTENT } from '../src/sim/content.js';
import { BotDirector } from '../src/ai/director.js';
import { KIND, TICK_HZ } from '../src/sim/constants.js';

const roster = ['morrow', 'gus', 'vesper', 'saffi', 'brindle', 'auctioneer'].map((k, p) => ({ playerId: p, heroKey: k, team: p < 3 ? 0 : 1, isBot: true }));

describe('bots', () => {
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
