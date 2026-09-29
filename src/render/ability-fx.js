// Hero ability styles: each hero has its own visual language so a glance tells who did what.
//   Morrow     brass clockwork: clock faces, ticking hands, tick-marked afterimages
//   Saffi      candle fire: molten wax wedges, scorch marks, flame rings
//   Vesper     ink: brush-edged washes and splatter
//   Gus        stone: radial cracks, dust rings, boulder tracks
//   Brindle    honey: glossy honeycomb
//   Auctioneer gold: filigree rings, coin dots, a gilded chain
// Ground decals are one instanced draw; the fragment shader draws the pattern for each style and
// shape (circle, ring, cone, line). Event and state driven; presentation only.
import * as THREE from 'three';
import { S } from './palette.js';
import { EV } from '../core/events.js';
import { KIND } from '../sim/constants.js';
import { rx, ry } from './interp.js';

export const STYLE = { CLOCK: 0, FLAME: 1, INK: 2, STONE: 3, HONEY: 4, GOLD: 5 };
const SHAPE = { DISC: 0, RING: 1, CONE: 2, LINE: 3 };
const HERO_STYLE = { morrow: STYLE.CLOCK, saffi: STYLE.FLAME, vesper: STYLE.INK, gus: STYLE.STONE, brindle: STYLE.HONEY, auctioneer: STYLE.GOLD };
const COLORS = { [STYLE.CLOCK]: '#f2c14e', [STYLE.FLAME]: '#ff8a3d', [STYLE.INK]: '#8b7bff', [STYLE.STONE]: '#cdb894', [STYLE.HONEY]: '#ffc233', [STYLE.GOLD]: '#ffd65a' };
const RGB = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, new THREE.Color(v)]));
const CAP = 96;
const rnd = (a, b) => a + Math.random() * (b - a);

