// Gus & Pebble: stone. Radial cracks, dust rings, boulder tracks, telegraphed rockfalls.
import { SHAPE, DECAL } from '../kit.js';

const STONE = '#cdb894', ROCK = '#bfae93', DUST = '#d7c9b0';

export default {
  key: 'gus', accent: '#9fb8a0', style: 'stone', color: STONE,
  emblem: '<path d="M6 36l8-14 7 6 8-14 13 22z"/><circle cx="33" cy="12" r="4"/>',
  aim: [{ kind: 'gusq', range: 900, radius: 160 }, { kind: 'self', radius: 220 }, { kind: 'line', range: 620, width: 160 }, { kind: 'point', range: 800, radius: 300 }],
  /** Q depends on the mount: a slam in front of Pebble, or a lobbed rock on foot. */
  aimFor(me, slot, a) { return a.kind !== 'gusq' ? a : me.heroState.mounted ? { kind: 'point', range: 140, radius: 190, anchored: true } : { kind: 'point', range: 900, radius: 160 }; },
  projectiles: {
    'gus-auto': { shape: SHAPE.ROCK, color: '#8a7a66', color2: '#d9c3a0', size: 0.24, glow: 1, arc: 0.8, spin: 2, impact: 'dust' },
  },
  melee: {
    gus: { color: '#c9a26a', edge: '#fff3dc', arc: 2.6, radius: 1.25, width: 0.45, dur: 0.26, heavy: true, impact: 'dust' },
    pebble: { color: '#a39580', edge: '#e8dcc4', arc: 2.2, radius: 1.3, width: 0.5, dur: 0.28, heavy: true, impact: 'dust' },
  },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { tone(e, b, { f0: 140, f1: 55, t, dur: 0.35, gain: 0.3 * g, pan: p }); noise(e, b, { type: 'lowpass', f0: 900, t, dur: 0.18, gain: 0.14 * g, pan: p }); },
    auto: (e, b, t, p, g, { tone, noise }) => { tone(e, b, { f0: 110, f1: 60, t, dur: 0.16, gain: 0.2 * g, pan: p }); noise(e, b, { type: 'lowpass', f0: 700, t, dur: 0.08, gain: 0.08 * g, pan: p }); },
  },
  fx: {
    cast(api, c) { if (c.slot === 3) api.decal({ x: c.tx, z: c.tz, r: 3, style: 'stone', shape: DECAL.RING, inner: 2.7, dur: 0.9 }); },
    events: {
      'gus-slam': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 2, style: 'stone', shape: DECAL.DISC, dur: 1.4, grow: 1 });
        api.burst(c.x, c.z, 0.1, 40, 4.5, api.color(ROCK), 0.8, 0.3, 0.06, { up: 2, gravity: 8, drag: 1.5, intensity: 0.9 }); api.ring(c.x, c.z, 0.1, 30, 0.4, api.color(DUST), 0.5, 0.25, 5); api.shake(0.4);
      },
      'gus-rock-impact': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.7, style: 'stone', shape: DECAL.DISC, dur: 1.2, grow: 1 }); api.burst(c.x, c.z, 0.2, 30, 3.5, api.color(ROCK), 0.7, 0.26, 0.05, { up: 2, gravity: 8, intensity: 0.9 }); },
      'gus-avalanche': (api, c) => {
        api.decal({ x: c.x, z: c.z, r: 3.2, style: 'stone', shape: DECAL.DISC, dur: 2.2, grow: 1 }); api.ring(c.x, c.z, 0.3, 40, 0.8, api.color(STONE), 0.8, 0.3, 6);
        api.burst(c.x, c.z, 0.2, 80, 6, api.color(ROCK), 1, 0.4, 0.08, { up: 3, gravity: 9, drag: 1.2, intensity: 0.9 }); api.ring(c.x, c.z, 0.1, 48, 0.6, api.color(DUST), 0.7, 0.35, 7); api.shake(1);
      },
      'pebble-crumble': (api, c) => api.burst(c.x, c.z, 0.8, 40, 3, api.color(ROCK), 1, 0.35, 0.05, { gravity: 9, up: 1.5, intensity: 0.8 }),
      'gus-dismount': (api, c) => api.ring(c.x, c.z, 0.1, 16, 0.6, api.color(DUST), 0.4, 0.2, 2),
      'gus-mount': (api, c) => api.ring(c.x, c.z, 0.1, 16, 0.6, api.color(DUST), 0.4, 0.2, 2),
      'gus-rebuild': (api, c) => api.ring(c.x, c.z, 0.1, 16, 0.6, api.color(DUST), 0.4, 0.2, 2),
      'gus-lob': (api, c) => api.telegraph(c.e.x, c.e.y, 160, c.e.v || 0.6, c.ent ? c.ent.team : 0),
      'gus-avalanche-warn': (api, c) => api.telegraph(c.e.x, c.e.y, 300, c.e.v || 0.6, c.ent ? c.ent.team : 0),
    },
    // the boulder roll leaves cracked ground (stamp times live here: sim records stay fixed-shape)
    world(api, world) {
      const stamps = api.state('gus-roll'), t = api.tick, now = api.now;
      for (const u of world.entities) if (u.alive && !u.dead && u.dashUntil > t && u.dashFx === 'pebble-roll') {
        const last = stamps.get(u.id) || 0; if (now - last < 0.09) continue;
        stamps.set(u.id, now); api.decal({ x: api.hx(u), z: api.hz(u), r: 0.8, style: 'stone', shape: DECAL.DISC, dur: 1.2, grow: 0.6 });
      }
    },
  },
};
