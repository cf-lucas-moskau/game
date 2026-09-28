// Collects frame, simulation, render and latency timings with zero per-frame allocation.
// Exposed as window.__perf for the overlay, the "Copy report" button and the bench harness.
class Series {
  constructor(n = 3600) { this.buf = new Float32Array(n); this.n = n; this.i = 0; this.count = 0; }
  push(v) { this.buf[this.i] = v; this.i = (this.i + 1) % this.n; if (this.count < this.n) this.count++; }
  last(k = 1) { return this.buf[(this.i - k + this.n) % this.n]; }
  values() { const out = new Float32Array(this.count); for (let k = 0; k < this.count; k++) out[k] = this.buf[(this.i - this.count + k + this.n) % this.n]; return out; }
  pct(p) { const v = this.values().sort(); if (!v.length) return 0; return v[Math.min(v.length - 1, Math.floor(p * v.length))]; }
  mean() { const v = this.values(); let s = 0; for (const x of v) s += x; return v.length ? s / v.length : 0; }
  max() { const v = this.values(); let m = 0; for (const x of v) if (x > m) m = x; return m; }
  reset() { this.i = 0; this.count = 0; }
}
export class Telemetry {
  constructor() {
    this.frame = new Series(); this.sim = new Series(); this.render = new Series(); this.renderUpdate = new Series(); this.renderSubmit = new Series(); this.input = new Series(512);
    this.draws = new Series(); this.tris = new Series(); this.lastFrame = 0; this.startedAt = performance.now();
    this.pendingInputs = []; this.corrections = 0; this.gauges = { entities: 0, particles: 0, ping: 0, jitter: 0, loss: 0, quality: 'medium', renderScale: 1 };
    this.heapStart = this.heap(); this.longTasks = 0; this.markers = {};
    try { new PerformanceObserver((l) => { this.longTasks += l.getEntries().length; }).observe({ entryTypes: ['longtask'] }); } catch {}
  }
  heap() { const m = performance.memory; return m ? m.usedJSHeapSize / 1048576 : 0; }
  beginFrame(now) { if (this.lastFrame) this.frame.push(now - this.lastFrame); this.lastFrame = now; }
  /** Input pipeline: issued (input event) -> processed (sim tick applied it) -> presented (next frame drawn). */
  inputProcessed(issuedAt) { this.pendingInputs.push(issuedAt); }
  /** Called right after a frame is submitted: every processed input is now on screen. */
  inputsPresented(now) { for (let i = 0; i < this.pendingInputs.length; i++) this.input.push(now - this.pendingInputs[i]); this.pendingInputs.length = 0; }
  reset() { for (const s of [this.frame, this.sim, this.render, this.renderUpdate, this.renderSubmit, this.input, this.draws, this.tris]) s.reset(); this.corrections = 0; this.heapStart = this.heap(); this.startedAt = performance.now(); this.longTasks = 0; this.lastFrame = 0; }
  summary() {
    const seconds = (performance.now() - this.startedAt) / 1000;
    const f = this.frame.values().sort(); const n = f.length;
    const low = n ? f.slice(Math.floor(n * 0.99)) : [];
    const lowMean = low.length ? low.reduce((a, b) => a + b, 0) / low.length : 0;
    return {
      seconds: +seconds.toFixed(1), frames: n,
      fps: +(n ? 1000 / this.frame.mean() : 0).toFixed(1),
      onePercentLowFps: +(lowMean ? 1000 / lowMean : 0).toFixed(1),
      frameP50Ms: +this.frame.pct(0.5).toFixed(2), frameP95Ms: +this.frame.pct(0.95).toFixed(2), frameP99Ms: +this.frame.pct(0.99).toFixed(2),
      simTickP95Ms: +this.sim.pct(0.95).toFixed(3), simTickMeanMs: +this.sim.mean().toFixed(3),
      renderCpuP95Ms: +this.render.pct(0.95).toFixed(3), renderCpuMeanMs: +this.render.mean().toFixed(3),
      renderUpdateP95Ms: +this.renderUpdate.pct(0.95).toFixed(3), renderSubmitP95Ms: +this.renderSubmit.pct(0.95).toFixed(3),
      inputLatencyP95Ms: +this.input.pct(0.95).toFixed(1),
      drawCallsMax: this.draws.max(), drawCallsMean: +this.draws.mean().toFixed(1), trianglesMax: this.tris.max(),
      heapMb: +this.heap().toFixed(1), heapGrowthMb: +(this.heap() - this.heapStart).toFixed(2),
      heapGrowthMbPer10Min: +(seconds > 5 ? (this.heap() - this.heapStart) / seconds * 600 : 0).toFixed(2),
      correctionsPer10s: +(seconds > 0 ? this.corrections / seconds * 10 : 0).toFixed(2),
      longTasks: this.longTasks, ...this.gauges,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '', gpu: this.gpu || '',
      screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}` : '',
    };
  }
}
export const telemetry = new Telemetry();
if (typeof window !== 'undefined') window.__perf = { telemetry, summary: () => telemetry.summary(), reset: () => telemetry.reset(), done: false };
