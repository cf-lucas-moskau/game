// Visuals for every simulated unit. Reads world state, never writes it.
import * as THREE from 'three';
import { S, TEAM_COLORS, TEAM_RGB, WHITE_RGB } from './palette.js';
import { KIND, isMinion } from '../sim/constants.js';
import { HERO_LOOKS, MINION_LOOKS, STRUCTURE_LOOKS, CLIPS } from '../assets/manifest.js';
import { resolveLook } from '../assets/skins.js';
import { bakeVAT, vatMaterial } from './vat.js';
import { rx, ry } from './interp.js';
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const lerp = (a, b, t) => a + (b - a) * t;
/** Standard material whose emissive glow follows the per-instance colour (team tint). */
function glowMaterial(base, glow, opts = {}) {
  const m = (base ? base.clone() : new THREE.MeshStandardMaterial({ roughness: 0.2, metalness: 0.1 }));
  Object.assign(m, opts);
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    #if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
      totalEmissiveRadiance += vColor.rgb * ${glow.toFixed(2)};
    #endif`); };
  m.customProgramCacheKey = () => `glow${glow}`;
  return m;
}
// Kenney rigs face +z at rotation 0: rotate so the model looks along the sim facing (cos a, sin a) in x/z.
// (Verified by close-up: at yaw 0 the cap badge / Gus's beard face the camera.)
const faceToRotY = (a) => Math.PI / 2 - a;
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

