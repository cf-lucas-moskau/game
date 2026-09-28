import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { moveCmd, attackMoveCmd } from '../src/sim/commands.js';
import { KIND, sec } from '../src/sim/constants.js';
import { testContent, roster3v3 } from './helpers.js';

function run(seed, seconds, scripted = true) {
  const w = createMatch({ seed, roster: roster3v3(), content: testContent });
  for (let i = 0; i < sec(seconds); i++) {
    const cmds = [];
    if (scripted && i % 45 === 0) for (let p = 0; p < 6; p++) cmds.push(attackMoveCmd(p, p < 3 ? 2600 : 1400, 450));
    w.step(cmds);
  }
  return w;
}

describe('simulation', () => {
  it('is deterministic for the same seed and commands', () => {
    const a = run(99, 120), b = run(99, 120);
    expect(stateHash(a)).toBe(stateHash(b));
  });
  it('spawns minion waves that fight and die', () => {
    const w = run(3, 60, false);
    const minions = w.entities.filter((e) => e.alive && e.kind >= 2 && e.kind <= 4);
    expect(w.state.waveCount).toBeGreaterThanOrEqual(3);
    expect(minions.length).toBeGreaterThan(0);
    expect(w.freeIds.length).toBeGreaterThan(0); // some died and were recycled
  });
  it('whale roll cycles through warn, roll and back to idle', () => {
    const w = run(5, 128, false);
    expect(['roll', 'idle']).toContain(w.state.whale.phase);
    const w2 = run(5, 121.5, false); expect(w2.state.whale.phase).toBe('warn');
  });
  it('heroes gain gold, xp and levels, and structures take damage', () => {
    const w = run(11, 240);
    const h = w.heroes[0];
    expect(h.level).toBeGreaterThan(3);
    const towers = w.structures.filter((s) => s.kind === KIND.TOWER);
    expect(towers.some((t) => !t.alive || t.hp < t.maxHp)).toBe(true);
  });
  it('keeps the simulation tick fast', () => {
    const w = createMatch({ seed: 1, roster: roster3v3(), content: testContent });
    for (let i = 0; i < sec(90); i++) w.step(i % 45 === 0 ? [0,1,2,3,4,5].map(p => attackMoveCmd(p, p < 3 ? 2600 : 1400, 450)) : []);
    const t0 = performance.now(); const N = 300;
    for (let i = 0; i < N; i++) w.step([]);
    const per = (performance.now() - t0) / N;
    expect(per).toBeLessThan(2);
  });
});
