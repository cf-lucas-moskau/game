// Ground decals in each hero's visual language (DECAL_STYLES in presentation/kit.js): one instanced draw;
// the fragment shader draws the pattern for each style and shape (disc, ring, cone, line).
// Generic engine: what to draw comes from the hero presentation packs through render/hero-fx.js, which
// adds timed decals (add) and puts this frame's lasting states (put) from the hook between reset and upload.
import * as THREE from 'three';
import { DECAL_STYLES, DECAL as SHAPE } from '../presentation/kit.js';
import { S } from './palette.js';
import { rx, ry } from './interp.js';

/** Decal style name -> shader style index. */
export const STYLE_ID = Object.fromEntries(DECAL_STYLES.map((n, i) => [n, i]));
const COLORS = { clock: '#f2c14e', flame: '#ff8a3d', ink: '#8b7bff', stone: '#cdb894', honey: '#ffc233', gold: '#ffd65a',
  storm: '#a8f0ff', coral: '#ff9e8a', sight: '#d4ff5a', wind: '#bff5e6', frost: '#9ec9ff', vine: '#6fd66a', sound: '#ff9ee6', star: '#ffe9b0', iron: '#b7c3cf', shadow: '#d65cff' };
const RGB = DECAL_STYLES.map((n) => new THREE.Color(COLORS[n]));
const CAP = 96;

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
          } else if (style == 5) { // GOLD: filigree ring with orbiting coins
            float fil = smoothstep(.04, 0., abs(sin(ang * 6. + spin) * .25 - (r - .8))) * step(.6, r);
            float coins = 0.; for (int i = 0; i < 6; i++) { float ca = spin * .5 + float(i) * 1.0472; coins += smoothstep(.1, .06, length(p - .88 * vec2(cos(ca), sin(ca)))); }
            float glow = smoothstep(1., .5, r) * .12;
            c = col * (fil * 1.3 + coins * 1.6 + rim * 1.1 + glow); a = fil * .6 + coins * .8 + rim * .5 + glow;
          } else if (style == 6) { // STORM: jagged bolts forking out from the centre, flickering; dark cloud wash
            float bolt = 0.;
            for (int i = 0; i < 5; i++) { float ca = seed * 6.2832 + float(i) * 1.2566 + (noise(vec2(r * 7., float(i) + seed)) - .5) * .9; bolt += smoothstep(.04, 0., abs(sin(ang - ca)) * r) * step(0., cos(ang - ca)) * step(r, prog * .9 + .1); }
            if (shape == 3) bolt = smoothstep(.12, 0., abs(p.y - (noise(vec2(p.x * 6., seed)) - .5) * .9));
            float flick = .55 + .45 * step(.35, fract(uTime * 9. + seed * 3.)), wash = .12 * (1. - r);
            c = col * (wash * .5 + rim * 1.1) + vec3(.92, .97, 1.) * bolt * 1.7 * flick; a = wash * .5 + min(1., bolt) * .9 * flick + rim * .5;
          } else if (style == 7) { // CORAL: caustic ripples over teal water, coral polyps near the rim
            float n = noise(p * 6. + uTime * .6 + seed), caust = smoothstep(.6, .85, abs(sin((n + r * 2.) * 6.)));
            vec2 g = floor(p * 9.); float dot_ = step(.72, hash(g + seed)) * smoothstep(.45, .2, length(fract(p * 9.) - .5)) * step(.5, r);
            c = mix(vec3(.08, .4, .5), col, .45) * (.25 + caust * .7) + col * dot_ * 1.3 + col * rim; a = .2 + caust * .3 + dot_ * .6 + rim * .5;
          } else if (style == 8) { // SIGHT: a turning reticle with cross ticks and a centre dot; dashed tracers on lines
            float cs = cos(spin), sn = sin(spin); vec2 q = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
            float ticks = step(abs(q.x), .035) * step(.35, abs(q.y)) * step(abs(q.y), .75) + step(abs(q.y), .035) * step(.35, abs(q.x)) * step(abs(q.x), .75);
            float ring = smoothstep(.04, 0., abs(r - .86)), inner = smoothstep(.09, .05, r);
            c = col * (ring * 1.4 + ticks * 1.3 + inner * 1.6 + rim * .8 + .05); a = ring * .8 + ticks * .8 + inner * .8 + rim * .4 + .05;
            if (shape == 3) { float dash_ = step(.45, fract(p.x * 7. - uTime * 5.)) * smoothstep(.6, 0., r); c = col * (dash_ * 1.4 + rim * .6); a = dash_ * .8 + rim * .3; }
          } else if (style == 9) { // WIND: spiral streaks sweeping around (along the line on corridors)
            float sw = shape == 3 ? sin(p.x * 12. - uTime * 10. + p.y * 3. + seed) : sin(ang * 3. + r * 10. - uTime * 6. + seed);
            float streak = smoothstep(.7, 1., sw) * (1. - r * .3);
            c = col * (streak * 1.1 + rim * .7 + .08); a = streak * .55 + rim * .35 + .06;
          } else if (style == 10) { // FROST: crystal facets, six snowflake arms, a frosted rim
            float h = hex(p * 4. + seed), facet = smoothstep(.42, .5, h);
            float flake = smoothstep(.045, 0., abs(sin(ang * 3. + spin * .2)) * r) * step(r, .9) + smoothstep(.03, 0., abs(sin(ang * 3. + 1.5708 + spin * .2)) * r) * step(r, .45);
            vec3 ice = mix(vec3(.78, .92, 1.), col, .4);
            c = ice * (.16 + facet * .45 + flake * 1.2 + rim * 1.1); a = .2 + facet * .28 + flake * .6 + rim * .6;
          } else if (style == 11) { // VINE: curling tendrils that grow outward, thorns, a leafy wash
            float vine = 0.;
            for (int i = 0; i < 4; i++) { float ca = seed * 6.2832 + float(i) * 1.5708 + sin(r * 9. + float(i)) * .35; vine += smoothstep(.045, 0., abs(sin(ang - ca)) * r) * step(0., cos(ang - ca)) * step(r, prog * .95 + .05); }
            if (shape == 3) vine = smoothstep(.16, 0., abs(p.y - sin(p.x * 8. + seed) * .4));
            float thorn = step(.88, fract(r * 14. + seed)) * min(1., vine * 3.), wash = noise(p * 5. + seed) * .25;
            c = col * (min(1., vine) * 1.2 + thorn * .8 + rim * .7) + vec3(.12, .3, .08) * wash * 2.; a = min(1., vine) * .8 + wash * .5 + rim * .4 + thorn * .3;
          } else if (style == 12) { // SOUND: rings of sound rolling outward
            float q = fract((shape == 3 ? abs(p.x) : r) * 3.5 - uTime * 1.4 + seed), ring = smoothstep(.2, .0, abs(q - .5));
            c = col * (ring * 1.2 * (1. - r * .5) + rim * .9 + .06); a = ring * .6 * (1. - r * .4) + rim * .5 + .05;
          } else if (style == 13) { // STAR: a five-point star, constellation points on the rim, twinkles
            float k = cos(ang * 5. + spin) * .5 + .5, sr = mix(.24, .56, k) * .9;
            float outline = smoothstep(.035, 0., abs(r - sr)), inside = step(r, sr) * .22, dots = 0.;
            for (int i = 0; i < 5; i++) { float ca = float(i) * 1.2566 + spin * .3; dots += smoothstep(.07, .03, length(p - .86 * vec2(cos(ca), sin(ca)))); }
            float tw = step(.975, hash(floor(p * 18.) + floor(uTime * 4.)));
            c = col * (outline * 1.4 + inside + dots * 1.6 + tw * 1.5 + rim * .8); a = outline * .7 + inside * .6 + dots * .8 + tw * .6 + rim * .4 + .05;
          } else if (style == 14) { // IRON: a riveted steel band with a chain along it
            float band = step(.62, r) * step(r, .95), rv = 0.;
            for (int i = 0; i < 10; i++) { float ca = float(i) * .6283 + seed; rv += smoothstep(.06, .03, length(p - .78 * vec2(cos(ca), sin(ca)))); }
            float link = smoothstep(.05, 0., abs(abs(fract(ang * 2.546 + spin) - .5) - .25)) * smoothstep(.1, 0., abs(r - .78));
            if (shape == 3) { band = step(r, .7); link = smoothstep(.08, 0., abs(length(vec2(fract(p.x * 5.) - .5, p.y * 1.4)) - .3)); rv = 0.; }
            c = vec3(.22, .24, .28) * band * .9 + col * (rv * 1.4 + link * 1.2 + rim * 1.1); a = band * .45 + rv * .7 + link * .6 + rim * .5;
          } else { // SHADOW: drifting smoke, black at the heart, a violet glow at the edge
            float n = noise(p * 4. + vec2(uTime * .5, -uTime * .3) + seed) * .6 + noise(p * 9. - uTime) * .4;
            float smoke = smoothstep(.35, .8, n + (1. - r) * .35);
            c = mix(vec3(.02, 0., .05), col * .7, smoothstep(.18, 0., edge)) * (.6 + smoke * .5); a = smoke * .75 + rim * .45;
          }
          float alpha = vC.a; c *= alpha; a *= alpha;
          if (a < .01 && max(max(c.r, c.g), c.b) < .01) discard;
          gl_FragColor = vec4(c, clamp(a, 0., 1.)); }` }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; parent.add(this.mesh);
    this.active = []; this.n = 0; this.hook = null;
  }
  /** Add a timed decal. o: { x, z (render units), r | len+width, style, shape, angle, half, dur, spin, spinRate, inner, grow } */
  add(o, now) { if (this.active.length < 64) this.active.push({ ...o, start: now, seed: Math.random() * 100 }); }
  put(x, z, hx, hz, angle, style, shape, half, alpha, prog, seed, spin, inner) {
    const i = this.n; if (i >= CAP) return; this.n++;
    const c = RGB[style];
    this.iA.setXYZW(i, x, z, hx, hz); this.iB.setXYZW(i, angle, style, shape, half);
    this.iC.setXYZW(i, c.r, c.g, c.b, alpha); this.iD.setXYZW(i, prog, seed, spin, inner);
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
    // lasting states (packs, via hero-fx.js)
    if (this.hook) this.hook(world, now);
    this.mesh.geometry.instanceCount = this.n; this.mesh.visible = this.n > 0;
    if (this.n) this.iA.needsUpdate = this.iB.needsUpdate = this.iC.needsUpdate = this.iD.needsUpdate = true;
  }
}
