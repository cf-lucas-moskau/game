// Coralie Brine, the Reefwarden: coral. Caustic water, coral polyps, spikes that burst from the deck.
import { SHAPE, DECAL, rnd } from '../kit.js';

const CORAL = '#ff9e8a', FOAM = '#dffcff', SEA = '#3fb7c4';

/** Coral spikes along a line (render units): a staggered row of upward particle jets. */
function spikes(api, x0, z0, x1, z1, n = 12) {
  const col = api.color(CORAL), foam = api.color(FOAM);
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k + rnd(-0.1, 0.1), z = z0 + (z1 - z0) * k + rnd(-0.1, 0.1);
    for (let j = 0; j < 3; j++) api.spawn(x, 0.1, z, rnd(-0.3, 0.3), rnd(3, 5.5), rnd(-0.3, 0.3), 0.35, j ? col : foam, 1.8, 0.2, 0.05, 9, 0.5);
  }
}

export default {
  key: 'coralie', accent: '#ff9e8a', style: 'coral', color: CORAL,
  emblem: '<path d="M24 42V24M24 24c0-6-6-8-6-14M24 24c0-5 6-7 6-13M24 32c-4 0-8-3-9-8M24 30c5 0 8-3 9-7"/><path d="M14 42h20"/>',
  aim: [{ kind: 'line', range: 650, width: 140 }, { kind: 'self', radius: 280 }, { kind: 'line', range: 450, width: 220 }, { kind: 'self', radius: 360 }],
  melee: { coralie: { color: '#ff9e8a', edge: '#dffcff', arc: 2.4, radius: 1.3, width: 0.46, dur: 0.24, heavy: true, impact: 'splash' } },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'lowpass', f0: 1800, f1: 300, t, dur: 0.4, gain: 0.2 * g, q: 1, pan: p, attack: 0.05 }); tone(e, b, { type: 'triangle', f0: 220, f1: 165, t, dur: 0.3, gain: 0.08 * g, pan: p }); },
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 900, f1: 400, t, dur: 0.12, gain: 0.14 * g, q: 1.5, pan: p }),
  },
  fx: {
    events: {
      'coralie-spike-warn': (api, c) => {
        if (!c.ent) return; const x0 = api.hx(c.ent), z0 = api.hz(c.ent), len = Math.hypot(c.x - x0, c.z - z0) / 2;
        api.decal({ x: (x0 + c.x) / 2, z: (z0 + c.z) / 2, len, width: 0.7, angle: Math.atan2(c.z - z0, c.x - x0), style: 'coral', shape: DECAL.LINE, dur: 0.5 });
      },
      'coralie-spike': (api, c) => {
        if (!c.ent) return; const a = c.e.v, x1 = c.x, z1 = c.z, x0 = x1 - Math.cos(a) * 6.5, z0 = z1 - Math.sin(a) * 6.5;
        spikes(api, x0, z0, x1, z1); api.shake(0.15);
      },
      'coralie-bulwark': (api, c) => { api.ring(c.x, c.z, 0.8, 22, 0.7, api.color(SEA), 0.6, 0.16, 0.4); api.decal({ x: c.x, z: c.z, r: 1.1, style: 'coral', shape: DECAL.RING, inner: 0.8, dur: 0.6 }); },
      'coralie-burst': (api, c) => { api.decal({ x: c.x, z: c.z, r: 2.8, style: 'coral', shape: DECAL.DISC, dur: 0.7, grow: 0.8 }); for (let i = 0, n = api.n(30); i < n; i++) { const a = Math.random() * 6.283, v = rnd(2, 4); api.spawn(c.x, 0.4, c.z, Math.cos(a) * v, rnd(2, 4), Math.sin(a) * v, 0.6, api.color(FOAM), 1.6, 0.14, 0.04, 9, 0.8); } },
      'coralie-undertow': (api, c) => { const a = c.e.v, len = 2.25; api.decal({ x: c.x + Math.cos(a) * len, z: c.z + Math.sin(a) * len, len, width: 1.1, angle: a, style: 'coral', shape: DECAL.LINE, dur: 0.8 }); },
      'coralie-bloom': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 3.6, style: 'coral', shape: DECAL.RING, inner: 2.8, dur: 1.2 }); api.shake(0.35);
        for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, r = 3.3; spikes(api, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, 0); }
      },
    },
    blink: {},
    // the reef: a coral ring under her that thickens with every stack
    decals(api, h) { const n = h.heroState.reef; if (n) api.mark(api.hx(h), api.hz(h), 1.0, 'coral', DECAL.RING, 0.35 + n * 0.08, h.id, 0, 0.9 - n * 0.04); },
    zones: {
      'coralie-bloom': { decal: (api, z) => { const k = (api.tick - z.born) / Math.max(1, z.until - z.born); api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'coral', DECAL.RING, 0.4 + k * 0.5, z.id, 0, 0.95 - k * 0.2); } },
    },
  },
};
