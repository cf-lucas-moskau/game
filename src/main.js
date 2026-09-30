import './ui/styles.css';
import { AssetLibrary } from './render/assets.js';
import { telemetry } from './perf/telemetry.js';
import { startSpectate } from './app/spectate.js';
import { App } from './app/app.js';
import { Lab, labPanel } from './app/lab.js';
import { loadFonts } from './ui/fonts.js';
import { defaultQuality } from './render/quality.js';
import { HERO_KEYS } from './sim/heroes/index.js';

const params = new URLSearchParams(location.search);
const root = document.getElementById('app');
Object.assign(document.body.style, { margin: 0, overflow: 'hidden', background: '#1c1f4a' });
root.innerHTML = '<div id="boot" class="veil"><div><div class="t">Leviathan Lane</div><div class="s">Waking the whale…</div></div></div>';
const bootText = root.querySelector('#boot .s');

const num = (k, d) => (params.has(k) ? +params.get(k) : d);
async function boot() {
  const t0 = performance.now();
  const lib = new AssetLibrary();
  await Promise.all([lib.loadAll((p) => { bootText.textContent = `Waking the whale… ${Math.round(p * 100)}%`; }), loadFonts()]);
  telemetry.gauges.loadMs = Math.round(performance.now() - t0);
  const veil = root.querySelector('#boot'); veil.classList.add('out'); setTimeout(() => veil.remove(), 400);
  if (params.has('lab')) {
    // Leviathan Lab: heroes, animations and effects up close (see src/app/lab.js, tools/lab.mjs)
    const lab = window.__lab = new Lab({ root, lib, quality: params.get('quality') || 'high', hero: params.get('hero') || 'vesper', skin: params.get('skin') || undefined, dummy: params.get('dummy') || 'morrow', dummies: num('dummies', 2) });
    lab.camera(params.get('cam') || 'three', num('zoom', 1));
    if (params.get('panel') !== '0') { const ui = document.createElement('div'); ui.className = 'ui'; root.append(ui); labPanel(ui, lab); }
    if (params.get('paused') !== '1') lab.play();
  } else if (params.has('spectate')) {
    // bot-only match without UI: benchmark scenario and attract mode
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block' });
    root.prepend(canvas);
    window.__game = startSpectate({ canvas, lib, seed: num('seed', (Date.now() & 0xffff) || 7), quality: params.get('quality') || defaultQuality(), telemetry,
      skipSeconds: num('skip', 0), fixedBuffer: params.get('cpu') ? [160, 90] : null, timeScale: num('speed', 1) });
  } else {
    const app = window.__app = new App({ root, lib, telemetry, params });
    // URL shortcuts (development, tests, benchmarks) jump straight into a match; otherwise hero select
    if (params.has('hero') || params.has('heroes') || params.has('play')) {
      app.startMatch({
        heroKey: HERO_KEYS.includes(params.get('hero')) ? params.get('hero') : null,
        heroes: params.get('heroes') ? params.get('heroes').split(',') : null,
        difficulty: params.get('bots') || 'medium', seed: params.has('seed') ? num('seed', 7) : undefined,
        net: params.has('ping') || params.has('loss') ? { ping: num('ping', 0), jitter: num('jitter', 0), loss: num('loss', 0) } : undefined,
        autopilot: params.get('play') === 'auto', skipSeconds: num('skip', 0),
      });
    } else if (params.has('join')) { app.showMenu(); app.showOnline({ joinCode: params.get('join') }); } // invite link
    else app.showMenu();
  }
  if (params.get('bench')) {
    const warm = num('warmup', 5), secs = num('seconds', 90);
    setTimeout(() => telemetry.reset(), warm * 1000);
    setTimeout(() => { window.__perf.result = telemetry.summary(); window.__perf.done = true; }, (warm + secs) * 1000);
  }
}
boot().catch((e) => { console.error(e); const b = root.querySelector('#boot .s'); if (b) b.textContent = `Could not start: ${e.message}`; window.__perf.error = String(e.stack || e); });
