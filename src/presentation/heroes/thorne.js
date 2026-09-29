// Old Thorne, the Skygardener: vine. Curling tendrils, thorns, leaves, and real thornbushes that grow in.
import { SHAPE, DECAL, rnd } from '../kit.js';

const VINE = '#6fd66a', LEAF = '#9be27a', BARK = '#8a6a44';

export default {
  key: 'thorne', accent: '#6fd66a', style: 'vine', color: VINE,
  emblem: '<path d="M24 44V20"/><path d="M24 28c-8 0-12-6-12-12 7 0 12 4 12 12z"/><path d="M24 22c6 0 10-5 10-10-6 0-10 4-10 10z"/><path d="M18 44h12"/>',
  aim: [{ kind: 'point', range: 750, radius: 60 }, { kind: 'line', range: 800, width: 110 }, { kind: 'self', radius: 260 }, { kind: 'point', range: 800, radius: 300 }],
  projectiles: {
    'thorne-auto': { shape: SHAPE.SHARD, color: '#9be27a', color2: '#f2ffd9', size: 0.2, glow: 1.4, stretch: 1.4,
      trail: { color: '#9be27a', rate: 0.6, size: 0.07, life: 0.4 }, impact: 'leaf' },
    'thorne-thorn': { shape: SHAPE.SHARD, color: '#b5d86a', color2: '#5a4a2a', size: 0.18, glow: 1.1, stretch: 2.2, impact: 'leaf' },
    'thorne-vine': { shape: SHAPE.LANCE, color: '#6fd66a', color2: '#dfffc2', size: 0.4, glow: 1.6, stretch: 2.8, sparkle: VINE,
      trail: { color: '#6fd66a', rate: 2.2, size: 0.1, life: 0.6 }, impact: 'leaf' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'bandpass', f0: 400, f1: 900, t, dur: 0.3, gain: 0.14 * g, q: 2, pan: p, attack: 0.04 }); tone(e, b, { type: 'triangle', f0: 330, f1: 392, t, dur: 0.25, gain: 0.05 * g, pan: p }); },
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 1400, f1: 700, t, dur: 0.08, gain: 0.09 * g, q: 4, pan: p }),
  },
  fx: {
    events: {
      'thorne-sow': (api, c) => { api.decal({ x: c.x, z: c.z, r: 0.6, style: 'vine', shape: DECAL.DISC, dur: 1.2, grow: 1 }); api.burst(c.x, c.z, 0.3, 8, 1.2, api.color(LEAF), 0.5, 0.12, 0.04, { up: 1, gravity: 3 }); },
      'thorne-snare': (api, c) => {
        const u = api.world.entities[c.e.b]; if (!u) return;
        api.decal({ x: api.hx(u), z: api.hz(u), r: 0.9, style: 'vine', shape: DECAL.RING, inner: 0.45, dur: c.e.v, follow: u.id, spinRate: 1 });
      },
      'thorne-pulse': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 2.6, style: 'vine', shape: DECAL.DISC, dur: 0.8, grow: 1 });
        for (let i = 0, n = api.n(18); i < n; i++) { const a = Math.random() * 6.283, v = rnd(1.5, 3); api.spawn(c.x, 0.6, c.z, Math.cos(a) * v, rnd(1, 2.5), Math.sin(a) * v, 0.9, api.color(LEAF), 1.3, 0.12, 0.08, 2, 2); }
      },
      'thorne-grove': (api, c) => { api.decal({ x: c.x, z: c.z, r: 3.1, style: 'vine', shape: DECAL.DISC, dur: 2.2, grow: 1 }); api.ring(c.x, c.z, 0.2, 36, 0.6, api.color(VINE), 0.9, 0.2, 5); api.shake(0.3); },
    },
    zones: {
      'thorne-bush': {
        // a real bush model that grows in over the sprout second, then shrinks as it withers
        draw(api, z, k) {
          const grow = Math.min(1, k.age), wither = Math.min(1, k.left * 2);
          api.prop('bush', z.x * api.S, z.y * api.S, 0.2 + 0.85 * grow * wither, z.id * 1.7);
        },
        decal: (api, z) => { const t = api.tick; api.mark(z.x * api.S, z.y * api.S, 1.05, 'vine', DECAL.DISC, Math.min(1, (z.until - t) / 8, (t - z.born) / 10), z.id, 0, 0); },
        particles(api, z, rate) { if (api.tick - z.born < api.tickHz && Math.random() < rate) api.spawn(z.x * api.S + rnd(-0.3, 0.3), 0.2, z.y * api.S + rnd(-0.3, 0.3), 0, rnd(0.8, 1.6), 0, 0.5, api.color(LEAF), 1.8, 0.12, 0.03); },
      },
    },
  },
};
