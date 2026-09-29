// Hero effects director: runs the presentation packs (src/presentation/heroes) against the render engines.
// The engines stay generic: ground decals (ability-fx.js), zone ribbons/discs/domes (zones.js) and particles
// (fx.js). Each calls a hook between its per-frame reset and its GPU upload; packs get one small api for all
// three. Events (casts, blinks, named effects) are dispatched to the pack that owns them.
import * as THREE from 'three';
import { S } from './palette.js';
import { EV } from '../core/events.js';
import { TICK_HZ } from '../sim/constants.js';
import { rx, ry } from './interp.js';
import { HERO_VIEWS } from '../presentation/heroes/index.js';
import { DECAL } from '../presentation/kit.js';
import { STYLE_ID } from './ability-fx.js';

const SHIELD = new THREE.Color('#dfe8ff');

export class HeroFx {
  constructor(r) {
    this.r = r; this.colors = new Map(); this.states = new Map();
    // named effect -> [pack, handler]; zone kind -> drawer (from every pack: a zone can outlive its caster)
    this.named = new Map(); this.zoneDrawers = new Map();
    for (const k in HERO_VIEWS) {
      const fx = HERO_VIEWS[k].fx || {};
      for (const n in fx.events || {}) if (n !== 'rewind') this.named.set(n, fx.events[n]);
      for (const z in fx.zones || {}) this.zoneDrawers.set(z, fx.zones[z]);
    }
    this.active = null; // packs of the heroes in this match (their world hooks run each frame)
    this.k = { age: 0, left: 0, fade: 0 }; // zone timing scratch, reused
    this.c = { slot: 0, ent: null, cx: 0, cz: 0, tx: 0, tz: 0, e: null, x: 0, z: 0 }; // event context, reused
    this.api = this.makeApi();
    r.zones.hook = (world, now) => this.zonePhase(world, now);
    r.abilities.hook = (world, now) => this.decalPhase(world, now);
    r.fx.hook = (world, rate, now) => this.particlePhase(world, rate, now);
  }
  makeApi() {
    const r = this.r, fx = r.fx, ab = r.abilities, zn = r.zones, self = this;
    return {
      S, tickHz: TICK_HZ, tick: 0, now: 0, world: null,
      hx: (u) => rx(u) * S, hz: (u) => ry(u) * S,
      color(hex) { let c = self.colors.get(hex); if (!c) { c = new THREE.Color(hex); self.colors.set(hex, c); } return c; },
      n: (count) => fx.n(count),
      /** Per-renderer scratch storage for a pack (e.g. stamp times keyed by entity id). */
      state(key) { let m = self.states.get(key); if (!m) { m = new Map(); self.states.set(key, m); } return m; },
      // particles (render units; col = api.color(...))
      spawn: (x, y, z, vx, vy, vz, life, col, intensity, s0, s1, gravity = 0, drag = 0) => fx.p.spawn(x, y, z, vx, vy, vz, life, col.r, col.g, col.b, intensity, s0, s1, gravity, drag),
      burst: (x, z, y, count, speed, col, life, s0, s1, o) => fx.burst(x, z, y, count, speed, col, life, s0, s1, o),
      ring: (x, z, y, count, radius, col, life, size, outward) => fx.ring(x, z, y, count, radius, col, life, size, outward),
      line: (x0, z0, x1, z1, y, count, col, life, size) => fx.line(x0, z0, x1, z1, y, count, col, life, size),
      shake: (a) => r.shake(a),
      // ground decals: timed (decal) and drawn-this-frame (mark); style = pack style name
      decal(o) { ab.add({ ...o, style: STYLE_ID[o.style] }, self.api.now); },
      mark: (x, z, rad, style, shape, alpha, seed, spin, inner) => ab.put(x, z, rad, rad, 0, STYLE_ID[style], shape, 0, alpha, 1, seed, spin, inner),
      /** A dash/blink leaves a line decal in the given style from (c.x, c.z) to (c.tx, c.tz). */
      trail(c, style) { const len = Math.hypot(c.tx - c.x, c.tz - c.z) / 2; if (len > 0.05) ab.add({ x: (c.x + c.tx) / 2, z: (c.z + c.tz) / 2, len, width: 0.28, angle: Math.atan2(c.tz - c.z, c.tx - c.x), style: STYLE_ID[style], shape: DECAL.LINE, dur: 0.7 }, self.api.now); },
      // zone layer (sim units): ribbons, discs, domes, telegraphs
      ribbon: (pts, kind, alpha, width, wall = false) => zn.pushRibbon(pts, kind, alpha, width, wall),
      disc: (x, y, rad, kind, prog, alpha, team, seed) => zn.disc(x, y, rad, kind, prog, alpha, team, seed),
      dome: (x, y, rad, age, fade) => zn.dome(x, y, rad, age, fade, self.api.now),
      telegraph: (x, y, rad, dur, team) => zn.telegraphs.push({ x, y, r: rad, start: self.api.now, dur, team }),
    };
  }
  pack(key) { return HERO_VIEWS[key] || null; }
  activePacks(world) {
    if (!this.active) { const s = new Set(); for (const h of world.heroes) if (HERO_VIEWS[h.heroKey]) s.add(HERO_VIEWS[h.heroKey]); this.active = [...s]; }
    return this.active;
  }
  sync(world, now) { const a = this.api; a.world = world; a.tick = world.tick; a.now = now; }
  // ------------------------------------------------------------------ events
  onEvent(e, world, now) {
    this.sync(world, now);
    const ent = world.entities[e.a], c = this.c, api = this.api;
    c.e = e; c.ent = ent; c.x = e.x * S; c.z = e.y * S;
    if (e.type === EV.CAST) {
      const p = this.pack(e.s); if (!p || !ent) return;
      c.slot = e.b; c.cx = rx(ent) * S; c.cz = ry(ent) * S; c.tx = c.x; c.tz = c.z;
      // every cast: a small signature under the caster in the hero's own style
      api.decal({ x: c.cx, z: c.cz, r: 0.9, style: p.style, shape: DECAL.RING, inner: 0.55, dur: 0.45, spinRate: 6, grow: 0.3 });
      if (p.fx && p.fx.cast) p.fx.cast(api, c);
    } else if (e.type === EV.BLINK) {
      c.tx = ent ? ent.x * S : c.x; c.tz = ent ? ent.y * S : c.z;
      const p = ent ? this.pack(ent.heroKey) : null, col = e.s === 'dash' || !p ? SHIELD : api.color(p.color);
      api.line(c.x, c.z, c.tx, c.tz, 0.5, 26, col, 0.6, 0.18);
      api.burst(c.x, c.z, 0.6, 12, 2, col, 0.5, 0.2, 0.02, { drag: 4 }); api.burst(c.tx, c.tz, 0.6, 12, 2, col, 0.5, 0.2, 0.02, { drag: 4 });
      const f = p && p.fx && p.fx.blink && p.fx.blink[e.s]; if (f) f(api, c);
    } else if (e.type === EV.REWIND) {
      const p = ent ? this.pack(ent.heroKey) : null, f = p && p.fx && p.fx.events && p.fx.events.rewind; if (f) f(api, c);
    } else if (e.type === EV.FX) {
      const f = this.named.get(e.s); if (f) f(api, c);
    }
  }
  update() {} // work happens in the engine hooks below
  // ------------------------------------------------------------------ per-frame phases
  zonePhase(world, now) {
    this.sync(world, now);
    const api = this.api, t = world.tick, k = this.k;
    for (const h of world.heroes) { if (h.dead) continue; const p = HERO_VIEWS[h.heroKey]; if (p && p.fx && p.fx.ground) p.fx.ground(api, h); }
    for (const z of world.zones) {
      const d = this.zoneDrawers.get(z.kind); if (!d || !d.draw) continue;
      k.age = (t - z.born) / TICK_HZ; k.left = (z.until - t) / TICK_HZ; k.fade = Math.min(1, k.age * 8) * Math.min(1, k.left * 4);
      d.draw(api, z, k);
    }
  }
  decalPhase(world, now) {
    this.sync(world, now);
    const api = this.api, t = world.tick;
    for (const h of world.heroes) {
      if (h.dead) continue;
      const p = HERO_VIEWS[h.heroKey];
      if (p && p.fx && p.fx.decals) p.fx.decals(api, h);
      if (h.shield > 0 && h.shieldUntil > t) { // shield ring: the hero's own style when its pack says so, honey otherwise
        const st = (p && p.shieldStyle && p.shieldStyle(h)) || 'honey';
        api.mark(rx(h) * S, ry(h) * S, 0.85, st, DECAL.RING, 0.9, h.id + 7, now * 3, 0.7);
      }
    }
    const packs = this.activePacks(world);
    for (let i = 0; i < packs.length; i++) { const f = packs[i].fx && packs[i].fx.world; if (f) f(api, world); }
    for (const z of world.zones) { const d = this.zoneDrawers.get(z.kind); if (d && d.decal) d.decal(api, z, this.k); }
  }
  particlePhase(world, rate, now) {
    this.sync(world, now);
    const api = this.api;
    for (const h of world.heroes) { if (h.dead) continue; const p = HERO_VIEWS[h.heroKey]; if (p && p.fx && p.fx.particles) p.fx.particles(api, h, rate); }
    for (const z of world.zones) { const d = this.zoneDrawers.get(z.kind); if (d && d.particles) d.particles(api, z, rate); }
  }
}
