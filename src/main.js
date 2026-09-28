import { AssetLibrary } from './render/assets.js';
import { telemetry } from './perf/telemetry.js';
import { startSpectate } from './app/spectate.js';
import { GameSession } from './app/session.js';
import { DesktopInput } from './input/desktop.js';
import { TouchInput } from './input/touch.js';
import { defaultQuality } from './render/quality.js';
import { HERO_KEYS } from './sim/heroes/index.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
app.innerHTML = '<canvas id="view"></canvas><div id="boot">Waking the whale…</div>';
const canvas = document.getElementById('view');
Object.assign(document.body.style, { margin: 0, overflow: 'hidden', background: '#1c1f4a' });
Object.assign(canvas.style, { position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block', touchAction: 'none' });

const num = (k, d) => (params.has(k) ? +params.get(k) : d);
async function boot() {
  const t0 = performance.now();
  const lib = new AssetLibrary();
  await lib.loadAll((p) => { document.getElementById('boot').textContent = `Waking the whale… ${Math.round(p * 100)}%`; });
  document.getElementById('boot').remove();
  telemetry.gauges.loadMs = Math.round(performance.now() - t0);
  const quality = params.get('quality') || defaultQuality();
  const seed = num('seed', (Date.now() & 0xffff) || 7);
  const common = { canvas, lib, seed, quality, telemetry, skipSeconds: num('skip', 0), fixedBuffer: params.get('cpu') ? [160, 90] : null };
  let game;
  if (params.has('spectate')) game = startSpectate({ ...common, timeScale: num('speed', 1) });
  else {
    const heroKey = HERO_KEYS.includes(params.get('hero')) ? params.get('hero') : null;
    const net = { ping: num('ping', 0), jitter: num('jitter', 0), loss: num('loss', 0) };
    game = new GameSession({ ...common, heroKey, net, autopilot: params.get('play') === 'auto', difficulty: params.get('bots') || 'medium' });
    const toggle = (what) => window.dispatchEvent(new CustomEvent('ll-toggle', { detail: what }));
    const inputs = [];
    if (params.get('play') !== 'auto') {
      const coarse = matchMedia('(pointer: coarse)').matches || params.get('touch') === '1';
      if (matchMedia('(pointer: fine)').matches || !coarse) inputs.push(new DesktopInput(game, canvas, { onToggle: toggle }));
      if (coarse || 'ontouchstart' in window) inputs.push(new TouchInput(game, app, { onToggle: toggle }));
    }
    game.on((ev) => { if (ev === 'frame') for (const i of inputs) i.update(); });
    game.inputs = inputs;
    game.start();
  }
  window.__game = game;
  if (params.get('bench')) {
    const warm = num('warmup', 5), secs = num('seconds', 90);
    setTimeout(() => telemetry.reset(), warm * 1000);
    setTimeout(() => { window.__perf.result = telemetry.summary(); window.__perf.done = true; }, (warm + secs) * 1000);
  }
}
boot().catch((e) => { console.error(e); const b = document.getElementById('boot'); if (b) b.textContent = `Could not start: ${e.message}`; window.__perf.error = String(e.stack || e); });
