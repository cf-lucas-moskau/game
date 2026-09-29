// Dredge Harrow, the Anchorhand: iron. Riveted bands, chains, an anchor that lands like a dropped hull.
import { SHAPE, DECAL, rnd } from '../kit.js';

const IRON = '#b7c3cf', RUST = '#b0673a', SPARK = '#ffd9a0';

export default {
  key: 'dredge', accent: '#b7c3cf', style: 'iron', color: IRON, leaps: ['dredge-leap'],
  emblem: '<circle cx="24" cy="9" r="4"/><path d="M24 13v29"/><path d="M16 20h16"/><path d="M8 30c0 8 7 12 16 12s16-4 16-12"/><path d="M8 30l-2 4M40 30l2 4"/>',
  aim: [{ kind: 'line', range: 800, width: 100 }, { kind: 'self', radius: 260 }, { kind: 'self', radius: 90 }, { kind: 'point', range: 650, radius: 280 }],
  projectiles: {
    'dredge-anchor': { shape: SHAPE.ROCK, color: '#8f9aa6', color2: '#dfe6ee', size: 0.55, glow: 1.2, spin: 2.5, sparkle: RUST,
      trail: { color: '#b7c3cf', rate: 2.4, size: 0.08, life: 0.5 }, impact: 'clang' },
  },
  melee: { dredge: { color: '#b7c3cf', edge: '#f2f6fa', arc: 2.5, radius: 1.35, width: 0.5, dur: 0.26, heavy: true, impact: 'clang' } },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { tone(e, b, { type: 'square', f0: 110, f1: 70, t, dur: 0.25, gain: 0.09 * g, pan: p, filter: 700 }); noise(e, b, { type: 'bandpass', f0: 2600, f1: 1800, t, dur: 0.12, gain: 0.12 * g, q: 6, pan: p }); },
    auto: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'bandpass', f0: 3200, t, dur: 0.05, gain: 0.1 * g, q: 8, pan: p }); tone(e, b, { f0: 140, f1: 80, t, dur: 0.1, gain: 0.12 * g, pan: p }); },
  },
  fx: {
    events: {
      'dredge-drag': (api, c) => {
        const u = api.world.entities[c.e.b]; if (!c.ent || !u) return;
        api.line(api.hx(c.ent), api.hz(c.ent), api.hx(u), api.hz(u), 0.9, 30, api.color(IRON), 0.35, 0.09);
        api.burst(api.hx(u), api.hz(u), 0.9, 10, 2.5, api.color(SPARK), 0.25, 0.08, 0.01, { drag: 4, gravity: 5, intensity: 2.4 });
      },
      'dredge-sweep': (api, c) => { api.decal({ x: c.x, z: c.z, r: 2.6, style: 'iron', shape: DECAL.RING, inner: 1.9, dur: 0.45, spinRate: 9 }); api.ring(c.x, c.z, 0.5, 28, 2.4, api.color(IRON), 0.3, 0.12, 2.5); },
      'dredge-ready': (api, c) => api.ring(c.x, c.z, 1, 14, 0.5, api.color(SPARK), 0.4, 0.1, 0.6),
      'dredge-breach': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.1, style: 'iron', shape: DECAL.DISC, dur: 0.6, grow: 0.6 }); api.burst(c.x, c.z, 1, 18, 4, api.color(SPARK), 0.3, 0.09, 0.01, { drag: 4, gravity: 6, intensity: 2.6 }); api.shake(0.12); },
      'dredge-slam': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 2.9, style: 'iron', shape: DECAL.DISC, dur: 1.4, grow: 1 }); api.decal({ x: c.x, z: c.z, r: 2.9, style: 'stone', shape: DECAL.DISC, dur: 1.4, grow: 1 });
        api.burst(c.x, c.z, 0.3, 40, 5, api.color('#bfae93'), 0.8, 0.28, 0.06, { up: 2.4, gravity: 9, intensity: 0.9 }); api.ring(c.x, c.z, 0.1, 36, 0.5, api.color(IRON), 0.5, 0.24, 6); api.shake(0.6);
      },
    },
    // Hull Breach primed: a riveted band turning under him
    decals(api, h) { if (h.heroState.breachUntil > api.tick) api.mark(api.hx(h), api.hz(h), 0.95, 'iron', DECAL.RING, 0.9, h.id, api.now * 2, 0.7); },
    particles(api, h, rate) { if (h.heroState.breachUntil > api.tick && Math.random() < rate * 0.6) api.spawn(api.hx(h) + rnd(-0.3, 0.3), 1.2, api.hz(h) + rnd(-0.3, 0.3), rnd(-0.5, 0.5), rnd(0.5, 1.5), rnd(-0.5, 0.5), 0.3, api.color(SPARK), 2.2, 0.06, 0.01, 5, 1); },
  },
};
