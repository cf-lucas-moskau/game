// Map features in the neutral middle: Barnacle Crabs (procedural, instanced: body and claws are one draw each) and the
// Sky Pearl (an iridescent sphere and, while it is announced, a beam of light).
// Reads world state and events, never writes them. Ground markings (nests, rings) are drawn by render/zones.js.
import * as THREE from 'three';
import { S, WHITE_RGB } from './palette.js';
import { KIND, RULES } from '../sim/constants.js';
import { EV } from '../core/events.js';
import { rx, ry } from './interp.js';
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const tmp = new THREE.Object3D(), tmpC = new THREE.Color(), tmpTip = new THREE.Matrix4(), tmpYaw = new THREE.Matrix4(), TIP = new THREE.Euler();
const SHELL = new THREE.Color('#d9623b'), SHELL_DARK = new THREE.Color('#8f3424'), BARNACLE = new THREE.Color('#e8dcc4'), EYE = new THREE.Color('#1c1f4a'), LEG = new THREE.Color('#b44a2c');
const faceToRotY = (a) => Math.PI / 2 - a;

/** Paint every vertex of a geometry one colour (non-indexed, so parts merge cleanly). */
function painted(g, color) {
  g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g;
}
/** A tapered cylinder from point a to point b (render units). */
function limb(a, b, r0, r1) {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, len, 5);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z); return g;
}
/** Crab body in render units, facing +z: domed shell with barnacles, eye stalks and eight legs. */
function crabBody() {
  const parts = [];
  const shell = new THREE.IcosahedronGeometry(0.5, 1); shell.scale(1.25, 0.5, 0.95); shell.translate(0, 0.42, 0); parts.push(painted(shell, SHELL));
  const belly = new THREE.CylinderGeometry(0.52, 0.42, 0.14, 9); belly.scale(1.15, 1, 0.9); belly.translate(0, 0.28, 0); parts.push(painted(belly, SHELL_DARK));
  // barnacles: little volcano cones on the shell
  const spots = [[0.25, 0.1], [-0.3, 0.05], [0.05, -0.2], [-0.12, 0.25], [0.38, -0.15], [-0.4, -0.18]];
  for (const [x, z] of spots) { const b = new THREE.ConeGeometry(0.11, 0.13, 6); b.translate(x, 0.66 - Math.hypot(x, z) * 0.28, z); parts.push(painted(b, BARNACLE)); }
  // eye stalks
  for (const s of [-1, 1]) {
    const stalk = new THREE.CylinderGeometry(0.025, 0.03, 0.22, 5); stalk.translate(s * 0.14, 0.72, 0.36); parts.push(painted(stalk, SHELL_DARK));
    const eye = new THREE.SphereGeometry(0.055, 6, 4); eye.translate(s * 0.14, 0.85, 0.36); parts.push(painted(eye, EYE));
  }
  // legs: hip -> knee (up and out) -> foot on the ground, four per side, fanned front to back
  for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z = 0.2 - i * 0.16, fan = (i - 1.5) * 0.12;
    const hip = new THREE.Vector3(sd * 0.5, 0.34, z), knee = new THREE.Vector3(sd * 0.86, 0.56, z + fan), foot = new THREE.Vector3(sd * 1.08, 0.02, z + fan * 1.8);
    parts.push(painted(limb(hip, knee, 0.04, 0.035), LEG), painted(limb(knee, foot, 0.035, 0.018), LEG));
  }
  return BGU.mergeGeometries(parts);
}
/** One claw (right side, pivot at the shoulder): arm and a two-jaw pincer. Mirrored per instance. */
function crabClaw() {
  const parts = [];
  const arm = new THREE.CylinderGeometry(0.05, 0.065, 0.36, 6); arm.rotateX(Math.PI / 2); arm.translate(0, 0, 0.18); parts.push(painted(arm, LEG));
  const palm = new THREE.SphereGeometry(0.16, 7, 5); palm.scale(1, 0.8, 1.2); palm.translate(0, 0.02, 0.42); parts.push(painted(palm, SHELL));
  const jawA = new THREE.ConeGeometry(0.075, 0.3, 6); jawA.rotateX(Math.PI / 2); jawA.translate(0.05, 0.05, 0.66); parts.push(painted(jawA, SHELL));
  const jawB = new THREE.ConeGeometry(0.055, 0.24, 6); jawB.rotateX(Math.PI / 2); jawB.translate(-0.06, -0.02, 0.62); parts.push(painted(jawB, SHELL_DARK));
  return BGU.mergeGeometries(parts);
}

