// Aggregation of simulation-lab match records into balance tables: per hero, per item, per matchup, per match.
// Pure functions over plain records (the output of MatchStats.finish), so a saved run can be re-analysed later.

/** Wilson score interval (95%) for k successes in n trials: [low, high] as fractions. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}
/** Two-proportion z statistic (pooled) for k1/n1 against k2/n2. */
export function zTwo(k1, n1, k2, n2) {
  if (!n1 || !n2) return 0;
  const p = (k1 + k2) / (n1 + n2), se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  return se ? (k1 / n1 - k2 / n2) / se : 0;
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const quantile = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

/** Numeric per-hero fields averaged per game; the `perMin` ones are also reported per minute of match time. */
export const HERO_FIELDS = ['kills', 'deaths', 'assists', 'level', 'cs', 'goldEarned', 'goldSpent', 'dmgHeroes', 'dmgHeroesPhys', 'dmgHeroesMagic',
  'dmgHeroesTrue', 'dmgHeroesBasic', 'dmgHeroesAbility', 'dmgHeroesOther', 'dmgMinions', 'dmgStructures', 'taken', 'takenHeroes', 'takenMinions',
  'takenStructures', 'healSelf', 'healAllies', 'shieldSelf', 'shieldAllies', 'healed', 'ccStun', 'ccRoot', 'ccAirborne', 'displaces', 'slowSec',
  'slowWeighted', 'ccTaken', 'slowTaken', 'secondsDead', 'camps', 'dmgNeutral', 'pearls', 'lootGold', 'shrines', 'shutdowns', 'bestStreak'];
const PER_MIN = ['dmgHeroes', 'taken', 'dmgStructures', 'goldEarned', 'cs'];

export function aggregate(run) {
  const matches = run.matches.filter((m) => !m.timedOut);
  const decided = matches.length, heroGames = decided * 6;
  // ---- match summary
  const mins = run.matches.map((m) => m.minutes);
  const blueWins = matches.filter((m) => m.winner === 0).length;
  const pairs = new Map(); for (const m of run.matches) { if (!pairs.has(m.pair)) pairs.set(m.pair, []); pairs.get(m.pair).push(m); }
  let pairsSplit = 0, pairsSweep = 0; // swapped pairs: sides split the wins, or one roster won on both sides
  for (const ms of pairs.values()) if (ms.length === 2 && ms.every((m) => !m.timedOut)) { const w0 = teamHeroes(ms[0], ms[0].winner), w1 = teamHeroes(ms[1], ms[1].winner); if (w0 === w1) pairsSweep++; else pairsSplit++; }
  const summary = {
    matches: run.matches.length, decided, timedOut: run.matches.length - decided,
    minutes: { mean: r2(mean(mins)), p10: quantile(mins, 0.1), median: quantile(mins, 0.5), p90: quantile(mins, 0.9), max: Math.max(0, ...mins) },
    blueWinRate: r3(decided ? blueWins / decided : 0), blueCi: wilson(blueWins, decided).map(r3),
    killsPerMatch: r2(mean(matches.map((m) => m.kills[0] + m.kills[1]))),
    firstBloodMin: r1(mean(matches.filter((m) => m.firstBloodMin !== null).map((m) => m.firstBloodMin))),
    firstTowerMin: r2(mean(matches.filter((m) => m.firstTowerMin !== null).map((m) => m.firstTowerMin))),
    firstBloodWinRate: r3(rate(matches.filter((m) => m.firstBloodTeam !== null), (m) => m.firstBloodTeam === m.winner)),
    firstTowerWinRate: r3(rate(matches.filter((m) => m.firstTowerTeam !== null), (m) => m.firstTowerTeam === m.winner)),
    suddenDeathRate: r3(rate(run.matches, (m) => m.suddenDeathMin !== null)),
    pairsSplit, pairsSweep,
    // map features: per match, and how often the team that took more of them won
    camps: r2(mean(matches.map((m) => (m.camps || [0, 0])[0] + (m.camps || [0, 0])[1]))),
    campsWinRate: r3(rate(matches.filter((m) => m.camps && m.camps[0] !== m.camps[1]), (m) => (m.camps[0] > m.camps[1] ? 0 : 1) === m.winner)),
    pearls: r2(mean(matches.map((m) => (m.pearls || [0, 0])[0] + (m.pearls || [0, 0])[1]))),
    pearlsWinRate: r3(rate(matches.filter((m) => m.pearls && m.pearls[0] !== m.pearls[1]), (m) => (m.pearls[0] > m.pearls[1] ? 0 : 1) === m.winner)),
    lootGold: r1(mean(matches.map((m) => (m.lootGold || [0, 0])[0] + (m.lootGold || [0, 0])[1]))),
    shrines: r2(mean(matches.map((m) => (m.shrines || [0, 0])[0] + (m.shrines || [0, 0])[1]))),
    shutdowns: r2(mean(matches.map((m) => (m.shutdowns || [0, 0])[0] + (m.shutdowns || [0, 0])[1]))),
    simMsPerMatch: r1(mean(run.matches.map((m) => m.simMs || 0))),
  };
  // ---- heroes
  const H = new Map();
  const itemAgg = new Map();
  const vs = new Map(), with_ = new Map();
  for (const m of matches) {
    for (const h of m.heroes) {
      if (!H.has(h.hero)) H.set(h.hero, { hero: h.hero, games: 0, wins: 0, sums: Object.fromEntries(HERO_FIELDS.map((f) => [f, 0])), minutes: 0, firstItem: [], builds: new Map(), casts: [0, 0, 0, 0] });
      const a = H.get(h.hero); a.games++; if (h.win) a.wins++; a.minutes += m.minutes;
      for (const f of HERO_FIELDS) a.sums[f] += h[f] || 0;
      for (let s = 0; s < 4; s++) a.casts[s] += h.casts[s];
      if (h.firstItemMin !== null) a.firstItem.push(h.firstItemMin);
      const b3 = h.items.slice(0, 3).map((x) => x.key).join(' > '); if (b3) a.builds.set(b3, (a.builds.get(b3) || 0) + 1);
      // items: once per hero-game
      const seen = new Set();
      for (const it of h.items) {
        if (seen.has(it.key)) continue; seen.add(it.key);
        if (!itemAgg.has(it.key)) itemAgg.set(it.key, { item: it.key, buys: 0, wins: 0, mins: [], slots: [], heroes: new Map() });
        const x = itemAgg.get(it.key); x.buys++; if (h.win) x.wins++; x.mins.push(it.min); x.slots.push(h.items.indexOf(it) + 1); x.heroes.set(h.hero, (x.heroes.get(h.hero) || 0) + 1);
      }
    }
    // matchups: every opposing pair, every allied pair
    for (const a of m.heroes) for (const b of m.heroes) {
      if (a === b) continue;
      const map = a.team === b.team ? with_ : vs; if (a.team === b.team && a.hero > b.hero) continue;
      const k = `${a.hero}|${b.hero}`; if (!map.has(k)) map.set(k, { a: a.hero, b: b.hero, games: 0, wins: 0 });
      const x = map.get(k); x.games++; if (a.win) x.wins++;
    }
  }
  const heroes = [...H.values()].map((a) => {
    const avg = Object.fromEntries(HERO_FIELDS.map((f) => [f, r1(a.sums[f] / a.games)]));
    const perMin = Object.fromEntries(PER_MIN.map((f) => [f, r1(a.sums[f] / a.minutes)]));
    const top = [...a.builds.entries()].sort((x, y) => y[1] - x[1])[0];
    return {
      hero: a.hero, games: a.games, wins: a.wins, winRate: r3(a.wins / a.games), ci: wilson(a.wins, a.games).map(r3),
      pickRate: r3(a.games / (heroGames || 1)),
      kda: r3((a.sums.kills + a.sums.assists) / Math.max(1, a.sums.deaths)),
      avg, perMin, casts: a.casts.map((c) => r1(c / a.games)),
      firstItemMin: r2(mean(a.firstItem)), topBuild: top ? { items: top[0], share: r3(top[1] / a.games) } : null,
    };
  }).sort((x, y) => y.winRate - x.winRate);
  // ---- items
  const items = [...itemAgg.values()].map((x) => {
    const others = heroGames - x.buys, otherWins = decided * 3 - x.wins; // every decided match has 3 winning heroes
    return {
      item: x.item, buys: x.buys, buyRate: r3(x.buys / (heroGames || 1)), avgMin: r2(mean(x.mins)), avgSlot: r1(mean(x.slots)),
      winRate: r3(x.wins / x.buys), ci: wilson(x.wins, x.buys).map(r3), winRateWithout: r3(others ? otherWins / others : 0),
      topHeroes: [...x.heroes.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([h, n]) => `${h} ${n}`),
    };
  }).sort((p, q) => q.buys - p.buys);
  const pairsOut = (map) => [...map.values()].map((x) => ({ ...x, winRate: r3(x.wins / x.games), ci: wilson(x.wins, x.games).map(r3) }));
  return { summary, heroes, items, matchups: pairsOut(vs), synergies: pairsOut(with_) };
}
function rate(list, f) { return list.length ? list.filter(f).length / list.length : 0; }
function teamHeroes(m, team) { return m.heroes.filter((h) => h.team === team).map((h) => h.hero).sort().join(','); }

/** Compare two runs (A = baseline, B = candidate): per-hero and per-item win-rate deltas with z statistics. */
export function compare(aggA, aggB) {
  const idx = (list, k) => new Map(list.map((x) => [x[k], x]));
  const ha = idx(aggA.heroes, 'hero'), hb = idx(aggB.heroes, 'hero');
  const heroes = [...new Set([...ha.keys(), ...hb.keys()])].map((k) => {
    const a = ha.get(k) || { games: 0, wins: 0, winRate: 0, avg: {} }, b = hb.get(k) || { games: 0, wins: 0, winRate: 0, avg: {} };
    return { hero: k, gamesA: a.games, gamesB: b.games, winRateA: a.winRate, winRateB: b.winRate, delta: r3(b.winRate - a.winRate), z: r2(zTwo(b.wins, b.games, a.wins, a.games)),
      dmgHeroesA: a.avg.dmgHeroes || 0, dmgHeroesB: b.avg.dmgHeroes || 0, takenA: a.avg.taken || 0, takenB: b.avg.taken || 0 };
  }).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const ia = idx(aggA.items, 'item'), ib = idx(aggB.items, 'item');
  const items = [...new Set([...ia.keys(), ...ib.keys()])].map((k) => {
    const a = ia.get(k) || { buys: 0, winRate: 0, buyRate: 0 }, b = ib.get(k) || { buys: 0, winRate: 0, buyRate: 0 };
    return { item: k, buyRateA: a.buyRate, buyRateB: b.buyRate, winRateA: a.winRate, winRateB: b.winRate, delta: r3(b.winRate - a.winRate) };
  });
  const s = (k) => ({ a: aggA.summary[k], b: aggB.summary[k] });
  return { summary: { minutes: { a: aggA.summary.minutes.mean, b: aggB.summary.minutes.mean }, blueWinRate: s('blueWinRate'), killsPerMatch: s('killsPerMatch'), matches: s('matches') }, heroes, items };
}
