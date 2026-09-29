// Performance benchmark: runs the production build in headless Chromium under scripted scenarios,
// collects in-game telemetry (window.__perf) plus Chrome DevTools data (forced-GC heap, GC pauses
// from a trace, long tasks), and compares against budgets and the stored baseline.
//   node tools/bench.mjs                 run + report
//   node tools/bench.mjs --gate          exit 1 on budget failure or >10% regression
//   node tools/bench.mjs --update-baseline
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUDGETS, GATED, GATED_REAL_GPU, REGRESSION_TOLERANCE } from '../src/perf/budgets.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick') || args.has('--gate');
// Two passes per scenario: `cpu` renders the identical scene (same draw calls and JS work) into a
// 160x90 buffer so rasterization on the software GPU does not starve the main thread and hundreds of
// frames are sampled; `full` renders at real resolution for frame-time / GPU reporting.
const MIN_FRAMES = 200; // p95 from >= 200 samples keeps at least 10 samples in the tail
const SCENARIOS = [
  { name: 'desktop-medium', viewport: { width: 1280, height: 720 }, query: 'quality=medium&skip=150&spectate=1', seconds: quick ? 30 : 90 },
  { name: 'play-ping100', viewport: { width: 1280, height: 720 }, query: 'quality=medium&skip=60&play=auto&ping=100&jitter=15&loss=0.01', seconds: quick ? 30 : 90 },
  { name: 'mobile-low', viewport: { width: 844, height: 390 }, mobile: true, cpuThrottle: 4, query: 'quality=low&skip=150&play=auto&ping=100&jitter=20&loss=0.02', seconds: quick ? 70 : 120 },
];
const lowerIsBetter = (k) => !/fps/i.test(k);

async function runScenario(browser, sc) {
  const ctx = await browser.newContext({ viewport: sc.viewport, isMobile: !!sc.mobile, hasTouch: !!sc.mobile, deviceScaleFactor: sc.mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let cdp = await ctx.newCDPSession(page);
  // warmup covers JIT tier-up, shader compilation and V8's one-time memory-reducer GC (~30 s after load)
  const warm = +(process.env.BENCH_WARMUP || 35);
  const t0 = Date.now();
  await page.goto(`file://${root}/dist/index.html?bench=1&cpu=1&${sc.query}&warmup=${warm}&seconds=${sc.seconds}`);
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  const loadWallMs = Date.now() - t0;
  // players hear the game: unlock audio as their first click would (launched with the autoplay flag)
  await page.evaluate(() => window.__app && window.__app.audio.unlock());
  // (re)attach after navigation: a file:// load can swap renderer processes and drop emulation state
  cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (sc.cpuThrottle) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: sc.cpuThrottle });
    // verify throttling is live: a fixed busy loop must take roughly `rate` times longer
    const probe = () => page.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 3e7; i++) x += Math.sqrt(i); return performance.now() - t + (x < 0 ? 1 : 0); });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await probe(); const fast = await probe(); // first call warms the JIT
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: sc.cpuThrottle }); const slow = await probe();
    sc.throttleFactor = +(slow / fast).toFixed(1);
    if (slow / fast < sc.cpuThrottle * 0.6) throw new Error(`CPU throttling not effective (${(slow / fast).toFixed(1)}x)`);
  }
  await page.waitForTimeout(warm * 1000);
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
  const heap0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  const traceFile = join('/tmp', `bench-${sc.name}.json`);
  await browser.startTracing(page, { path: traceFile, categories: ['v8', 'devtools.timeline', 'disabled-by-default-devtools.timeline'] });
  await page.waitForFunction(() => window.__perf.done, null, { timeout: (sc.seconds + 120) * 1000, polling: 1000 });
  await browser.stopTracing();
  await cdp.send('HeapProfiler.collectGarbage');
  const heap1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  const r = await page.evaluate(() => window.__perf.result);
  // GC pauses from the trace
  // GC pauses: thread CPU time (tdur), so preemption by the software rasterizer on shared cores is not counted
  // as GC cost. V8 memory-reducer compactions are housekeeping, reported separately.
  let gcMax = 0, gcTotal = 0, gcCount = 0, gcWorst = null, reducerMax = 0, reducerCount = 0, gcWallMax = 0; const pauses = [];
  try {
    const tr = JSON.parse(readFileSync(traceFile, 'utf8')); const evs = tr.traceEvents || tr;
    const reducer = evs.filter((e) => e.name === 'V8.GCFinalizeMCReduceMemory').map((e) => e.ts);
    for (const e of evs) if ((e.name === 'MajorGC' || e.name === 'MinorGC') && e.dur) {
      const cpu = (e.tdur ?? e.dur) / 1000; gcWallMax = Math.max(gcWallMax, e.dur / 1000);
      if (reducer.some((ts) => ts >= e.ts && ts <= e.ts + e.dur)) { reducerCount++; reducerMax = Math.max(reducerMax, cpu); continue; }
      gcCount++; gcTotal += cpu; pauses.push(cpu);
      if (cpu > gcMax) { gcMax = cpu; gcWorst = { name: e.name, cpuMs: +cpu.toFixed(2), wallMs: +(e.dur / 1000).toFixed(2), type: e.args?.type }; }
    }
    if (process.env.KEEP_TRACE) console.log('   trace kept at', traceFile); else rmSync(traceFile);
  } catch {}
  await ctx.close();
  const secs = r.seconds || sc.seconds;
  return { scenario: sc.name, ...r, throttleFactor: sc.throttleFactor || 1, loadMs: r.loadMs, loadWallMs, gcPauseMaxMs: +gcMax.toFixed(2), gcTotalMs: +gcTotal.toFixed(1), gcCount, gcWorst, gcWallMaxMs: +gcWallMax.toFixed(2), memoryReducerMaxMs: +reducerMax.toFixed(2), memoryReducerCount: reducerCount,
    gcPauseP99Ms: +(pauses.sort((a, b) => a - b)[Math.min(pauses.length - 1, Math.floor(pauses.length * 0.99))] || 0).toFixed(2), gcPausesOver5Ms: pauses.filter((p) => p > 5).length,
    heapGrowthMbPer10Min: +(((heap1 - heap0) / 1048576) / secs * 600).toFixed(2), heapRetainedMb: +(heap1 / 1048576).toFixed(1), errors };
}

