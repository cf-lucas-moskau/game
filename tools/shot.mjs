// Screenshot helper: node tools/shot.mjs "<query>" out.png [waitSeconds] [width] [height]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright');
const [q = '', out = '/tmp/shot.png', wait = '6', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`file://${process.cwd()}/dist/index.html${q}`);
await page.waitForTimeout(+wait * 1000);
await page.screenshot({ path: out });
const perf = await page.evaluate(() => window.__perf && window.__perf.summary());
console.log(JSON.stringify(perf && { fps: perf.fps, frameP95Ms: perf.frameP95Ms, simTickP95Ms: perf.simTickP95Ms, renderCpuP95Ms: perf.renderCpuP95Ms, drawCallsMax: perf.drawCallsMax, trianglesMax: perf.trianglesMax, gpu: perf.gpu, entities: perf.entities }));
console.log(logs.slice(0, 15).join('\n'));
await browser.close();