// ---------------------------------------------------------------- heroes
class HeroView {
  constructor(lib, e, parent, skin) {
    this.look = resolveLook(e.heroKey, skin); this.id = e.id; this.team = e.team;
    this.root = new THREE.Group(); parent.add(this.root);
    this.body = lib.instance(this.look.model, this.look.height); this.root.add(this.body);
    mergeSkinned(this.body);
    if (this.look.variant) applyPaletteVariant(this.body, lib.atlas.variants[this.look.variant]);
    // per-hero material copy: the same hero can appear twice, and hit flashes must stay per unit
    this.skin = []; this.body.traverse((o) => { if (o.isSkinnedMesh) { o.material = o.material.clone(); this.skin.push(o.material); } });
    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = {};
    for (const [k, name] of Object.entries(CLIPS)) { const c = lib.clip(this.look.model, name); if (c) this.actions[k] = this.mixer.clipAction(c); }
    for (const k of ['attack', 'shoot', 'cast', 'emote']) if (this.actions[k]) { this.actions[k].setLoop(THREE.LoopOnce); this.actions[k].clampWhenFinished = false; }
    if (this.actions.die) { this.actions.die.setLoop(THREE.LoopOnce); this.actions.die.clampWhenFinished = true; }
    this.current = null; this.play('idle');
    this.oneShotUntil = 0; this.lastYaw = 0;
    // held props on bones, fitted in the idle pose (the pose players see most; arms hang out ~45 deg from rest)
    if (this.current) { this.current.stopFading(); this.current.setEffectiveWeight(1); } // play() fades in from 0: apply idle fully now
    this.mixer.update(0); this.body.updateMatrixWorld(true);
    this.glows = [];
    for (const p of this.look.props || []) {
      let bone = null; this.body.traverse((o) => { if (!bone && o.name === p.bone) bone = o; });
      if (!bone) continue;
      const prop = lib.instance(p.key, p.size);
      // bones are scaled with the rig; compensate so props keep their authored size
      const ws = new THREE.Vector3(); bone.getWorldScale(ws); prop.scale.divide(ws).multiplyScalar(this.body.scale.x || 1);
      bone.add(prop);
      if (p.hold) holdInHand(this.body, bone, prop, p);
      else if (p.on === 'top') sitOnTop(this.body, bone, prop, p);
      else { prop.position.fromArray(p.pos); prop.rotation.set(...p.rot); }
      // glow anchor: the renderer's fixed light pool lights the nearest ones (glow-lights.js)
      if (p.glow) { const a = new THREE.Object3D(); prop.add(a); a.position.y = 0.6; this.glows.push({ anchor: a, color: new THREE.Color(p.glow), phase: this.id, active: false, x: 0, y: 0, z: 0, d: 0 }); }
      bakeProp(this.body, bone, prop);
    }
    if (this.look.pebble) { this.mount = buildPebble(lib, this.look.pebble, 1.0, this.look); this.root.add(this.mount); this.mount.visible = false; }
    this.flash = 0; this.forced = null; this.forcedTime = null;
  }
  play(k, fade = 0.15) {
    const a = this.actions[k] || this.actions.idle; if (!a || this.current === a) return;
    a.reset().fadeIn(fade).play(); if (this.current) this.current.fadeOut(fade); this.current = a; this.currentKey = k;
  }
  /** Lab control: force clip `k` (null releases it); `time` freezes it at that many seconds, otherwise it loops. */
  force(k, time = null) {
    if (this.forced && this.forced !== k && this.actions[this.forced]) this.loopModes(this.forced);
    this.forced = k; this.forcedTime = time; if (!k) { this.current = null; this.currentKey = null; this.play('idle'); }
  }
  applyForced() {
    const a = this.actions[this.forced]; if (!a) return;
    if (this.current !== a) { if (this.current) this.current.stop(); a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.play(); this.current = a; this.currentKey = this.forced; }
    if (this.forcedTime !== null) { a.paused = false; a.time = this.forcedTime % a.getClip().duration; a.paused = true; } else a.paused = false;
  }
  loopModes(k) {
    const a = this.actions[k]; if (!a) return;
    if (k === 'die') { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
    else if (['attack', 'shoot', 'cast', 'emote'].includes(k)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; }
    a.paused = false;
  }
  oneShot(k, now, speed = 1) {
    const a = this.actions[k]; if (!a) return;
    if (this.current && this.current !== a) this.current.fadeOut(0.08);
    a.reset(); a.timeScale = speed; a.fadeIn(0.05).play(); this.current = a; this.currentKey = k;
    this.oneShotUntil = now + (a.getClip().duration / speed) * 0.9;
  }
  update(e, alpha, dt, now, world) {
    const x = rx(e) * S, z = ry(e) * S;
    this.root.position.set(x, 0, z);
    let yaw = faceToRotY(e.facing), d = yaw - this.lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.lastYaw += d * Math.min(1, dt * 16); this.root.rotation.y = this.lastYaw;
    const mounted = e.heroKey === 'gus' && e.heroState.mounted;
    if (this.mount) { this.mount.visible = mounted && !e.dead; this.body.position.y = mounted ? 0.78 : 0; if (mounted) animatePebble(this.mount, e, now); }
    const air = e.airborneUntil > world.tick ? Math.sin(Math.min(1, (e.airborneUntil - world.tick) / 20) * Math.PI) * 0.8 : 0;
    this.root.position.y = air + (e.dashFx === 'gus-leap' && e.dashUntil > world.tick ? 2 : 0);
    if (this.forced) this.applyForced(); // lab: a chosen clip, looping or frozen at a time
    else if (e.dead) { if (this.currentKey !== 'die') this.play('die', 0.1); }
    else if (now >= this.oneShotUntil || this.currentKey === 'die') {
      if (e.moving || e.dashUntil > world.tick) this.play(mounted ? 'idle' : (e.hasteUntil > world.tick ? 'run' : 'walk'));
      else this.play('idle');
    }
    this.root.visible = !(e.dead && world.tick > e.respawnAt - 1);
    for (let i = 0; i < this.glows.length; i++) this.glows[i].active = this.root.visible && !e.dead;
    this.mixer.update(dt);
    const fl = this.fx ? (this.fx.flash.get(this.id) || 0) : 0;
    if (fl !== this.lastFlash) { for (const m of this.skin) m.emissive.setRGB(fl * 0.9, fl * 0.8, fl * 0.75); this.lastFlash = fl; }
  }
  dispose() { this.root.removeFromParent(); }
}

/** Merge sibling skinned meshes (same bones + texture) into one draw call, remapping skin indices. */
function mergeSkinned(root) {
  const skinned = []; root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  if (skinned.length < 2) return;
  const base = skinned[0], bones = base.skeleton.bones, map = base.material.map;
  const geos = [];
  for (const m of skinned) {
    if ((m.material.map || null) !== (map || null)) return;
    const remap = m.skeleton.bones.map((bn) => bones.indexOf(bn));
    if (remap.includes(-1)) return;
    const g = new THREE.BufferGeometry(), src = m.geometry;
    const src2 = src.index ? src.toNonIndexed() : src;
    for (const n of ['position', 'normal', 'uv', 'skinWeight']) {
      const a = src2.attributes[n]; const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize));
    }
    const si = src2.attributes.skinIndex, u = new Uint16Array(si.count * 4);
    for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) u[i * 4 + c] = remap[si.getComponent(i, c)];
    g.setAttribute('skinIndex', new THREE.BufferAttribute(u, 4));
    // re-bind into the base mesh: per vertex, via its dominant bone,
    // p' = baseBind^-1 * baseInv_k^-1 * ownInv_k * ownBind * p  (exact for rigidly bound parts like heads)
    if (m !== base) {
      const P = g.attributes.position, N = g.attributes.normal, W = g.attributes.skinWeight, cache = new Map();
      const v = new THREE.Vector3(), nm = new THREE.Matrix3();
      for (let i = 0; i < P.count; i++) {
        let bi = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = W.getComponent(i, c); if (w > bw) { bw = w; bi = c; } }
        const own = si.getComponent(i, bi);
        let M = cache.get(own);
        if (!M) { const k = remap[own]; M = new THREE.Matrix4().copy(base.bindMatrixInverse).multiply(new THREE.Matrix4().copy(base.skeleton.boneInverses[k]).invert()).multiply(m.skeleton.boneInverses[own]).multiply(m.bindMatrix); cache.set(own, M); }
        v.fromBufferAttribute(P, i).applyMatrix4(M); P.setXYZ(i, v.x, v.y, v.z);
        nm.getNormalMatrix(M); v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); N.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geos.push(g);
  }
  const merged = BGU.mergeGeometries(geos, false); if (!merged) return;
  merged.computeBoundingSphere();
  base.geometry = merged;
  for (let i = 1; i < skinned.length; i++) skinned[i].removeFromParent();
}
/**
 * Point the body's UVs at a skin's recoloured palette cell (atlas.js). Runs before props are baked in,
 * so only the character's own vertices move; each hero view owns its geometry (merged or copied here).
 */
