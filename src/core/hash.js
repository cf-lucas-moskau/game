// FNV-1a over numbers (quantized) for determinism checks.
export class StateHasher {
  constructor() { this.h = 0x811c9dc5; this.f = new Float64Array(1); this.u = new Uint32Array(this.f.buffer); }
  num(v) {
    this.f[0] = v;
    for (let k = 0; k < 2; k++) { this.h ^= this.u[k]; this.h = Math.imul(this.h, 0x01000193) >>> 0; }
    return this;
  }
  str(s) { for (let i = 0; i < s.length; i++) { this.h ^= s.charCodeAt(i); this.h = Math.imul(this.h, 0x01000193) >>> 0; } return this; }
  digest() { return (this.h >>> 0).toString(16).padStart(8, '0'); }
}
