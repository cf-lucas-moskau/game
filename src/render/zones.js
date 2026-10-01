// Zone layer: ground ribbons (ink strokes/loops/walls, fire trails: one mesh), discs (pools, echoes,
// telegraphs, relics: one instanced mesh) and honeycomb domes (pooled). Generic engine: hero zones are drawn
// by the presentation packs through render/hero-fx.js (hook in update); relics and telegraphs are drawn here.
import * as THREE from 'three';
import { S } from './palette.js';
import { TICK_HZ, RULES } from '../sim/constants.js';

const RIBBON_CAP = 6000; // vertices
import { DISC } from '../presentation/kit.js';

export class ZoneViews {
  constructor(parent) {
    // ---- ribbons: flat strokes on the ground or vertical walls; per-vertex kind + alpha + across/up coordinate
    const g = new THREE.BufferGeometry();
    this.rPos = new THREE.BufferAttribute(new Float32Array(RIBBON_CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.rDat = new THREE.BufferAttribute(new Float32Array(RIBBON_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // kind, alpha, v, along
    g.setAttribute('position', this.rPos); g.setAttribute('dat', this.rDat);
    const idx = new Uint16Array((RIBBON_CAP / 2) * 6); for (let i = 0, q = 0; q < RIBBON_CAP / 2 - 1; q++, i += 6) { const a = q * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i); }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.ribbonMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 dat; varying vec4 vD; void main(){ vD = dat; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uTime; varying vec4 vD;
        float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
        void main(){
          float kind = vD.x, a = vD.y, v = vD.z, along = vD.w;
          vec3 c; float alpha;
          if (kind < 1.5) { // ink: dark core, violet glowing edge, brushy breakup along the stroke
            float edge = abs(v * 2. - 1.);
            float brush = 0.75 + 0.25 * sin(along * 7. + h(floor(along * 3.)) * 6.);
            c = mix(vec3(.05,.03,.12), vec3(.55,.45,1.), smoothstep(0.55, 1., edge));
            alpha = a * smoothstep(1., 0.82 * brush, edge);
            if (kind > 0.5) { c = mix(vec3(.06,.03,.16), vec3(.62,.5,1.), smoothstep(0.35, 1., v)); alpha = a * (0.92 - 0.5 * v) * (0.8 + 0.2 * sin(along * 5. + uTime * 3.)); } // wall
          } else { // fire trail
            float edge = abs(v * 2. - 1.);
            c = mix(vec3(1., .78, .4), vec3(1., .32, .06), edge) * 1.25;
            alpha = a * 0.75 * smoothstep(1., 0.3, edge) * (0.7 + 0.3 * sin(along * 11. - uTime * 14.));
          }
          if (alpha < 0.01) discard; gl_FragColor = vec4(c, alpha); }` });
    this.ribbon = new THREE.Mesh(g, this.ribbonMat); this.ribbon.frustumCulled = false; this.ribbon.renderOrder = 7; parent.add(this.ribbon);
    // ---- discs
    const dg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
    this.dA = new THREE.InstancedBufferAttribute(new Float32Array(64 * 4), 4).setUsage(THREE.DynamicDrawUsage); // x, z, radius, kind
    this.dB = new THREE.InstancedBufferAttribute(new Float32Array(64 * 4), 4).setUsage(THREE.DynamicDrawUsage); // progress, alpha, team, seed
    dg.setAttribute('iA', this.dA); dg.setAttribute('iB', this.dB); dg.instanceCount = 0;
    this.discMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 } },
      vertexShader: `attribute vec4 iA, iB; varying vec2 vUv; varying vec4 vA, vB;
        void main(){ vUv = position.xz; vA = iA; vB = iB; vec3 p = vec3(position.x * iA.z + iA.x, 0.045 + iA.w * 0.002, position.z * iA.z + iA.y);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vA, vB;
        void main(){ float r = length(vUv); if (r > 1.) discard; float k = vA.w, prog = vB.x, a = vB.y; vec3 c; float al;
          if (k < 0.5) { // honey: amber pool with slow ripples
            float rip = 0.5 + 0.5 * sin(r * 18. - uTime * 2. + vB.w * 6.);
            c = mix(vec3(.9, .55, .1), vec3(1., .78, .3), rip * 0.5); al = a * (0.26 + 0.3 * smoothstep(0.86, 1., r)) * smoothstep(1., 0.95, r);
          } else if (k < 1.5) { // echo: clock face ring with ticking hand
            float ring = smoothstep(0.08, 0., abs(r - 0.82)); float ang = atan(vUv.y, vUv.x);
            float ticks = step(0.9, fract(ang / 6.2832 * 12.)) * step(0.62, r) * step(r, 0.8);
            float hand = step(abs(sin(ang - uTime * 2.)), 0.05) * step(r, 0.7);
            c = vec3(1., .82, .38) * 1.6; al = a * (ring + ticks * 0.6 + hand * 0.5) * 0.8;
          } else if (k < 2.5) { // telegraph: edge + filling disc until impact
            vec3 tc = vB.z > 0.5 ? vec3(1., .3, .42) : vec3(.35, .8, 1.);
            float edge = smoothstep(0.05, 0., abs(r - 0.97)); float fill = step(r, prog) * 0.28 + smoothstep(0.04, 0., abs(r - prog)) * 0.5;
            c = tc * 1.4; al = a * (edge * 0.9 + fill);
          } else if (k < 3.5) { // relic: soft green glow
            float pulse = 0.6 + 0.4 * sin(uTime * 3. + vB.w * 5.); c = vec3(.45, 1., .5) * 1.5; al = a * smoothstep(1., 0.1, r) * 0.5 * pulse;
          } else if (k < 4.5) { // camp nest: barnacle-studded sand ring; while the camp is down, a gold arc fills toward its return
            float ang = atan(vUv.y, vUv.x) / 6.2832 + 0.5;
            float ring = smoothstep(0.07, 0., abs(r - 0.86)) * (0.55 + 0.45 * step(0.5, fract(ang * 18.)));
            float dots = step(0.82, fract(sin(floor(ang * 26.) * 12.9) * 43758.5)) * smoothstep(0.1, 0., abs(r - 0.72));
            c = vec3(.91, .86, .77); al = a * (ring * 0.45 + dots * 0.5 + smoothstep(1., 0.2, r) * 0.08);
            if (prog < 0.999) { float arc = step(ang, prog) * smoothstep(0.06, 0., abs(r - 0.95)); c = mix(c, vec3(.95, .76, .3) * 1.4, arc); al = max(al, a * arc * 0.9); }
          } else if (k < 5.5) { // Sky Pearl: shimmering ring; the holding team's colour fills inward with capture progress
            vec3 tc = vB.z < 0.5 ? vec3(.27, .77, .9) : vB.z < 1.5 ? vec3(.94, .28, .43) : vec3(.9, .95, 1.);
            float edge = smoothstep(0.035, 0., abs(r - 0.97)); float shimmer = 0.5 + 0.5 * sin(atan(vUv.y, vUv.x) * 8. + uTime * 2. - r * 6.);
            float fill = step(1. - prog, 1. - r) * 0.22 + smoothstep(0.03, 0., abs(r - (1. - prog))) * 0.6 * step(0.01, prog);
            c = mix(vec3(.85, .93, 1.), tc, step(0.01, prog)) * 1.5; al = a * (edge * (0.7 + 0.3 * shimmer) + fill + smoothstep(1., 0., r) * 0.06);
          } else if (k < 6.5) { // whale-roll loot: gold glow with a sparkle
            float tw = 0.55 + 0.45 * sin(uTime * 7. + vB.w * 4.); c = vec3(1., .82, .35) * 1.7; al = a * smoothstep(1., 0.05, r) * 0.55 * tw;
          } else { // Gale Shrine: a pale wind spiral; prog = channel progress (a dims it while it recharges)
            float ang = atan(vUv.y, vUv.x); float sp = 0.5 + 0.5 * sin(ang * 3. + log(r + 0.05) * 6. - uTime * 3.);
            float ring = smoothstep(0.05, 0., abs(r - 0.92)); float ch = step(0.01, prog) * step(r, prog) * 0.25;
            c = vec3(.75, .97, .95) * 1.4; al = a * (ring * 0.7 + sp * smoothstep(1., 0.3, r) * 0.25 + ch);
          }
          if (al < 0.01) discard; gl_FragColor = vec4(c, al); }` });
    this.discs = new THREE.Mesh(dg, this.discMat); this.discs.frustumCulled = false; this.discs.renderOrder = 4; parent.add(this.discs);
    // ---- domes (Hive Dome): honeycomb hemisphere
    this.domeMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 } },
      vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uTime, uAlpha; varying vec3 vP; varying vec3 vN;
        vec2 hexd(vec2 p){ p *= vec2(1., 1.1547); p.x += mod(floor(p.y), 2.) * 0.5; vec2 f = fract(p) - 0.5; return f; }
        void main(){ vec2 uv = vec2(atan(vP.z, vP.x) * 3.2 * sqrt(max(0.05, 1. - vP.y * vP.y)), vP.y * 4.2); vec2 f = hexd(uv); float cell = max(abs(f.x) * 1.7, abs(f.y) * 1.9);
          float line = smoothstep(0.78, 0.9, cell); float rim = pow(1. - abs(vN.z), 2.);
          vec3 c = mix(vec3(1., .7, .2), vec3(1., .86, .45), line) * (0.7 + line * 0.5);
          float a = (0.05 + line * 0.26 + rim * 0.14) * uAlpha * (0.85 + 0.15 * sin(uTime * 4. + vP.y * 6.));
          gl_FragColor = vec4(c, a); }` });
    this.domeGeo = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.domes = [0, 1].map(() => { const m = new THREE.Mesh(this.domeGeo, this.domeMat.clone()); m.visible = false; m.renderOrder = 8; parent.add(m); return m; });
    this.telegraphs = []; this.nDome = 0; this.hook = null;
  }
  pushRibbon(pts, kind, alpha, width, wall = false) {
    const P = this.rPos, D = this.rDat, n = pts.length / 2;
    if (n < 2 || this.nv + n * 2 + 4 > RIBBON_CAP) return;
    // vertex pair i of this strip
    const pair = (i, out) => {
      const x = pts[i * 2] * S, z = pts[i * 2 + 1] * S;
      if (wall) { out[0] = x; out[1] = 0; out[2] = z; out[3] = x; out[4] = 1.35; out[5] = z; return; }
      const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
      let tx = pts[j * 2] - pts[k * 2], ty = pts[j * 2 + 1] - pts[k * 2 + 1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = width * S;
      out[0] = x - ty * w; out[1] = 0.05; out[2] = z + tx * w; out[3] = x + ty * w; out[4] = 0.05; out[5] = z - tx * w;
    };
    const q = this._q || (this._q = new Float32Array(6));
    let v = this.nv;
    if (v > 0) { // invisible bridge: repeat the previous end pair and the new start pair at alpha 0
      P.setXYZ(v, P.getX(v - 2), P.getY(v - 2), P.getZ(v - 2)); P.setXYZ(v + 1, P.getX(v - 1), P.getY(v - 1), P.getZ(v - 1));
      pair(0, q); P.setXYZ(v + 2, q[0], q[1], q[2]); P.setXYZ(v + 3, q[3], q[4], q[5]);
      for (let k = 0; k < 4; k++) D.setXYZW(v + k, kind, 0, k & 1, 0);
      v += 4;
    }
    let along = 0;
    for (let i = 0; i < n; i++) {
      if (i) along += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]) * S;
      pair(i, q); P.setXYZ(v, q[0], q[1], q[2]); P.setXYZ(v + 1, q[3], q[4], q[5]);
      const kk = wall ? 1 : kind; D.setXYZW(v, kk, alpha, 0, along); D.setXYZW(v + 1, kk, alpha, 1, along);
      v += 2;
    }
    this.nv = v;
  }
  /** A honeycomb dome over (x, y) (sim units), growing in over its first quarter second. */
  dome(x, y, r, age, fade, now) {
    if (this.nDome >= this.domes.length) return;
    const m = this.domes[this.nDome++], k = Math.min(1, age * 4);
    m.visible = true; m.position.set(x * S, 0, y * S); m.scale.set(r * S * (0.6 + 0.4 * k), r * S * 0.65 * k, r * S * (0.6 + 0.4 * k));
    m.material.uniforms.uAlpha.value = fade; m.material.uniforms.uTime.value = now;
  }
  disc(x, y, r, kind, prog, alpha, team, seed) {
    const i = this.nd; if (i >= 64) return; this.nd++;
    this.dA.setXYZW(i, x * S, y * S, r * S, kind); this.dB.setXYZW(i, prog, alpha, team, seed);
  }
  update(world, alpha, dt, now) {
    this.ribbonMat.uniforms.uTime.value = now; this.discMat.uniforms.uTime.value = now;
    this.nv = 0; this.nd = 0; this.nDome = 0;
    if (this.hook) this.hook(world, now);
    for (let i = this.nDome; i < this.domes.length; i++) this.domes[i].visible = false;
    for (const p of world.pickups) this.disc(p.x, p.y, 70, DISC.RELIC, 0, 1, 0, p.id % 5);
    // Sky Pearl circle: faint while announced; while up it fills with the holding team's colour
    const pearl = world.state.pearl;
    if (pearl && pearl.phase !== 'idle') this.disc(pearl.x, pearl.y, RULES.PEARL_RADIUS, DISC.PEARL, pearl.phase === 'up' ? pearl.prog : 0, pearl.phase === 'up' ? 1 : 0.45, pearl.holder < 0 ? 2 : pearl.holder, 0);
    // camp nests; a downed camp shows its return as a filling arc during the last 15 seconds
    const camps = world.state.camps;
    if (camps) for (let i = 0; i < camps.length; i++) {
      const c = camps[i], wait = (c.respawnAt - world.tick) / TICK_HZ;
      if (c.crabId >= 0) this.disc(c.x, c.y, 130, DISC.CAMP, 1, 0.9, 0, i);
      else if (wait < 15) this.disc(c.x, c.y, 130, DISC.CAMP, 1 - Math.max(0, wait) / 15, 0.9, 0, i);
    }
    let w = 0;
    for (const tg of this.telegraphs) { const k = (now - tg.start) / tg.dur; if (k > 1.1) continue; this.telegraphs[w++] = tg; this.disc(tg.x, tg.y, tg.r, DISC.TELEGRAPH, Math.min(1, k), 1 - Math.max(0, k - 1) * 10, tg.team, 0); }
    this.telegraphs.length = w;
    this.ribbon.geometry.setDrawRange(0, Math.max(0, (this.nv / 2 - 1) * 6)); this.ribbon.visible = this.nv > 0;
    this.rPos.needsUpdate = this.rDat.needsUpdate = true;
    this.discs.geometry.instanceCount = this.nd; this.discs.visible = this.nd > 0; this.dA.needsUpdate = this.dB.needsUpdate = true;
  }
}
