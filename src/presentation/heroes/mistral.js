// Mistral Aveline, the Windcaller: wind. Spiral streaks, rising columns, a jetstream corridor.
import { SHAPE, DECAL, rnd } from '../kit.js';

const WIND = '#bff5e6', WHITE = '#f4fffb';

export default {
  key: 'mistral', accent: '#bff5e6', style: 'wind', color: WIND,
  emblem: '<path d="M6 18h22a5 5 0 1 0-5-5"/><path d="M6 26h30a5 5 0 1 1-5 5"/><path d="M6 34h14"/>',
  aim: [{ kind: 'line', range: 850, width: 140 }, { kind: 'point', range: 750, radius: 170 }, { kind: 'ally', range: 700 }, { kind: 'line', range: 1400, width: 300 }],
  projectiles: {
    'mistral-auto': { shape: SHAPE.ORB, color: '#bff5e6', color2: '#ffffff', size: 0.22, glow: 1.8, wobble: 0.1,
      trail: { color: '#e6fff8', rate: 1, size: 0.1, life: 0.3, up: 0.3 }, impact: 'gust' },
    'mistral-gust': { shape: SHAPE.SHARD, color: '#dffff6', color2: '#ffffff', size: 0.55, glow: 1.6, stretch: 1.4, sparkle: WIND,
      trail: { color: '#bff5e6', rate: 2.2, size: 0.16, life: 0.35, up: 0.2 }, impact: 'gust' },
  },
  sounds: {
    cast: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 600, f1: 2400, t, dur: 0.45, gain: 0.16 * g, q: 2, pan: p, attack: 0.08 }),
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 1800, f1: 3600, t, dur: 0.12, gain: 0.07 * g, q: 3, pan: p }),
  },
  fx: {
    cast(api, c) { if (c.slot === 3) api.ring(c.cx, c.cz, 0.5, 30, 0.6, api.color(WIND), 0.6, 0.16, 4); },
    events: {
      'mistral-updraft': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 1.7, style: 'wind', shape: DECAL.DISC, dur: 0.9, spinRate: 8 });
        const col = api.color(WHITE);
        for (let i = 0, n = api.n(34); i < n; i++) { const a = Math.random() * 6.283, r = Math.random() * 1.6; api.spawn(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r, -Math.sin(a) * 1.5, rnd(4, 7), Math.cos(a) * 1.5, 0.6, col, 1.6, 0.14, 0.04, 0, 1.5); }
      },
      'mistral-carry': (api, c) => {
        const t = api.world.entities[c.e.b] || c.ent; if (!t) return;
        api.decal({ x: api.hx(t), z: api.hz(t), r: 1, style: 'wind', shape: DECAL.RING, inner: 0.7, dur: 0.8, spinRate: 7 });
        api.ring(api.hx(t), api.hz(t), 0.5, 18, 0.6, api.color(WIND), 0.5, 0.14, 1.5);
      },
    },
    // Tailwind: faint streaks trailing her while she moves
    particles(api, h, rate) { if (!h.moving || Math.random() > rate * 0.5) return; const a = h.facing + Math.PI + rnd(-0.5, 0.5); api.spawn(api.hx(h), 0.5 + Math.random() * 0.8, api.hz(h), Math.cos(a) * 2, 0.1, Math.sin(a) * 2, 0.4, api.color(WIND), 1.2, 0.1, 0.02, 0, 2); },
    zones: {
      'mistral-updraft': { decal: (api, z) => { const k = (api.tick - z.born) / Math.max(1, z.until - z.born); api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'wind', DECAL.RING, 0.5 + k * 0.4, z.id, api.now * 5, 0.85); } },
      'mistral-jet': {
        decal: (api, z) => {
          const t = api.tick, x0 = z.x * api.S, z0 = z.y * api.S, x1 = z.x2 * api.S, z1 = z.y2 * api.S, len = Math.hypot(x1 - x0, z1 - z0) / 2;
          api.markLine((x0 + x1) / 2, (z0 + z1) / 2, len, z.r * api.S, Math.atan2(z1 - z0, x1 - x0), 'wind', Math.min(1, (z.until - t) / 10, (t - z.born) / 5), z.id);
        },
        particles(api, z, rate) {
          if (Math.random() > rate * 2) return; const k = Math.random(), a = Math.atan2(z.y2 - z.y, z.x2 - z.x), off = (Math.random() - 0.5) * z.r * 1.6;
          api.spawn(api.S * (z.x + (z.x2 - z.x) * k - Math.sin(a) * off), 0.3 + Math.random() * 0.9, api.S * (z.y + (z.y2 - z.y) * k + Math.cos(a) * off), Math.cos(a) * 6, 0, Math.sin(a) * 6, 0.45, api.color(WHITE), 1.3, 0.12, 0.03, 0, 1);
        },
      },
    },
  },
};
