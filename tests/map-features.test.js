// Map features: neutral camps and buffs (later: Sky Pearl, whale-roll loot, bounties, shrines).
import { describe, it, expect } from 'vitest';
import { createMatch } from '../src/sim/match.js';
import { attackCmd, moveCmd } from '../src/sim/commands.js';
import { KIND, TEAM, MAP, RULES, LANE, sec } from '../src/sim/constants.js';
import { addBuff, hasBuff, BUFFS } from '../src/sim/buffs.js';
import { EV } from '../src/core/events.js';
import { testContent, roster3v3 } from './helpers.js';

const match = () => createMatch({ seed: 3, roster: roster3v3(), content: testContent });
const steps = (w, n, cmds = () => []) => { for (let i = 0; i < n; i++) w.step(cmds(w)); };
const crabs = (w) => w.entities.filter((e) => e.alive && e.kind === KIND.CRAB);
const place = (e, x, y) => { e.x = e.px = x; e.y = e.py = y; };
const events = (w, type) => { const out = []; w.events.drain((e) => { if (e.type === type) out.push({ ...e }); }); return out; };

describe('neutral camps', () => {
  it('crabs surface on the centre line, neutral to both teams, at CAMP_FIRST', () => {
    const w = match();
    steps(w, sec(RULES.CAMP_FIRST) - 2); expect(crabs(w)).toHaveLength(0);
    steps(w, 3);
    const cs = crabs(w); expect(cs).toHaveLength(MAP.CAMPS.length);
    for (const c of cs) { expect(c.team).toBe(TEAM.NEUTRAL); expect(c.x).toBe(LANE.W / 2); }
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
