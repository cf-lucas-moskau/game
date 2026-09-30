import { describe, it, expect } from 'vitest';
import { createMatch, stateHash } from '../src/sim/match.js';
import { moveCmd, attackMoveCmd, surrenderCmd, validCommand } from '../src/sim/commands.js';
import { EV } from '../src/core/events.js';
import { KIND, sec, RULES, TICK_HZ } from '../src/sim/constants.js';
import { testContent, roster3v3 } from './helpers.js';
import { kill as killFn, dealDamage, DMG } from '../src/sim/damage.js';

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
  it('surrender ends the match for the other team, once, even while dead', () => {
    const w = createMatch({ seed: 4, roster: roster3v3(), content: testContent });
    expect(validCommand(surrenderCmd(4))).toBe(true);
    for (let i = 0; i < 30; i++) w.step([]);
    killFn(w, w.heroes[4], null);
    const ends = []; w.events.drain(() => {});
    w.step([surrenderCmd(4), surrenderCmd(1)]);
    w.events.drain((e) => { if (e.type === EV.MATCH_END) ends.push(e.a); });
    expect(w.state.over).toBe(true);
    expect(w.state.winner).toBe(0);
    expect(ends).toEqual([0]);
    expect(w.state.surrendered).toBe(true);
  });
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
  it('heroes gain gold, xp, levels and kills', () => {
    const w = run(11, 240);
    const h = w.heroes[0];
    expect(h.level).toBeGreaterThan(3);
    expect(w.heroes.some((x) => x.kills > 0)).toBe(true);
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
describe('entity recycling', () => {
  it('never recycles destroyed structures into new units', () => {
    const w = createMatch({ seed: 2, roster: roster3v3(), content: testContent });
    const tower = w.structures[0];
    tower.hp = 1; w.step([]); killFn(w, tower, null);
    for (let i = 0; i < sec(60); i++) w.step([]);
    expect(w.structures.every((s) => s.alive ? s.kind >= 5 : true)).toBe(true);
    expect(tower.alive).toBe(false);
  });
});
describe('entity ids', () => {
  it('recycled records keep their own index as id', () => {
    const w = createMatch({ seed: 4, roster: roster3v3(), content: testContent });
    for (let i = 0; i < sec(120); i++) w.step([]);
    w.entities.forEach((e, i) => expect(e.id).toBe(i));
  });
});

describe('sudden death', () => {
  // both Heartstones one decay step from breaking, then the next full second
  const toTheBrink = (w) => {
    w.state.suddenDeath = true;
    for (const s of w.structures) if (s.kind === KIND.HEART) s.hp = s.maxHp * RULES.SUDDEN_DEATH_HEART_DECAY * 0.5;
    while (w.tick % TICK_HZ !== TICK_HZ - 1) w.step([]);
    w.step([]);
  };
  it('a simultaneous Heartstone break goes to the side with more kills, whichever side that is', () => {
    for (const team of [0, 1]) {
      const w = createMatch({ seed: 3, roster: roster3v3(), content: testContent });
      w.heroes.find((h) => h.team === team).kills = 2;
      toTheBrink(w);
      expect(w.state.over).toBe(true);
      expect(w.state.winner).toBe(team);
    }
  });
  it('more Heartstone health wins the tiebreak first; a perfect tie is a seeded coin', () => {
    const w = createMatch({ seed: 3, roster: roster3v3(), content: testContent });
    w.heroes[0].kills = 5; // blue leads in kills...
    const red = w.structures.find((s) => s.kind === KIND.HEART && s.team === 1);
    toTheBrink(w);
    expect(w.state.winner).toBe(0);
    const w2 = createMatch({ seed: 3, roster: roster3v3(), content: testContent });
    w2.heroes[0].kills = 5;
    w2.state.suddenDeath = true;
    for (const s of w2.structures) if (s.kind === KIND.HEART) s.hp = s.maxHp * RULES.SUDDEN_DEATH_HEART_DECAY * (s.team === 1 ? 0.9 : 0.5); // ...but red's heart is healthier
    while (w2.tick % TICK_HZ !== TICK_HZ - 1) w2.step([]);
    w2.step([]);
    expect(w2.state.winner).toBe(1);
    expect(red).toBeTruthy();
    const coin = (seed) => { const x = createMatch({ seed, roster: roster3v3(), content: testContent }); toTheBrink(x); return x.state.winner; };
    const outcomes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(coin));
    expect(outcomes.size).toBe(2); // both sides win some perfect ties
    expect(coin(5)).toBe(coin(5));
  });
});

describe('kill credit', () => {
  const setup = () => {
    const w = createMatch({ seed: 5, roster: roster3v3(), content: testContent });
    const [a, b] = w.heroes.filter((h) => h.team === 0), victim = w.heroes.find((h) => h.team === 1);
    const tower = w.structures.find((s) => s.kind === KIND.TOWER && s.team === 0);
    const kills = []; const grab = () => w.events.drain((e) => { if (e.type === EV.KILL) kills.push({ ...e }); });
    return { w, a, b, victim, tower, kills, grab };
  };
  const wait = (w, s) => { w.tick += sec(s); };
  it('a tower finishing a hero credits the last enemy hero who hit them within 15 s, with the full bounty', () => {
    const { w, a, victim, tower, kills, grab } = setup();
    dealDamage(w, a, victim, 50, DMG.TRUE);
    wait(w, 12);
    const g0 = a.gold; killFn(w, victim, tower); grab();
    expect(a.kills).toBe(1);
    expect(a.gold - g0).toBe(RULES.KILL_GOLD);
    expect(kills[0].b).toBe(a.id); expect(kills[0].c).toBe(RULES.KILL_GOLD);
  });
  it('after 15 s nobody gets the kill: the gold is shared as before', () => {
    const { w, a, victim, tower, grab } = setup();
    dealDamage(w, a, victim, 50, DMG.TRUE);
    wait(w, 16);
    const g0 = a.gold; killFn(w, victim, tower); grab();
    expect(a.kills).toBe(0); expect(a.gold - g0).toBe(RULES.ASSIST_GOLD);
  });
  it('the latest damager gets the kill, the earlier one the assist', () => {
    const { w, a, b, victim, tower } = setup();
    dealDamage(w, a, victim, 50, DMG.TRUE); wait(w, 2);
    dealDamage(w, b, victim, 50, DMG.TRUE); wait(w, 2);
    killFn(w, victim, tower);
    expect([a.kills, a.assists, b.kills, b.assists]).toEqual([0, 1, 1, 0]);
  });
});
