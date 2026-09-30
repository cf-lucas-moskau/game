// Text and Markdown reports for simulation-lab aggregates (see aggregate.js). One table model, two renderers.
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const ci = (c) => `${(c[0] * 100).toFixed(0)}-${(c[1] * 100).toFixed(0)}`;
const num = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v * 10) / 10}`);
/** Significance flag: the 95% interval excludes 50%. */
const sig = (c) => (c[0] > 0.5 ? ' ▲' : c[1] < 0.5 ? ' ▼' : '');

/** Render rows (arrays of cells) with a header as an aligned text table or a Markdown table. */
export function table(head, rows, md = false) {
  if (md) return [`| ${head.join(' | ')} |`, `|${head.map((h, i) => (i ? ' ---: ' : ' --- ')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => (i ? String(c).padStart(w[i]) : String(c).padEnd(w[i]))).join('  ');
  return [line(head), w.map((n) => '-'.repeat(n)).join('  '), ...rows.map(line)].join('\n');
}
const title = (t, md) => (md ? `\n## ${t}\n` : `\n${t}\n${'='.repeat(t.length)}`);

export function summaryText(run, agg, md = false) {
  const s = agg.summary, c = run.config;
  const cfg = [`${s.matches} matches (${s.decided} decided, ${s.timedOut} timed out)`, `seed ${c.seed}`, `bots ${c.blueDifficulty || c.difficulty} vs ${c.redDifficulty || c.difficulty}`,
    `builds ${c.builds}`, c.swap ? 'side-swapped pairs' : 'no side swap', c.focus.length ? `focus ${c.focus.join(',')}` : '', c.blue ? `blue ${c.blue.join(',')}` : '', c.red ? `red ${c.red.join(',')}` : '',
    Object.keys(c.patch || {}).length ? `patch: ${Object.entries(c.patch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}` : '', `commit ${run.commit || '?'}`].filter(Boolean).join(' · ');
  const rows = [
    ['Match length (min)', `mean ${s.minutes.mean}, median ${s.minutes.median}, p10 ${s.minutes.p10}, p90 ${s.minutes.p90}, max ${s.minutes.max}`],
    ['Blue side win rate', `${pct(s.blueWinRate)} (95% CI ${ci(s.blueCi)})`],
    ['Kills per match', `${s.killsPerMatch}`],
    ['First blood', `${s.firstBloodMin} min; its team wins ${pct(s.firstBloodWinRate)}`],
    ['First tower', `${s.firstTowerMin} min; its team wins ${pct(s.firstTowerWinRate)}`],
    ['Sudden death reached', pct(s.suddenDeathRate)],
    ['Swapped pairs', `${s.pairsSplit} split, ${s.pairsSweep} won by the same roster on both sides`],
    ['Sim time per match', `${s.simMsPerMatch} ms`],
  ];
  return `${title('Run', md)}\n${cfg}\n\n${table(['metric', 'value'], rows, md)}`;
}

export function heroesText(agg, md = false) {
  const rows = agg.heroes.map((h) => [h.hero, h.games, `${pct(h.winRate)}${sig(h.ci)}`, ci(h.ci), `${h.avg.kills}/${h.avg.deaths}/${h.avg.assists}`, h.kda,
    num(h.avg.dmgHeroes), num(h.perMin.dmgHeroes), num(h.avg.taken), num(h.avg.healAllies + h.avg.shieldAllies), num(h.avg.healSelf + h.avg.shieldSelf),
    r(h.avg.ccStun + h.avg.ccRoot + h.avg.ccAirborne), r(h.avg.slowSec), num(h.avg.dmgStructures), num(h.perMin.goldEarned), h.avg.cs, h.avg.level, r(h.avg.secondsDead)]);
  return `${title('Heroes (per game; ▲/▼: 95% interval excludes 50%)', md)}\n${table(['hero', 'n', 'win', 'CI', 'K/D/A', 'KDA', 'dmg→heroes', '/min', 'taken', 'heal+shield allies', 'self', 'CC s', 'slow s', 'dmg→towers', 'gold/min', 'cs', 'lvl', 'dead s'], rows, md)}`;
}

export function damageText(agg, md = false) {
  const rows = agg.heroes.map((h) => {
    const d = h.avg, t = d.dmgHeroes || 1;
    return [h.hero, num(d.dmgHeroes), `${Math.round((d.dmgHeroesPhys / t) * 100)}/${Math.round((d.dmgHeroesMagic / t) * 100)}/${Math.round((d.dmgHeroesTrue / t) * 100)}`,
      `${Math.round((d.dmgHeroesBasic / t) * 100)}/${Math.round((d.dmgHeroesAbility / t) * 100)}/${Math.round((d.dmgHeroesOther / t) * 100)}`,
      num(d.dmgMinions), num(d.takenHeroes), num(d.takenMinions), num(d.takenStructures), r(d.ccTaken), h.casts.join('/')];
  });
  return `${title('Damage profile (per game)', md)}\n${table(['hero', 'dmg→heroes', 'phys/magic/true %', 'basic/ability/other %', 'dmg→minions', 'taken: heroes', 'minions', 'towers', 'CC taken s', 'casts Q/W/E/R'], rows, md)}`;
}

