// F3 / three-finger tap: live performance numbers from window.__perf and a "Copy report" button.
import { h, setText, toggle } from './dom.js';

const ROWS = [
  ['FPS', (s) => s.fps, (v) => v < 50], ['Frame p95 ms', (s) => s.frameP95Ms, (v) => v > 20], ['Sim tick p95 ms', (s) => s.simTickP95Ms, (v) => v > 2],
  ['Render CPU p95 ms', (s) => s.renderCpuP95Ms, (v) => v > 6], ['UI update mean ms', (s) => s.uiUpdateMeanMs, (v) => v > 0.6], ['Audio mean ms', (s) => s.audioUpdateMeanMs, (v) => v > 0.3], ['Draw calls', (s) => s.drawCallsMax, (v) => v > 50], ['Input latency p95', (s) => s.inputLatencyP95Ms, (v) => v > 150],
  ['Corrections /10 s', (s) => s.correctionsPer10s, (v) => v > 1], ['Heap MB', (s) => s.heapMb, () => false], ['Quality', (s) => s.quality, () => false],
];
export class PerfOverlay {
  constructor(root) {
    this.rows = ROWS.map(([label]) => { const v = h('span'); return { el: h('div', { class: 'r' }, h('span', {}, label), v), v }; });
    this.btn = h('button', { class: 'btn small', onclick: () => this.copy() }, 'Copy report');
    this.el = h('div', { class: 'perf interactive hidden' }, this.rows.map((r) => r.el), this.btn);
    root.append(this.el); this.next = 0; this.open = false;
  }
  toggle() { this.open = !this.open; this.el.classList.toggle('hidden', !this.open); this.next = 0; }
  update(now) {
    if (!this.open || now < this.next || !window.__perf) return; this.next = now + 500;
    const s = window.__perf.summary();
    ROWS.forEach(([, get, bad], i) => { const v = get(s); setText(this.rows[i].v, v == null ? '–' : String(v)); toggle(this.rows[i].el, 'bad', typeof v === 'number' && bad(v)); });
  }
  async copy() {
    const text = JSON.stringify(window.__perf.summary(), null, 2);
    try { await navigator.clipboard.writeText(text); this.btn.textContent = 'Copied'; }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select(); try { document.execCommand('copy'); this.btn.textContent = 'Copied'; } catch { this.btn.textContent = 'Copy failed'; } ta.remove(); }
    setTimeout(() => { this.btn.textContent = 'Copy report'; }, 1500);
  }
  dispose() { this.el.remove(); }
}