function applyPaletteVariant(body, v) {
  if (!v) return;
  body.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    if (!o.geometry.userData.flat) { o.geometry = flatSkinned(o.geometry); o.geometry.userData.flat = true; }
    const uv = o.geometry.attributes.uv, a = uv.array, e = 1e-4;
    const u0 = v.u0 - e, v0 = v.v0 - e, u1 = v.u0 + v.size + e, v1 = v.v0 + v.size + e;
    for (let i = 0; i < a.length; i += 2) if (a[i] >= u0 && a[i] <= u1 && a[i + 1] >= v0 && a[i + 1] <= v1) { a[i] += v.du; a[i + 1] += v.dv; }
    uv.needsUpdate = true;
  });
}
/**
 * Put a prop in the fist at the end of an arm bone: the grip is the centre of the arm's farthest
 * vertices from the joint (found on the mesh, so any rig works), and the prop is oriented in the
 * hero's own frame (upright, tilted forward by p.tilt, rolled outward by p.roll), then slid down its
 * own axis by p.grip x its height so the fist closes around the handle.
 */
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
function holdInHand(body, bone, prop, p) {
  let base = null; body.traverse((o) => { if (!base && o.isSkinnedMesh) base = o; });
  body.updateMatrixWorld(true);
  const k = base.skeleton.bones.indexOf(bone), g = base.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const toBone = new THREE.Matrix4().copy(bone.matrixWorld).invert(), pts = []; let far = 0;
  for (let i = 0; i < g.attributes.position.count; i++) {
    let bi = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > bw) { bw = w; bi = SI.getComponent(i, c); } }
    if (bi !== k) continue;
    base.getVertexPosition(i, _v); _v.applyMatrix4(base.matrixWorld).applyMatrix4(toBone);
    const d = _v.length(); pts.push(_v.clone()); if (d > far) far = d;
  }
  const grip = new THREE.Vector3(); let n = 0;
  for (const q of pts) if (q.length() > far * 0.85) { grip.add(q); n++; }
  if (n) grip.divideScalar(n);
  // orientation: hero frame (body root) * tilt/roll, expressed in the bone's frame
  (body.parent || body).getWorldQuaternion(_q); bone.getWorldQuaternion(_q2); // the hero root: upright, facing +z
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((p.tilt ?? 0.3) + (p.flip ? Math.PI : 0), 0, p.roll ?? 0)); // flip: art authored head-down
  prop.quaternion.copy(_q2.invert()).multiply(_q).multiply(tilt);
  // slide down the prop's own up axis so the handle, not its foot, sits in the fist
  prop.updateMatrix(); const box = new THREE.Box3().setFromObject(prop.children[0] || prop, true);
  const hgt = (box.max.y - box.min.y) || p.size;
  _w.set(0, -hgt * (p.grip ?? 0.2), 0).applyQuaternion(prop.quaternion);
  prop.position.copy(grip).add(_w);
}
/** Stand a prop upright on the highest point of the mesh a bone carries (a candle on a head). */
function sitOnTop(body, bone, prop, p) {
  let base = null; body.traverse((o) => { if (!base && o.isSkinnedMesh) base = o; });
  body.updateMatrixWorld(true);
  const k = base.skeleton.bones.indexOf(bone), g = base.geometry, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  let top = -Infinity; const tip = new THREE.Vector3(), sum = new THREE.Vector3(); let n = 0;
  const pts = [];
  for (let i = 0; i < g.attributes.position.count; i++) {
    let bi = 0, bw = -1; for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > bw) { bw = w; bi = SI.getComponent(i, c); } }
    if (bi !== k) continue;
    base.getVertexPosition(i, _v); _v.applyMatrix4(base.matrixWorld); pts.push(_v.clone()); if (_v.y > top) top = _v.y;
  }
  for (const q of pts) if (q.y > top - 0.03) { sum.add(q); n++; }
  if (n) tip.copy(sum.divideScalar(n)); tip.y = top + (p.lift || 0);
  tip.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert());
  (body.parent || body).getWorldQuaternion(_q); bone.getWorldQuaternion(_q2);
  prop.quaternion.copy(_q2.invert()).multiply(_q); prop.position.copy(tip);
}
/** Flat, non-indexed skinned geometry (Float32 attributes, Uint16 skin indices) so parts can be merged. */
function flatSkinned(src) {
  const g = new THREE.BufferGeometry(), s2 = src.index ? src.toNonIndexed() : src;
  for (const n of ['position', 'normal', 'uv', 'skinWeight']) {
    const a = s2.attributes[n]; const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(n, new THREE.BufferAttribute(f, a.itemSize));
  }
  const si = s2.attributes.skinIndex, u = new Uint16Array(si.count * 4);
  for (let i = 0; i < si.count * 4; i++) u[i] = si.getComponent(i >> 2, i & 3);
  g.setAttribute('skinIndex', new THREE.BufferAttribute(u, 4));
  return g;
}
/**
 * Bake a held prop into the hero's skinned mesh, rigidly bound to its hand bone (one draw per hero
 * instead of two). Only when both share the atlas texture. With attached binding the shader computes
 * world = boneWorld * boneInverse * bindMatrix * v, so v = bindMatrix^-1 * boneInverse^-1 * L * p,
 * where L is the prop mesh relative to the bone, gives exactly the old parented placement.
 */
