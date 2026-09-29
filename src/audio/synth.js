// Synthesized voices from persistent pools. Every voice is built once (oscillator or looping noise
// -> filter -> gain -> panner -> bus) and runs silently; a sound only schedules AudioParam
// automation on a free voice. Nothing is allocated per sound, so combat and music create no
// garbage (a fresh node graph per sound measured +150 ms of GC per 2 minutes on the emulated phone).

const SILENT = 0.0001;
class Voice {
  constructor(c, bus, noiseBuf, lfo) {
    this.busyUntil = 0;
    this.filter = c.createBiquadFilter(); this.filter.frequency.value = 20000;
    this.gain = c.createGain(); this.gain.gain.value = 0;
    this.pan = c.createStereoPanner ? c.createStereoPanner() : null;
    this.filter.connect(this.gain);
    if (this.pan) this.gain.connect(this.pan).connect(bus); else this.gain.connect(bus);
    if (noiseBuf) {
      this.src = c.createBufferSource(); this.src.buffer = noiseBuf; this.src.loop = true;
      this.src.connect(this.filter); this.src.start(0, Math.random() * 0.9);
    } else {
      this.src = c.createOscillator(); this.src.connect(this.filter); this.src.start();
      this.vib = c.createGain(); this.vib.gain.value = 0; lfo.connect(this.vib).connect(this.src.frequency);
    }
  }
  envelope(t, gain, attack, dur, curve) {
    const g = this.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(SILENT, t);
    g.linearRampToValueAtTime(Math.max(SILENT, gain), t + attack);
    if (curve === 'exp') g.exponentialRampToValueAtTime(SILENT, t + dur); else g.linearRampToValueAtTime(SILENT, t + dur);
    g.setValueAtTime(0, t + dur + 0.01);
    if (this.pan) { this.pan.pan.cancelScheduledValues(t); this.pan.pan.setValueAtTime(0, t); }
    this.busyUntil = t + dur + 0.02;
  }
  place(t, pan) { if (this.pan) this.pan.pan.setValueAtTime(pan, t); }
}
class Pool {
  constructor(voices) { this.voices = voices; this.i = 0; }
  /** A free voice, or the one that frees soonest (stolen). */
  take(t, engine) {
    const v = this.voices; let best = null;
    for (let k = 0; k < v.length; k++) { const x = v[(this.i + k) % v.length]; if (x.busyUntil <= t) { best = x; this.i = (this.i + k + 1) % v.length; break; } }
    if (!best) { best = v[0]; for (const x of v) if (x.busyUntil < best.busyUntil) best = x; engine.dropped++; }
    engine.played++; return best;
  }
}
export const POOL_SIZES = { sfx: { tone: 16, noise: 10 }, music: { tone: 12, noise: 4 } };
export class Synth {
  constructor(engine) {
    const c = engine.ctx; this.engine = engine;
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 5.5; this.lfo.start();
    const mk = (bus, n, noise) => new Pool(Array.from({ length: n }, () => new Voice(c, bus, noise ? engine.noise : null, this.lfo)));
    this.pools = {
      sfx: { tone: mk(engine.sfx, POOL_SIZES.sfx.tone, false), noise: mk(engine.sfx, POOL_SIZES.sfx.noise, true) },
      music: { tone: mk(engine.music, POOL_SIZES.music.tone, false), noise: mk(engine.music, POOL_SIZES.music.noise, true) },
    };
  }
  busy(bus) { const t = this.engine.now; let n = 0; for (const p of Object.values(this.pools[bus])) for (const v of p.voices) if (v.busyUntil > t) n++; return n; }
}
const busOf = (engine, dest) => (dest === engine.music ? 'music' : 'sfx');

/** Pitched voice with an optional pitch glide, lowpass filter and vibrato. */
export function tone(engine, dest, { type = 'sine', f0, f1 = f0, t = engine.now, dur = 0.2, gain = 0.2, attack = 0.005, pan = 0, filter = 0, q = 1, vibrato = 0, curve = 'exp' }) {
  if (!engine.ready) return;
  const v = engine.synth.pools[busOf(engine, dest)].tone.take(t, engine), o = v.src;
  if (o.type !== type) o.type = type;
  const f = o.frequency; f.cancelScheduledValues(t); f.setValueAtTime(f0, t);
  if (f1 !== f0) f.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const fl = v.filter; if (fl.type !== 'lowpass') fl.type = 'lowpass';
  fl.frequency.cancelScheduledValues(t); fl.frequency.setValueAtTime(filter || 20000, t); fl.Q.setValueAtTime(filter ? q : 0.0001, t);
  v.vib.gain.cancelScheduledValues(t); v.vib.gain.setValueAtTime(f0 * vibrato, t); if (vibrato) v.vib.gain.setValueAtTime(0, t + dur);
  v.envelope(t, gain, attack, dur, curve); v.place(t, pan);
}
/** Filtered noise burst (whooshes, impacts, rumbles). */
export function noise(engine, dest, { t = engine.now, dur = 0.15, gain = 0.2, type = 'bandpass', f0 = 1800, f1 = f0, q = 1, attack = 0.003, pan = 0, curve = 'exp' }) {
  if (!engine.ready) return;
  const v = engine.synth.pools[busOf(engine, dest)].noise.take(t, engine), fl = v.filter;
  if (fl.type !== type) fl.type = type;
  fl.frequency.cancelScheduledValues(t); fl.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  fl.Q.setValueAtTime(q, t);
  v.envelope(t, gain, attack, dur, curve); v.place(t, pan);
}

/** Sustained chord voices for the music pad: they glide between chords instead of being rebuilt. */
export class Pad {
  constructor(engine, voices = 8) {
    const c = engine.ctx;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 800; this.filter.Q.value = 0.7;
    this.out = c.createGain(); this.out.gain.value = 0; this.filter.connect(this.out).connect(engine.music);
    this.oscs = []; this.gains = [];
    for (let i = 0; i < voices; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = i % 2 ? 6 : -6;
      const g = c.createGain(); g.gain.value = 0; o.connect(g).connect(this.filter); o.start();
      this.oscs.push(o); this.gains.push(g);
    }
    this.bass = c.createOscillator(); this.bass.type = 'sine'; this.bassGain = c.createGain(); this.bassGain.gain.value = 0;
    this.bass.connect(this.bassGain).connect(engine.music); this.bass.start();
  }
  /** Move to a chord (Hz per note) at time t; brightness 0..1 opens the filter. */
  chord(t, freqs, bassHz, brightness) {
    for (let i = 0; i < this.oscs.length; i++) {
      const n = i >> 1, on = n < freqs.length;
      if (on) this.oscs[i].frequency.setTargetAtTime(freqs[n], t, 0.08);
      this.gains[i].gain.setTargetAtTime(on ? 0.018 : 0, t, 0.25);
    }
    this.bass.frequency.setTargetAtTime(bassHz, t, 0.08); this.bassGain.gain.setTargetAtTime(0.07, t, 0.3);
    this.filter.frequency.setTargetAtTime(500 + 1800 * brightness, t, 0.5);
    this.out.gain.setTargetAtTime(1, t, 0.6);
  }
  silence(t) { this.out.gain.setTargetAtTime(0, t, 0.4); }
}
