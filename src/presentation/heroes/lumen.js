// Lumen Vey, the Starcartographer: star. Star points, constellation rings, starlight threads.
import { SHAPE, DECAL, rnd } from '../kit.js';

const STAR = '#ffe9b0', NIGHT = '#8fa6ff', WHITE = '#fffdf2';

// stars charted on enemies: one stored callback per frame
const starCtx = { api: null, t: 0 };
const drawStars = (c, id) => {
  const api = starCtx.api, u = api.world.entities[id];
  if (!u || u.dead || c.until <= starCtx.t || !c.n) return;
  const x = api.hx(u), z = api.hz(u);
  api.mark(x, z, 0.85, 'star', DECAL.RING, 0.35 + c.n * 0.25, id + 5, api.now * 0.6, 0.82);
  for (let i = 0; i < c.n; i++) { const a = api.now * 1.5 + i * 2.094; api.spawnOnce(x + Math.cos(a) * 0.35, 2.15, z + Math.sin(a) * 0.35, api.color(WHITE), 0.16); }
};

export default {
  key: 'lumen', accent: '#ffe9b0', style: 'star', color: STAR,
  emblem: '<path d="M24 6l4.5 11.5L40 18l-9 8 3 12-10-6.5L14 38l3-12-9-8 11.5-.5z"/><circle cx="40" cy="40" r="2"/><circle cx="8" cy="40" r="1.5"/>',
  aim: [{ kind: 'point', range: 850, radius: 150 }, { kind: 'unit', range: 700, heroesOnly: true }, { kind: 'point', range: 380, radius: 50 }, { kind: 'self', radius: 1100 }],
  projectiles: {
    'lumen-auto': { shape: SHAPE.ORB, color: '#fff3c8', color2: '#8fa6ff', size: 0.22, glow: 2.4,
      trail: { color: '#ffe9b0', rate: 1.2, size: 0.06, life: 0.4, glint: true }, impact: 'star' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone }) => { tone(e, b, { type: 'sine', f0: 1320, t, dur: 0.4, gain: 0.05 * g, pan: p }); tone(e, b, { type: 'sine', f0: 1980, t: t + 0.06, dur: 0.35, gain: 0.04 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone }) => tone(e, b, { type: 'sine', f0: 2640, f1: 2400, t, dur: 0.1, gain: 0.035 * g, pan: p }),
  },
  fx: {
    blink: { 'lumen-wayfinder': (api, c) => { api.trail(c, 'star'); api.burst(c.tx, c.tz, 1, 14, 2, api.color(WHITE), 0.5, 0.12, 0.02, { drag: 4, intensity: 2.4 }); } },
    events: {
      'lumen-star': (api, c) => api.burst(c.x, c.z, 2, 6, 1.2, api.color(WHITE), 0.4, 0.14, 0.02, { drag: 3, intensity: 2.6 }),
      'lumen-constellation': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 1.4, style: 'star', shape: DECAL.DISC, dur: 0.9, spinRate: 2, grow: 0.6 });
        const col = api.color(STAR);
        for (let i = 0; i < 3; i++) { const a = i * 2.094, b = a + 2.094; api.line(c.x + Math.cos(a) * 1.2, c.z + Math.sin(a) * 1.2, c.x + Math.cos(b) * 1.2, c.z + Math.sin(b) * 1.2, 1.6, 10, col, 0.6, 0.1); }
        api.burst(c.x, c.z, 1.2, 20, 3, api.color(WHITE), 0.45, 0.16, 0.02, { drag: 4, intensity: 2.8 });
      },
      'lumen-impact': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.5, style: 'star', shape: DECAL.DISC, dur: 0.7, grow: 0.7, spinRate: 3 }); api.burst(c.x, c.z, 0.5, 20, 3, api.color(STAR), 0.4, 0.2, 0.03, { up: 1.5, intensity: 2.2 }); api.shake(0.08); },
      'lumen-nova': (api, c) => { api.ring(c.x, c.z, 0.5, 60, 1, api.color(NIGHT), 1, 0.22, 11); api.ring(c.x, c.z, 1.5, 40, 0.5, api.color(STAR), 0.8, 0.16, 8); api.shake(0.3); },
    },
    world(api, world) {
      starCtx.api = api; starCtx.t = api.tick;
      for (const h of world.heroes) if (h.heroKey === 'lumen') h.heroState.stars.forEach(drawStars);
    },
    zones: {
      // a star falling onto its target: a spinning star decal growing in, a streak coming down
      'lumen-fall': {
        decal: (api, z) => { const k = (api.tick - z.born) / Math.max(1, z.until - z.born); api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'star', DECAL.DISC, 0.3 + k * 0.6, z.id, api.now * 2, 0); },
        particles(api, z, rate) { const k = (api.tick - z.born) / Math.max(1, z.until - z.born); if (Math.random() < rate * 2) api.spawn(z.x * api.S + rnd(-0.1, 0.1), 5 - k * 4.8, z.y * api.S + rnd(-0.1, 0.1), 0, -2, 0, 0.2, api.color(WHITE), 3, 0.3, 0.05); },
      },
      'lumen-thread': {
        decal: (api, z) => {
          const o = api.world.entities[z.owner], u = api.world.entities[z.data.target]; if (!o || !u || o.dead || u.dead) return;
          const x0 = api.hx(o), z0 = api.hz(o), x1 = api.hx(u), z1 = api.hz(u);
          api.markLine((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2, 0.16, Math.atan2(z1 - z0, x1 - x0), 'star', 0.9, z.id);
        },
        particles(api, z, rate) { const o = api.world.entities[z.owner], u = api.world.entities[z.data.target]; if (!o || !u || Math.random() > rate) return; const k = Math.random(); api.spawn(api.hx(o) + (api.hx(u) - api.hx(o)) * k, 1.1, api.hz(o) + (api.hz(u) - api.hz(o)) * k, 0, 0.2, 0, 0.3, api.color(WHITE), 2.4, 0.12, 0.02); },
      },
    },
  },
};
