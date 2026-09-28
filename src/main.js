import { AssetLibrary } from './render/assets.js';
import { telemetry } from './perf/telemetry.js';
import { startSpectate } from './app/spectate.js';
import { defaultQuality } from './render/quality.js';

const params = new URLSearchParams(location.search);
const app = document.getElementById('app');
app.innerHTML = '<canvas id="view"></canvas><div id="boot">Waking the whale…</div>';
const canvas = document.getElementById('view');
Object.assign(document.body.style, { margin: 0, overflow: 'hidden', background: '#1c1f4a' });
Object.assign(canvas.style, { position: 'fixed', inset: 0, width: '100vw', height: '100vh', display: 'block', touchAction: 'none' });

async function boot() {
  const t0 = performance.now();
  const lib = new AssetLibrary();
  await lib.loadAll((p) => { document.getElementById('boot').textContent = `Waking the whale… ${Math.round(p * 100)}%`; });
  document.getElementById('boot').remove();
  telemetry.gauges.loadMs = Math.round(performance.now() - t0);
  const bench = params.get('bench');
  const quality = params.get('quality') || defaultQuality();
  const seed = +(params.get('seed') || 7);
  const game = startSpectate({ canvas, lib, seed, quality, telemetry, timeScale: +(params.get('speed') || 1), skipSeconds: +(params.get('skip') || 0), fixedBuffer: params.get('cpu') ? [160, 90] : null });
  window.__game = game;
  if (bench) {
    const warm = +(params.get('warmup') || 5), secs = +(params.get('seconds') || 90);
    setTimeout(() => telemetry.reset(), warm * 1000);
    setTimeout(() => { window.__perf.result = telemetry.summary(); window.__perf.done = true; }, (warm + secs) * 1000);
  }
}
boot().catch((e) => { console.error(e); document.getElementById('boot').textContent = `Could not start: ${e.message}`; window.__perf.error = String(e.stack || e); });
