// Kestrel Vane, the Harpooner: sight. Reticles, tracer dashes, a lane-long firing line before the Skyline Shot.
import { SHAPE, DECAL, rnd } from '../kit.js';

const SIGHT = '#d4ff5a', STEEL = '#e6f2ff', ROPE = '#c9a36a';

export default {
  key: 'kestrel', accent: '#d4ff5a', style: 'sight', color: SIGHT,
  emblem: '<circle cx="24" cy="24" r="14"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/><circle cx="24" cy="24" r="3"/>',
  aim: [{ kind: 'line', range: 900, width: 80 }, { kind: 'point', range: 750, radius: 170 }, { kind: 'point', range: 320, radius: 50 }, { kind: 'line', range: 2400, width: 110 }],
  projectiles: {
    'kestrel-auto': { shape: SHAPE.LANCE, color: '#e6f2ff', color2: '#d4ff5a', size: 0.22, glow: 1.9, stretch: 3,
      trail: { color: '#d4ff5a', rate: 0.8, size: 0.05, life: 0.15 }, impact: 'pierce' },
    'kestrel-harpoon': { shape: SHAPE.LANCE, color: '#e6f2ff', color2: '#c9a36a', size: 0.4, glow: 2, stretch: 3.4, sparkle: ROPE,
      trail: { color: '#c9a36a', rate: 2.4, size: 0.06, life: 0.5 }, impact: 'pierce' },
    'kestrel-skyline': { shape: SHAPE.LANCE, color: '#f4ffd0', color2: '#d4ff5a', size: 0.6, glow: 4, stretch: 6, sparkle: SIGHT,
      trail: { color: '#d4ff5a', rate: 3, size: 0.18, life: 0.35, sparks: true }, impact: 'pierce' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'highpass', f0: 2400, t, dur: 0.07, gain: 0.14 * g, q: 1, pan: p }); tone(e, b, { type: 'triangle', f0: 520, f1: 260, t, dur: 0.14, gain: 0.1 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'bandpass', f0: 2000, f1: 1200, t, dur: 0.05, gain: 0.1 * g, q: 3, pan: p }); tone(e, b, { type: 'square', f0: 180, t, dur: 0.03, gain: 0.03 * g, pan: p, filter: 900 }); },
  },
  fx: {
    events: {
      'kestrel-deadeye': (api, c) => { api.decal({ x: c.x, z: c.z, r: 0.9, style: 'sight', shape: DECAL.RING, inner: 0.7, dur: 0.5, spinRate: 6, grow: 0.5 }); api.burst(c.x, c.z, 1, 10, 3, api.color(SIGHT), 0.25, 0.12, 0.02, { drag: 6, intensity: 2.4 }); },
      'kestrel-roll-shot': (api, c) => api.burst(c.x, c.z, 1, 12, 2.4, api.color(STEEL), 0.3, 0.14, 0.02, { drag: 5, intensity: 2 }),
      'kestrel-reel': (api, c) => {
        const t = api.world.entities[c.e.b]; if (!c.ent || !t) return;
        api.line(api.hx(c.ent), api.hz(c.ent), api.hx(t), api.hz(t), 1, 24, api.color(ROPE), 0.35, 0.08);
      },
      'kestrel-net': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 1.7, style: 'sight', shape: DECAL.DISC, dur: 1.2 });
        for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; api.line(c.x, c.z, c.x + Math.cos(a) * 1.7, c.z + Math.sin(a) * 1.7, 0.15, 5, api.color(ROPE), 0.9, 0.06); }
      },
      'kestrel-aim': (api, c) => {
        if (!c.ent) return; const x0 = api.hx(c.ent), z0 = api.hz(c.ent), a = c.e.v, len = 12;
        api.decal({ x: x0 + Math.cos(a) * len, z: z0 + Math.sin(a) * len, len, width: 0.55, angle: a, style: 'sight', shape: DECAL.LINE, dur: 0.75 });
        api.decal({ x: x0, z: z0, r: 1, style: 'sight', shape: DECAL.RING, inner: 0.75, dur: 0.75, spinRate: 4 });
      },
    },
    // Deadeye ready (next attack is the fourth): a reticle turning under her; roll-shot primed: a bright ring
    decals(api, h) {
      const s = h.heroState;
      if (s.shots === 3) api.mark(api.hx(h), api.hz(h), 0.8, 'sight', DECAL.RING, 0.85, h.id, api.now * 3, 0.72);
      if (s.rollUntil > api.tick) api.mark(api.hx(h), api.hz(h), 1.05, 'sight', DECAL.RING, 0.6, h.id + 1, -api.now * 5, 0.88);
    },
    zones: {
      'kestrel-net': { decal: (api, z) => { const k = (api.tick - z.born) / Math.max(1, z.until - z.born); api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'sight', DECAL.RING, 0.5 + k * 0.4, z.id, api.now * 4, 0.85); } },
    },
  },
};
