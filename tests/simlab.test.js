// Simulation lab: reproducible plans, balance patches, statistics invariants and aggregation.
import { describe, it, expect } from 'vitest';
import { resolveConfig, planMatch, runMatch, applyPatch, matchSeed, patchablePaths } from '../src/stats/simlab.js';
import { aggregate, wilson, compare } from '../src/stats/aggregate.js';
import { CONTENT } from '../src/sim/content.js';
import { RULES } from '../src/sim/constants.js';

const strip = (r) => { const { simMs, ...rest } = r; return rest; };

describe('simulation lab', () => {
  it('plans are reproducible and side-swapped pairs mirror each other', () => {
    const c = resolveConfig({ seed: 5 });
    expect(planMatch(c, 7)).toEqual(planMatch(c, 7));
    const a = planMatch(c, 4), b = planMatch(c, 5);
    expect(a.pair).toBe(b.pair);
    expect(a.roster.filter((p) => p.team === 0).map((p) => p.heroKey)).toEqual(b.roster.filter((p) => p.team === 1).map((p) => p.heroKey));
    expect(new Set(a.roster.map((p) => p.heroKey)).size).toBe(6); // no duplicates by default
    expect(matchSeed(5, 1)).not.toBe(matchSeed(5, 2));
  });
  it('fixed teams, focus heroes and per-team difficulty follow the config', () => {
    const c = resolveConfig({ blue: ['gus', 'saffi'], focus: ['wisp'], redDifficulty: 'hard', swap: false });
    for (let i = 0; i < 20; i++) {
      const p = planMatch(c, i), blue = p.roster.filter((x) => x.team === 0).map((x) => x.heroKey);
      expect(blue.slice(0, 2)).toEqual(['gus', 'saffi']);
      expect(p.roster.some((x) => x.heroKey === 'wisp')).toBe(true);
      expect(p.difficulty).toEqual(['medium', 'medium', 'medium', 'hard', 'hard', 'hard']);
    }
    expect(() => resolveConfig({ focus: ['nobody'] })).toThrow(/unknown hero/);
  });
  it('build modes give six valid items; recommended keeps the hero build', () => {
    for (const builds of ['recommended', 'shuffled', 'role', 'random']) {
      const p = planMatch(resolveConfig({ builds, seed: 3 }), 0);
      for (const r of p.roster) {
        const b = p.builds[r.playerId];
        expect(b.every((k) => CONTENT.items[k])).toBe(true);
        if (builds === 'recommended') expect(b).toEqual(CONTENT.heroes[r.heroKey].build);
        if (builds === 'shuffled') expect([...b].sort()).toEqual([...CONTENT.heroes[r.heroKey].build].sort());
      }
    }
  });
  it('patches set, scale and add in place, and reject unknown paths', () => {
    const ad = CONTENT.heroes.saffi.base.ad, cd = CONTENT.heroes.saffi.abilities.Q.cd.slice(), respawn = RULES.RESPAWN_BASE;
    try {
      const applied = applyPatch({ 'heroes.saffi.base.ad': ad + 5, 'heroes.saffi.abilities.Q.cd': 'x0.5', 'rules.RESPAWN_BASE': '+2' });
      expect(applied).toHaveLength(3);
      expect(CONTENT.heroes.saffi.base.ad).toBe(ad + 5);
      expect(CONTENT.heroes.saffi.abilities.Q.cd).toEqual(cd.map((v) => v * 0.5));
      expect(RULES.RESPAWN_BASE).toBe(respawn + 2);
      expect(() => applyPatch({ 'heroes.saffi.base.nothing': 1 })).toThrow(/not found/);
      expect(() => applyPatch({ 'weather.rain': 1 })).toThrow(/must start with/);
    } finally { CONTENT.heroes.saffi.base.ad = ad; CONTENT.heroes.saffi.abilities.Q.cd = cd; RULES.RESPAWN_BASE = respawn; }
    expect(patchablePaths('saffi').some(([p]) => p === 'heroes.saffi.abilities.Q.values.0.base')).toBe(true);
  });
  it('a match replays identically and its damage books balance', () => {
    const c = resolveConfig({ seed: 11, maxMinutes: 20 });
    const plan = planMatch(c, 0);
    const a = runMatch(plan, c), b = runMatch(plan, c);
    expect(strip(a)).toEqual(strip(b));
    // hero damage dealt to enemy heroes by one team is exactly the hero damage the other team took
    for (const team of [0, 1]) {
      const dealt = a.heroes.filter((h) => h.team === team).reduce((s, h) => s + h.dmgHeroes, 0);
      const taken = a.heroes.filter((h) => h.team !== team).reduce((s, h) => s + h.takenHeroes, 0);
      expect(dealt).toBeCloseTo(taken, 0);
    }
    for (const h of a.heroes) {
      expect(h.dmgHeroesPhys + h.dmgHeroesMagic + h.dmgHeroesTrue).toBeCloseTo(h.dmgHeroes, 0);
      expect(h.dmgHeroesBasic + h.dmgHeroesAbility + h.dmgHeroesOther).toBeCloseTo(h.dmgHeroes, 0);
      expect(h.goldSpent).toBe(h.items.reduce((s, it) => s + it.price, 0));
      for (const it of h.items) expect(it.price).toBeLessThanOrEqual(CONTENT.items[it.key].cost);
    }
    if (a.winner !== null) expect(a.heroes.filter((h) => h.win).every((h) => h.team === a.winner)).toBe(true);
    // aggregation over the pair
    const run = { config: c, matches: [a, runMatch(planMatch(c, 1), c)] };
    const agg = aggregate(run);
    expect(agg.heroes.reduce((s, h) => s + h.games, 0)).toBe(agg.summary.decided * 6);
    expect(compare(agg, agg).heroes.every((h) => h.delta === 0)).toBe(true);
  });
  it('wilson intervals', () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeCloseTo(0.404, 2); expect(hi).toBeCloseTo(0.596, 2);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});
