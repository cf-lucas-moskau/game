// Cantor Brightbell, the Songkeeper: sound. Rolling rings of sound, a metronome ring that shows the beat.
import { SHAPE, DECAL, rnd } from '../kit.js';

const SOUND = '#ff9ee6', BRIGHT = '#fff0fb';
const CHORD = [523, 659, 784];

export default {
  key: 'cantor', accent: '#ff9ee6', style: 'sound', color: SOUND, leaps: ['cantor-leap'],
  emblem: '<path d="M18 36V10l18-4v26"/><circle cx="13" cy="36" r="5"/><circle cx="31" cy="32" r="5"/>',
  aim: [{ kind: 'cone', range: 460, angle: Math.PI * 0.5 }, { kind: 'self', radius: 450 }, { kind: 'point', range: 380, radius: 200 }, { kind: 'self', radius: 400 }],
  projectiles: {
    'cantor-auto': { shape: SHAPE.ORB, color: '#ff9ee6', color2: '#ffffff', size: 0.24, glow: 2.1, wobble: 0.14,
      trail: { color: '#ffc4f0', rate: 0.9, size: 0.08, life: 0.35, up: 0.4 }, impact: 'note' },
  },
  sounds: {
    // his casts are chords on a bright bell timbre; autos a single plucked note
    cast: (e, b, t, p, g, { tone }) => { for (let i = 0; i < 3; i++) tone(e, b, { type: 'triangle', f0: CHORD[i], t: t + i * 0.02, dur: 0.35, gain: 0.06 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone }) => tone(e, b, { type: 'triangle', f0: 880, t, dur: 0.15, gain: 0.05 * g, pan: p }),
  },
  fx: {
    events: {
      'cantor-onbeat': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.4, style: 'sound', shape: DECAL.RING, inner: 1.1, dur: 0.35, grow: 0.6 }); api.burst(c.x, c.z, 1.6, 6, 1.2, api.color(BRIGHT), 0.4, 0.14, 0.04, { up: 1.5, drag: 1 }); },
      'cantor-crescendo': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 4.8, style: 'sound', shape: DECAL.CONE, angle: c.e.v, half: Math.PI / 4, dur: 0.6 });
        const col = api.color(c.e.b ? BRIGHT : SOUND);
        for (let i = 0, n = api.n(20); i < n; i++) { const a = c.e.v + rnd(-0.7, 0.7), v = rnd(3, 6); api.spawn(c.x, 1, c.z, Math.cos(a) * v, rnd(0.2, 0.8), Math.sin(a) * v, 0.5, col, 1.8, 0.16, 0.06, 0, 2); }
      },
      'cantor-harmony': (api, c) => { api.decal({ x: c.x, z: c.z, r: 4.5, style: 'sound', shape: DECAL.RING, inner: 3.9, dur: 0.8, grow: 0.9 }); api.ring(c.x, c.z, 0.8, 26, 0.7, api.color(c.e.b ? BRIGHT : '#b8ffcf'), 0.8, 0.14, 2.5); },
      'cantor-staccato': (api, c) => { api.decal({ x: c.x, z: c.z, r: 2, style: 'sound', shape: DECAL.DISC, dur: 0.6, grow: 1 }); api.ring(c.x, c.z, 0.2, 24, 0.3, api.color(c.e.b ? BRIGHT : SOUND), 0.4, 0.2, 4); api.shake(c.e.b ? 0.25 : 0.1); },
      'cantor-wave': (api, c) => { api.decal({ x: c.x, z: c.z, r: 4, style: 'sound', shape: DECAL.RING, inner: 3.6, dur: 0.5, grow: 1 }); api.ring(c.x, c.z, 0.4, 24, 1, api.color(SOUND), 0.4, 0.16, 5); },
      'cantor-encore': (api, c) => api.shake(0.2),
    },
    // the metronome: a ring that swells towards each beat and flashes inside the on-beat window
    // (full strength for the player's own Cantor, a faint pulse on everyone else's)
    decals(api, h) {
      const s = h.heroState, p = (api.tick - s.beat0) % s.beat, on = p <= s.window || p >= s.beat - s.window, k = p / s.beat, mine = h.id === api.focusId;
      api.mark(api.hx(h), api.hz(h), 0.7 + (mine ? 0.5 : 0.25) * k, 'sound', DECAL.RING, (on ? 0.95 : 0.25) * (mine ? 1 : 0.35), h.id, 0, 0.85);
    },
    zones: {
      'cantor-encore': { decal: (api, z) => { const o = api.world.entities[z.data.follow]; if (!o || o.dead) return; api.mark(api.hx(o), api.hz(o), z.r * api.S, 'sound', DECAL.RING, 0.45, z.id, 0, 0.92); } },
    },
  },
};
