// Nimbus Kettle, the Stormherd: storm. Jagged bolts, crackling rims, a thunderhead that strikes.
import { SHAPE, DECAL, rnd } from '../kit.js';

const BOLT = '#a8f0ff', WHITE = '#eaffff', CLOUD = '#6e7a99';

/** A lightning bolt between two points (render units): a jagged particle line plus bright end flashes. */
function bolt(api, x0, z0, x1, z1, y = 1.1) {
  const col = api.color(BOLT), core = api.color(WHITE), n = 7;
  let px = x0, pz = z0;
  for (let i = 1; i <= n; i++) {
    const k = i / n, jx = i < n ? rnd(-0.25, 0.25) : 0, jz = i < n ? rnd(-0.25, 0.25) : 0;
    const x = x0 + (x1 - x0) * k + jx, z = z0 + (z1 - z0) * k + jz;
    api.line(px, pz, x, z, y + rnd(-0.1, 0.2), 4, i % 2 ? core : col, 0.18, 0.12);
    px = x; pz = z;
  }
  api.burst(x1, z1, 0.8, 8, 2.5, core, 0.25, 0.16, 0.02, { drag: 5, intensity: 2.4 });
}

export default {
  key: 'nimbus', accent: '#a8f0ff', style: 'storm', color: BOLT,
  emblem: '<path d="M10 22a9 9 0 0 1 16-6 7 7 0 0 1 12 5 5 5 0 0 1 0 10H12a5 5 0 0 1-2-9z"/><path d="M24 30l-4 8h6l-3 8"/>',
  aim: [{ kind: 'line', range: 850, width: 90 }, { kind: 'point', range: 800, radius: 200 }, { kind: 'cone', range: 440, angle: Math.PI * 0.44 }, { kind: 'self', radius: 420 }],
  projectiles: {
    'nimbus-auto': { shape: SHAPE.LANCE, color: '#a8f0ff', color2: '#ffffff', size: 0.2, glow: 2.6, stretch: 2.4,
      trail: { color: '#cff8ff', rate: 1.2, size: 0.07, life: 0.18, sparks: true }, launch: 'spark', impact: 'spark' },
    'nimbus-bolt': { shape: SHAPE.SHARD, color: '#bff6ff', color2: '#ffffff', size: 0.42, glow: 3.2, stretch: 2.2, sparkle: BOLT,
      trail: { color: '#a8f0ff', rate: 2, size: 0.12, life: 0.22, sparks: true }, impact: 'spark' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'highpass', f0: 3000, f1: 800, t, dur: 0.25, gain: 0.16 * g, q: 0.7, pan: p }); tone(e, b, { type: 'sawtooth', f0: 90, f1: 60, t, dur: 0.3, gain: 0.08 * g, pan: p, filter: 800 }); },
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'highpass', f0: 5000, f1: 2500, t, dur: 0.06, gain: 0.08 * g, q: 0.8, pan: p }),
  },
  fx: {
    cast(api, c) { if (c.slot === 0) api.burst(c.cx, c.cz, 1.3, 8, 2, api.color(BOLT), 0.25, 0.1, 0.02, { drag: 5, intensity: 2.2 }); },
    events: {
      'nimbus-chain': (api, c) => { const from = api.world.entities[c.e.b]; if (from) bolt(api, api.hx(from), api.hz(from), c.x, c.z); },
      'nimbus-strike': (api, c) => {
        bolt(api, c.x + rnd(-0.3, 0.3), c.z - 0.6, c.x, c.z, 0.1);
        const col = api.color(WHITE); for (let i = 0; i < 6; i++) api.spawn(c.x, 3.4 - i * 0.55, c.z, 0, 0, 0, 0.14, col, 3, 0.2, 0.08);
        api.decal({ x: c.x, z: c.z, r: 0.8, style: 'storm', shape: DECAL.DISC, dur: 0.45, grow: 0.6 });
        if (c.e.v) api.shake(0.05);
      },
      'nimbus-gale': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 4.4, style: 'wind', shape: DECAL.CONE, angle: c.e.v, half: Math.PI / 4.5, dur: 0.55 });
        const col = api.color('#dff9ff');
        for (let i = 0, n = api.n(26); i < n; i++) { const a = c.e.v + rnd(-0.6, 0.6), v = rnd(4, 8); api.spawn(c.x, 0.6 + rnd(0, 0.6), c.z, Math.cos(a) * v, 0.3, Math.sin(a) * v, 0.45, col, 1.4, 0.16, 0.04, 0, 3); }
      },
      'nimbus-eye': (api, c) => { api.ring(c.x, c.z, 0.4, 36, 1, api.color(BOLT), 0.6, 0.18, 5); api.shake(0.25); },
    },
    // static charges: small crackling orbs orbiting him, one per stack
    particles(api, h, rate) {
      const n = h.heroState.static; if (!n) return;
      const x = api.hx(h), z = api.hz(h), col = api.color(n >= 3 ? WHITE : BOLT);
      for (let i = 0; i < n; i++) { if (Math.random() > rate * 0.8) continue; const a = api.now * 4 + i * 2.094; api.spawn(x + Math.cos(a) * 0.5, 1.2 + Math.sin(api.now * 7 + i) * 0.1, z + Math.sin(a) * 0.5, 0, 0, 0, 0.12, col, n >= 3 ? 3 : 2, 0.14, 0.06); }
    },
    zones: {
      'nimbus-cloud': {
        decal: (api, z) => { const t = api.tick; api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'storm', DECAL.DISC, Math.min(1, (z.until - t) / 8, (t - z.born) / 4), z.id, api.now, 0); },
        particles(api, z, rate) { // the thunderhead: dark puffs hanging over the zone
          if (Math.random() > rate * 1.5) return; const a = Math.random() * 6.283, r = Math.random() * z.r * api.S * 0.8;
          api.spawn(z.x * api.S + Math.cos(a) * r, 3.2 + rnd(-0.2, 0.3), z.y * api.S + Math.sin(a) * r, rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2), 0.9, api.color(CLOUD), 0.7, 0.9, 1.2, 0, 1);
        },
      },
      'nimbus-eye': {
        decal: (api, z) => { const t = api.tick, o = api.world.entities[z.data.follow]; if (!o || o.dead) return; api.mark(api.hx(o), api.hz(o), z.r * api.S, 'storm', DECAL.RING, Math.min(1, (z.until - t) / 8), z.id, api.now * 2, 0.9); },
        particles(api, z, rate) { const o = api.world.entities[z.data.follow]; if (!o || o.dead || Math.random() > rate) return; const a = Math.random() * 6.283, r = z.r * api.S; api.spawn(api.hx(o) + Math.cos(a) * r, 0.3, api.hz(o) + Math.sin(a) * r, 0, rnd(1, 2), 0, 0.3, api.color(BOLT), 2, 0.12, 0.04); },
      },
    },
  },
};
