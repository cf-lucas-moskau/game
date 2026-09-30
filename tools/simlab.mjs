#!/usr/bin/env node
// Simulation lab: reproducible headless bot matches with statistics for balancing (docs/SIMLAB.md).
//
//   node tools/simlab.mjs run --matches 960 --seed 7                 all heroes, side-swapped pairs, 4 workers
//   node tools/simlab.mjs run --focus saffi --matches 400            Saffi in every match
//   node tools/simlab.mjs run --blue gus,brindle,vesper --red morrow,saffi,auctioneer --matches 200
//   node tools/simlab.mjs run --builds role --matches 960            random role-fitting builds (item evaluation)
//   node tools/simlab.mjs run --set heroes.saffi.base.ad=62 --ab     same matches without/with the change, compared
//   node tools/simlab.mjs run --patch balance.json --out b.json      a patch file (JSON: { "path": value })
//   node tools/simlab.mjs report simlab-results/x.json [--hero saffi] [--md out.md] [--csv dir]
//   node tools/simlab.mjs compare a.json b.json [--md out.md]
//   node tools/simlab.mjs paths saffi                                 patchable numbers of a hero
// The same config on the same commit always produces the same matches, whatever the worker count.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig, planMatch, runMatch, applyPatch, patchablePaths, BUILD_MODES } from '../src/stats/simlab.js';
import { aggregate, compare, HERO_FIELDS } from '../src/stats/aggregate.js';
import { fullReport, heroText, compareText, summaryText } from '../src/stats/report.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---- worker: apply the patch once, run the assigned match indices, post each record ----------------------------
if (!isMainThread) {
  const { config, indices } = workerData;
  applyPatch(config.patch);
  for (const i of indices) parentPort.postMessage(runMatch(planMatch(config, i), config));
  process.exit(0);
}

// ---- CLI ---------------------------------------------------------------------------------------------------------
const HELP = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n');
const argv = process.argv.slice(2), cmd = argv[0];
const flags = {}, sets = [], positional = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { positional.push(a); continue; }
  const [k, inline] = a.slice(2).split(/=(.*)/s);
  const boolean = ['ab', 'no-swap', 'duplicates', 'quiet', 'json', 'help'].includes(k);
  const v = boolean ? true : inline !== undefined ? inline : argv[++i];
  if (k === 'set') sets.push(v); else flags[k] = v;
}
const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);

function configFromFlags() {
  const patch = {};
  if (flags.patch) Object.assign(patch, JSON.parse(readFileSync(flags.patch, 'utf8')));
  for (const s of sets) {
    const m = /^([^=]+)=(.*)$/.exec(s); if (!m) throw new Error(`--set expects path=value: ${s}`);
    let v = m[2]; try { v = JSON.parse(v); } catch { /* keep "x1.1" / "+5" strings */ }
    patch[m[1]] = v;
  }
  if (flags.builds && !BUILD_MODES.includes(flags.builds)) throw new Error(`--builds: ${BUILD_MODES.join(' | ')}`);
  return resolveConfig({
    matches: flags.matches ? +flags.matches : undefined, seed: flags.seed ? +flags.seed : undefined,
    pool: list(flags.pool), blue: list(flags.blue), red: list(flags.red), focus: list(flags.focus) || [],
    swap: !flags['no-swap'], duplicates: !!flags.duplicates,
    difficulty: flags.difficulty, blueDifficulty: flags['blue-difficulty'], redDifficulty: flags['red-difficulty'],
    builds: flags.builds, maxMinutes: flags['max-minutes'] ? +flags['max-minutes'] : undefined, patch,
  });
}
const clean = (c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined));

/** Run every match of a config across worker threads; resolves to records sorted by match index. */
function runAll(config, workers, label) {
  const n = config.matches, out = new Array(n), tty = process.stderr.isTTY; let done = 0, lastPct = -1;
  const t0 = Date.now();
  const shards = Array.from({ length: Math.min(workers, n) }, () => []);
  for (let i = 0; i < n; i++) shards[i % shards.length].push(i);
  return Promise.all(shards.map((indices) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { config, indices } });
    w.on('message', (rec) => {
      out[rec.index] = rec; done++;
      // progress: a live line on a terminal, a line per quarter otherwise (logs)
      const p = Math.floor((done / n) * (tty ? 50 : 4));
      if (!flags.quiet && p !== lastPct) { lastPct = p; process.stderr.write(`${tty ? '\r' : ''}   ${label}: ${done}/${n} matches  ${((Date.now() - t0) / 1000).toFixed(1)} s${tty ? '   ' : '\n'}`); }
    });
    w.on('error', reject); w.on('exit', (code) => (code ? reject(new Error(`worker exited ${code}`)) : resolve()));
  }))).then(() => { if (!flags.quiet && tty) process.stderr.write('\n'); return { matches: out, durationMs: Date.now() - t0 }; });
}
function commitInfo() {
  try { return { commit: execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(), dirty: !!execSync('git status --porcelain -- src', { cwd: root }).toString().trim() }; }
  catch { return { commit: null, dirty: null }; }
}
function save(run, path) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(run)); return path; }
function defaultOut(label) { return join(root, 'simlab-results', `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}${label ? `-${label}` : ''}.json`); }

