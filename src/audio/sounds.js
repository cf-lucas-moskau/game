// The sound palette: airy, woody and glassy, to fit a battle on a sky-whale's back.
// Each sound is (engine, bus, t, pan, gain) => void; names are what the director plays.
import { tone, noise } from './synth.js';
import { mtof, degree } from './theory.js';

import { HERO_VIEWS } from '../presentation/heroes/index.js';

// Hero casts and auto-attacks come from each hero's presentation pack; voices are handed over, not imported.
const VOICES = { tone, noise };
const heroSound = (kind) => (e, b, t, p, g, hero) => { const v = HERO_VIEWS[hero] || HERO_VIEWS.morrow; v.sounds[kind](e, b, t, p, g, VOICES); };
export const SOUNDS = {
  auto: heroSound('auto'),
  towerLock: (e, b, t) => [0, 0.12].forEach((dt) => tone(e, b, { type: 'square', f0: 1480, t: t + dt, dur: 0.08, gain: 0.07, filter: 3000 })),
  towerHit: (e, b, t) => { tone(e, b, { f0: 150, f1: 45, t, dur: 0.35, gain: 0.35 }); noise(e, b, { type: 'lowpass', f0: 2400, f1: 300, t, dur: 0.25, gain: 0.2 }); },
  cast: heroSound('cast'),
  hitDealt: (e, b, t, p, g) => { noise(e, b, { f0: 2400, t, dur: 0.05, gain: 0.12 * g, q: 1.5, pan: p }); tone(e, b, { f0: 180, f1: 90, t, dur: 0.08, gain: 0.12 * g, pan: p }); },
  hitTaken: (e, b, t, p, g) => { tone(e, b, { type: 'triangle', f0: 120, f1: 70, t, dur: 0.12, gain: 0.25 * g, pan: p }); noise(e, b, { type: 'lowpass', f0: 1200, t, dur: 0.07, gain: 0.12 * g, pan: p }); },
  melee: (e, b, t, p, g) => noise(e, b, { f0: 1500, f1: 700, t, dur: 0.06, gain: 0.05 * g, q: 1, pan: p }),
  tower: (e, b, t, p, g) => { noise(e, b, { type: 'lowpass', f0: 700, f1: 120, t, dur: 0.5, gain: 0.3 * g, pan: p }); tone(e, b, { f0: 90, f1: 40, t, dur: 0.4, gain: 0.25 * g, pan: p }); },
  blink: (e, b, t, p, g) => { tone(e, b, { f0: 400, f1: 1800, t, dur: 0.16, gain: 0.07 * g, pan: p }); noise(e, b, { type: 'highpass', f0: 4000, t, dur: 0.12, gain: 0.06 * g, pan: p }); },
  heroDeath: (e, b, t, p, g) => [0, 0.12, 0.24].forEach((dt, i) => tone(e, b, { type: 'triangle', f0: mtof(degree(4 - i * 2, 62)), t: t + dt, dur: 0.5, gain: 0.12 * g, pan: p })),
  kill: (e, b, t) => { tone(e, b, { f0: mtof(degree(7, 62)), t, dur: 0.5, gain: 0.14 }); tone(e, b, { f0: mtof(degree(11, 62)), t: t + 0.09, dur: 0.7, gain: 0.14 }); },
  levelUp: (e, b, t) => [0, 2, 4, 7].forEach((d, i) => tone(e, b, { type: 'triangle', f0: mtof(degree(d, 67)), t: t + i * 0.07, dur: 0.35, gain: 0.1 })),
  gold: (e, b, t, p, g) => { tone(e, b, { f0: 1760, t, dur: 0.12, gain: 0.06 * g, pan: p }); tone(e, b, { f0: 2637, t: t + 0.04, dur: 0.16, gain: 0.05 * g, pan: p }); },
  buy: (e, b, t) => [0, 0.05, 0.1].forEach((dt, i) => tone(e, b, { f0: 1500 + i * 400, t: t + dt, dur: 0.15, gain: 0.07 })),
  relic: (e, b, t, p, g) => [0, 4, 7, 11].forEach((d, i) => tone(e, b, { f0: mtof(degree(d, 74)), t: t + i * 0.05, dur: 0.3, gain: 0.05 * g, pan: p })),
  structure: (e, b, t, p, g) => { noise(e, b, { type: 'lowpass', f0: 1400, f1: 80, t, dur: 1.8, gain: 0.45 * g, pan: p }); tone(e, b, { f0: 70, f1: 30, t, dur: 1.5, gain: 0.35 * g, pan: p }); },
  whaleWarn: (e, b, t) => { tone(e, b, { f0: 190, f1: 120, t, dur: 2.2, gain: 0.18, attack: 0.4, vibrato: 0.03, filter: 900 }); tone(e, b, { f0: 95, f1: 72, t: t + 0.3, dur: 2.4, gain: 0.14, attack: 0.5, filter: 500 }); },
  whaleRoll: (e, b, t) => noise(e, b, { type: 'lowpass', f0: 180, f1: 90, t, dur: 3.6, gain: 0.35, attack: 0.5, curve: 'lin' }),
  respawn: (e, b, t) => tone(e, b, { type: 'triangle', f0: mtof(degree(0, 62)), f1: mtof(degree(7, 62)), t, dur: 0.6, gain: 0.08, attack: 0.1 }),
  suddenDeath: (e, b, t) => [0, 0.5].forEach((dt) => tone(e, b, { type: 'sawtooth', f0: mtof(degree(0, 38)), t: t + dt, dur: 1.2, gain: 0.12, filter: 600, attack: 0.05 })),
  // map features
  campUp: (e, b, t, p, g) => [0, 0.09, 0.2].forEach((dt, i) => tone(e, b, { type: 'sine', f0: 300 + i * 140, f1: 520 + i * 160, t: t + dt, dur: 0.12, gain: 0.05 * g, pan: p })), // bubbles
  campSlain: (e, b, t, p, g) => { noise(e, b, { type: 'bandpass', f0: 2600, f1: 900, t, dur: 0.18, gain: 0.22 * g, q: 2, pan: p }); tone(e, b, { type: 'triangle', f0: 160, f1: 60, t, dur: 0.35, gain: 0.2 * g, pan: p }); [0, 4, 7].forEach((d, i) => tone(e, b, { f0: mtof(degree(d, 69)), t: t + 0.12 + i * 0.06, dur: 0.25, gain: 0.05 * g, pan: p })); },
  buff: (e, b, t) => [0, 7, 12].forEach((d, i) => tone(e, b, { type: 'triangle', f0: mtof(degree(d, 72)), t: t + i * 0.04, dur: 0.4, gain: 0.06, attack: 0.02 })),
  ui: (e, b, t) => tone(e, b, { type: 'triangle', f0: 1100, f1: 900, t, dur: 0.05, gain: 0.05 }),
  victory: (e, b, t) => [[0, 2, 4], [3, 5, 7], [4, 6, 8], [7, 9, 11]].forEach((c, i) => c.forEach((d) => tone(e, b, { type: 'triangle', f0: mtof(degree(d, 62)), t: t + i * 0.28, dur: i === 3 ? 1.8 : 0.5, gain: 0.08, attack: 0.02 }))),
  defeat: (e, b, t) => [[4, 6, 8], [3, 5, 7], [1, 3, 5], [0, 2, 4]].forEach((c, i) => c.forEach((d) => tone(e, b, { type: 'sine', f0: mtof(degree(d, 55)), t: t + i * 0.42, dur: i === 3 ? 2 : 0.7, gain: 0.08, attack: 0.05, filter: 1500 }))),
};