function bakeProp(body, bone, prop) {
  let base = null; body.traverse((o) => { if (!base && o.isSkinnedMesh) base = o; });
  if (!base || !base.material.map) return;
  const k = base.skeleton.bones.indexOf(bone); if (k < 0) return;
  const meshes = []; prop.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && o.material.map === base.material.map) meshes.push(o); });
  if (!meshes.length) return;
  body.updateMatrixWorld(true);
  const toBind = new THREE.Matrix4().copy(base.bindMatrix).invert().multiply(new THREE.Matrix4().copy(base.skeleton.boneInverses[k]).invert());
  const boneInv = new THREE.Matrix4().copy(bone.matrixWorld).invert();
  const geos = [base.geometry.userData.flat ? base.geometry : flatSkinned(base.geometry)];
  const t = new THREE.Vector3();
  for (const m of meshes) {
    const M = new THREE.Matrix4().copy(toBind).multiply(boneInv).multiply(m.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(M);
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, n = src.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      t.fromBufferAttribute(src.attributes.position, i).applyMatrix4(M); P.set([t.x, t.y, t.z], i * 3);
      t.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(nm).normalize(); N.set([t.x, t.y, t.z], i * 3);
      UV[i * 2] = src.attributes.uv.getX(i); UV[i * 2 + 1] = src.attributes.uv.getY(i);
      SI[i * 4] = k; SW[i * 4] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
    geos.push(g); m.visible = false; // the prop's own mesh stays as an anchor (glow lights) but is not drawn
  }
  const merged = BGU.mergeGeometries(geos, false); if (!merged) { for (const m of meshes) m.visible = true; return; }
  merged.userData.flat = true; merged.computeBoundingSphere(); base.geometry = merged;
}
const STONE = new THREE.MeshStandardMaterial({ color: '#a39580', roughness: 0.95, flatShading: true });
const PEBBLE_EYES = new THREE.MeshBasicMaterial({ color: '#8ff4ff' });
const pebbleMats = new Map(); // skin tint -> [stone, eyes], shared by every Pebble wearing it
function pebbleMaterials(tint, eyes) {
  if (!tint && !eyes) return [STONE, PEBBLE_EYES];
  const k = `${tint}|${eyes}`; let m = pebbleMats.get(k);
  if (!m) { const st = STONE.clone(); if (tint) st.color.set(tint); const ey = PEBBLE_EYES.clone(); if (eyes) ey.color.set(eyes); m = [st, ey]; pebbleMats.set(k, m); }
  return m;
}
/**
 * Pebble the rock golem: boulder torso, rock head with glowing eyes, two boulder fists.
 * The rigid parts are merged into one skinned mesh with a bone each (one draw instead of five);
 * the eyes ride the head bone. Bones animate exactly like the separate parts used to.
 */