/** Flat CSVs for spreadsheets: one row per hero-game, per hero, per item. */
function writeCsv(run, agg, dir) {
  mkdirSync(dir, { recursive: true });
  const esc = (v) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = (head, rows) => [head.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const hg = [];
  for (const m of run.matches) for (const h of m.heroes) hg.push([m.index, m.seed, m.minutes, m.winner, h.team, h.hero, h.win ? 1 : 0, ...HERO_FIELDS.map((f) => h[f]), h.items.map((x) => x.key).join(' ')]);
  writeFileSync(join(dir, 'hero-games.csv'), csv(['match', 'seed', 'minutes', 'winner', 'team', 'hero', 'win', ...HERO_FIELDS, 'items'], hg));
  writeFileSync(join(dir, 'heroes.csv'), csv(['hero', 'games', 'winRate', 'ciLow', 'ciHigh', 'kda', ...HERO_FIELDS], agg.heroes.map((h) => [h.hero, h.games, h.winRate, h.ci[0], h.ci[1], h.kda, ...HERO_FIELDS.map((f) => h.avg[f])])));
  writeFileSync(join(dir, 'items.csv'), csv(['item', 'buys', 'buyRate', 'avgMin', 'avgSlot', 'winRate', 'ciLow', 'ciHigh', 'winRateWithout'], agg.items.map((x) => [x.item, x.buys, x.buyRate, x.avgMin, x.avgSlot, x.winRate, x.ci[0], x.ci[1], x.winRateWithout])));
  return dir;
}
function emit(text) { process.stdout.write(`${text}\n`); if (flags.md) { writeFileSync(flags.md, text.replace(/\x1b\[[0-9;]*m/g, '')); console.log(`\n   markdown written to ${flags.md}`); } }

async function main() {
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }
  if (cmd === 'paths') {
    const hero = positional[0]; if (!hero) throw new Error('usage: simlab paths <hero>');
    for (const [p, v, label] of patchablePaths(hero)) console.log(`${p.padEnd(52)} ${JSON.stringify(v)}${label ? `   (${label})` : ''}`);
    return;
  }
  if (cmd === 'run') {
    const config = configFromFlags(); const workers = Math.max(1, +(flags.workers || cpus().length));
    const md = !!flags.md; const info = commitInfo();
    if (flags.ab) {
      if (!Object.keys(config.patch).length) throw new Error('--ab needs a patch (--set or --patch): it compares the run without and with it');
      const base = { ...config, patch: {} };
      const A = { tool: 'simlab', version: 1, ...info, config: clean(base), workers, ...(await runAll(base, workers, 'baseline')) };
      const B = { tool: 'simlab', version: 1, ...info, config: clean(config), workers, ...(await runAll(config, workers, 'patched')) };
      const outA = save(A, flags.out ? flags.out.replace(/\.json$/, '') + '-A.json' : defaultOut(`${flags.label || 'ab'}-A`));
      const outB = save(B, flags.out ? flags.out.replace(/\.json$/, '') + '-B.json' : defaultOut(`${flags.label || 'ab'}-B`));
      const ga = aggregate(A), gb = aggregate(B);
      emit([summaryText(B, gb, md), compareText(compare(ga, gb), md)].join('\n'));
      console.log(`\n   results: ${outA}\n            ${outB}`);
      return;
    }
    const run = { tool: 'simlab', version: 1, ...info, config: clean(config), workers, ...(await runAll(config, workers, 'matches')) };
    const out = save(run, flags.out || defaultOut(flags.label));
    const agg = aggregate(run);
    if (flags.json) { console.log(JSON.stringify(agg)); return; }
    emit(flags.hero ? `${summaryText(run, agg, md)}\n${heroText(agg, flags.hero, md, +(flags['min-games'] || 20))}` : fullReport(run, agg, md));
    if (flags.csv) console.log(`   csv written to ${writeCsv(run, agg, flags.csv)}`);
    console.log(`\n   results: ${out}  (${(run.durationMs / 1000).toFixed(1)} s, ${workers} workers)`);
    return;
  }
  if (cmd === 'report') {
    const file = positional[0]; if (!file || !existsSync(file)) throw new Error('usage: simlab report <results.json>');
    const run = JSON.parse(readFileSync(file, 'utf8')); const agg = aggregate(run); const md = !!flags.md;
    if (flags.json) { console.log(JSON.stringify(agg)); return; }
    emit(flags.hero ? `${summaryText(run, agg, md)}\n${heroText(agg, flags.hero, md, +(flags['min-games'] || 20))}` : fullReport(run, agg, md));
    if (flags.csv) console.log(`   csv written to ${writeCsv(run, agg, flags.csv)}`);
    return;
  }
  if (cmd === 'compare') {
    const [a, b] = positional; if (!a || !b) throw new Error('usage: simlab compare <a.json> <b.json>');
    const A = JSON.parse(readFileSync(a, 'utf8')), B = JSON.parse(readFileSync(b, 'utf8'));
    emit(compareText(compare(aggregate(A), aggregate(B)), !!flags.md));
    return;
  }
  throw new Error(`unknown command ${cmd}\n\n${HELP}`);
}
main().catch((e) => { console.error(`simlab: ${e.message}`); process.exit(1); });