export class MapFeatureViews {
  constructor(lib, world, parent) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, flatShading: true });
    const cap = world.state.camps.length * 2; // living crabs plus the ones still playing their death
    this.bodies = new THREE.InstancedMesh(crabBody(), mat, cap); this.claws = new THREE.InstancedMesh(crabClaw(), mat, cap * 2);
    for (const m of [this.bodies, this.claws]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count * 3), 3);
      m.castShadow = true; m.frustumCulled = false; m.count = 0; parent.add(m);
    }
    // Sky Pearl: fresnel-iridescent sphere; the beam marks the spot while it is announced
    this.pearlMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uTint: { value: new THREE.Color('#ffffff') }, uGlow: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uTime, uGlow; uniform vec3 uTint; varying vec3 vN; varying vec3 vV;
        void main(){ float f = 1. - max(0., dot(vN, vV)); float band = 0.5 + 0.5 * sin(f * 9. + uTime * 1.6 + vN.y * 4.);
          vec3 iri = mix(vec3(.95, .9, 1.), mix(vec3(.55, .85, 1.), vec3(1., .7, .9), band), smoothstep(0.15, 0.9, f));
          vec3 c = mix(iri, uTint, 0.35) * (0.9 + 0.6 * pow(f, 2.)) * uGlow; gl_FragColor = vec4(c, 1.); }` });
    this.pearl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 18), this.pearlMat); this.pearl.visible = false; parent.add(this.pearl);
    this.beamMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform float uTime, uAlpha; varying vec2 vUv; void main(){ float a = (1. - vUv.y) * (0.6 + 0.4 * sin(vUv.y * 20. - uTime * 6.)) * uAlpha; gl_FragColor = vec4(vec3(.8, .92, 1.) * a, a); }` });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 9, 20, 1, true).translate(0, 4.5, 0), this.beamMat); this.beam.visible = false; this.beam.renderOrder = 9; parent.add(this.beam);
    // whale-roll loot: spinning gold coins over their glow (one instanced draw)
    const coin = lib.merged('prop-coin', 0.45);
    this.coins = new THREE.InstancedMesh(coin.geometry, new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#7a5410', roughness: 0.25, metalness: 0.7 }), 12);
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.coins.count = 0; this.coins.frustumCulled = false; this.coins.castShadow = true; parent.add(this.coins);
    // bounty marker: a gold star turning over every hero worth a shutdown
    const star = lib.merged('prop-star', 0.42);
    this.stars = new THREE.InstancedMesh(star.geometry, new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#a8720f', emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.5, flatShading: true }), 6);
    this.stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.stars.count = 0; this.stars.frustumCulled = false; parent.add(this.stars);
    this.pearlY = -1.2; this.teamTint = [new THREE.Color('#45c4e6'), new THREE.Color('#f0476e')]; this.white = new THREE.Color('#ffffff');
    this.anim = new Map(); // crab id -> { attack: start time, flash, dying }
    this.corpses = [];     // crabs that just died: tip over and sink
  }
  onEvent(e, world, now) {
    if (e.type === EV.AUTO_ATTACK) { const u = world.entities[e.a]; if (u && u.kind === KIND.CRAB) this.state(e.a).attack = now; }
    else if (e.type === EV.DAMAGE) { const u = world.entities[e.a]; if (u && u.kind === KIND.CRAB) this.state(e.a).flash = 1; }
    else if (e.type === EV.DEATH) { const u = world.entities[e.a]; if (u && u.kind === KIND.CRAB) { this.corpses.push({ x: u.x * S, z: u.y * S, yaw: faceToRotY(u.facing), start: now }); this.anim.delete(e.a); } }
  }
  finish(m, n) { m.count = n; m.visible = n > 0; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; } }
  /** One crab: body at (x, z) with yaw; tip (radians) and sink for the death animation; a = animation state or null. */
  put(x, z, yaw, tip, sink, moving, a, phase) {
    const now = this.now;
    // body: scuttle bob while walking, slow breathing at rest
    const bob = moving ? Math.abs(Math.sin(now * 14 + phase)) * 0.05 : Math.sin(now * 2 + phase) * 0.012;
    tmp.position.set(x, bob - sink, z); tmp.rotation.set(tip, yaw + (moving ? Math.sin(now * 14 + phase) * 0.08 : 0), tip * 0.6); tmp.scale.setScalar(1); tmp.updateMatrix();
    this.bodies.setMatrixAt(this.nb, tmp.matrix);
    const fl = a ? a.flash : 0; tmpC.copy(WHITE_RGB).multiplyScalar(1 + fl * 0.8); this.bodies.setColorAt(this.nb++, tmpC);
    // claws: idle snapping; an attack swings both forward and down
    const atk = a ? Math.max(0, 1 - (now - a.attack) / 0.35) : 0, swing = Math.sin(atk * Math.PI);
    TIP.set(tip, 0, tip * 0.6); tmpTip.makeRotationFromEuler(TIP); tmpYaw.makeRotationY(yaw).setPosition(x, 0, z);
    for (let s = -1; s <= 1; s += 2) {
      const snap = Math.sin(now * 3 + phase + s) * 0.12;
      tmp.position.set(s * 0.42, 0.4 + bob - sink, 0.32); tmp.rotation.set(-0.15 + swing * 0.9 + snap * 0.3, s * (0.55 - swing * 0.35) + snap, 0); tmp.scale.set(s, 1, 1); tmp.updateMatrix();
      tmp.matrix.premultiply(tmpTip).premultiply(tmpYaw); // tip over with the body on death, then face and place
      this.claws.setMatrixAt(this.nc, tmp.matrix); this.claws.setColorAt(this.nc++, tmpC);
    }
    if (a && a.flash) a.flash = Math.max(0, a.flash - this.dt * 6);
  }
  state(id) { let a = this.anim.get(id); if (!a) { a = { attack: -9, flash: 0 }; this.anim.set(id, a); } return a; }
  update(world, alpha, dt, now) {
    this.nb = 0; this.nc = 0; this.now = now; this.dt = dt;
    for (const camp of world.state.camps) {
      const e = camp.crabId >= 0 ? world.entities[camp.crabId] : null;
      if (!e || !e.alive || e.kind !== KIND.CRAB) continue;
      this.put(rx(e) * S, ry(e) * S, faceToRotY(e.facing), 0, 0, e.moving, this.state(e.id), e.id * 1.7);
    }
    let w = 0;
    for (const c of this.corpses) { const age = now - c.start; if (age > 2.4) continue; this.corpses[w++] = c; this.put(c.x, c.z, c.yaw, Math.min(1, age * 3) * 2.6, Math.max(0, age - 1.2) * 0.6, false, null, 0); }
    this.corpses.length = w;
    this.finish(this.bodies, this.nb); this.finish(this.claws, this.nc);
    this.updatePearl(world, dt, now);
    let n = 0;
    for (const p of world.pickups) {
      if (p.kind !== 'loot' || n >= 12) continue;
      tmp.position.set(p.x * S, 0.45 + Math.sin(now * 3 + p.id) * 0.1, p.y * S); tmp.rotation.set(0, now * 3 + p.id, 0.25); tmp.scale.setScalar(1); tmp.updateMatrix();
      this.coins.setMatrixAt(n++, tmp.matrix);
    }
    this.coins.count = n; this.coins.visible = n > 0; if (n) this.coins.instanceMatrix.needsUpdate = true;
    let ns = 0;
    for (const h of world.heroes) {
      if (h.dead || h.streak < RULES.SHUTDOWN_FROM || ns >= 6) continue;
      const big = 0.8 + Math.min(1, (h.streak - RULES.SHUTDOWN_FROM) / 4) * 0.5; // grows with the bounty
      tmp.position.set(rx(h) * S, 2.55 + (h.heroKey === 'gus' && h.heroState.mounted ? 0.75 : 0) + Math.sin(now * 2.5 + h.id) * 0.05, ry(h) * S);
      tmp.rotation.set(0, now * 2, 0); tmp.scale.setScalar(big); tmp.updateMatrix(); this.stars.setMatrixAt(ns++, tmp.matrix);
    }
    this.stars.count = ns; this.stars.visible = ns > 0; if (ns) this.stars.instanceMatrix.needsUpdate = true;
  }
  /** The pearl rises while announced, floats while up (tinted toward the holding team), sinks when idle. */
  updatePearl(world, dt, now) {
    const p = world.state.pearl; if (!p) return;
    const warnLeft = p.phase === 'warn' ? Math.max(0, (p.until - world.tick) / 30) : 0;
    const target = p.phase === 'up' ? 1.25 : p.phase === 'warn' ? -0.9 + 1.4 * (1 - Math.min(1, warnLeft / 15)) : -1.4;
    this.pearlY += (target - this.pearlY) * Math.min(1, dt * (p.phase === 'idle' ? 1.5 : 3));
    const vis = this.pearlY > -1.3;
    this.pearl.visible = vis;
    if (vis) {
      this.pearl.position.set(p.x * S, this.pearlY + (p.phase === 'up' ? Math.sin(now * 1.4) * 0.08 : 0), p.y * S);
      this.pearl.rotation.y = now * 0.4;
      this.pearlMat.uniforms.uTime.value = now;
      this.pearlMat.uniforms.uTint.value.copy(p.holder >= 0 ? this.teamTint[p.holder] : this.white).lerp(this.white, 1 - p.prog);
      this.pearlMat.uniforms.uGlow.value = 1 + (p.phase === 'up' ? p.prog * 0.4 : 0);
    }
    const beamA = p.phase === 'warn' ? 0.55 : p.phase === 'up' ? 0.12 : 0;
    this.beamMat.uniforms.uAlpha.value += (beamA - this.beamMat.uniforms.uAlpha.value) * Math.min(1, dt * 3);
    this.beam.visible = this.beamMat.uniforms.uAlpha.value > 0.01;
    if (this.beam.visible) { this.beam.position.set(p.x * S, 0, p.y * S); this.beamMat.uniforms.uTime.value = now; }
  }
}
