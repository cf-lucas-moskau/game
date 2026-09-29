#!/usr/bin/env node
// Leviathan Lab CLI: look at heroes, animations and effects up close without playing a match.
// Drives the in-game lab (src/app/lab.js, index.html?lab=1) in headless Chromium and writes PNGs.
//
//   node tools/lab.mjs info    [--hero saffi]                              clips, abilities, cameras (JSON)
//   node tools/lab.mjs shot    --hero saffi [--cam close] [--clip attack --time 0.3] [--out x.png]
//   node tools/lab.mjs strip   --hero saffi --clip attack [--frames 8]     animation frames across the clip
//   node tools/lab.mjs ability --hero gus --slot R [--frames 6 --every 0.15] timeline after a cast
//   node tools/lab.mjs attack  --hero vesper [--frames 6 --every 0.08]    auto-attack timeline
//   node tools/lab.mjs heroes  [--cam front] [--clip idle]                 every hero, one tile each
//   node tools/lab.mjs skins   [--hero saffi] [--cam front]                every skin (of one hero, or of all), one tile each
// Common: --cam front|side|back|three|close|top|wide|game  --zoom 1  --size 640x480  --quality high
//         --skin bluewick  --dummy morrow --dummies 2  --out path.png (default .shots/lab-<command>-<hero>.png)
// Needs `npm run build` first (reads dist/index.html). PW_PATH points at a playwright install.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const [cmd = 'info', ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2), v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true'; opt[k] = v; }
const hero = opt.hero || 'vesper', cam = opt.cam || (cmd === 'ability' || cmd === 'attack' ? 'wide' : 'three'), zoom = +(opt.zoom || 1);
const [W, H] = (opt.size || (cmd === 'shot' ? '960x640' : '480x360')).split('x').map(Number);
const frames = +(opt.frames || (cmd === 'strip' ? 8 : 6)), every = +(opt.every || (cmd === 'attack' ? 0.08 : 0.15));
const out = opt.out || join(root, '.shots', `lab-${cmd}-${cmd === 'heroes' || (cmd === 'skins' && !opt.hero) ? 'all' : hero}${opt.skin ? '-' + opt.skin : ''}${opt.clip ? '-' + opt.clip : ''}${opt.slot ? '-' + opt.slot : ''}.png`);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function openLab(h, skin = opt.skin || 'classic') {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${root}/dist/index.html?lab=1&panel=0&paused=1&hero=${h}&skin=${skin}&cam=${cam}&zoom=${zoom}&quality=${opt.quality || 'high'}&dummy=${opt.dummy || 'morrow'}&dummies=${opt.dummies || 2}`);
  await page.waitForFunction(() => window.__lab, null, { timeout: 90000 });
  await page.evaluate(() => window.__lab.step(0.3));
  return page;
}
const tiles = []; // [label, png buffer]
const snap = async (page, label) => tiles.push([label, await page.screenshot()]);

if (cmd === 'info') {
  const page = await openLab(hero); console.log(JSON.stringify(await page.evaluate(() => window.__lab.info()), null, 2));
} else if (cmd === 'shot') {
  const page = await openLab(hero);
  if (opt.clip) await page.evaluate(([c, t]) => window.__lab.anim(c, t), [opt.clip, opt.time !== undefined ? +opt.time : null]);
  await page.evaluate(() => window.__lab.step(1 / 30));
  await page.screenshot({ path: out }); console.log(out);
} else if (cmd === 'strip') {
  const page = await openLab(hero), clip = opt.clip || 'idle';
  const dur = await page.evaluate((c) => { window.__lab.anim(c, 0); return window.__lab.heroView().actions[c].getClip().duration; }, clip);
  for (let i = 0; i < frames; i++) { const t = (i / frames) * dur; await page.evaluate(([c, tt]) => { window.__lab.anim(c, tt); window.__lab.step(1 / 60); }, [clip, t]); await snap(page, `${hero} ${clip} t=${t.toFixed(2)}s`); }
} else if (cmd === 'ability' || cmd === 'attack') {
  const page = await openLab(hero), slot = opt.slot || 'Q';
  const name = await page.evaluate(([c, s]) => (c === 'attack' ? (window.__lab.attack(), 'auto-attack') : window.__lab.cast(s, 'dummy')), [cmd, slot]);
  for (let i = 0; i < frames; i++) { await page.evaluate((dt) => window.__lab.step(dt), i === 0 ? 1 / 30 : every); await snap(page, `${hero} ${cmd === 'attack' ? 'auto' : slot + ' ' + name} +${(i === 0 ? 1 / 30 : 1 / 30 + i * every).toFixed(2)}s`); }
} else if (cmd === 'skins') {
  const first = await openLab(opt.hero || 'vesper'), all = await first.evaluate(() => window.__lab.info().heroes); await first.close();
  for (const h of opt.hero ? [opt.hero] : all) {
    const probe = await openLab(h), skins = await probe.evaluate(() => window.__lab.info().skins); await probe.close();
    for (const k of skins) { const page = await openLab(h, k); await snap(page, `${h} · ${k}`); await page.close(); }
  }
} else if (cmd === 'heroes') {
  const first = await openLab(hero), all = await first.evaluate(() => window.__lab.info().heroes); await first.close();
  for (const h of all) {
    const page = await openLab(h);
    if (opt.clip) await page.evaluate((c) => { window.__lab.anim(c, 0.3); window.__lab.step(1 / 60); }, opt.clip);
    await snap(page, h); await page.close();
  }
} else { console.log(`unknown command ${cmd}`); process.exitCode = 1; }

if (tiles.length) { // contact sheet with labels
  const dir = join(tmpdir(), `lab-${process.pid}`); mkdirSync(dir, { recursive: true });
  const cols = Math.min(4, tiles.length), files = tiles.map(([, buf], i) => { const f = join(dir, `${i}.png`); writeFileSync(f, buf); return f; });
  const html = `<body style="margin:0;background:#0c0e24;display:grid;grid-template-columns:repeat(${cols},${W}px);gap:3px">${tiles.map(([label], i) => `<div style="position:relative"><img src="file://${files[i]}" style="display:block;width:${W}px"><b style="position:absolute;left:8px;top:6px;color:#e8dcc4;font:700 13px system-ui;text-shadow:0 1px 3px #000">${label}</b></div>`).join('')}</body>`;
  writeFileSync(join(dir, 'sheet.html'), html);
  const p = await browser.newPage({ viewport: { width: cols * (W + 3), height: 200 } });
  await p.goto(`file://${join(dir, 'sheet.html')}`); await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth), null, { timeout: 20000 });
  mkdirSync(dirname(out), { recursive: true }); await p.screenshot({ path: out, fullPage: true }); rmSync(dir, { recursive: true, force: true });
  console.log(out);
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); process.exitCode = 1; }
await browser.close();
