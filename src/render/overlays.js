// Instanced overlays: health bars (1 draw), ground shadows + team rings (1 draw), projectiles (1 draw).
import * as THREE from 'three';
import { S, TEAM_COLORS, TEAM_RGB, SELF_RGB } from './palette.js';
import { KIND, isStructure } from '../sim/constants.js';

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
      this.iPos.setXYZ(n, lerp(e.px, e.x, alpha) * S, h + (hero && e.heroKey === 'gus' && e.heroState.mounted ? 0.75 : 0), lerp(e.py, e.y, alpha) * S);
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
      this.iPos.setXYZW(n, lerp(e.px, e.x, alpha) * S, lerp(e.py, e.y, alpha) * S, e.radius * S * (e.kind === KIND.HERO ? 1.25 : 1), ring);
      const c = e.id === myId ? SELF_RGB : TEAM_RGB[e.team === myTeam ? 0 : 1];
      this.iCol.setXYZ(n, c.r, c.g, c.b); n++;
    }
    this.mesh.geometry.instanceCount = n; this.iPos.needsUpdate = this.iCol.needsUpdate = true;
  }
}

// Projectile look per sim projectile kind: [color, size, emissive strength, trail length]
const PROJ = {
  'tower-bolt': ['#ffe9a8', 0.28, 3.2], 'minion-bolt': ['#ffffff', 0.12, 1.6], 'siege-shot': ['#ffb070', 0.22, 1.8],
  'morrow-cog': ['#f2c14e', 0.34, 2.6], 'morrow-auto': ['#ffd88a', 0.14, 2], 'saffi-auto': ['#ff9d4d', 0.12, 2],
  'vesper-auto': ['#a99bff', 0.14, 2.4], 'gus-auto': ['#d9b98a', 0.18, 1.2], 'brindle-auto': ['#ffd84a', 0.14, 2.2],
  'brindle-sting': ['#ffd000', 0.2, 3], 'auctioneer-auto': ['#ffe07a', 0.14, 2.2], 'auctioneer-gavel': ['#f2c14e', 0.36, 3.2],
};
const PROJ_RGB = {}; for (const [k, v] of Object.entries(PROJ)) PROJ_RGB[k] = new THREE.Color(v[0]).multiplyScalar(v[2]);
const PROJ_DEFAULT = ['#ffffff', 0.15, 1.5], PROJ_DEFAULT_RGB = new THREE.Color('#ffffff').multiplyScalar(1.5);
export class ProjectileViews {
  constructor(parent, cap = 256) {
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    this.iA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // pos, size
    this.iB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage); // color*intensity, spin
    this.iD = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2).setUsage(THREE.DynamicDrawUsage); // screen-space-ish dir (x,z)
    g.setAttribute('iA', this.iA); g.setAttribute('iB', this.iB); g.setAttribute('iD', this.iD); g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 iA; attribute vec4 iB; attribute vec2 iD; varying vec2 vUv; varying vec4 vB;
        void main(){ vUv = uv*2.-1.; vB = iB; vec4 mv = viewMatrix*vec4(iA.xyz,1.);
          vec3 dir = (viewMatrix*vec4(iD.x,0.,iD.y,0.)).xyz; vec2 d = length(dir.xy) > 0.001 ? normalize(dir.xy) : vec2(1.,0.);
          vec2 q = position.xy; vec2 stretched = d*q.x*(1. + length(iD)*2.2) + vec2(-d.y,d.x)*q.y;
          mv.xy += stretched*iA.w; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec2 vUv; varying vec4 vB;
        void main(){ float r = length(vUv); float core = smoothstep(0.35, 0., r); float glow = smoothstep(1., 0., r);
          vec3 c = vB.rgb*(glow*0.7) + vec3(1.)*core*0.9; float a = glow; if (a < 0.01) discard; gl_FragColor = vec4(c*a, a); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 50; parent.add(this.mesh); this.cap = cap;
  }
  update(world, alpha) {
    let n = 0;
    for (const p of world.projectiles) {
      if (!p.alive || n >= this.cap) continue;
      const look = PROJ[p.kind] || PROJ_DEFAULT, rgb = PROJ_RGB[p.kind] || PROJ_DEFAULT_RGB;
      const y = p.kind === 'tower-bolt' ? 2.4 : 0.85;
      this.iA.setXYZW(n, lerp(p.px, p.x, alpha) * S, y, lerp(p.py, p.y, alpha) * S, look[1]);
      this.iB.setXYZW(n, rgb.r, rgb.g, rgb.b, 0);
      this.iD.setXY(n, p.dirX * 0.35, p.dirY * 0.35); n++;
    }
    this.mesh.geometry.instanceCount = n; this.iA.needsUpdate = this.iB.needsUpdate = this.iD.needsUpdate = true;
  }
}
