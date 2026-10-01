// Map features: neutral camps and buffs (later: Sky Pearl, whale-roll loot, bounties, shrines).
import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/sim/match.js';
import { attackCmd, moveCmd } from '../src/sim/commands.js';
import { KIND, TEAM, MAP, RULES, LANE, STRUCT, NEUTRAL, sec } from '../src/sim/constants.js';
import { addBuff, hasBuff, BUFFS } from '../src/sim/buffs.js';
import { EV } from '../src/core/events.js';
import { testContent, roster3v3 } from './helpers.js';

const match = () => createMatch({ seed: 3, roster: roster3v3(), content: testContent });
const steps = (w, n, cmds = () => []) => { for (let i = 0; i < n; i++) w.step(cmds(w)); };
const crabs = (w) => w.entities.filter((e) => e.alive && e.kind === KIND.CRAB);
const place = (e, x, y) => { e.x = e.px = x; e.y = e.py = y; };
const events = (w, type) => { const out = []; w.events.drain((e) => { if (e.type === type) out.push({ ...e }); }); return out; };

describe('neutral camps', () => {
  it('crabs surface symmetric through the centre, neutral to both teams, at CAMP_FIRST', () => {
    const w = match();
    steps(w, sec(RULES.CAMP_FIRST) - 2); expect(crabs(w)).toHaveLength(0);
    steps(w, 3);
    const cs = crabs(w); expect(cs).toHaveLength(MAP.CAMPS.length);
    for (const c of cs) expect(c.team).toBe(TEAM.NEUTRAL);
    // the two nests are symmetric through the centre of the lane: each team is equally far from one of them
    const [a, b] = MAP.CAMPS; expect(a[0] + b[0]).toBe(LANE.W); expect(a[1] + b[1]).toBe(LANE.H);
    // and outside every tower's reach, and outside the Sky Pearl's circle
    const reach = STRUCT.TOWER.range + STRUCT.TOWER.radius + NEUTRAL[KIND.CRAB].radius;
    for (const [x, y] of MAP.CAMPS) {
      expect(Math.min(x, LANE.W - x) - MAP.TOWER_OUTER_X).toBeGreaterThan(reach);
      expect(Math.hypot(x - MAP.PEARL[0], y - MAP.PEARL[1])).toBeGreaterThan(RULES.PEARL_RADIUS + 100);
    }
  });
  it('minions walk past a crab; a crab chases whoever hits it and walks home past its leash', () => {
    const w = match(); steps(w, sec(RULES.CAMP_FIRST) + 1);
    const crab = crabs(w)[0], hero = w.heroes[0];
    // a minion right next to the crab does not attack it
    const before = crab.hp; steps(w, sec(2)); expect(crab.hp).toBe(before);
    place(hero, crab.x - 300, crab.y + 40);
    steps(w, sec(1.5), () => [attackCmd(0, crab.id)]);
    expect(crab.hp).toBeLessThan(before); expect(crab.aggroId).toBe(hero.id);
    // run far away: the crab gives up, walks home untouchable and heals
    steps(w, sec(6), () => [moveCmd(0, 200, 450)]);
    expect(crab.aggroId).toBe(-1);
    steps(w, sec(12));
    expect(Math.hypot(crab.x - crab.homeX, crab.y - crab.homeY)).toBeLessThan(45);
    expect(crab.hp).toBe(crab.maxHp);
  });
  it('the killing blow pays gold, experience and Barnacle Fury; the camp returns after CAMP_RESPAWN', () => {
    const w = match(); steps(w, sec(RULES.CAMP_FIRST) + 1);
    const crab = crabs(w)[0], hero = w.heroes[0], ally = w.heroes[1];
    place(hero, crab.x - 200, crab.y); place(ally, crab.x - 300, crab.y + 60);
    w.events.drain(() => {});
    const gold = hero.gold, allyGold = ally.gold, amp = hero.dmgAmp;
    crab.hp = 1; crab.lastCombatTick = w.tick; steps(w, sec(2), () => [attackCmd(0, crab.id)]);
    expect(crab.alive).toBe(false);
    const slain = events(w, EV.OBJECTIVE).find((e) => e.s === 'camp-slain');
    expect(slain.a).toBe(hero.id); expect(slain.b).toBe(hero.team);
    expect(hero.gold - gold).toBeGreaterThanOrEqual(RULES.CAMP_GOLD);
    expect(ally.gold - allyGold).toBeGreaterThanOrEqual(RULES.CAMP_SHARE_GOLD);
    expect(hasBuff(hero, 'barnacle-fury')).toBe(true); expect(hero.dmgAmp).toBeCloseTo(amp + BUFFS['barnacle-fury'].stats.dmgAmp, 6);
    const camp = w.state.camps.find((c) => c.crabId < 0);
    expect(camp.respawnAt - w.tick).toBeGreaterThan(sec(RULES.CAMP_RESPAWN) - sec(2.1));
    steps(w, camp.respawnAt - w.tick + 1);
    expect(crabs(w)).toHaveLength(MAP.CAMPS.length);
  });
});