function buildPebble(lib, keys, height, look = null) {
  const [stone, eyeMat] = pebbleMaterials(look && look.pebbleTint, look && look.pebbleEyes);
  const g = new THREE.Group();
  const layout = [
    { key: keys[0], h: height * 0.72, pos: [0, 0, 0], scale: [1.2, 1, 1.05] },
    { key: keys[2], h: height * 0.36, pos: [0, 0.82, 0.12] }, // head height as players know it (the old bob animation held it at 0.82)
    { key: keys[1], h: height * 0.4, pos: [0.62, height * 0.12, 0.1] },
    { key: keys[1], h: height * 0.4, pos: [-0.62, height * 0.12, 0.1] },
  ];
  const bones = layout.map((p) => { const b = new THREE.Bone(); b.position.fromArray(p.pos); return b; });
  const root = new THREE.Bone(); for (const b of bones) root.add(b);
  const geos = [], v = new THREE.Matrix4();
  layout.forEach((p, bi) => {
    const part = lib.instance(p.key, p.h); if (p.scale) part.scale.multiply(new THREE.Vector3().fromArray(p.scale));
    part.updateMatrixWorld(true);
    part.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      // part space (bone-local: the bone sits at the part's origin), then the bone's rest offset into mesh space
      v.copy(o.matrixWorld).premultiply(new THREE.Matrix4().makeTranslation(...p.pos));
      const nm = new THREE.Matrix3().getNormalMatrix(v), sp = src.attributes.position, sn = src.attributes.normal, t = new THREE.Vector3();
      const P = new THREE.BufferAttribute(new Float32Array(sp.count * 3), 3), N = new THREE.BufferAttribute(new Float32Array(sp.count * 3), 3);
      for (let i = 0; i < sp.count; i++) {
        t.fromBufferAttribute(sp, i).applyMatrix4(v); P.setXYZ(i, t.x, t.y, t.z); // fromBufferAttribute dequantizes
        t.fromBufferAttribute(sn, i).applyMatrix3(nm).normalize(); N.setXYZ(i, t.x, t.y, t.z);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', P); geo.setAttribute('normal', N);
      const si = new Uint16Array(P.count * 4), sw = new Float32Array(P.count * 4);
      for (let i = 0; i < P.count; i++) { si[i * 4] = bi + 1; sw[i * 4] = 1; } // bone 0 is the root
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      geos.push(geo);
    });
  });
  const mesh = new THREE.SkinnedMesh(BGU.mergeGeometries(geos, false), stone);
  mesh.castShadow = true; mesh.frustumCulled = false;
  mesh.add(root); mesh.bind(new THREE.Skeleton([root, ...bones]));
  g.add(mesh);
  const [, head, armL, armR] = bones;
  // eyes sit on the head bone (their own glowing material: one extra draw)
  const eyes = new THREE.Mesh(BGU.mergeGeometries([-1, 1].map((sx) => new THREE.SphereGeometry(0.055, 8, 6).translate(sx * 0.11, height * 0.82 - 0.82, 0.24))), eyeMat);
  head.add(eyes);
  g.userData = { head, armL, armR, eyes, headY: head.position.y };
  return g;
}
function animatePebble(g, e, now) {
  const u = g.userData, k = e.moving ? 1 : 0.2;
  u.armL.rotation.x = Math.sin(now * 7) * 0.5 * k; u.armR.rotation.x = -Math.sin(now * 7) * 0.5 * k;
  const bob = Math.abs(Math.sin(now * 7)) * 0.05 * k; u.head.position.y = u.headY + bob;
  g.rotation.x = e.dashFx === 'pebble-roll' ? now * 12 : 0;
}