function evaluate(results, baseline) {
  const fails = [], lines = [];
  for (const r of results) {
    const software = /SwiftShader|llvmpipe|Software/i.test(r.gpu || '');
    const gated = software ? GATED : GATED_REAL_GPU;
    lines.push(`\n  ${r.scenario}  (${software ? 'software GPU: CPU-side metrics gate' : 'hardware GPU'})`);
    for (const k of [...new Set([...GATED_REAL_GPU, 'gcPauseP99Ms', 'gcPausesOver5Ms', 'uiUpdateP95Ms', 'audioUpdateP95Ms', 'heapGrowthMbPer10Min', 'gcWallMaxMs', 'gcCount', 'memoryReducerMaxMs', 'throttleFactor', 'fps', 'onePercentLowFps', 'trianglesMax', 'postPasses', 'longTasks'])]) {
      if (r[k] === undefined) continue;
      const budget = BUDGETS[k]; const isGated = gated.includes(k);
      const ok = budget === undefined || (lowerIsBetter(k) ? r[k] <= budget : r[k] >= budget);
      const base = baseline && baseline[r.scenario] && baseline[r.scenario][k];
      let reg = '';
      if (isGated && typeof base === 'number' && base > 0.05 && lowerIsBetter(k)) {
        // throttled scenarios: the effective throttle factor varies run to run (measured 2.8x-5.1x),
        // so time metrics are compared per unit of throttle, and the noise floor scales with it
        const timeMetric = /Ms$/.test(k), bf = (baseline[r.scenario].throttleFactor || 1), rf = (r.throttleFactor || 1);
        const cur = timeMetric ? r[k] / rf : r[k], ref = timeMetric ? base / bf : base;
        const delta = (cur - ref) / ref; reg = ` (baseline ${base}, ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%${timeMetric && rf > 1 ? ' throttle-normalized' : ''})`;
        // regression = relative tolerance exceeded AND above a noise floor of 10% of the budget
        // heap growth from a 30 s window scatters by ~half its budget (JIT, caches, match progression);
        // tools/soak.mjs is the authoritative leak check
        const floor = Math.max(0.2, (budget || 0) * (k === 'heapGrowthMbPer10Min' ? 0.5 : 0.1)) * (timeMetric ? Math.max(rf, bf) : 1);
        if (delta > REGRESSION_TOLERANCE && r[k] - base > floor) fails.push(`${r.scenario}.${k} regressed ${(delta * 100).toFixed(0)}% (+${(r[k] - base).toFixed(2)})`);
      }
      if (isGated && !ok) fails.push(`${r.scenario}.${k} = ${r[k]} over budget ${budget}`);
      lines.push(`   ${isGated ? (ok ? 'PASS' : 'FAIL') : 'info'}  ${k.padEnd(22)} ${String(r[k]).padStart(9)}${budget !== undefined ? `  / ${budget}` : ''}${reg}`);
    }
    if (r.frames < MIN_FRAMES) fails.push(`${r.scenario}: only ${r.frames} frames sampled (need ${MIN_FRAMES}); result not valid`);
    lines.push(`   info  ${'frames sampled'.padEnd(22)} ${String(r.frames).padStart(9)}  (min ${MIN_FRAMES})`);
    if (r.errors.length) { fails.push(`${r.scenario}: ${r.errors.length} page errors`); lines.push(`   FAIL  page errors: ${r.errors.slice(0, 3).join(' | ')}`); }
  }
  return { fails, report: lines.join('\n') };
}

