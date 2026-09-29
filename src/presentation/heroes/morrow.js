// Morrow, the Clockwright: brass clockwork. Clock faces, ticking hands, tick-marked afterimages.
import { SHAPE, DECAL, DISC, rnd } from '../kit.js';

const gear = () => {
  let d = '';
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const x1 = 24 + Math.cos(a) * 13, y1 = 24 + Math.sin(a) * 13, x2 = 24 + Math.cos(a) * 19, y2 = 24 + Math.sin(a) * 19; d += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`; }
  return `<circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4.5"/>${d}<path d="M24 24 L24 17"/>`;
};
const CLOCK = '#f2c14e';

export default {
  key: 'morrow', accent: '#f7b267', emblem: gear(), style: 'clock', color: CLOCK,
  aim: [{ kind: 'line', range: 700, width: 110 }, { kind: 'self', radius: 90 }, { kind: 'echo', range: 1100 }, { kind: 'self', radius: 120 }],
  projectiles: {
    'morrow-auto': { shape: SHAPE.GEAR, color: '#f2c14e', color2: '#fff1c2', size: 0.28, glow: 1.8, spin: 3,
      trail: { color: '#ffd27a', rate: 0.9, size: 0.08, life: 0.3, sparks: true }, launch: 'brass', impact: 'brass' },
    'morrow-cog': { shape: SHAPE.GEAR, color: '#f2c14e', color2: '#fffbe6', size: 0.5, glow: 2.4, spin: 5, sparkle: '#f2c14e',
      trail: { color: '#ffd27a', rate: 1.6, size: 0.12, life: 0.35, sparks: true }, impact: 'brass' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone }) => { for (let i = 0; i < 3; i++) tone(e, b, { type: 'square', f0: 1400 - i * 180, t: t + i * 0.045, dur: 0.05, gain: 0.05 * g, pan: p, filter: 3000 }); tone(e, b, { f0: 520, f1: 880, t, dur: 0.2, gain: 0.08 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone }) => { tone(e, b, { type: 'square', f0: 1900, t, dur: 0.03, gain: 0.04 * g, pan: p, filter: 4000 }); tone(e, b, { type: 'square', f0: 1300, t: t + 0.035, dur: 0.03, gain: 0.035 * g, pan: p, filter: 3500 }); },
  },
  shieldStyle: (h) => (h.heroState.windupShield ? 'clock' : null), // Wind-Up: he shields himself in brass
  fx: {
    cast(api, c) {
      if (c.slot === 1) api.decal({ x: c.cx, z: c.cz, r: 1.25, style: 'clock', shape: DECAL.DISC, dur: 2, spinRate: 3, follow: c.ent.id }); // wind-up: a ticking face under him
      else if (c.slot === 0) {
        const col = api.color(CLOCK);
        for (let i = 0; i < api.n(8); i++) api.spawn(c.cx, 1, c.cz, rnd(-2, 2), rnd(1, 3), rnd(-2, 2), 0.4, col, 2.2, 0.06, 0.02, 8, 1);
        api.burst(c.tx, c.tz, 0.8, 4, 1, col, 0.4, 0.12, 0.02);
      }
    },
    blink: {
      'morrow-step': (api, c) => api.trail(c, 'clock'),
      'morrow-rewind': (api, c) => {
        api.trail(c, 'clock');
        api.decal({ x: c.tx, z: c.tz, r: 1.6, style: 'clock', shape: DECAL.DISC, dur: 1, spinRate: -14 });
        api.ring(c.tx, c.tz, 0.2, 36, 0.9, api.color(CLOCK), 0.9, 0.18, -1.2); api.shake(0.2);
      },
    },
    events: {
      rewind: (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.3, style: 'clock', shape: DECAL.DISC, dur: 0.6, spinRate: -18 }); api.ring(c.x, c.z, 0.8, 24, 0.7, api.color(CLOCK), 0.5, 0.14, -0.8); },
      'morrow-spring': (api, c) => api.burst(c.x, c.z, 0.4, 16, 2.4, api.color(CLOCK), 0.4, 0.14, 0.02),
    },
    // echoes: clock faces on the ground where he can step back to
    ground(api, h) { const t = api.tick; for (const e of h.heroState.echoes) api.disc(e.x, e.y, 58, DISC.ECHO, 0, Math.min(1, (e.until - t) / api.tickHz), h.team, e.id); },
  },
};
