// The Auctioneer: gold. Filigree rings, coin dots, a gilded chain, price rings on appraised targets.
import { SHAPE, DECAL, rnd } from '../kit.js';

const GOLD = '#ffd65a', COIN = '#f2c14e';

export default {
  key: 'auctioneer', accent: '#d9a7ff', style: 'gold', color: GOLD,
  emblem: '<rect x="10" y="10" width="18" height="10" rx="2" transform="rotate(-30 19 15)"/><path d="M22 22l14 14"/><path d="M8 42h20"/>',
  aim: [{ kind: 'line', range: 900, width: 90 }, { kind: 'unit', range: 800 }, { kind: 'unit', range: 700 }, { kind: 'unit', range: 700, heroesOnly: true }],
  projectiles: {
    'auctioneer-auto': { shape: SHAPE.COIN, color: '#f2c14e', color2: '#fff6c9', size: 0.26, glow: 1.9, spin: 4,
      trail: { color: '#ffe07a', rate: 0.7, size: 0.07, life: 0.3, glint: true }, launch: 'coin', impact: 'coin' },
    'auctioneer-gavel': { shape: SHAPE.COIN, color: '#f2c14e', color2: '#ffffff', size: 0.5, glow: 2.8, spin: 6, sparkle: COIN,
      trail: { color: '#ffe07a', rate: 1.6, size: 0.14, life: 0.4, glint: true }, impact: 'coin' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { tone(e, b, { type: 'triangle', f0: 820, f1: 610, t, dur: 0.08, gain: 0.22 * g, pan: p }); noise(e, b, { f0: 3000, t, dur: 0.03, gain: 0.12 * g, q: 2, pan: p }); },
    auto: (e, b, t, p, g, { tone }) => { tone(e, b, { f0: 2093, t, dur: 0.09, gain: 0.05 * g, pan: p }); tone(e, b, { f0: 3136, t: t + 0.02, dur: 0.12, gain: 0.03 * g, pan: p }); },
  },
  fx: {
    cast(api, c) { const col = api.color(GOLD); for (let i = 0; i < api.n(6); i++) api.spawn(c.cx, 1.3, c.cz, rnd(-1, 1), rnd(2, 3.5), rnd(-1, 1), 0.7, col, 2, 0.1, 0.07, 9, 0.2); },
    events: {
      'auctioneer-refund': (api, c) => {
        for (let i = 0; i < api.n(10); i++) api.spawn(c.x, 1.2, c.z, rnd(-1.5, 1.5), rnd(3, 5), rnd(-1.5, 1.5), 0.9, api.color('#ffd659'), 2.2, 0.12, 0.08, 9, 0.2);
        api.burst(c.x, c.z, 1, 10, 1.4, api.color(COIN), 0.8, 0.14, 0.05, { up: 2.4, gravity: 5 });
      },
      'auctioneer-appraise': (api, c) => api.ring(c.x, c.z, 1.6, 16, 0.4, api.color(COIN), 0.6, 0.12, 0),
      'auctioneer-hook': (api, c) => {
        const o = c.ent ? { x: c.ent.x * api.S, z: c.ent.y * api.S } : c, len = Math.hypot(o.x - c.x, o.z - c.z) / 2;
        if (len > 0.05) api.decal({ x: (c.x + o.x) / 2, z: (c.z + o.z) / 2, len, width: 0.18, angle: Math.atan2(o.z - c.z, o.x - c.x), style: 'gold', shape: DECAL.LINE, dur: 0.5 });
        api.line(o.x, o.z, c.x, c.z, 0.8, 30, api.color(COIN), 0.4, 0.14);
      },
      'auctioneer-repossess': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.3, style: 'gold', shape: DECAL.RING, inner: 0.9, dur: 1.2, spinRate: 5 }); api.burst(c.x, c.z, 1.2, 30, 2.5, api.color(COIN), 0.9, 0.18, 0.04, { up: 1.5, gravity: 4 }); },
      'auctioneer-return': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.3, style: 'gold', shape: DECAL.RING, inner: 0.9, dur: 1.2, spinRate: 5 }); api.burst(c.x, c.z, 1.2, 30, 2.5, api.color(COIN), 0.9, 0.18, 0.04, { up: 1.5, gravity: 4 }); },
    },
    // Appraise: a gilded price ring on everything marked
    world(api, world) {
      const t = api.tick, now = api.now;
      for (const u of world.entities) {
        if (!u.alive || u.dead || u.ampUntil <= t) continue;
        if (u.kind === 1) api.mark(api.hx(u), api.hz(u), 0.95, 'gold', DECAL.RING, Math.min(1, (u.ampUntil - t) / 10), u.id, now * 2, 0.62);
        else api.mark(api.hx(u), api.hz(u), 0.8, 'gold', DECAL.RING, 0.8, u.id, now * 2, 0.62);
      }
    },
  },
};
