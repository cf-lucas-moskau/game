// Quality presets and the dynamic resolution guard.
export const QUALITY = {
  low:    { name: 'low', pixelRatio: 0.75, post: false, bloomLevels: 0, shadows: false, msaa: 0, antialias: false, particles: 0.4, glowLights: 0 },
  medium: { name: 'medium', pixelRatio: 1, post: true, bloomLevels: 4, shadows: false, msaa: 0, antialias: false, particles: 0.7, glowLights: 2 },
  high:   { name: 'high', pixelRatio: 1.5, post: true, bloomLevels: 5, shadows: true, msaa: 4, antialias: false, particles: 1, glowLights: 3 },
};
export function defaultQuality() {
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  if (coarse) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}
/** Lowers render scale when frames run long, raises it back when there is headroom. */
export class ResolutionGuard {
  constructor(min = 0.55, max = 1) { this.scale = max; this.min = min; this.max = max; this.window = []; this.good = 0; this.enabled = true; }
  sample(frameMs) {
    if (!this.enabled) return false;
    this.window.push(frameMs); if (this.window.length < 45) return false;
    const w = this.window.sort((a, b) => a - b); const p90 = w[Math.floor(w.length * 0.9)]; this.window.length = 0;
    const prev = this.scale;
    if (p90 > 18.5 && this.scale > this.min) { this.scale = Math.max(this.min, this.scale - 0.1); this.good = 0; }
    else if (p90 < 13) { if (++this.good >= 4 && this.scale < this.max) { this.scale = Math.min(this.max, this.scale + 0.05); this.good = 0; } }
    else this.good = 0;
    return prev !== this.scale;
  }
}
