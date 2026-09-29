// Instanced overlays: health bars (1 draw), ground shadows + team rings (1 draw), projectiles (1 draw).
import * as THREE from 'three';
import { PROJECTILE_STYLES, DEFAULT_PROJECTILE } from './attack-styles.js';
import { S, TEAM_COLORS, TEAM_RGB, SELF_RGB } from './palette.js';
import { KIND, isStructure } from '../sim/constants.js';
import { rx, ry } from './interp.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class HealthBars {
  constructor(parent, cap = 160) {
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.iData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // hp, shield, width, maxHp
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);  // rgb, isHero
    g.setAttribute('iPos', this.iPos); g.setAttribute('iData', this.iData); g.setAttribute('iCol', this.iCol);
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uRes: { value: new THREE.Vector2(1280, 720) } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iData; attribute vec4 iCol; varying vec2 vUv; varying vec4 vData; varying vec4 vCol; varying vec2 vPx; uniform vec2 uRes;
        void main(){ vUv = uv; vData = iData; vCol = iCol; vec4 c = projectionMatrix*viewMatrix*vec4(iPos,1.);
          // bar size in device pixels, proportional to screen height with a legible minimum
          float k = max(uRes.y / 900., 0.75);
          vec2 px = iCol.w > 0.5 ? vec2(92., 11.) : vec2(iData.z * 64., 6.); px *= k; vPx = px;
          c.xy += position.xy * px / uRes * 2. * c.w; gl_Position = c; if (c.w <= 0.) gl_Position = vec4(3., 3., 3., 1.); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vData; varying vec4 vCol; varying vec2 vPx;
        void main(){ vec2 px = 1. / vPx;
          vec3 c = vec3(0.06,0.06,0.12);
          float hp = vData.x, sh = vData.y;
          if (vUv.x < hp) c = vCol.rgb * (0.85 + 0.35*vUv.y);
          else if (vUv.x < min(1., hp + sh)) c = vec3(.92,.94,1.);
          if (vCol.w > 0.5 && vData.w > 0.) { float seg = fract(vUv.x * vData.w / 250.); if (seg < 0.04*vData.w/400. && vUv.y > 0.4) c *= 0.4; }
          float edge = step(vUv.x, px.x*1.5) + step(1.-px.x*1.5, vUv.x) + step(vUv.y, px.y*1.5) + step(1.-px.y*1.5, vUv.y);
          c = mix(c, vec3(0.02), clamp(edge,0.,1.));
          gl_FragColor = vec4(c, 0.95); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 100; parent.add(this.mesh);
    this.cap = cap;
  }
  update(world, alpha, myTeam, myId, res) {
    if (res) this.mesh.material.uniforms.uRes.value.copy(res);
    let n = 0;
    for (const e of world.entities) {
      if (!e.alive || e.dead || n >= this.cap) continue;
      if (isStructure(e.kind) && e.hp >= e.maxHp && !e.vulnerable) continue;
      const hero = e.kind === KIND.HERO, h = e.kind === KIND.HERO ? 2.0 : e.kind === KIND.TOWER ? 6.6 : e.kind === KIND.HEART ? 3.6 : e.kind === KIND.PEBBLE ? 1.9 : 1.35;
      const w = hero ? 1.25 : isStructure(e.kind) ? 2.2 : e.kind === KIND.PEBBLE ? 1.2 : e.kind === KIND.SIEGE ? 0.95 : 0.7;
      this.iPos.setXYZ(n, rx(e) * S, h + (hero && e.heroKey === 'gus' && e.heroState.mounted ? 0.75 : 0), ry(e) * S);
      const shield = e.shieldUntil > world.tick ? e.shield / e.maxHp : 0;
      this.iData.setXYZW(n, Math.max(0, e.hp / e.maxHp), shield, w, hero ? e.maxHp : 0);
      const c = e.id === myId ? SELF_RGB : TEAM_RGB[e.team === myTeam ? 0 : 1];
      this.iCol.setXYZW(n, c.r, c.g, c.b, hero ? 1 : 0);
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.iPos.needsUpdate = this.iData.needsUpdate = this.iCol.needsUpdate = true;
  }
}

export class GroundDecals {
  constructor(parent, cap = 160) {
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // x, z, radius, ring
    this.iCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.iPos); g.setAttribute('iCol', this.iCol); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 iPos; attribute vec3 iCol; varying vec2 vUv; varying vec4 vP; varying vec3 vC;
        void main(){ vUv = uv*2.-1.; vP = iPos; vC = iCol; vec3 p = position*iPos.z*2.4; p.xz += iPos.xy; p.y = 0.035;
          gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vP; varying vec3 vC; uniform float uTime;
        void main(){ float r = length(vUv);
          float shadow = smoothstep(0.55, 0.0, r) * 0.45;
          float ring = vP.w > 0.75 ? smoothstep(0.035, 0., abs(r - 0.78)) * (0.75 + 0.25*sin(uTime*3.)) : smoothstep(0.05, 0., abs(r - 0.62)) * 0.55;
          vec3 c = mix(vec3(0.02,0.03,0.08), vC*1.6, ring);
          float a = max(shadow, ring*0.95); if (a < 0.01) discard; gl_FragColor = vec4(c, a); }` });
    m.onBeforeRender = () => {};
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; parent.add(this.mesh); this.cap = cap;
  }
  update(world, alpha, myTeam, myId, dt) {
    this.mesh.material.uniforms.uTime.value += dt;
    let n = 0;
    for (const e of world.entities) {
      if (!e.alive || e.dead || n >= this.cap || e.kind === KIND.TOWER || e.kind === KIND.HEART) continue;
      const ring = e.kind === KIND.HERO ? 1 : 0.5;
      this.iPos.setXYZW(n, rx(e) * S, ry(e) * S, e.radius * S * (e.kind === KIND.HERO ? 1.25 : 1), ring);
      const c = e.id === myId ? SELF_RGB : TEAM_RGB[e.team === myTeam ? 0 : 1];
      this.iCol.setXYZ(n, c.r, c.g, c.b); n++;
    }
    this.mesh.geometry.instanceCount = n; this.iPos.needsUpdate = this.iCol.needsUpdate = true;
  }
}

// Projectile look per sim projectile kind: [color, size, emissive strength, trail length]
// Projectiles: one instanced draw; the fragment shader draws each attack's own shape (attack-styles.js).
// Premultiplied blending lets glowing shapes add light and solid ones (ink, stone) stay dark.
const RGB = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);
const STYLE_CACHE = new Map();
function lookOf(kind) {
  let l = STYLE_CACHE.get(kind); if (l) return l;
  const s = PROJECTILE_STYLES[kind] || DEFAULT_PROJECTILE;
  l = { s, c: s.team ? s.team.map((h) => RGB(h, s.glow)) : [RGB(s.color, s.glow), RGB(s.color, s.glow)], c2: RGB(s.color2 || '#ffffff'), y: s.y ?? 0.85 };
  STYLE_CACHE.set(kind, l); return l;
}
export class ProjectileViews {
  constructor(parent, cap = 256) {
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    const A = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
    this.iA = A(4); // pos, size
    this.iB = A(4); // colour * glow, shape
    this.iC = A(4); // secondary colour, spin phase
    this.iD = A(3); // flight direction (x, z), stretch
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB); g.setAttribute('iC', this.iC); g.setAttribute('iD', this.iD); g.instanceCount = 0;
    this.uniforms = { uTime: { value: 0 } };
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.uniforms,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `attribute vec4 iA, iB, iC; attribute vec3 iD; varying vec2 vUv; varying vec4 vB, vC; varying float vStretch;
        void main(){ vUv = uv * 2. - 1.; vB = iB; vC = iC; vStretch = iD.z; vec4 mv = viewMatrix * vec4(iA.xyz, 1.);
          vec3 dir = (viewMatrix * vec4(iD.x, 0., iD.y, 0.)).xyz; vec2 d = length(dir.xy) > 0.001 ? normalize(dir.xy) : vec2(1., 0.);
          vec2 q = position.xy; vec2 stretched = d * q.x * iD.z + vec2(-d.y, d.x) * q.y;
          mv.xy += stretched * iA.w; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vB, vC; varying float vStretch;
        mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
        void main(){
          int shape = int(vB.w + .5); vec3 col = vB.rgb, c2 = vC.rgb; float spin = vC.w, r = length(vUv);
          vec3 c = vec3(0.); float a = 0.;
          if (shape == 1) { // lance: white-hot core line, hot halo, bright head
            float y = abs(vUv.y), head = smoothstep(-1., 1., vUv.x);
            float core = smoothstep(.22, 0., y) * (.35 + .65 * head), halo = smoothstep(1., 0., r) * (.4 + .6 * head);
            c = c2 * core * 1.4 + col * halo * .9; a = 0.;
          } else if (shape == 2) { // gear: spinning toothed ring
            vec2 p = rot(spin) * vUv; float ang = atan(p.y, p.x), teeth = step(.5, fract(ang * 8. / 6.2832));
            float outer = mix(.62, .9, teeth), body = step(r, outer) * step(.28, r);
            float glow = smoothstep(1., .3, r) * .35;
            c = mix(col, c2, smoothstep(.3, .8, r) * .5) * body + col * glow; a = body * .85;
          } else if (shape == 3) { // ink blot: dark wobbling body, violet rim, droplets
            float ang = atan(vUv.y, vUv.x), w = .62 + .12 * sin(ang * 5. + uTime * 9. + spin) + .06 * sin(ang * 9. - uTime * 7.);
            float body = smoothstep(w, w - .08, r), rim = smoothstep(w - .02, w - .2, r) * body;
            c = col * body + c2 * (body - rim) * 1.6 + c2 * smoothstep(1., w, r) * .25; a = body * .92;
          } else if (shape == 4) { // bee: striped body, flickering wings
            vec2 p = vUv * vec2(1., 1.5); float body = smoothstep(.62, .55, length(p * vec2(.9, 1.)));
            float stripe = step(.5, fract((vUv.x + 1.) * 2.2));
            float wing = smoothstep(.35, .2, length(vUv - vec2(-.05, .55 + .08 * sin(uTime * 60. + spin)))) + smoothstep(.35, .2, length(vUv - vec2(-.05, -.55 - .08 * sin(uTime * 60. + spin))));
            c = mix(col, c2, stripe) * body + vec3(.9) * wing * .6 * (1. - body); a = max(body, wing * .5);
          } else if (shape == 5) { // coin: spinning gold disc with rim and glint
            float sx = max(.18, abs(cos(spin))); vec2 p = vec2(vUv.x / sx, vUv.y); float rr = length(p);
            float disc = step(rr, .7), rim = smoothstep(.55, .7, rr) * disc, glint = pow(max(0., 1. - length(p - vec2(-.25, .25)) * 2.2), 3.);
            c = col * disc * (.75 + .25 * sin(spin * 2.)) + c2 * (rim * .6 + glint * 1.5) + col * smoothstep(1., .4, r) * .3; a = disc * .9;
          } else if (shape == 6) { // rock: dark chunky stone with a warm lit edge
            vec2 p = rot(spin) * vUv; float ang = atan(p.y, p.x), w = .66 + .1 * sin(ang * 3. + 1.) + .06 * sin(ang * 7.);
            float body = smoothstep(w, w - .05, r), lit = smoothstep(.2, .9, dot(normalize(p + 1e-4), vec2(-.6, .8))) * body;
            c = col * body + c2 * lit * .5; a = body;
          } else if (shape == 7) { // shard: sharp diamond with a white edge
            float dmd = abs(vUv.x) * .7 + abs(vUv.y) * 1.6, body = smoothstep(1., .8, dmd), core = smoothstep(.55, .1, dmd);
            c = col * body * .9 + c2 * core; a = 0.;
          } else { // orb
            float core = smoothstep(.35, 0., r), glow = smoothstep(1., 0., r); c = col * glow * .7 + c2 * core * .9; a = 0.;
          }
          float lum = max(max(c.r, c.g), c.b); if (a < .01 && lum < .01) discard;
          gl_FragColor = vec4(c, a); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 50; parent.add(this.mesh); this.cap = cap;
    this.start = new Map(); // projectile id -> launch distance (for lobbed arcs)
  }
  update(world, alpha, dt = 0) {
    let n = 0; this.uniforms.uTime.value += dt; const t = this.uniforms.uTime.value;
    for (const p of world.projectiles) {
      if (!p.alive || n >= this.cap) continue;
      const l = lookOf(p.kind), s = l.s, rgb = s.team ? l.c[p.team] || l.c[0] : l.c[0];
      const x = lerp(p.px, p.x, alpha), z = lerp(p.py, p.y, alpha);
      let y = l.y;
      if (s.arc) { // lob: height from the share of the way travelled to the target
        const tg = world.entities[p.targetId]; let d0 = this.start.get(p.id);
        const d = tg ? Math.hypot(tg.x - x, tg.y - z) : 0; if (d0 === undefined) { d0 = Math.max(1, d); this.start.set(p.id, d0); }
        const k = 1 - Math.min(1, d / d0); y += Math.sin(k * Math.PI) * s.arc;
      }
      let ox = 0, oz = 0;
      if (s.wobble) { const w = Math.sin(t * 18 + p.id) * s.wobble; ox = -p.dirY * w; oz = p.dirX * w; } // bees zig-zag
      this.iA.setXYZW(n, x * S + ox, y, z * S + oz, s.size);
      this.iB.setXYZW(n, rgb.r, rgb.g, rgb.b, s.shape);
      this.iC.setXYZW(n, l.c2.r, l.c2.g, l.c2.b, (s.spin || 0) * t * 6.2832 + p.id);
      this.iD.setXYZ(n, p.dirX, p.dirY, s.stretch || 1); n++;
    }
    if (this.start.size > 64) for (const id of this.start.keys()) if (!world.projectiles.some((q) => q.id === id && q.alive)) this.start.delete(id);
    this.mesh.geometry.instanceCount = n; this.iA.needsUpdate = this.iB.needsUpdate = this.iC.needsUpdate = this.iD.needsUpdate = true;
  }
}
