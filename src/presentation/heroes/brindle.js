// Brindle, the Beekeeper: honey. Glossy honeycomb, amber pools, a honeycomb dome.
import { SHAPE, DECAL, DISC } from '../kit.js';

const HONEY = '#ffc233';

export default {
  key: 'brindle', accent: '#f2c14e', style: 'honey', color: HONEY,
  emblem: '<path d="M24 6l14 8v16l-14 8-14-8V14z"/><ellipse cx="24" cy="23" rx="5" ry="7"/><path d="M19 20h10M19 26h10"/>',
  aim: [{ kind: 'unit', range: 650 }, { kind: 'ally', range: 700 }, { kind: 'point', range: 700, radius: 220 }, { kind: 'self', radius: 340 }],
  projectiles: {
    'brindle-auto': { shape: SHAPE.BEE, color: '#ffcf3d', color2: '#20160a', size: 0.26, glow: 1.2, wobble: 0.18,
      trail: { color: '#ffe27a', rate: 0.6, size: 0.06, life: 0.25 }, launch: 'honey', impact: 'honey' },
    'brindle-sting': { shape: SHAPE.BEE, color: '#ffd000', color2: '#20160a', size: 0.3, glow: 1.4, wobble: 0.3, sparkle: '#ffc233',
      trail: { color: '#ffe27a', rate: 1, size: 0.07, life: 0.3 }, impact: 'honey' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone }) => tone(e, b, { type: 'sawtooth', f0: 190, f1: 230, t, dur: 0.4, gain: 0.05 * g, pan: p, filter: 1400, vibrato: 0.06, attack: 0.04 }),
    auto: (e, b, t, p, g, { tone }) => tone(e, b, { type: 'sawtooth', f0: 260, f1: 330, t, dur: 0.12, gain: 0.03 * g, pan: p, filter: 1600, vibrato: 0.08 }),
  },
  fx: {
    cast(api, c) { if (c.slot === 2) api.decal({ x: c.tx, z: c.tz, r: 0.9, style: 'honey', shape: DECAL.RING, inner: 0.6, dur: 0.5, grow: 0.8 }); },
    events: {
      'brindle-shield': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1, style: 'honey', shape: DECAL.RING, inner: 0.7, dur: 0.6 }); api.ring(c.x, c.z, 0.9, 20, 0.6, api.color(HONEY), 0.7, 0.14, 0.6); },
      'brindle-dome': (api, c) => api.ring(c.x, c.z, 0.2, 40, 3.2, api.color(HONEY), 0.9, 0.3, 0.5),
    },
    zones: {
      'brindle-honey': {
        draw: (api, z, k) => api.disc(z.x, z.y, z.r, DISC.HONEY, 0, k.fade, z.team, z.id % 7),
        decal: (api, z) => { const t = api.tick; api.mark(z.x * api.S, z.y * api.S, z.r * api.S, 'honey', DECAL.DISC, Math.min(1, (z.until - t) / 10, (t - z.born) / 5), z.id, 0, 0); },
      },
      'brindle-dome': { draw: (api, z, k) => api.dome(z.x, z.y, z.r, k.age, k.fade) },
      'brindle-sting-dot': {
        particles(api, z, rate) {
          const u = api.world.entities[z.data.target]; if (!u || !u.alive || u.dead || Math.random() >= rate * 0.5) return;
          const a = api.now * 9 + Math.random(), col = api.color(HONEY);
          api.spawn(api.hx(u) + Math.cos(a) * 0.3, 1 + Math.random() * 0.5, api.hz(u) + Math.sin(a) * 0.3, 0, 0, 0, 0.3, col, 1.6, 0.1, 0.05);
        },
      },
    },
  },
};
