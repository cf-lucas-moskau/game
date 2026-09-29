// Vesper, the Ink Sage: ink. Brush-edged washes, splatter, strokes that become whips, loops and walls.
import { SHAPE, DECAL, RIBBON } from '../kit.js';

const INK = '#6f5cff';

export default {
  key: 'vesper', accent: '#8b7bff', style: 'ink', color: INK,
  emblem: '<path d="M8 36c6-2 9-8 14-15s10-11 18-11"/><path d="M34 6l6 4-16 20-6-4z"/><path d="M8 40c4 0 8-1 12-3"/>',
  aim: [{ kind: 'stroke', range: 550, maxLen: 400 }, { kind: 'loop', range: 650 }, { kind: 'stroke', range: 600, maxLen: 500 }, { kind: 'self', radius: 120 }],
  projectiles: {
    'vesper-auto': { shape: SHAPE.INK, color: '#1a1030', color2: '#9d8cff', size: 0.3, glow: 1.6, stretch: 1.3,
      trail: { color: '#6f5cff', rate: 1.1, size: 0.14, life: 0.45, drip: true }, launch: 'ink', impact: 'ink' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { f0: 5200, f1: 1600, t, dur: 0.32, gain: 0.14 * g, q: 5, pan: p, attack: 0.02 }); tone(e, b, { type: 'triangle', f0: 660, f1: 990, t, dur: 0.3, gain: 0.05 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { f0: 2600, f1: 5200, t, dur: 0.14, gain: 0.07 * g, q: 4, pan: p }); tone(e, b, { type: 'triangle', f0: 740, f1: 520, t, dur: 0.12, gain: 0.03 * g, pan: p }); },
  },
  fx: {
    cast(api, c) { api.burst(c.cx, c.cz, 1.1, 10, 1.4, api.color(INK), 0.5, 0.14, 0.02, { drag: 3, gravity: 3 }); },
    events: {
      'vesper-masterpiece': (api, c) => { api.decal({ x: c.x, z: c.z, r: 2.2, style: 'ink', shape: DECAL.RING, inner: 1.7, dur: 1 }); api.ring(c.x, c.z, 0.5, 48, 0.5, api.color(INK), 1, 0.25, 3); },
      'vesper-fizzle': (api, c) => { api.decal({ x: c.x, z: c.z, r: 0.6, style: 'ink', shape: DECAL.DISC, dur: 0.5 }); api.burst(c.x, c.z, 0.3, 10, 1, api.color(INK), 0.5, 0.16, 0.02); },
    },
    decals(api, h) { const hs = h.heroState, t = api.tick; if (hs.mpUntil > t) api.mark(api.hx(h), api.hz(h), 1.4, 'ink', DECAL.RING, Math.min(1, (hs.mpUntil - t) / 15), h.id, 0, 0.8); },
    zones: {
      'vesper-stroke': { draw: (api, z, k) => api.ribbon(z.data.pts, RIBBON.INK, k.fade, 28) },
      'vesper-loop': { draw: (api, z, k) => api.ribbon(z.data.pts, RIBBON.INK, k.fade, 22) },
      'vesper-wall': { draw: (api, z, k) => { api.ribbon(z.data.pts, RIBBON.WALL, k.fade, 0, true); api.ribbon(z.data.pts, RIBBON.INK, k.fade * 0.8, 20); } },
    },
  },
};
