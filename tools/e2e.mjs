// End-to-end input test: real mouse, keyboard and touch events in headless Chromium.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || '/home/claude/.npm-global/lib/node_modules/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = (q) => `file://${root}/dist/index.html?cpu=1&quality=low&seed=3&bots=easy&${q}`;
const results = []; let failed = 0;
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); if (!ok) failed++; };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const me = (page) => page.evaluate(() => { const h = window.__game.me; return { x: h.x, y: h.y, cds: [...h.cds], spellCds: [...h.spellCds], dead: h.dead }; });
const screenOf = (page, x, y) => page.evaluate(([x, y]) => window.__game.renderer.worldToScreen(x, y), [x, y]);
const until = async (page, fn, arg, ms = 20000) => { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };

// ---------------- desktop
{
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url('hero=vesper'));
  await page.waitForFunction(() => window.__game && window.__game.world.tick > 20, null, { timeout: 90000 });
  const a = await me(page);
  const tgt = await screenOf(page, a.x + 450, a.y);
  await page.mouse.move(tgt.x, tgt.y); await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  const moved = await until(page, (x0) => window.__game.me.x > x0 + 250, a.x);
  check('right-click moves the hero', moved, `x ${a.x | 0} -> ${(await me(page)).x | 0}`);
  const b = await me(page);
  const q = await screenOf(page, b.x + 300, b.y);
  await page.mouse.move(q.x, q.y); await page.keyboard.press('q');
  check('Q quick-casts at the cursor', await until(page, () => window.__game.me.cds[0] > 0));
  // draw a closed loop with W held (stop first: the camera follows the hero, so screen points
  // computed up front only map to a fixed world shape while the hero stands still)
  await page.keyboard.press('s');
  await until(page, () => { const h = window.__game.me; return Math.abs(h.x - h.px) + Math.abs(h.y - h.py) < 0.5; });
  await page.waitForTimeout(600);
  const c = await me(page); const cx = c.x + 250, cy = c.y; const pts = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI * 2; pts.push(await screenOf(page, cx + Math.cos(t) * 140, cy + Math.sin(t) * 140)); }
  await page.mouse.move(pts[0].x, pts[0].y); await page.keyboard.down('w');
  for (const p of pts) await page.mouse.move(p.x, p.y, { steps: 3 });
  const drawn = await page.evaluate(() => window.__game.renderer.aim.pts ? window.__game.renderer.aim.pts.length / 2 : 0);
  await page.keyboard.up('w');
  check('W with Vesper draws a stroke while held', drawn >= 8, `${drawn} points`);
  check('closed loop casts Loop on release', await until(page, () => window.__game.me.cds[1] > 0));
  await page.keyboard.press('d');
  check('D casts Dash', await until(page, () => window.__game.me.spellCds[0] > 0));
  const lat = await page.evaluate(() => window.__perf.summary().inputLatencyP95Ms);
  check('input latency is being measured', lat > 0, `${lat} ms p95 (software GPU: frame-bound)`);
  check('no page errors (desktop)', errors.length === 0, errors[0] || '');
  await page.close();
}
// ---------------- touch
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url('hero=saffi&touch=1'));
  await page.waitForFunction(() => window.__game && window.__game.world.tick > 20, null, { timeout: 90000 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) });
  const a = await me(page);
  await touch('touchStart', [{ x: 150, y: 280, id: 1 }]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 150 + i * 10, y: 280, id: 1 }]);
  const moved = await until(page, (x0) => window.__game.me.x > x0 + 150, a.x, 25000);
  await touch('touchEnd', []);
  check('joystick drag moves the hero', moved, `x ${a.x | 0} -> ${(await me(page)).x | 0}`);
  const btn = await page.evaluate(() => { const r = document.querySelectorAll('.tc-ab')[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await touch('touchStart', [{ ...btn, id: 2 }]); await touch('touchEnd', []);
  check('tapping Q quick-casts', await until(page, () => window.__game.me.cds[0] > 0));
  // drag an ability onto the cancel zone: no cast
  const btnW = await page.evaluate(() => { const r = document.querySelectorAll('.tc-ab')[1].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await touch('touchStart', [{ ...btnW, id: 3 }]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: btnW.x - i * 20, y: btnW.y - i * 10, id: 3 }]);
  const cancelVisible = await page.evaluate(() => document.querySelector('.tc-cancel').classList.contains('on'));
  const c = await page.evaluate(() => { const r = document.querySelector('.tc-cancel').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await touch('touchMove', [{ ...c, id: 3 }]); await touch('touchEnd', []);
  await page.waitForTimeout(1500);
  check('cancel zone appears while aiming', cancelVisible);
  check('releasing on cancel does not cast', (await me(page)).cds[1] === 0);
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.tc-ab')].map((b) => b.getBoundingClientRect().width));
  check('ability buttons are at least 48 px', sizes.every((s) => s >= 48), sizes.map((s) => s | 0).join('/'));
  check('no page errors (touch)', errors.length === 0, errors[0] || '');
  await ctx.close();
}
await browser.close();
console.log(results.map((r) => '   ' + r).join('\n'));
if (failed) { console.log(`   E2E: ${failed} failure(s)`); process.exit(1); } else console.log('   E2E: all input checks passed');