const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const dir = join(root, 'perf-results'); mkdirSync(dir, { recursive: true });
const basePath = join(dir, 'baseline.json');
const commit = argOf('--commit') || (existsSync(join(root, 'dist/.commit')) ? readFileSync(join(root, 'dist/.commit'), 'utf8').trim() : 'working-tree');
const partialPath = (name) => join(dir, `partial-${name}.json`);

async function runAndStore(list) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const out = [];
  for (const sc of list) { process.stdout.write(`   running ${sc.name} (${sc.seconds}s)...\n`); const r = await runScenario(browser, sc); r.commit = commit; out.push(r); writeFileSync(partialPath(sc.name), JSON.stringify(r, null, 2)); }
  await browser.close();
  return out;
}
let results;
if (argOf('--scenario')) {
  const sc = SCENARIOS.find((x) => x.name === argOf('--scenario'));
  if (!sc) { console.log('unknown scenario'); process.exit(1); }
  results = await runAndStore([sc]);
  const r = results[0];
  console.log(`   ${sc.name}: frames ${r.frames}, sim p95 ${r.simTickP95Ms} ms, render update p95 ${r.renderUpdateP95Ms} ms, GC max ${r.gcPauseMaxMs} ms, draws ${r.drawCallsMax}`);
  if (r.errors.length) { console.log('   page errors:', r.errors.slice(0, 3).join(' | ')); process.exit(1); }
  process.exit(0); // budgets are judged in --evaluate, across all scenarios of the same commit
} else if (args.has('--evaluate')) {
  results = SCENARIOS.map((sc) => { const p = partialPath(sc.name); if (!existsSync(p)) { console.log(`   missing result for ${sc.name}`); process.exit(1); } return JSON.parse(readFileSync(p, 'utf8')); });
  const stale = results.filter((r) => r.commit !== commit);
  if (stale.length) { console.log(`   results are not from ${commit}: ${stale.map((r) => r.scenario).join(', ')}`); process.exit(1); }
} else {
  results = await runAndStore(SCENARIOS);
}
const baseline = existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : null;
const { fails, report } = evaluate(results, baseline);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
writeFileSync(join(dir, `${stamp}.json`), JSON.stringify(results, null, 2));
console.log(report);
if (args.has('--update-baseline') || !baseline) {
  writeFileSync(basePath, JSON.stringify(Object.fromEntries(results.map((r) => [r.scenario, r])), null, 2));
  console.log(`\n   baseline ${baseline ? 'updated' : 'created'}: perf-results/baseline.json`);
}
if (fails.length) { console.log(`\n   PERF GATE: ${fails.length} failure(s)\n   - ${fails.join('\n   - ')}`); if (args.has('--gate')) process.exit(1); }
else console.log('\n   PERF GATE: all gated metrics within budget');
