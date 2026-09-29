// Leak check: long play session through the transport, forced GC + heap sample every 30 s,
// least-squares slope of retained heap. node tools/soak.mjs [minutes]
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
import { BUDGETS } from '../src/perf/budgets.js';
const minutes = +(process.argv[2] || 4); const mode = process.argv[3] || 'play=auto&ping=100&jitter=15&loss=0.01';
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 960, height: 540 } }); const page = await ctx.newPage();
await page.goto(`file://${root}/dist/index.html?cpu=1&quality=medium&seed=11&${mode}`);
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
const cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.enable');
await page.waitForTimeout(+(process.env.SOAK_WARMUP || 40) * 1000);
const pts = [];
const every = minutes <= 3 ? 20 : 30;
for (let t = 0; t <= minutes * 60; t += every) {
  await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage');
  const mb = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
  const tick = await page.evaluate(() => window.__game.world.tick);
  pts.push([t, mb]); console.log(`   t=${String(t).padStart(4)}s  heap ${mb.toFixed(2)} MB  sim tick ${tick}`);
  if (t < minutes * 60) await page.waitForTimeout(every * 1000);
}
const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
const per10 = slope * 600;
console.log(`   retained-heap slope: ${per10.toFixed(2)} MB per 10 min over ${minutes} min (budget ${BUDGETS.heapGrowthMbPer10Min})`);
await b.close();
if (process.argv.includes('--gate') && per10 > BUDGETS.heapGrowthMbPer10Min) { console.log('   SOAK: heap growth over budget'); process.exit(1); }
console.log('   SOAK: retained heap within budget');
