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
// HUD pieces must not overlap each other on phones, in both orientations
for (const [w, hgt] of [[844, 390], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url('hero=gus&touch=1'));
  await page.waitForFunction(() => window.__game && window.__game.world.tick > 20, null, { timeout: 90000 });
  const hits = await page.evaluate(() => {
    const sel = { dock: '.dock', strip: '.topbar', clock: '.clock', score: '[data-act=score]', attack: '.tc-atk', D: '.tc-sp', R: '.tc-ab' };
    const r = {}; for (const k in sel) { const all = document.querySelectorAll(sel[k]), el = all[all.length - 1]; if (el) r[k] = el.getBoundingClientRect(); }
    const over = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const out = [], ks = Object.keys(r);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      if ((ks[i] === 'strip' && ks[j] === 'clock')) continue; // the clock hangs off the strip by design
      if (over(r[ks[i]], r[ks[j]])) out.push(`${ks[i]}/${ks[j]}`);
    }
    const offscreen = ks.filter((k) => r[k].left < 0 || r[k].top < 0 || r[k].right > innerWidth + 1 || r[k].bottom > innerHeight + 1);
    return { out, offscreen, found: ks.length };
  });
  check(`phone HUD has no overlaps at ${w}x${hgt}`, hits.found === 7 && !hits.out.length && !hits.offscreen.length, `${hits.found} parts${hits.out.length ? `, overlaps ${hits.out.join(' ')}` : ''}${hits.offscreen.length ? `, off screen ${hits.offscreen.join(' ')}` : ''}`);
  await ctx.close();
}
// ---------------- the game loop: hero select -> match -> shop -> surrender -> end screen -> hero select -> match
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${root}/dist/index.html?cpu=1&quality=low`);
  const menu = await until(page, () => !!document.querySelector('[data-act=play]'), null, 90000);
  check('hero select appears', menu);
  const k0 = await page.evaluate(() => document.querySelector('.hero-card h2').textContent);
  const seen = new Set([k0]);
  for (let i = 0; i < 4; i++) { await page.click('[data-act=reroll]'); seen.add(await page.evaluate(() => document.querySelector('.hero-card h2').textContent)); }
  check('reroll is unlimited and always changes the hero', seen.size >= 3 && !(await page.evaluate(() => document.querySelector('[data-act=reroll]').disabled)), `${seen.size} heroes after 4 rerolls`);
  const chosen = await page.evaluate(() => document.querySelector('.hero-card h2').textContent);
  await page.click('[data-act=play]');
  check('Fight starts a match with the chosen hero', await until(page, (n) => window.__game && window.__game.world.tick > 30 && window.__game.world.registry.heroes[window.__game.me.heroKey].name === n, chosen, 60000), `${k0} -> ${chosen}`);
  check('HUD shows the hero', await page.evaluate(() => !!document.querySelector('.hud .dock') && !document.querySelector('.menu')));
  check('audio unlocks on the first click and plays music and effects', await until(page, () => { const a = window.__app.audio; return a.ready && a.played > 20; }, null, 20000),
    await page.evaluate(() => { const a = window.__app.audio; return `${a.ctx && a.ctx.state}, ${a.played} voices played, ${a.dropped} dropped`; }));
  await page.keyboard.press('p');
  const gold0 = await page.evaluate(() => window.__game.me.gold);
  await page.click('.card[aria-disabled=false]');
  check('shop buys an item at the fountain', await until(page, () => window.__game.me.items.length === 1), `gold ${gold0 | 0} -> ${(await page.evaluate(() => window.__game.me.gold)) | 0}`);
  check('shop cards show what an item does for your hero', await page.evaluate(() => [...document.querySelectorAll('.card .impact')].some((x) => /For you: \+\d+/.test(x.textContent))),
    await page.evaluate(() => (document.querySelector('.card .impact') || {}).textContent || 'none'));
  await page.keyboard.press('Escape');
  check('Escape closes the shop', await page.evaluate(() => document.querySelector('[aria-label=Shop]').classList.contains('hidden')));
  await page.keyboard.press('Tab');
  check('Tab opens the scoreboard with six heroes', await until(page, () => document.querySelectorAll('[aria-label=Scoreboard] tbody tr').length === 6));
  await page.click('[aria-label=Scoreboard] tbody tr[data-id]:not(.me)');
  check('clicking a scoreboard row shows that hero\'s details and items', await until(page, () => { const p = document.querySelector('.inspect'); return p && !p.classList.contains('hidden') && p.querySelectorAll('.ins-item').length === 6; }));
  await page.keyboard.press('Escape');
  const ally = await page.evaluate(() => { const g = window.__game, a = g.world.heroes.find((h) => h !== g.me && h.team === g.me.team); return g.renderer.worldToScreen(a.x, a.y, 0.6); });
  await page.mouse.click(ally.x, ally.y);
  check('left-clicking a unit on the battlefield inspects it', await until(page, () => !document.querySelector('.inspect').classList.contains('hidden')), await page.evaluate(() => document.querySelector('.ins-name') ? document.querySelector('.ins-name').textContent : 'no panel'));
  await page.evaluate(() => window.__app.match.inspect.hide());
  await page.click('[data-act=menu]');
  await page.click('[data-act=surrender]'); await page.click('[data-act=confirm-surrender]');
  check('surrender ends the match in defeat', await until(page, () => document.querySelector('.end h1') && document.querySelector('.end h1').textContent === 'Defeat', null, 20000));
  await page.click('[data-act=again]');
  check('Play again returns to hero select', await until(page, () => !!document.querySelector('[data-act=play]') && !document.querySelector('.hud'), null, 30000));
  await page.click('[data-act=play]');
  check('a second match starts cleanly', await until(page, () => window.__game && window.__game.world.tick > 30 && window.__game.me.items.length === 0, null, 60000),
    `${await page.evaluate(() => document.querySelectorAll('canvas').length)} canvases`);
  check('audio voices are released (no leak across matches)', await page.evaluate(() => { const v = window.__app.audio.voices; return v.sfx <= 28 && v.music <= 22; }),
    await page.evaluate(() => JSON.stringify(window.__app.audio.voices)));
  check('no page errors (loop)', errors.length === 0, errors[0] || '');
  await page.close();
}
// ---------------- Leviathan Lab: every hero loads, casts every ability and plays every clip
{
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${root}/dist/index.html?lab=1&panel=0&paused=1&quality=low`);
  await page.waitForFunction(() => window.__lab, null, { timeout: 90000 });
  const r = await page.evaluate(() => {
    const lab = window.__lab, done = [];
    for (const h of lab.info().heroes) {
      lab.setHero(h);
      for (const c of lab.info().clips) { lab.anim(c, 0.2); lab.step(1 / 30); }
      lab.anim(null);
      for (const k of ['Q', 'W', 'E', 'R']) { lab.cast(k); lab.step(0.6); }
      lab.attack(); lab.step(1);
      done.push(h);
    }
    return done.length;
  });
  check('lab: every hero plays every clip and casts every ability', r === 6 && errors.length === 0, errors[0] || `${r} heroes`);
  await page.close();
}
await browser.close();
console.log(results.map((r) => '   ' + r).join('\n'));
if (failed) { console.log(`   E2E: ${failed} failure(s)`); process.exit(1); } else console.log('   E2E: all input and game-loop checks passed');
