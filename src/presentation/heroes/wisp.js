// Wisp Umbrel, the Duskmoth: shadow. Drifting smoke, violet edges, moths, a shade to swap with.
import { SHAPE, DECAL, rnd } from '../kit.js';

const DUSK = '#d65cff', SMOKE = '#3a2a4a', MOTH = '#f0d8ff';

// dusk marks on enemies: one stored callback per frame
const markCtx = { api: null, t: 0 };
const drawMark = (until, id) => {
  const api = markCtx.api, u = api.world.entities[id];
  if (!u || u.dead || until <= markCtx.t) return;
  api.mark(api.hx(u), api.hz(u), 0.85, 'shadow', DECAL.RING, 0.85, id + 9, 0, 0.74);
};

export default {
  key: 'wisp', accent: '#d65cff', style: 'shadow', color: DUSK,
  emblem: '<path d="M24 16c-3-6-12-10-18-6 0 8 6 14 16 14"/><path d="M24 16c3-6 12-10 18-6 0 8-6 14-16 14"/><path d="M24 14v20"/><path d="M20 34c-2 4-6 6-10 6M28 34c2 4 6 6 10 6"/>',
  aim: [{ kind: 'line', range: 650, width: 110 }, { kind: 'point', range: 650, radius: 60 }, { kind: 'self', radius: 90 }, { kind: 'unit', range: 750, heroesOnly: true }],
  projectiles: {
    'wisp-moths': { shape: SHAPE.BEE, color: '#e6c4ff', color2: '#2a1034', size: 0.34, glow: 1.8, wobble: 0.35, sparkle: DUSK,
      trail: { color: '#d65cff', rate: 1.6, size: 0.08, life: 0.4 }, impact: 'smoke' },
  },
  melee: { wisp: { color: '#d65cff', edge: '#f7e6ff', arc: 1.9, radius: 1, width: 0.3, dur: 0.16, alternate: true, impact: 'smoke' } },
  sounds: {
    cast: (e, b, t, p, g, { tone, noise }) => { noise(e, b, { type: 'lowpass', f0: 1200, f1: 200, t, dur: 0.35, gain: 0.16 * g, q: 1, pan: p, attack: 0.02 }); tone(e, b, { type: 'sine', f0: 330, f1: 247, t, dur: 0.3, gain: 0.05 * g, pan: p }); },
    auto: (e, b, t, p, g, { noise }) => noise(e, b, { type: 'bandpass', f0: 2600, f1: 1200, t, dur: 0.07, gain: 0.1 * g, q: 2, pan: p }),
  },
  fx: {
    blink: {
      'wisp-swap': (api, c) => {
        api.trail(c, 'shadow');
        for (const [x, z] of [[c.x, c.z], [c.tx, c.tz]]) api.burst(x, z, 0.8, 16, 1.4, api.color(SMOKE), 0.8, 0.3, 0.5, { drag: 2, up: 0.4, intensity: 0.8 });
      },
    },
    events: {
      'wisp-mark': (api, c) => api.burst(c.x, c.z, 1.2, 8, 1, api.color(MOTH), 0.6, 0.1, 0.06, { up: 1, drag: 1.5 }),
      'wisp-shade': (api, c) => api.burst(c.x, c.z, 0.6, 14, 1.2, api.color(SMOKE), 0.9, 0.3, 0.5, { drag: 2, up: 0.3, intensity: 0.8 }),
      'wisp-veil': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.3, style: 'shadow', shape: DECAL.DISC, dur: 0.9, grow: 0.5 }); api.burst(c.x, c.z, 0.9, 24, 1.8, api.color(SMOKE), 0.9, 0.3, 0.6, { drag: 2, up: 0.6, intensity: 0.7 }); },
      'wisp-dive': (api, c) => { api.decal({ x: c.x, z: c.z, r: 1.6, style: 'shadow', shape: DECAL.DISC, dur: 0.8, grow: 0.5 }); api.burst(c.x, c.z, 1, 22, 3.5, api.color(DUSK), 0.35, 0.14, 0.02, { drag: 5, intensity: 2.4 }); api.shake(0.2); },
      'wisp-eclipse': (api, c) => { api.decal({ x: c.x, z: c.z, r: 2.2, style: 'shadow', shape: DECAL.RING, inner: 1.6, dur: 0.9, grow: 0.8 }); api.ring(c.x, c.z, 1, 30, 0.6, api.color(DUSK), 0.8, 0.16, 3); },
    },
    // her shade: a pool of dusk with moths circling, until she swaps or it fades
    decals(api, h) {
      const s = h.heroState, t = api.tick;
      if (s.shadeUntil > t) api.mark(s.shadeX * api.S, s.shadeY * api.S, 0.9, 'shadow', DECAL.DISC, Math.min(1, (s.shadeUntil - t) / 10), h.id + 3, 0, 0);
      if (h.untargetableUntil > t) api.mark(api.hx(h), api.hz(h), 1.1, 'shadow', DECAL.DISC, 0.9, h.id, 0, 0);
    },
    particles(api, h, rate) {
      const s = h.heroState;
      if (s.shadeUntil > api.tick && Math.random() < rate) { const a = api.now * 3 + Math.random() * 6.283; api.spawn(s.shadeX * api.S + Math.cos(a) * 0.5, 0.8 + Math.random() * 0.6, s.shadeY * api.S + Math.sin(a) * 0.5, -Math.sin(a) * 0.8, 0.2, Math.cos(a) * 0.8, 0.5, api.color(MOTH), 1.6, 0.08, 0.04); }
      if (h.untargetableUntil > api.tick && Math.random() < rate * 2) api.spawn(api.hx(h) + rnd(-0.4, 0.4), rnd(0.2, 1.6), api.hz(h) + rnd(-0.4, 0.4), 0, 0.5, 0, 0.6, api.color(SMOKE), 0.8, 0.3, 0.5);
    },
    world(api, world) {
      markCtx.api = api; markCtx.t = api.tick;
      for (const h of world.heroes) if (h.heroKey === 'wisp') h.heroState.marks.forEach(drawMark);
    },
  },
};