// ---------------------------------------------------------------- instanced minions (VAT)
class MinionBatch {
  constructor(lib, look, team, cap, parent) {
    this.static = !!look.static; this.cap = cap; this.count = 0;
    if (this.static) {
      const { geometry, material } = lib.merged(look.model, look.height);
      this.mesh = new THREE.InstancedMesh(geometry, material.clone(), cap);
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    } else {
      this.vat = bakeVAT(lib.gltf[look.model], [CLIPS.idle, CLIPS.walk, CLIPS.attack, CLIPS.shoot, CLIPS.die], look.height);
      const geo = new THREE.InstancedBufferGeometry().copy(this.vat.geometry);
      this.iFrame = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.iFrame.setUsage(THREE.DynamicDrawUsage);
      this.iTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.iTint.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iFrame', this.iFrame); geo.setAttribute('iTint', this.iTint);
      this.mesh = new THREE.InstancedMesh(geo, vatMaterial(this.vat.material, this.vat), cap);
    }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.castShadow = true;
    this.mesh.count = 0; this.team = team; parent.add(this.mesh);
  }
  begin() { this.count = 0; }
  /** clip: 'idle'|'walk'|'attack'|'shoot'|'die'; t: seconds into clip; loop */
  push(x, z, yaw, clip, t, loop, tint, flash, sink = 0) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    tmpObj.position.set(x, -sink, z); tmpObj.rotation.set(0, yaw, 0); tmpObj.scale.setScalar(1); tmpObj.updateMatrix();
    this.mesh.setMatrixAt(i, tmpObj.matrix);
    if (this.static) { tmpColor.copy(tint).lerp(WHITE_RGB, 0.5 + flash * 0.5); this.mesh.setColorAt(i, tmpColor); return; }
    const c = this.vat.clips[CLIPS[clip]] || this.vat.clips[CLIPS.idle];
    let f = (t / c.duration) * c.frames; f = loop ? f % c.frames : Math.min(c.frames - 1.001, f);
    const a = Math.floor(f), b = loop ? (a + 1) % c.frames : Math.min(c.frames - 1, a + 1);
    this.iFrame.setXYZ(i, c.start + a, c.start + b, f - a);
    this.iTint.setXYZW(i, tint.r, tint.g, tint.b, 0.12 + flash * 0.6);
  }
  end() {
    this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.static) { if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
    else { this.iFrame.needsUpdate = true; this.iTint.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- structures
class StructureViews {
  constructor(lib, world, parent) {
    this.towers = world.structures.filter((s) => s.kind === KIND.TOWER);
    this.hearts = world.structures.filter((s) => s.kind === KIND.HEART);
    const tl = STRUCTURE_LOOKS.tower;
    // stonework (base + mids) is merged into one geometry: one draw for all towers; roofs carry team colour
    const stackH = [1.9, 0.75, 0.75, 1.25];
    const stone = [], y0 = []; let y = 0; let stoneMat = null;
    tl.parts.forEach((k, i) => { y0.push(y); y += stackH[i] * (i === 0 ? 0.97 : 0.93); });
    for (let i = 0; i < tl.parts.length - 1; i++) { const { geometry, material } = lib.merged(tl.parts[i], stackH[i]); stone.push(geometry.clone().translate(0, y0[i], 0)); stoneMat = stoneMat || material; }
    const roofG = lib.merged(tl.parts[tl.parts.length - 1], stackH[stackH.length - 1]).geometry.clone().translate(0, y0[y0.length - 1], 0);
    const stoneMesh = new THREE.InstancedMesh(BGU.mergeGeometries(stone), stoneMat, this.towers.length); stoneMesh.castShadow = stoneMesh.receiveShadow = true;
    const roof = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, flatShading: true }), this.towers.length); roof.castShadow = true;
    roof.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.towers.length * 3), 3); this.roof = roof;
    parent.add(stoneMesh); parent.add(roof);
    this.parts = [{ mesh: stoneMesh, y: 0 }, { mesh: roof, y: 0 }];
    this.towerTop = y;
    const cr = lib.merged(tl.crystal, 0.9);
    this.crystals = new THREE.InstancedMesh(cr.geometry, glowMaterial(null, 0.75, { flatShading: true }), this.towers.length);
    this.crystals.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.towers.length * 3), 3); parent.add(this.crystals);
    const h = lib.merged(STRUCTURE_LOOKS.heart.model, STRUCTURE_LOOKS.heart.height);
    this.heartMat = glowMaterial(null, 0.55, { flatShading: true, roughness: 0.15, metalness: 0.25 });
    this.heartMesh = new THREE.InstancedMesh(h.geometry, this.heartMat, this.hearts.length);
    this.heartMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.hearts.length * 3), 3); parent.add(this.heartMesh);
    // team banners on each tower
    const fl = lib.merged(STRUCTURE_LOOKS.banner, 1.3);
    this.flags = new THREE.InstancedMesh(fl.geometry, fl.material.clone(), this.towers.length);
    this.flags.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.towers.length * 3), 3); parent.add(this.flags);
    this.collapse = new Float32Array(world.structures.length);
    this.hitFlash = new Map();
  }
  update(world, dt, now) {
    this.towers.forEach((t, i) => {
      const dead = !t.alive; const k = this.collapse[i] = dead ? Math.min(1, this.collapse[i] + dt * 0.8) : 0;
      const col = TEAM_RGB[t.team];
      for (const p of this.parts) {
        tmpObj.position.set(t.x * S, -k * 1.2, t.y * S); tmpObj.rotation.set(k * 0.3, t.team ? Math.PI : 0, k * 0.2); tmpObj.scale.set(1, 1 - k * 0.6, 1); tmpObj.updateMatrix();
        p.mesh.setMatrixAt(i, tmpObj.matrix);
      }
      this.roof.setColorAt(i, tmpColor.copy(col).multiplyScalar(0.85));
      const fl = this.hitFlash.get(t.id) || 0;
      tmpObj.position.set(t.x * S, this.towerTop + 0.4 + Math.sin(now * 2 + i) * 0.12 - k * 4, t.y * S); tmpObj.rotation.set(0, now * 0.8, 0); tmpObj.scale.setScalar(dead ? 0.001 : 1 + fl * 0.3); tmpObj.updateMatrix();
      this.crystals.setMatrixAt(i, tmpObj.matrix); this.crystals.setColorAt(i, tmpColor.copy(col).multiplyScalar(t.vulnerable ? 1 : 0.35));
      tmpObj.position.set(t.x * S + (t.team ? -0.95 : 0.95), 0.6 - k * 2, t.y * S + 0.2); tmpObj.rotation.set(0, t.team ? Math.PI / 2 : -Math.PI / 2, 0); tmpObj.scale.setScalar(dead ? 0.001 : 1); tmpObj.updateMatrix();
      this.flags.setMatrixAt(i, tmpObj.matrix); this.flags.setColorAt(i, col);
      if (fl) this.hitFlash.set(t.id, Math.max(0, fl - dt * 4));
    });
    this.hearts.forEach((h, i) => {
      const dead = !h.alive; const r = h.hp / h.maxHp;
      tmpObj.position.set(h.x * S, 0.4 + Math.sin(now * 1.3 + i) * 0.15 - (dead ? 3 : 0), h.y * S);
      tmpObj.rotation.set(0, now * 0.4 * (i ? -1 : 1), 0); const hs = dead ? 0.001 : 1 + (this.hitFlash.get(h.id) || 0) * 0.08; tmpObj.scale.set(hs * 0.6, hs, hs * 0.6); tmpObj.updateMatrix();
      this.heartMesh.setMatrixAt(i, tmpObj.matrix);
      const pulse = h.vulnerable ? 0.6 + 0.4 * Math.sin(now * (4 + (1 - r) * 10)) : 0.8;
      this.heartMesh.setColorAt(i, tmpColor.copy(TEAM_RGB[h.team]).multiplyScalar(pulse));
      const fl = this.hitFlash.get(h.id) || 0; if (fl) this.hitFlash.set(h.id, Math.max(0, fl - dt * 4));
    });
    if (!this.allMeshes) this.allMeshes = [...this.parts.map((p) => p.mesh), this.crystals, this.flags, this.heartMesh];
    for (const m of this.allMeshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  flash(id) { this.hitFlash.set(id, 1); }
}

// ---------------------------------------------------------------- bees
class BeeSwarm {
  constructor(lib, key, parent, cap = 60) {
    const { geometry, material } = lib.merged(key, 0.28);
    this.mesh = new THREE.InstancedMesh(geometry, material, cap); this.mesh.count = 0; this.cap = cap; parent.add(this.mesh);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false;
  }
  update(world, alpha, now) {
    let n = 0;
    for (const h of world.heroes) {
      if (h.heroKey !== 'brindle' || h.dead) continue;
      const x = rx(h) * S, z = ry(h) * S;
      for (let i = 0; i < h.resource && n < this.cap; i++) {
        const a = now * (1.8 + (i % 3) * 0.4) + i * 2.399, r = 0.55 + (i % 4) * 0.13;
        tmpObj.position.set(x + Math.cos(a) * r, 0.9 + Math.sin(now * 5 + i) * 0.18 + (i % 3) * 0.2, z + Math.sin(a) * r);
        tmpObj.rotation.set(0, -a, 0); tmpObj.scale.setScalar(1); tmpObj.updateMatrix(); this.mesh.setMatrixAt(n++, tmpObj.matrix);
      }
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- manager
const BATCH_KEYS = [0, 1].map((t) => ({ [KIND.MELEE]: `${t}:melee`, [KIND.RANGED]: `${t}:ranged`, [KIND.SIEGE]: `${t}:siege` }));
export class UnitRenderer {
  constructor(lib, world, parent) {
    this.lib = lib; this.parent = parent; this.heroViews = new Map(); this.pebbleViews = new Map(); this.glowAnchors = [];
    this.skins = new Map(); // playerId -> skin key (presentation only; the roster carries it, the sim never does)
    this.batches = {};
    for (const team of [0, 1]) for (const kind of ['melee', 'ranged', 'siege']) this.batches[`${team}:${kind}`] = new MinionBatch(lib, MINION_LOOKS[team][kind], team, 48, parent);
    this.structures = new StructureViews(lib, world, parent);
    this.bees = new BeeSwarm(lib, HERO_LOOKS.brindle.bees, parent);
    this.anim = new Map();  // entity id -> {clip, start, kind, team}
    this.corpses = [];      // dying minions kept visible while the die clip plays
    this.flashes = new Map();
  }
  batchFor(team, kind) { return this.batches[BATCH_KEYS[team][kind]]; }
  kindName(k) { return k === KIND.MELEE ? 'melee' : k === KIND.RANGED ? 'ranged' : 'siege'; }
  onEvent(e, world, now) {
    // called by the renderer for each sim event before update
    if (e.type === 22) { const a = this.anim.get(e.a); if (a) { a.clip = world.entities[e.a].projectileSpeed > 0 ? 'shoot' : 'attack'; a.start = now; } const hv = this.heroViews.get(e.a); if (hv) hv.oneShot(HERO_LOOKS[world.entities[e.a].heroKey].attack, now, Math.max(1, world.entities[e.a].as * 1.2)); }
    else if (e.type === 4) { const hv = this.heroViews.get(e.a); if (hv) hv.oneShot('cast', now, 1.8); }
    else if (e.type === 1) { this.flashes.set(e.a, 1); const t = world.entities[e.a]; if (t && (t.kind === KIND.TOWER || t.kind === KIND.HEART)) this.structures.flash(t.id); }
    else if (e.type === 3) {
      const v = world.entities[e.a];
      if (v && isMinion(v.kind)) this.corpses.push({ x: v.x * S, z: v.y * S, yaw: faceToRotY(v.facing), team: v.team, key: `${v.team}:${this.kindName(v.kind)}`, start: now });
    }
  }
  skinOf(e) { return this.skins.get(e.playerId); }
  update(world, alpha, dt, now) {
    this.world = world;
    if (!this.batchList) this.batchList = Object.values(this.batches);
    for (const b of this.batchList) b.begin();
    const es = world.entities;
    for (let i = 0; i < es.length; i++) {
      const e = es[i];
      if (e.kind === KIND.HERO) {
        let v = this.heroViews.get(e.id); if (!v) { v = new HeroView(this.lib, e, this.parent, this.skinOf(e)); this.heroViews.set(e.id, v); this.glowAnchors.push(...v.glows); }
        v.fx = this.fx;
        v.update(e, alpha, dt, now, world); continue;
      }
      if (e.kind === KIND.PEBBLE) {
        let v = this.pebbleViews.get(e.id);
        if (e.alive && !v) { const o = world.entities[e.ownerId], look = resolveLook('gus', o ? this.skinOf(o) : undefined); v = buildPebble(this.lib, look.pebble, 1.15, look); this.parent.add(v); this.pebbleViews.set(e.id, v); }
        if (v) { v.visible = e.alive; if (e.alive) { v.position.set(rx(e) * S, 0, ry(e) * S); v.rotation.y = faceToRotY(e.facing); animatePebble(v, e, now); } }
        continue;
      }
      if (!e.alive || !isMinion(e.kind)) continue;
      let a = this.anim.get(e.id);
      if (!a || a.born !== e.bornTick) { a = { clip: 'walk', start: now, born: e.bornTick }; this.anim.set(e.id, a); }
      const moving = Math.abs(e.x - e.px) + Math.abs(e.y - e.py) > 0.5;
      let clip = moving ? 'walk' : 'idle';
      if ((a.clip === 'attack' || a.clip === 'shoot') && now - a.start < 0.6) clip = a.clip; else a.clip = clip;
      const fl = this.flashes.get(e.id) || 0; if (fl) this.flashes.set(e.id, Math.max(0, fl - dt * 6));
      const t = clip === a.clip && (clip === 'attack' || clip === 'shoot') ? now - a.start : now + e.id * 0.37;
      this.batchFor(e.team, e.kind).push(rx(e) * S, ry(e) * S, faceToRotY(e.facing), clip, t, clip === 'walk' || clip === 'idle', TEAM_RGB[e.team], fl);
    }
    // corpses: play die clip, then sink into the whale
    let w = 0;
    for (const c of this.corpses) {
      const age = now - c.start; if (age > 2.2) continue; this.corpses[w++] = c;
      this.batches[c.key].push(c.x, c.z, c.yaw, 'die', age, false, TEAM_RGB[c.team], 0, Math.max(0, age - 1.3) * 0.8);
    }
    this.corpses.length = w;
    for (const b of this.batchList) b.end();
    if (this.pebbleViews.size) this.pebbleViews.forEach(this._prunePebble || (this._prunePebble = (v, id) => { const x = this.world.entities[id]; if (!x || !x.alive || x.kind !== KIND.PEBBLE) { v.removeFromParent(); this.pebbleViews.delete(id); } }));
    this.structures.update(world, dt, now);
    this.bees.update(world, alpha, now);
  }
}
