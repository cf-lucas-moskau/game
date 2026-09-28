// GPU particles: one instanced draw for every particle in the game. The CPU only writes a spawn
// record into a ring buffer; the vertex shader animates position, size, colour and fade from birth time.
import * as THREE from 'three';

export class Particles {
  constructor(parent, cap = 3000) {
    this.cap = cap; this.head = 0; this.time = 0;
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
    const A = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = A(4);  // x y z, birth time
    this.aVel = A(4);  // vx vy vz, life (s)
    this.aCol = A(4);  // r g b, intensity
    this.aPar = A(4);  // size start, size end, gravity, drag
    g.setAttribute('iPos', this.aPos); g.setAttribute('iVel', this.aVel); g.setAttribute('iCol', this.aCol); g.setAttribute('iPar', this.aPar);
    g.instanceCount = cap;
    for (let i = 0; i < cap; i++) this.aVel.setW(i, -1); // dead
    this.uniforms = { uTime: { value: 0 } };
    const m = new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime; attribute vec4 iPos, iVel, iCol, iPar; varying vec4 vCol; varying vec2 vUv;
        void main(){
          float age = uTime - iPos.w, life = iVel.w;
          if (life <= 0. || age < 0. || age > life) { gl_Position = vec4(2., 2., 2., 1.); return; }
          float t = age / life;
          float drag = exp(-iPar.w * age);
          vec3 p = iPos.xyz + iVel.xyz * (1. - drag) / max(iPar.w, 0.001) + vec3(0., -0.5 * iPar.z * age * age, 0.);
          vec4 mv = viewMatrix * vec4(p, 1.);
          float s = mix(iPar.x, iPar.y, t);
          mv.xy += position.xy * s;
          gl_Position = projectionMatrix * mv;
          vUv = uv * 2. - 1.;
          vCol = vec4(iCol.rgb * iCol.w, (1. - t) * smoothstep(0., 0.08, t));
        }`,
      fragmentShader: `varying vec4 vCol; varying vec2 vUv;
        void main(){ float r = dot(vUv, vUv); float a = exp(-r * 3.2) * vCol.a; if (a < 0.01) discard; gl_FragColor = vec4(vCol.rgb * a, a); }` });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = 60; parent.add(this.mesh);
    this.dirty = false; this.minI = cap; this.maxI = -1;
  }
  /** Spawn one particle (render units, seconds). */
  spawn(x, y, z, vx, vy, vz, life, r, g, b, intensity, s0, s1, gravity = 0, drag = 0) {
    const i = this.head; this.head = (this.head + 1) % this.cap;
    this.aPos.setXYZW(i, x, y, z, this.time); this.aVel.setXYZW(i, vx, vy, vz, life);
    this.aCol.setXYZW(i, r, g, b, intensity); this.aPar.setXYZW(i, s0, s1, gravity, drag);
    if (i < this.minI) this.minI = i; if (i > this.maxI) this.maxI = i; this.dirty = true;
  }
  update(dt) {
    this.time += dt; this.uniforms.uTime.value = this.time;
    if (!this.dirty) return;
    // upload only the touched range of the ring
    for (const a of [this.aPos, this.aVel, this.aCol, this.aPar]) {
      a.clearUpdateRanges(); a.addUpdateRange(this.minI * a.itemSize, (this.maxI - this.minI + 1) * a.itemSize); a.needsUpdate = true;
    }
    this.dirty = false; this.minI = this.cap; this.maxI = -1;
  }
}