export function itemsText(agg, md = false) {
  const rows = agg.items.map((x) => [x.item, x.buys, pct(x.buyRate), x.avgMin, x.avgSlot, `${pct(x.winRate)}${sig(x.ci)}`, ci(x.ci), pct(x.winRateWithout), x.topHeroes.join(', ')]);
  return `${title('Items (win rate of hero-games that bought it; builds follow the run\'s build mode)', md)}\n${table(['item', 'buys', 'of heroes', 'avg min', 'avg slot', 'win', 'CI', 'win without', 'top buyers'], rows, md)}`;
}

export function buildsText(agg, md = false) {
  const rows = agg.heroes.map((h) => [h.hero, h.firstItemMin, h.topBuild ? h.topBuild.items : '-', h.topBuild ? pct(h.topBuild.share) : '-']);
  return `${title('Builds (first three items)', md)}\n${table(['hero', 'first item min', 'most common start', 'share'], rows, md)}`;
}

/** One hero in depth: every averaged field, best and worst matchups and partners (min games filter). */
export function heroText(agg, key, md = false, minGames = 20) {
  const h = agg.heroes.find((x) => x.hero === key); if (!h) return `no games for ${key}`;
  const fields = Object.entries(h.avg).map(([k, v]) => [k, num(v)]);
  const mu = agg.matchups.filter((m) => m.a === key && m.games >= minGames).sort((a, b) => b.winRate - a.winRate);
  const sy = agg.synergies.filter((m) => (m.a === key || m.b === key) && m.games >= minGames).map((m) => ({ ...m, other: m.a === key ? m.b : m.a })).sort((a, b) => b.winRate - a.winRate);
  const muRows = mu.map((m) => [m.b, m.games, `${pct(m.winRate)}${sig(m.ci)}`, ci(m.ci)]);
  const syRows = sy.map((m) => [m.other, m.games, `${pct(m.winRate)}${sig(m.ci)}`, ci(m.ci)]);
  return [`${title(`${key}: ${pct(h.winRate)} over ${h.games} games (CI ${ci(h.ci)})`, md)}`, table(['stat (per game)', 'value'], fields, md),
    `${title(`${key} against (min ${minGames} games)`, md)}`, table(['enemy', 'n', 'win', 'CI'], muRows, md),
    `${title(`${key} with (min ${minGames} games)`, md)}`, table(['ally', 'n', 'win', 'CI'], syRows, md)].join('\n');
}

export function compareText(cmp, md = false) {
  const s = cmp.summary;
  const head = `${title('Compare (A = baseline, B = candidate)', md)}\nmatches ${s.matches.a} / ${s.matches.b} · minutes ${s.minutes.a} -> ${s.minutes.b} · blue win ${pct(s.blueWinRate.a)} -> ${pct(s.blueWinRate.b)} · kills ${s.killsPerMatch.a} -> ${s.killsPerMatch.b}`;
  const rows = cmp.heroes.map((h) => [h.hero, `${h.gamesA}/${h.gamesB}`, pct(h.winRateA), pct(h.winRateB), `${h.delta >= 0 ? '+' : ''}${(h.delta * 100).toFixed(1)}`, `${h.z}${Math.abs(h.z) >= 1.96 ? ' *' : ''}`, `${num(h.dmgHeroesA)} -> ${num(h.dmgHeroesB)}`, `${num(h.takenA)} -> ${num(h.takenB)}`]);
  const items = cmp.items.filter((x) => x.buyRateA || x.buyRateB).map((x) => [x.item, `${pct(x.buyRateA)} -> ${pct(x.buyRateB)}`, `${pct(x.winRateA)} -> ${pct(x.winRateB)}`]);
  return `${head}\n\n${table(['hero', 'n A/B', 'win A', 'win B', 'Δ pts', 'z (* = p<.05)', 'dmg→heroes', 'taken'], rows, md)}\n${title('Items', md)}\n${table(['item', 'bought', 'win'], items, md)}`;
}

export function fullReport(run, agg, md = false) {
  return [md ? `# Simulation lab report\n` : '', summaryText(run, agg, md), heroesText(agg, md), damageText(agg, md), buildsText(agg, md), itemsText(agg, md)].join('\n');
}
function r(v) { return Math.round(v * 10) / 10; }