export class AbilityFX {
  constructor(parent) {
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
    const A = () => new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iA = A(); this.iB = A(); this.iC = A(); this.iD = A();
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB); g.setAttribute('iC', this.iC); g.setAttribute('iD', this.iD); g.instanceCount = 0;
    this.uniforms = { uTime: { value: 0 } };
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.uniforms,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      // iA: x, z, half length (or radius), half width (or radius)   iB: angle, style, shape, cone half-angle
      // iC: rgb, alpha                                               iD: progress 0..1, seed, spin, inner radius (ring)
      vertexShader: `attribute vec4 iA, iB, iC, iD; varying vec2 vP; varying vec4 vB, vC, vD;
        void main(){ vP = position.xz; vB = iB; vC = iC; vD = iD;
          float c = cos(iB.x), s = sin(iB.x); vec2 q = vec2(position.x * iA.z, position.z * iA.w); q = vec2(q.x * c - q.y * s, q.x * s + q.y * c);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(iA.x + q.x, 0.05 + iD.y * 0.0004, iA.y + q.y, 1.); }`,
      fragmentShader: `uniform float uTime; varying vec2 vP; varying vec4 vB, vC, vD;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        float hex(vec2 p){ p *= vec2(1., 1.1547); vec2 a = mod(p, vec2(1., 1.732)) - vec2(.5, .866), b = mod(p + vec2(.5, .866), vec2(1., 1.732)) - vec2(.5, .866);
          vec2 g = dot(a, a) < dot(b, b) ? a : b; vec2 ag = abs(g); return max(ag.x * .866 + ag.y * .5, ag.y); }
        void main(){
          int style = int(vB.y + .5), shape = int(vB.z + .5); float prog = vD.x, seed = vD.y, spin = vD.z;
          vec2 p = vP; float r = length(p), ang = atan(p.y, p.x);
          // shape mask: m (inside), edge (distance to the outline, 0 at the edge)
          float m = 1., edge = 1. - r;
          if (shape == 0) { m = step(r, 1.); }
          else if (shape == 1) { m = step(r, 1.) * step(vD.w, r); edge = min(1. - r, r - vD.w); }
          else if (shape == 2) { float half_ = vB.w; m = step(r, 1.) * step(abs(ang), half_); edge = min(1. - r, (half_ - abs(ang)) * r); }
          else { m = step(abs(p.x), 1.) * step(abs(p.y), 1.); edge = min(1. - abs(p.x), 1. - abs(p.y)) ; r = abs(p.y); }
          if (m < .5) discard;
          vec3 col = vC.rgb; float a = 0.; vec3 c = vec3(0.);
          float rim = smoothstep(.08, 0., edge);
          if (style == 0) { // CLOCK: brass face, 12 ticks, sweeping hand, rim
            float ticks = step(.82, r) * step(r, .95) * step(.86, fract(ang * 12. / 6.2832 + .07)) ;
            float hand = smoothstep(.06, 0., abs(sin(ang - spin)) * r) * step(r, .8) * step(0., cos(ang - spin));
            float face = .12 + .08 * smoothstep(1., .3, r);
            c = col * (face + ticks * 1.2 + hand * 1.4 + rim * 1.2); a = (face + rim * .6 + ticks * .5) * .8;
            if (shape == 3) { float t = step(.9, fract(p.x * 6. + .5)); c = col * (.15 + t * 1.2 + rim); a = .25 + t * .5; }
          } else if (style == 1) { // FLAME: molten wax / fire with rising flicker and a hot core
            float n = noise(p * 4. + vec2(0., -uTime * 3.) + seed) * .6 + noise(p * 9. - uTime * 2.) * .4;
            float heat = smoothstep(.2, .9, n + (1. - r) * .35);
            c = mix(vec3(.9, .22, .04), vec3(1., .62, .2), heat) * (.35 + .55 * heat) + col * rim * .5; a = .3 + .45 * heat;
            if (shape == 2) { float drip = step(.8, noise(vec2(ang * 18., r * 3. - uTime * 1.5) + seed)); c += vec3(1., .7, .35) * drip * .35; a += drip * .2; }
          } else if (style == 2) { // INK: dark wash, brushy edge, splatter
            float n = noise(p * 5. + seed * 7.), brush = smoothstep(.0, .12 + .1 * n, edge);
            float splat = step(.93, noise(p * 13. + seed)) * step(.6, r);
            c = mix(vec3(.03, .015, .08), col * .8, smoothstep(.1, 0., edge)) + col * splat * .8; a = (.85 * brush + splat * .6) * (.7 + .3 * n);
          } else if (style == 3) { // STONE: radial cracks, dust ring
            float cracks = 0.; for (int i = 0; i < 7; i++) { float ca = seed * 6.2832 + float(i) * .897; float d = abs(sin(ang - ca)) * r; cracks += smoothstep(.03 + .02 * noise(vec2(r * 8., float(i))), 0., d) * step(0., cos(ang - ca)) * step(r, .95 * prog + .05); }
            float dust = smoothstep(.25, 0., abs(r - prog)) * (1. - prog);
            c = vec3(.18, .14, .1) * cracks + col * (dust * 1.1 + rim * .3); a = cracks * .75 + dust * .5 + .08;
          } else if (style == 4) { // HONEY: glossy honeycomb
            float h = hex(p * 3.2 + seed), cell = smoothstep(.42, .38, h), line = smoothstep(.36, .46, h) - smoothstep(.46, .5, h);
            float gloss = pow(max(0., sin(ang * 2. + uTime * .8 + r * 6.)), 8.) * .35;
            c = col * (cell * .35 + line * 1.1 + gloss + rim * .9); a = cell * .35 + line * .7 + rim * .5;
          } else { // GOLD: filigree ring with orbiting coins
            float fil = smoothstep(.04, 0., abs(sin(ang * 6. + spin) * .25 - (r - .8))) * step(.6, r);
            float coins = 0.; for (int i = 0; i < 6; i++) { float ca = spin * .5 + float(i) * 1.0472; coins += smoothstep(.1, .06, length(p - .88 * vec2(cos(ca), sin(ca)))); }
            float glow = smoothstep(1., .5, r) * .12;
            c = col * (fil * 1.3 + coins * 1.6 + rim * 1.1 + glow); a = fil * .6 + coins * .8 + rim * .5 + glow;
          }
          float alpha = vC.a; c *= alpha; a *= alpha;
          if (a < .01 && max(max(c.r, c.g), c.b) < .01) discard;
          gl_FragColor = vec4(c, clamp(a, 0., 1.)); }` }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; parent.add(this.mesh);
    this.active = []; this.n = 0; this.rollStamp = new Map();
  }
  /** Add a timed decal. o: { x, z (render units), r | len+width, style, shape, angle, half, dur, spin, spinRate, inner, grow } */
  add(o, now) { if (this.active.length < 64) this.active.push({ ...o, start: now, seed: Math.random() * 100 }); }
  put(x, z, hx, hz, angle, style, shape, half, alpha, prog, seed, spin, inner) {
    const i = this.n; if (i >= CAP) return; this.n++;
    const c = RGB[style];
    this.iA.setXYZW(i, x, z, hx, hz); this.iB.setXYZW(i, angle, style, shape, half);
    this.iC.setXYZW(i, c.r, c.g, c.b, alpha); this.iD.setXYZW(i, prog, seed, spin, inner);
  }
  // --------------------------------------------------------------- events -> decals and signature particles
  onEvent(e, world, now, r) {
    const ent = world.entities[e.a], x = e.x * S, z = e.y * S, fx = r.fx;
    if (e.type === EV.CAST && ent) {
      const st = HERO_STYLE[e.s]; if (st === undefined) return;
      const cx = rx(ent) * S, cz = ry(ent) * S;
      // every cast: a small signature under the caster in the hero's own style
      this.add({ x: cx, z: cz, r: 0.9, style: st, shape: SHAPE.RING, inner: 0.55, dur: 0.45, spinRate: 6, grow: 0.3 }, now);
      this.castFx(e.s, e.b, ent, cx, cz, x, z, now, r);
      return;
    }
    if (e.type === EV.BLINK) {
      const tx = ent ? ent.x * S : x, tz = ent ? ent.y * S : z, len = Math.hypot(tx - x, tz - z) / 2, ang = Math.atan2(tz - z, tx - x);
      const st = e.s.startsWith('morrow') ? STYLE.CLOCK : e.s.startsWith('saffi') ? STYLE.FLAME : null;
      if (st !== null && len > 0.05) this.add({ x: (x + tx) / 2, z: (z + tz) / 2, len, width: 0.28, angle: ang, style: st, shape: SHAPE.LINE, dur: 0.7 }, now);
      if (e.s === 'morrow-rewind') this.add({ x: tx, z: tz, r: 1.6, style: STYLE.CLOCK, shape: SHAPE.DISC, dur: 1, spinRate: -14 }, now);
      if (e.s === 'saffi-flicker') { this.add({ x, z, r: 0.7, style: STYLE.FLAME, shape: SHAPE.DISC, dur: 1.2 }, now); this.add({ x: tx, z: tz, r: 0.6, style: STYLE.FLAME, shape: SHAPE.DISC, dur: 0.8 }, now); }
      return;
    }
    if (e.type === EV.REWIND) { this.add({ x, z, r: 1.3, style: STYLE.CLOCK, shape: SHAPE.DISC, dur: 0.6, spinRate: -18 }, now); return; }
    if (e.type !== EV.FX) return;
    switch (e.s) {
      case 'saffi-wax': this.add({ x, z, r: 4.2, style: STYLE.FLAME, shape: SHAPE.CONE, angle: e.v, half: Math.PI / 5, dur: 0.7 }, now); break; // the exact hit area (420 units, +-36 deg)
      case 'saffi-snuff-exec': case 'saffi-mark-pop': this.add({ x, z, r: 1, style: STYLE.FLAME, shape: SHAPE.DISC, dur: 0.5, grow: 0.5 }, now); break;
      case 'gus-slam': this.add({ x, z, r: 2, style: STYLE.STONE, shape: SHAPE.DISC, dur: 1.4, grow: 1 }, now); break;
      case 'gus-rock-impact': this.add({ x, z, r: 1.7, style: STYLE.STONE, shape: SHAPE.DISC, dur: 1.2, grow: 1 }, now); break;
      case 'gus-avalanche': this.add({ x, z, r: 3.2, style: STYLE.STONE, shape: SHAPE.DISC, dur: 2.2, grow: 1 }, now); fx.ring(x, z, 0.3, 40, 0.8, RGB[STYLE.STONE], 0.8, 0.3, 6); break;
      case 'vesper-masterpiece': this.add({ x, z, r: 2.2, style: STYLE.INK, shape: SHAPE.RING, inner: 1.7, dur: 1 }, now); break;
      case 'vesper-fizzle': this.add({ x, z, r: 0.6, style: STYLE.INK, shape: SHAPE.DISC, dur: 0.5 }, now); break;
      case 'brindle-shield': this.add({ x, z, r: 1, style: STYLE.HONEY, shape: SHAPE.RING, inner: 0.7, dur: 0.6 }, now); break;
      case 'auctioneer-refund': for (let i = 0; i < fx.n(10); i++) fx.p.spawn(x, 1.2, z, rnd(-1.5, 1.5), rnd(3, 5), rnd(-1.5, 1.5), 0.9, 1, 0.84, 0.35, 2.2, 0.12, 0.08, 9, 0.2); break;
      case 'auctioneer-hook': { const o = ent ? { x: ent.x * S, z: ent.y * S } : { x, z }; const len = Math.hypot(o.x - x, o.z - z) / 2; if (len > 0.05) this.add({ x: (x + o.x) / 2, z: (z + o.z) / 2, len, width: 0.18, angle: Math.atan2(o.z - z, o.x - x), style: STYLE.GOLD, shape: SHAPE.LINE, dur: 0.5 }, now); break; }
      case 'auctioneer-repossess': case 'auctioneer-return': this.add({ x, z, r: 1.3, style: STYLE.GOLD, shape: SHAPE.RING, inner: 0.9, dur: 1.2, spinRate: 5 }, now); break;
    }
  }
  castFx(hero, slot, ent, cx, cz, tx, tz, now, r) {
    const fx = r.fx, col = RGB[HERO_STYLE[hero]];
    switch (hero) {
      case 'morrow':
        if (slot === 1) this.add({ x: cx, z: cz, r: 1.25, style: STYLE.CLOCK, shape: SHAPE.DISC, dur: 2, spinRate: 3, follow: ent.id }, now); // wind-up: a ticking face under him
        else if (slot === 0) for (let i = 0; i < fx.n(8); i++) fx.p.spawn(cx, 1, cz, rnd(-2, 2), rnd(1, 3), rnd(-2, 2), 0.4, col.r, col.g, col.b, 2.2, 0.06, 0.02, 8, 1);
        break;
      case 'saffi': if (slot === 3) fx.ring(cx, cz, 0.3, 40, 0.3, col, 0.8, 0.3, 4); break;
      case 'vesper': fx.burst(cx, cz, 1.1, 10, 1.4, col, 0.5, 0.14, 0.02, { drag: 3, gravity: 3 }); break;
      case 'gus': if (slot === 3) this.add({ x: tx, z: tz, r: 3, style: STYLE.STONE, shape: SHAPE.RING, inner: 2.7, dur: 0.9 }, now); break;
      case 'brindle': if (slot === 2) this.add({ x: tx, z: tz, r: 0.9, style: STYLE.HONEY, shape: SHAPE.RING, inner: 0.6, dur: 0.5, grow: 0.8 }, now); break;
      case 'auctioneer': for (let i = 0; i < fx.n(6); i++) fx.p.spawn(cx, 1.3, cz, rnd(-1, 1), rnd(2, 3.5), rnd(-1, 1), 0.7, col.r, col.g, col.b, 2, 0.1, 0.07, 9, 0.2); break;
    }
  }
  // --------------------------------------------------------------- per frame
  update(world, alpha, dt, now, r) {
    this.uniforms.uTime.value = now; this.n = 0;
    // timed decals
    let w = 0;
    for (const d of this.active) {
      const k = (now - d.start) / d.dur; if (k >= 1) continue; this.active[w++] = d;
      const fade = Math.min(1, k * 8) * Math.min(1, (1 - k) * 3), grow = d.grow ? 1 - d.grow + d.grow * Math.min(1, k * 3) : 1;
      let x = d.x, z = d.z; if (d.follow !== undefined) { const f = world.entities[d.follow]; if (f && !f.dead) { x = rx(f) * S; z = ry(f) * S; } }
      const spin = (d.spinRate || 0) * (now - d.start);
      if (d.shape === SHAPE.LINE) this.put(x, z, d.len, d.width, d.angle || 0, d.style, d.shape, 0, fade, k, d.seed, spin, 0);
      else this.put(x, z, d.r * grow, d.r * grow, d.angle || 0, d.style, d.shape, d.half || 0, fade, Math.min(1, k * 2.5), d.seed, spin, d.inner ? d.inner / d.r : 0);
    }
    this.active.length = w;
    // lasting states, drawn while they hold
    const t = world.tick;
    // Gus's boulder roll leaves cracked ground (stamp times kept here: sim records stay fixed-shape)
    for (const u of world.entities) if (u.alive && !u.dead && u.dashUntil > t && u.dashFx === 'pebble-roll') {
      const last = this.rollStamp.get(u.id) || 0; if (now - last < 0.09) continue;
      this.rollStamp.set(u.id, now); this.add({ x: rx(u) * S, z: ry(u) * S, r: 0.8, style: STYLE.STONE, shape: SHAPE.DISC, dur: 1.2, grow: 0.6 }, now);
    }
    for (const h of world.heroes) {
      if (h.dead) continue;
      const x = rx(h) * S, z = ry(h) * S, hs = h.heroState;
      if (h.heroKey === 'saffi' && hs.blazeUntil > t) this.put(x, z, 1.3, 1.3, 0, STYLE.FLAME, SHAPE.RING, 0, Math.min(1, (hs.blazeUntil - t) / 15), 1, h.id, 0, 0.72);
      if (h.heroKey === 'vesper' && hs.mpUntil > t) this.put(x, z, 1.4, 1.4, 0, STYLE.INK, SHAPE.RING, 0, Math.min(1, (hs.mpUntil - t) / 15), 1, h.id, 0, 0.8);
      if (h.ampUntil > t) this.put(x, z, 0.95, 0.95, 0, STYLE.GOLD, SHAPE.RING, 0, Math.min(1, (h.ampUntil - t) / 10), 1, h.id, now * 2, 0.62); // appraised: a gilded price ring
      if (h.markUntil > t) this.put(x, z, 0.8, 0.8, 0, STYLE.FLAME, SHAPE.RING, 0, 0.8, 1, h.id + 3, 0, 0.66); // Saffi's wax mark
      if (h.shield > 0 && h.shieldUntil > t) {
        const st = h.heroKey === 'morrow' && hs.windupShield ? STYLE.CLOCK : STYLE.HONEY; // Morrow shields himself, Brindle shields allies
        this.put(x, z, 0.85, 0.85, 0, st, SHAPE.RING, 0, 0.9, 1, h.id + 7, now * 3, 0.7);
      }
    }
    for (const zn of world.zones) if (zn.kind === 'brindle-honey') this.put(zn.x * S, zn.y * S, zn.r * S, zn.r * S, 0, STYLE.HONEY, SHAPE.DISC, 0, Math.min(1, (zn.until - t) / 10, (t - zn.born) / 5), 1, zn.id, 0, 0);
    for (const u of world.entities) if (u.alive && !u.dead && u.kind !== KIND.HERO && u.ampUntil > t) this.put(rx(u) * S, ry(u) * S, 0.8, 0.8, 0, STYLE.GOLD, SHAPE.RING, 0, 0.8, 1, u.id, now * 2, 0.62);
    this.mesh.geometry.instanceCount = this.n; this.mesh.visible = this.n > 0;
    if (this.n) this.iA.needsUpdate = this.iB.needsUpdate = this.iC.needsUpdate = this.iD.needsUpdate = true;
  }
}
