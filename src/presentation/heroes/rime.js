// Rime Holloway, the Frostwright: frost. Crystal facets, snowflake arms, frozen heroes in ice.
import { SHAPE, DECAL, rnd } from '../kit.js';

const FROST = '#9ec9ff', ICE = '#e6f4ff', SNOW = '#ffffff';

// chill indicators: one stored callback per frame (no closure allocated per frame)
const chillCtx = { api: null, t: 0 };
const drawChill = (c, id) => {
  const api = chillCtx.api, u = api.world.entities[id];
  if (!u || u.dead || c.until <= chillCtx.t || !c.n) return;
  api.mark(api.hx(u), api.hz(u), 0.75 + c.n * 0.08, 'frost', DECAL.RING, 0.3 + c.n * 0.22, id + 11, api.now * 0.5, 0.8);
};

export default {
  key: 'rime', accent: '#9ec9ff', style: 'frost', color: FROST,
  emblem: '<path d="M24 4v40M6.7 14l34.6 20M6.7 34l34.6-20"/><path d="M20 8l4 4 4-4M20 40l4-4 4 4"/>',
  aim: [{ kind: 'line', range: 900, width: 100 }, { kind: 'point', range: 750, radius: 230 }, { kind: 'self', radius: 800 }, { kind: 'point', range: 800, radius: 340 }],
  projectiles: {
    'rime-auto': { shape: SHAPE.SHARD, color: '#cfe6ff', color2: '#ffffff', size: 0.24, glow: 1.8, stretch: 1.6,
      trail: { color: '#e6f4ff', rate: 0.8, size: 0.07, life: 0.3, drip: true }, impact: 'frost' },
    'rime-icicle': { shape: SHAPE.LANCE, color: '#dff0ff', color2: '#9ec9ff', size: 0.55, glow: 2.2, stretch: 3, sparkle: FROST,
      trail: { color: '#cfe6ff', rate: 2, size: 0.12, life: 0.4, drip: true }, impact: 'frost' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { tone(e, b, { type: 'sine', f0: 1760, f1: 2640, t, dur: 0.25, gain: 0.06 * g, pan: p }); noise(e, b, { type: 'highpass', f0: 6000, t, dur: 0.2, gain: 0.08 * g, q: 0.7, pan: p }); },
    auto: (e, b, t, p, g, { tone }) => tone(e, b, { type: 'sine', f0: 2200, f1: 1700, t, dur: 0.08, gain: 0.05 * g, pan: p }),
  },
  fx: {
    events: {
      'rime-freeze': (api, c) => {
        const u = api.world.entities[c.e.b]; if (!u) return;
        api.decal({ x: api.hx(u), z: api.hz(u), r: 0.95, style: 'frost', shape: DECAL.DISC, dur: c.e.v + 0.2, follow: u.id });
        for (let i = 0, n = api.n(24); i < n; i++) { const a = Math.random() * 6.283; api.spawn(api.hx(u) + Math.cos(a) * 0.45, rnd(0.1, 1.7), api.hz(u) + Math.sin(a) * 0.45, 0, 0, 0, c.e.v, api.color(ICE), 1.6, 0.16, 0.14); }
      },
      'rime-shatter': (api, c) => {
        const col = api.color(ICE);
        for (let i = 0, n = api.n(10 + 8 * c.e.v); i < n; i++) api.spawn(c.x, rnd(0.4, 1.4), c.z, rnd(-3, 3), rnd(1, 4), rnd(-3, 3), 0.55, col, 2, 0.12, 0.02, 9, 0.6);
        api.decal({ x: c.x, z: c.z, r: 0.6 + 0.25 * c.e.v, style: 'frost', shape: DECAL.RING, inner: 0.3, dur: 0.5, grow: 0.7 });
      },
      'rime-whiteout-warn': (api, c) => api.decal({ x: c.x, z: c.z, r: 3.4, style: 'frost', shape: DECAL.RING, inner: 3.1, dur: 0.85 }),
    },
    world(api, world) {
      chillCtx.api = api; chillCtx.t = api.tick;
      for (const h of world.heroes) if (h.heroKey === 'rime') h.heroState.chill.forEach(drawChill);
    },
    zones: {
      'rime-field': {
        decal: (api, z) => { const t = api.tick; api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'frost', DECAL.DISC, Math.min(1, (z.until - t) / 8, (t - z.born) / 4), z.id, 0, 0); },
        particles(api, z, rate) { if (Math.random() > rate) return; const a = Math.random() * 6.283, r = Math.random() * z.r * api.S; api.spawn(z.x * api.S + Math.cos(a) * r, 0.1, z.y * api.S + Math.sin(a) * r, 0, rnd(0.2, 0.6), 0, 0.8, api.color(SNOW), 1.2, 0.1, 0.04, 0, 1); },
      },
      'rime-whiteout': {
        decal: (api, z) => { const t = api.tick, on = t - z.born >= api.tickHz * 0.8; api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'frost', on ? DECAL.DISC : DECAL.RING, on ? Math.min(1, (z.until - t) / 8) : 0.6, z.id, 0, on ? 0 : 0.9); },
        particles(api, z, rate) {
          if (api.tick - z.born < api.tickHz * 0.8) return;
          for (let i = 0; i < 3; i++) { if (Math.random() > rate) continue; const a = Math.random() * 6.283, r = Math.random() * z.r * api.S; api.spawn(z.x * api.S + Math.cos(a) * r, 2.6, z.y * api.S + Math.sin(a) * r, rnd(1, 2.5), -rnd(1.5, 3), rnd(-0.5, 0.5), 1, api.color(SNOW), 1.4, 0.12, 0.08, 0, 0.5); }
        },
      },
    },
  },
};
