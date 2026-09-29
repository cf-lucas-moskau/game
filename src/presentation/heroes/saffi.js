// Saffi Blinkwick, the Candle: candle fire. Molten wax wedges, scorch marks, flame rings.
import { SHAPE, DECAL, RIBBON, rnd } from '../kit.js';

const FIRE = '#ff8a3d', EMBER = '#ffd27a';

export default {
  key: 'saffi', accent: '#ff8a4c', style: 'flame', color: FIRE,
  emblem: '<path d="M24 6c5 7 10 12 10 20a10 10 0 0 1-20 0c0-5 3-8 5-11 1 4 3 6 5 6 0-6-2-10 0-15z"/><rect x="17" y="36" width="14" height="6" rx="2"/>',
  aim: [{ kind: 'point', range: 350, radius: 60 }, { kind: 'cone', range: 400, angle: Math.PI * 0.4 }, { kind: 'unit', range: 550 }, { kind: 'self', radius: 200 }],
  projectiles: {
    'saffi-auto': { shape: SHAPE.SHARD, color: '#ff9d4d', color2: '#fff4d6', size: 0.18, glow: 2, stretch: 1.8, impact: 'ember' },
  },
  melee: { saffi: { color: '#ff8a3d', edge: '#fff2cf', arc: 2.1, radius: 1.05, width: 0.34, dur: 0.2, alternate: true, impact: 'ember' } },
  sounds: {
    cast: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'lowpass', f0: 500, f1: 3200, t, dur: 0.28, gain: 0.22 * g, q: 3, pan: p, attack: 0.03 }),
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 3200, f1: 900, t, dur: 0.09, gain: 0.12 * g, q: 2, pan: p }),
  },
  fx: {
    cast(api, c) { if (c.slot === 3) api.ring(c.cx, c.cz, 0.3, 40, 0.3, api.color(FIRE), 0.8, 0.3, 4); },
    blink: {
      'saffi-flicker': (api, c) => {
        api.trail(c, 'flame');
        api.decal({ x: c.x, z: c.z, r: 0.7, style: 'flame', shape: DECAL.DISC, dur: 1.2 }); api.decal({ x: c.tx, z: c.tz, r: 0.6, style: 'flame', shape: DECAL.DISC, dur: 0.8 });
      },
    },
    events: {
      'saffi-wax': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 4.2, style: 'flame', shape: DECAL.CONE, angle: c.e.v, half: Math.PI / 5, dur: 0.7 }); // the exact hit area (420 units, +-36 deg)
        const a = c.e.v, col = api.color(EMBER);
        for (let i = 0, n = api.n(30); i < n; i++) { const t = a + rnd(-0.6, 0.6), v = rnd(2, 5); api.spawn(c.x, 0.8, c.z, Math.cos(t) * v, 0.5, Math.sin(t) * v, 0.5, col, 1.8, 0.18, 0.04, 3, 2.5); }
      },
      'saffi-snuff-exec': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1, style: 'flame', shape: DECAL.DISC, dur: 0.5, grow: 0.5 }); api.burst(c.x, c.z, 0.9, 24, 3.5, api.color(FIRE), 0.5, 0.25, 0.03, { drag: 4, intensity: 2.2 }); },
      'saffi-mark-pop': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1, style: 'flame', shape: DECAL.DISC, dur: 0.5, grow: 0.5 }); api.burst(c.x, c.z, 0.9, 24, 3.5, api.color(FIRE), 0.5, 0.25, 0.03, { drag: 4, intensity: 2.2 }); },
      'saffi-blaze': (api, c) => { api.ring(c.x, c.z, 0.3, 40, 0.4, api.color(FIRE), 0.8, 0.3, 4); api.shake(0.3); },
      'saffi-splash': (api, c) => api.burst(c.x, c.z, 0.6, 16, 3, api.color(FIRE), 0.45, 0.24, 0.03, { drag: 4, intensity: 2 }),
    },
    decals(api, h) { const hs = h.heroState, t = api.tick; if (hs.blazeUntil > t) api.mark(api.hx(h), api.hz(h), 1.3, 'flame', DECAL.RING, Math.min(1, (hs.blazeUntil - t) / 15), h.id, 0, 0.72); },
    // the candle: a flame over her head, a column of fire during Blaze Up
    particles(api, h, rate) {
      const blaze = h.heroState.blazeUntil > api.tick, x = api.hx(h), z = api.hz(h), col = api.color(FIRE);
      if (Math.random() < rate * (blaze ? 1 : 0.35)) api.spawn(x + rnd(-0.1, 0.1), 1.9 + (blaze ? rnd(-1.4, 0) : 0), z + rnd(-0.1, 0.1), rnd(-0.2, 0.2), rnd(0.8, 1.6), rnd(-0.2, 0.2), 0.5, col, 2, blaze ? 0.24 : 0.12, 0.02);
    },
    // Wax Drip marks enemy heroes
    world(api, world) { const t = api.tick; for (const h of world.heroes) if (!h.dead && h.markUntil > t) api.mark(api.hx(h), api.hz(h), 0.8, 'flame', DECAL.RING, 0.8, h.id + 3, 0, 0.66); },
    zones: {
      'saffi-trail': {
        draw: (api, z, k) => api.ribbon([z.x, z.y, z.x2, z.y2], RIBBON.FIRE, k.fade, 40),
        particles(api, z, rate) { if (Math.random() < rate * 0.9) { const k = Math.random(), col = api.color(FIRE); api.spawn(api.S * (z.x + (z.x2 - z.x) * k), 0.1, api.S * (z.y + (z.y2 - z.y) * k), rnd(-0.2, 0.2), rnd(0.6, 1.4), rnd(-0.2, 0.2), 0.55, col, 1.3, 0.16, 0.03); } },
      },
    },
  },
};
