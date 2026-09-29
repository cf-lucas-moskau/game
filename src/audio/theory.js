// Pure helpers for audio (no Web Audio here, so they are unit-tested in node).

/** MIDI note -> frequency in Hz (A4 = 69 = 440 Hz). */
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** D dorian: the game's key. Degrees wrap into higher octaves. */
export const SCALE = [0, 2, 3, 5, 7, 9, 10];
export const ROOT = 50; // D3
export const degree = (d, root = ROOT) => root + SCALE[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
/** Chord progression as scale degrees of the chord root (i - VII - IV - v, then i - VI - VII - i). */
export const PROGRESSION = [0, 6, 3, 4, 0, 5, 6, 0];
/** Triad (plus seventh when rich) built on a scale degree, as MIDI notes. */
export const chord = (d, rich = false) => (rich ? [0, 2, 4, 6] : [0, 2, 4]).map((k) => degree(d + k));
/** Seconds per sixteenth note at a tempo. */
export const sixteenth = (bpm) => 60 / bpm / 4;
/** Stereo position (-1..1) and gain (0..1) of a sound at world x, heard from the camera at camX. */
export function spatial(x, camX, { panRange = 1400, hearing = 2600 } = {}) {
  const dx = x - camX;
  return { pan: Math.max(-1, Math.min(1, dx / panRange)), gain: Math.max(0, 1 - Math.abs(dx) / hearing) };
}
/** Per-sound rate limiter: returns true when a sound may play at time t (seconds). */
export class Throttle {
  constructor(gaps) { this.gaps = gaps; this.last = {}; }
  ok(name, t) { const g = this.gaps[name] ?? 0.03; const l = this.last[name]; if (l !== undefined && t - l < g) return false; this.last[name] = t; return true; }
}
/** Music intensity (0..1) from what the local player is living through. */
export function intensityFor({ inMenu, suddenDeath, combat, dead, over }) {
  if (inMenu || over) return 0.2;
  let v = combat ? 0.8 : 0.45;
  if (suddenDeath) v = Math.max(v, 0.95);
  if (dead) v = Math.min(v, 0.35);
  return v;
}