describe('buffs', () => {
  it('apply their stats, refresh instead of stacking, expire, and end on death', () => {
    const w = match(), h = w.heroes[0];
    const as0 = h.as, ms0 = h.speed;
    addBuff(w, h, 'tailwind'); steps(w, 1);
    expect(h.speed).toBeCloseTo(ms0 * 1.3, 4); expect(h.as).toBeGreaterThan(as0); expect(h.dmgTaken).toBeCloseTo(0.12, 6);
    addBuff(w, h, 'tailwind'); expect(h.buffs).toHaveLength(1);
    steps(w, sec(BUFFS.tailwind.duration) + 1);
    expect(hasBuff(h, 'tailwind')).toBe(false); expect(h.speed).toBeCloseTo(ms0, 4); expect(h.dmgTaken).toBe(0);
    addBuff(w, h, 'barnacle-fury'); h.dead = true; steps(w, 1); expect(h.buffs).toHaveLength(0);
  });
});

describe('Sky Pearl', () => {
  const toUp = (w) => { steps(w, sec(RULES.PEARL_FIRST) + 1); expect(w.state.pearl.phase).toBe('up'); };
  const parkAll = (w) => w.heroes.forEach((h, i) => place(h, h.team === 0 ? 300 : LANE.W - 300, 300 + (i % 3) * 120));
  it('is announced, surfaces at the centre, and a team holding it alone claims it', () => {
    const w = match(); steps(w, sec(RULES.PEARL_FIRST - RULES.PEARL_WARN) + 1); expect(w.state.pearl.phase).toBe('warn');
    steps(w, sec(RULES.PEARL_WARN)); expect(w.state.pearl.phase).toBe('up'); parkAll(w);
    const [px, py] = MAP.PEARL, h0 = w.heroes[0], h1 = w.heroes[1];
    w.events.drain(() => {});
    const g0 = h0.gold, g1 = h1.gold;
    const hold = () => { place(h0, px, py); place(h1, px + 60, py); return []; };
    steps(w, sec(RULES.PEARL_CAPTURE) - 5, hold); expect(w.state.pearl.phase).toBe('up');
    steps(w, 10, hold);
    const taken = events(w, EV.OBJECTIVE).find((e) => e.s === 'pearl-taken');
    expect(taken.b).toBe(0); expect(taken.c).toBe((1 << h0.playerId) | (1 << h1.playerId));
    expect(h0.gold - g0).toBeGreaterThanOrEqual(RULES.PEARL_GOLD); expect(h1.gold - g1).toBeGreaterThanOrEqual(RULES.PEARL_GOLD);
    for (const h of w.heroes) expect(hasBuff(h, 'pearl-blessing')).toBe(h.team === 0);
    expect(w.state.pearlWaves[0]).toBe(RULES.PEARL_WAVES);
    // the next blue wave brings a Pearl Golem
    const next = w.state.nextWave; steps(w, next - w.tick + 1);
    const golems = w.entities.filter((e) => e.alive && e.empowered);
    expect(golems).toHaveLength(1); expect(golems[0].team).toBe(0); expect(golems[0].kind).toBe(KIND.SIEGE);
    expect(w.state.pearlWaves[0]).toBe(RULES.PEARL_WAVES - 1);
  });
  it('freezes while contested and sinks when nobody claims it', () => {
    const w = match(); toUp(w); parkAll(w);
    const [px, py] = MAP.PEARL, b = w.heroes[0], r = w.heroes[3];
    steps(w, sec(2), () => { place(b, px, py); return []; });
    const prog = w.state.pearl.prog; expect(prog).toBeGreaterThan(0.3);
    steps(w, sec(3), () => { place(b, px, py); place(r, px + 50, py); return []; });
    expect(w.state.pearl.prog).toBeCloseTo(prog, 5); expect(w.state.pearl.phase).toBe('up');
    w.events.drain(() => {});
    steps(w, sec(RULES.PEARL_LIFETIME), () => { parkAll(w); return []; });
    expect(events(w, EV.OBJECTIVE).some((e) => e.s === 'pearl-sank')).toBe(true);
    expect(w.state.pearl.phase).toBe('idle');
  });
});

describe('whale-roll loot', () => {
  it('washes up in mirrored pairs on the edge the whale rolls toward, pays the hero who grabs it, and drifts away', () => {
    const w = match(); w.events.drain(() => {});
    steps(w, sec(RULES.WHALE_FIRST + RULES.WHALE_WARN) + 1);
    const wh = w.state.whale; expect(wh.phase).toBe('roll');
    const loot = w.pickups.filter((p) => p.kind === 'loot');
    expect(loot).toHaveLength(RULES.LOOT_X.length * 2);
    const xs = loot.map((p) => p.x).sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i++) expect(xs[i] + xs[xs.length - 1 - i]).toBe(LANE.W);
    for (const p of loot) expect(wh.dir > 0 ? p.y > LANE.EDGE_MAX : p.y < LANE.EDGE_MIN).toBe(true);
    const h = w.heroes[0], g = h.gold; place(h, loot[0].x, loot[0].y); w.events.drain(() => {});
    steps(w, 1);
    expect(h.gold - g).toBeGreaterThanOrEqual(RULES.LOOT_GOLD);
    expect(events(w, EV.PICKUP).some((e) => e.a === h.id && e.s === 'loot')).toBe(true);
    expect(w.pickups.filter((p) => p.kind === 'loot')).toHaveLength(loot.length - 1);
    steps(w, sec(RULES.WHALE_DURATION + RULES.LOOT_LINGER), () => { place(h, 300, 450); return []; });
    expect(w.pickups.some((p) => p.kind === 'loot')).toBe(false);
  });
});
