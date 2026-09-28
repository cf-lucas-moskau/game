// Turns sim events into visual feedback. Presentation only: randomness here is Math.random on purpose
// (never the sim RNG), so effects can vary without touching determinism.
import * as THREE from 'three';
import { Particles } from './particles.js';
import { S, PALETTE, TEAM_RGB } from './palette.js';
import { EV } from '../core/events.js';
import { KIND } from '../sim/constants.js';
import { HERO_LOOKS } from '../assets/manifest.js';
import { rx, ry } from './interp.js';

const C = (hex) => new THREE.Color(hex);
const COL = {
  phys: C('#ffe2b0'), magic: C('#b9a8ff'), true: C('#ffffff'), heal: C('#7ee07a'), shield: C('#dfe8ff'), gold: C(PALETTE.gold),
  ink: C('#6f5cff'), fire: C('#ff8a3d'), ember: C('#ffd27a'), honey: C('#ffc233'), stone: C('#bfae93'), dust: C('#d7c9b0'),
  stun: C('#fff3a0'), root: C('#8b7bff'), clock: C('#f2c14e'), coral: C(PALETTE.coral), tide: C(PALETTE.tide), smoke: C('#9aa0b8'),
};
const ACCENT = Object.fromEntries(Object.entries(HERO_LOOKS).map(([k, v]) => [k, C(v.accent)]));
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(parent, quality) {
    this.p = new Particles(parent, Math.round(3000 * (quality.particles ?? 1)));
    this.density = quality.particles ?? 1;
    this.flash = new Map(); // hero id -> flash amount
  }
  n(count) { return Math.max(1, Math.round(count * this.density)); }
  burst(x, z, y, count, speed, col, life, s0, s1, { up = 0, gravity = 0, drag = 2, spread = 1, intensity = 1.6 } = {}) {
    for (let i = 0, n = this.n(count); i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = rnd(-0.2, 1) * spread, v = speed * rnd(0.4, 1);
      this.p.spawn(x, y, z, Math.cos(a) * v * Math.cos(e), up + Math.sin(e) * v * 0.6, Math.sin(a) * v * Math.cos(e), life * rnd(0.7, 1.2), col.r, col.g, col.b, intensity, s0, s1, gravity, drag);
    }
  }
  ring(x, z, y, count, radius, col, life, size, outward = 1.5) {
    for (let i = 0, n = this.n(count); i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.p.spawn(x + Math.cos(a) * radius, y, z + Math.sin(a) * radius, Math.cos(a) * outward, 0.2, Math.sin(a) * outward, life, col.r, col.g, col.b, 1.6, size, size * 0.3, 0, 1.5);
    }
  }
  line(x0, z0, x1, z1, y, count, col, life, size) {
    for (let i = 0, n = this.n(count); i < n; i++) { const t = Math.random(); this.p.spawn(x0 + (x1 - x0) * t, y + rnd(-0.1, 0.3), z0 + (z1 - z0) * t, rnd(-0.3, 0.3), rnd(0.2, 0.8), rnd(-0.3, 0.3), life * rnd(0.6, 1.2), col.r, col.g, col.b, 1.5, size, size * 0.2, 0, 1); }
  }
  onEvent(e, world, now, r) {
    const x = e.x * S, z = e.y * S, ent = world.entities[e.a];
    switch (e.type) {
      case EV.DAMAGE: {
        if (!ent) break;
        const col = e.s === 'm' ? COL.magic : e.s === 't' ? COL.true : COL.phys;
        const big = e.v > 150, h = ent.kind === KIND.HERO ? 0.9 : ent.kind === KIND.TOWER ? 2.2 : 0.6;
        this.burst(x, z, h, big ? 10 : 4, big ? 4 : 2.5, col, 0.35, 0.16, 0.02, { drag: 5, up: 0.8 });
        if (ent.kind === KIND.HERO) this.flash.set(ent.id, Math.min(1, (this.flash.get(ent.id) || 0) + (big ? 1 : 0.5)));
        if (ent.id === r.focusId && e.v > ent.maxHp * 0.08) r.shake(0.25);
        break;
      }
      case EV.HEAL: if (e.v > 15) this.burst(x, z, 0.3, 6, 0.6, COL.heal, 0.9, 0.14, 0.04, { up: 1.6, drag: 1, spread: 0.3 }); break;
      case EV.SHIELD: this.ring(x, z, 0.8, 14, 0.55, COL.shield, 0.5, 0.1, 0.4); break;
      case EV.DEATH: {
        const hero = e.v === 1;
        this.burst(x, z, 0.5, hero ? 40 : 14, hero ? 3.5 : 2, hero ? COL.smoke : COL.dust, hero ? 1.2 : 0.7, hero ? 0.4 : 0.25, 0.05, { up: 1, drag: 2.5, intensity: 0.9 });
        if (hero) { const tc = TEAM_RGB[ent ? ent.team : 0]; this.ring(x, z, 0.1, 28, 0.3, tc, 0.8, 0.2, 4); }
        break;
      }
      case EV.CAST: {
        const col = ACCENT[e.s] || COL.shield;
        this.ring(rx(ent) * S, ry(ent) * S, 0.2, 12, 0.5, col, 0.4, 0.14, 2.2);
        if (e.s === 'morrow' && e.b === 0) this.burst(x, z, 0.8, 4, 1, COL.clock, 0.4, 0.12, 0.02);
        break;
      }
      case EV.BLINK: {
        const tx = ent ? ent.x * S : x, tz = ent ? ent.y * S : z;
        const col = e.s === 'saffi-flicker' ? COL.fire : e.s.startsWith('morrow') ? COL.clock : e.s === 'dash' ? COL.shield : COL.ink;
        this.line(x, z, tx, tz, 0.5, 26, col, 0.6, 0.18);
        this.burst(x, z, 0.6, 12, 2, col, 0.5, 0.2, 0.02, { drag: 4 });
        this.burst(tx, tz, 0.6, 12, 2, col, 0.5, 0.2, 0.02, { drag: 4 });
        if (e.s === 'morrow-rewind') { this.ring(tx, tz, 0.2, 36, 0.9, COL.clock, 0.9, 0.18, -1.2); r.shake(0.2); }
        break;
      }
      case EV.PROJECTILE_HIT: {
        const col = e.s === 'auctioneer-gavel' ? COL.gold : e.s === 'morrow-cog' ? COL.clock : e.s === 'brindle-sting' ? COL.honey : COL.shield;
        this.burst(x, z, 0.8, 8, 3, col, 0.35, 0.18, 0.02, { drag: 5 });
        break;
      }
      case EV.STUN: if (ent && e.b === 1) this.ring(ent.x * S, ent.y * S, 0.1, 14, 0.5, COL.root, 0.6, 0.14, -0.5); break;
      case EV.LEVEL_UP: if (ent) { this.burst(ent.x * S, ent.y * S, 0.1, 24, 0.5, COL.gold, 1.1, 0.16, 0.04, { up: 3.2, drag: 1.5, spread: 0.2 }); } break;
      case EV.STRUCTURE_DOWN: this.burst(x, z, 2, 70, 6, COL.stone, 1.4, 0.45, 0.1, { up: 3, gravity: 9, drag: 1, intensity: 0.9 }); this.burst(x, z, 1, 40, 3, COL.smoke, 2.2, 0.8, 1.6, { up: 1, drag: 1.2, intensity: 0.5 }); r.shake(0.9); break;
      case EV.WHALE_ROLL: r.shake(0.6); break;
      case EV.RELIC: if (e.a > 0 || e.v === 0) this.burst(x, z, 0.4, 20, 1.2, COL.heal, 0.9, 0.2, 0.04, { up: 2 }); break;
      case EV.REWIND: this.ring(x, z, 0.8, 24, 0.7, COL.clock, 0.5, 0.14, -0.8); break;
      case EV.FX: this.named(e, world, x, z, ent, r); break;
    }
  }
  named(e, world, x, z, ent, r) {
    switch (e.s) {
      case 'gus-slam': this.burst(x, z, 0.1, 40, 4.5, COL.stone, 0.8, 0.3, 0.06, { up: 2, gravity: 8, drag: 1.5, intensity: 0.9 }); this.ring(x, z, 0.1, 30, 0.4, COL.dust, 0.5, 0.25, 5); r.shake(0.4); break;
      case 'gus-rock-impact': this.burst(x, z, 0.2, 30, 3.5, COL.stone, 0.7, 0.26, 0.05, { up: 2, gravity: 8, intensity: 0.9 }); break;
      case 'gus-avalanche': this.burst(x, z, 0.2, 80, 6, COL.stone, 1, 0.4, 0.08, { up: 3, gravity: 9, drag: 1.2, intensity: 0.9 }); this.ring(x, z, 0.1, 48, 0.6, COL.dust, 0.7, 0.35, 7); r.shake(1); break;
      case 'pebble-crumble': this.burst(x, z, 0.8, 40, 3, COL.stone, 1, 0.35, 0.05, { gravity: 9, up: 1.5, intensity: 0.8 }); break;
      case 'gus-dismount': case 'gus-mount': case 'gus-rebuild': this.ring(x, z, 0.1, 16, 0.6, COL.dust, 0.4, 0.2, 2); break;
      case 'saffi-wax': { const a = e.v; for (let i = 0, n = this.n(30); i < n; i++) { const t = a + rnd(-0.6, 0.6), v = rnd(2, 5); this.p.spawn(x, 0.8, z, Math.cos(t) * v, 0.5, Math.sin(t) * v, 0.5, COL.ember.r, COL.ember.g, COL.ember.b, 1.8, 0.18, 0.04, 3, 2.5); } break; }
      case 'saffi-mark-pop': case 'saffi-snuff-exec': this.burst(x, z, 0.9, 24, 3.5, COL.fire, 0.5, 0.25, 0.03, { drag: 4, intensity: 2.2 }); break;
      case 'saffi-blaze': this.ring(x, z, 0.3, 40, 0.4, COL.fire, 0.8, 0.3, 4); r.shake(0.3); break;
      case 'saffi-splash': this.burst(x, z, 0.6, 16, 3, COL.fire, 0.45, 0.24, 0.03, { drag: 4, intensity: 2 }); break;
      case 'vesper-lash': break; // drawn as a zone ribbon
      case 'vesper-fizzle': this.burst(x, z, 0.3, 10, 1, COL.ink, 0.5, 0.16, 0.02); break;
      case 'vesper-masterpiece': this.ring(x, z, 0.5, 48, 0.5, COL.ink, 1, 0.25, 3); break;
      case 'brindle-shield': this.ring(x, z, 0.9, 20, 0.6, COL.honey, 0.7, 0.14, 0.6); break;
      case 'brindle-dome': this.ring(x, z, 0.2, 40, 3.2, COL.honey, 0.9, 0.3, 0.5); break;
      case 'auctioneer-refund': this.burst(x, z, 1, 10, 1.4, COL.gold, 0.8, 0.14, 0.05, { up: 2.4, gravity: 5 }); break;
      case 'auctioneer-appraise': this.ring(x, z, 1.6, 16, 0.4, COL.gold, 0.6, 0.12, 0); break;
      case 'auctioneer-hook': this.line(ent ? ent.x * S : x, ent ? ent.y * S : z, x, z, 0.8, 30, COL.gold, 0.4, 0.14); break;
      case 'auctioneer-repossess': case 'auctioneer-return': this.burst(x, z, 1.2, 30, 2.5, COL.gold, 0.9, 0.18, 0.04, { up: 1.5, gravity: 4 }); break;
      case 'borrowed-seconds': this.ring(x, z, 1, 30, 0.7, COL.clock, 2, 0.16, 0); break;
      case 'molted-shell': this.ring(x, z, 0.8, 24, 0.6, COL.stone, 0.8, 0.2, 1); break;
      case 'harpoon': case 'lens-pop': this.burst(x, z, 0.8, 10, 2, e.s === 'harpoon' ? COL.shield : COL.ink, 0.4, 0.14, 0.02); break;
      case 'horn': this.ring(x, z, 0.3, 50, 0.5, COL.tide, 1, 0.22, 6); break;
      case 'heal-spell': this.burst(x, z, 0.2, 30, 1.2, COL.heal, 1, 0.2, 0.04, { up: 2.5, spread: 0.3 }); break;
      case 'morrow-spring': this.burst(x, z, 0.4, 16, 2.4, COL.clock, 0.4, 0.14, 0.02); break;
      case 'sudden-death': r.shake(0.5); break;
    }
  }
  /** Continuous effects each frame. */
  update(world, alpha, dt, now, r) {
    const t = world.tick, rate = dt * 60 * this.density;
    for (const h of world.heroes) {
      if (h.dead) continue;
      const x = rx(h) * S, z = ry(h) * S;
      if (h.stunUntil > t || h.airborneUntil > t) for (let k = 0; k < 3; k++) { const a = now * 6 + k * 2.1; this.p.spawn(x + Math.cos(a) * 0.35, 1.9, z + Math.sin(a) * 0.35, 0, 0, 0, 0.12, COL.stun.r, COL.stun.g, COL.stun.b, 2, 0.14, 0.1); }
      if (h.heroKey === 'saffi') {
        const blaze = h.heroState.blazeUntil > t;
        if (Math.random() < rate * (blaze ? 1 : 0.35)) this.p.spawn(x + rnd(-0.1, 0.1), 1.9 + (blaze ? rnd(-1.4, 0) : 0), z + rnd(-0.1, 0.1), rnd(-0.2, 0.2), rnd(0.8, 1.6), rnd(-0.2, 0.2), 0.5, COL.fire.r, COL.fire.g, COL.fire.b, 2, blaze ? 0.24 : 0.12, 0.02);
      }
      if (h.dashUntil > t && Math.random() < rate) this.p.spawn(x, 0.4, z, 0, 0.3, 0, 0.35, COL.dust.r, COL.dust.g, COL.dust.b, 0.8, 0.3, 0.05);
      const f = this.flash.get(h.id); if (f) this.flash.set(h.id, Math.max(0, f - dt * 5));
    }
    for (const z of world.zones) {
      if (z.kind === 'saffi-trail' && Math.random() < rate * 0.9) { const k = Math.random(); this.p.spawn((z.x + (z.x2 - z.x) * k) * S, 0.1, (z.y + (z.y2 - z.y) * k) * S, rnd(-0.2, 0.2), rnd(0.6, 1.4), rnd(-0.2, 0.2), 0.55, COL.fire.r, COL.fire.g, COL.fire.b, 1.3, 0.16, 0.03); }
      else if (z.kind === 'brindle-sting-dot') { const u = world.entities[z.data.target]; if (u && u.alive && !u.dead && Math.random() < rate * 0.5) { const a = now * 9 + Math.random(); this.p.spawn(rx(u) * S + Math.cos(a) * 0.3, 1 + rnd(0, 0.5), ry(u) * S + Math.sin(a) * 0.3, 0, 0, 0, 0.3, COL.honey.r, COL.honey.g, COL.honey.b, 1.6, 0.1, 0.05); } }
    }
    for (const p of world.projectiles) {
      if (!p.alive || !(p.kind === 'morrow-cog' || p.kind === 'auctioneer-gavel' || p.kind === 'tower-bolt' || p.kind === 'brindle-sting')) continue;
      if (Math.random() < rate * 0.8) { const col = p.kind === 'brindle-sting' ? COL.honey : p.kind === 'tower-bolt' ? COL.ember : COL.gold; this.p.spawn((p.px + (p.x - p.px) * alpha) * S, p.kind === 'tower-bolt' ? 2.4 : 0.85, (p.py + (p.y - p.py) * alpha) * S, 0, 0, 0, 0.3, col.r, col.g, col.b, 1.4, 0.16, 0.02); }
    }
    this.p.update(dt);
  }
}
