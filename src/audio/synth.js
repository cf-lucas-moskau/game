// Synthesized voices. Each call builds a short node graph that frees itself when it ends.
// dest: an AudioNode (engine.sfx or engine.music). All times in AudioContext seconds.

function out(engine, dest, pan, gain, t, dur, attack = 0.005, curve = 'exp') {
  const c = engine.ctx, g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur); else g.gain.linearRampToValueAtTime(0, t + dur);
  let node = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
  node.connect(dest);
  return g;
}
const busOf = (engine, dest) => (dest === engine.music ? 'music' : 'sfx');
function done(engine, bus, src, t, dur, offset = 0) { src.start(t, offset); src.stop(t + dur + 0.05); src.onended = () => engine.release(bus); }

/** Pitched voice with an optional pitch glide and filter. */
export function tone(engine, dest, { type = 'sine', f0, f1 = f0, t = engine.now, dur = 0.2, gain = 0.2, attack = 0.005, pan = 0, filter = 0, q = 1, vibrato = 0, curve = 'exp' }) {
  const bus = busOf(engine, dest); if (!engine.claim(bus)) return;
  const c = engine.ctx, o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  let head = o;
  if (vibrato) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 5.5; lg.gain.value = f0 * vibrato; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; f.Q.value = q; head.connect(f); head = f; }
  head.connect(out(engine, dest, pan, gain, t, dur, attack, curve));
  done(engine, bus, o, t, dur);
}
/** Filtered noise burst (whooshes, impacts, rumbles). */
export function noise(engine, dest, { t = engine.now, dur = 0.15, gain = 0.2, type = 'bandpass', f0 = 1800, f1 = f0, q = 1, attack = 0.003, pan = 0, curve = 'exp' }) {
  const bus = busOf(engine, dest); if (!engine.claim(bus)) return;
  const c = engine.ctx, s = c.createBufferSource(); s.buffer = engine.noise; s.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  s.connect(f).connect(out(engine, dest, pan, gain, t, dur, attack, curve));
  done(engine, bus, s, t, dur, Math.random() * 0.8);
}
