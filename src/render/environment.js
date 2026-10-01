// The world around the lane: sky, cloud sea, drifting clouds, the living sky-whale, lane surface
// and scenery. All procedural except scenery models from the manifest.
import * as THREE from 'three';
import { S, PALETTE } from './palette.js';
import { LANE, MAP, TEAM, sideX } from '../sim/constants.js';
import { SCENERY } from '../assets/manifest.js';

const NOISE = /* glsl */`
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }`;

// Whale body shape, shared by mesh generation and scenery placement.
// The whale grows with the lane: tail 16 units behind the blue end, head 12 beyond the red end.
const LW = LANE.W * S, X0 = -16, X1 = LW + 12, SUPER = 3.2;
export function whaleProfile(x) {
  const t = (x - X0) / (X1 - X0);
  const body = Math.sin(Math.min(1, t * 1.06) * Math.PI * 0.94 + 0.12) ** 0.55;
  return { w: 1.2 + 6.4 * body, h: 1 + 9.5 * body * (0.6 + 0.4 * t) };
}
/** Height of the whale's back at (x, z) in render units (0 on the lane centre line). */
export function whaleTopY(x, z) {
  const { w, h } = whaleProfile(x), cz = LANE.H * S / 2;
  const q = Math.min(1, Math.abs(z - cz) / w);
  const c = q ** (SUPER / 2); const sv = Math.sqrt(Math.max(0, 1 - c * c));
  return -h + h * sv ** (2 / SUPER) - 0.02;
}

export class Environment {
  constructor(scene, assets, quality) {
    this.scene = scene; this.assets = assets; this.quality = quality;
    // pivot sits on the lane's long axis; `root` holds everything that tilts with the whale roll
    this.pivot = new THREE.Group(); this.pivot.position.z = LANE.H * S / 2; scene.add(this.pivot);
    this.root = new THREE.Group(); this.root.position.z = -LANE.H * S / 2; this.pivot.add(this.root);
    this.uniforms = { uTime: { value: 0 }, uWarn: { value: 0 }, uRollDir: { value: 0 }, uSudden: { value: 0 }, uSun: { value: new THREE.Vector3(-0.55, 0.32, -0.77).normalize() } };
    this.buildSky(); this.buildCloudSea(); this.buildClouds(); this.buildWhale(); this.buildLane(); this.buildScenery(); this.buildLights();
    this.tilt = 0;
  }
  buildLights() {
    const hemi = new THREE.HemisphereLight('#8fa6ff', '#3a2448', 0.9); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffc98f', 3.1); sun.position.copy(this.uniforms.uSun.value).multiplyScalar(40);
    sun.castShadow = this.quality.shadows;
    if (sun.castShadow) { sun.shadow.mapSize.set(2048, 2048); const c = sun.shadow.camera; c.left = -14; c.right = 14; c.top = 12; c.bottom = -12; c.near = 1; c.far = 90; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; }
    this.sun = sun; this.scene.add(sun); this.scene.add(sun.target);
    // (a cool rim light was removed: a third light re-uploads per material every frame for little visual gain;
    //  the hemisphere's cool sky term carries the same role)
  }
  buildSky() {
    const g = new THREE.SphereGeometry(600, 32, 16);
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { ...this.uniforms,
      cTop: { value: new THREE.Color(PALETTE.abyss) }, cMid: { value: new THREE.Color(PALETTE.plum) }, cHor: { value: new THREE.Color(PALETTE.dusk) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
      fragmentShader: `${NOISE} uniform vec3 cTop,cMid,cHor,uSun; uniform float uTime, uSudden; varying vec3 vDir;
        void main(){ float h = vDir.y;
          vec3 c = mix(cHor, cMid, smoothstep(-0.05, 0.25, h)); c = mix(c, cTop, smoothstep(0.2, 0.75, h));
          c = mix(c, cHor*0.85, smoothstep(0.0,-0.3,h));
          float sd = max(dot(vDir, uSun), 0.); c += vec3(1.,.72,.45)*pow(sd, 18.)*0.9 + vec3(1.,.85,.6)*pow(sd, 400.)*3.;
          float st = step(0.985, hash(floor(vDir.xz*420.))) * smoothstep(0.35, 0.8, h) * (0.6+0.4*sin(uTime*2.+hash(floor(vDir.xz*420.))*40.));
          c += st*0.8;
          c = mix(c, c*vec3(1.25,.7,.75), uSudden*0.5);
          gl_FragColor = vec4(c,1.); }` });
    const sky = new THREE.Mesh(g, m); sky.renderOrder = -10; sky.frustumCulled = false; this.scene.add(sky);
  }
  buildCloudSea() {
    const g = new THREE.PlaneGeometry(1400, 1400, 1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({ transparent: false, uniforms: { ...this.uniforms, cHor: { value: new THREE.Color(PALETTE.dusk) }, cLow: { value: new THREE.Color('#8e7fc9') } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${NOISE} uniform float uTime; uniform vec3 cHor, cLow, uSun; varying vec3 vW;
        void main(){ vec2 p = vW.xz*0.02 + vec2(uTime*0.012, uTime*0.004);
          float n = fbm(p) * 0.65 + fbm(p*3.1 - uTime*0.01)*0.35;
          vec3 c = mix(cLow, vec3(1.,.93,.88), smoothstep(0.35, 0.85, n));
          float d = length(vW.xz - cameraPosition.xz);
          c = mix(c, cHor, smoothstep(80., 520., d));
          c += vec3(1.,.7,.4)*0.25*smoothstep(0.6, 1., n)*max(0., -uSun.z);
          gl_FragColor = vec4(c,1.); }` });
    const sea = new THREE.Mesh(g, m); sea.position.y = -34; this.scene.add(sea);
  }
  buildClouds() {
    const N = 70; const g = new THREE.PlaneGeometry(1, 1);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ...this.uniforms },
      vertexShader: `attribute vec4 iCloud; varying vec2 vUv; varying float vSeed; uniform float uTime;
        void main(){ vUv = uv; vSeed = iCloud.w;
          vec3 c = iCloud.xyz; c.x = mod(c.x + uTime*(0.6+vSeed*0.8) + 300., 600.) - 300.;
          vec4 mv = viewMatrix*vec4(c,1.); float s = 18. + vSeed*38.;
          mv.xy += position.xy*vec2(s*1.8, s); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `${NOISE} varying vec2 vUv; varying float vSeed; uniform vec3 uSun;
        void main(){ vec2 p = vUv*2.-1.; float r = length(p*vec2(1.,1.4));
          float n = fbm(vUv*3.+vSeed*17.); float a = smoothstep(1., 0.25, r + (n-0.5)*0.8);
          vec3 lit = mix(vec3(.62,.55,.85), vec3(1.,.86,.72), clamp(vUv.y*1.2 + n*0.3, 0., 1.));
          gl_FragColor = vec4(lit, a*0.75); if (gl_FragColor.a < 0.01) discard; }` });
    const inst = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2, r = 70 + rnd() * 220;
      inst.setXYZW(i, 20 + Math.cos(a) * r, -30 + rnd() * 34, 4.5 + Math.sin(a) * r, rnd());
    }
    const ig = new THREE.InstancedBufferGeometry().copy(g); ig.instanceCount = N; ig.setAttribute('iCloud', inst);
    const mesh = new THREE.Mesh(ig, m); mesh.frustumCulled = false; mesh.renderOrder = -5; this.scene.add(mesh);
  }
  buildWhale() {
    // Parametric body along x with a superellipse cross-section: flat back (the lane), round flanks.
    const SEG = 150, RAD = 56, CZ = LANE.H * S / 2, profile = whaleProfile;
    const pos = [], nrm = [], uvs = [], idx = []; const n = SUPER;
    for (let i = 0; i <= SEG; i++) {
      const x = X0 + (X1 - X0) * (i / SEG), { w, h } = profile(x);
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
        const sz = Math.sign(c) * Math.abs(c) ** (2 / n), sy = Math.sign(s) * Math.abs(s) ** (2 / n);
        pos.push(x, -h + h * sy - 0.02, CZ + w * sz); uvs.push(i / SEG, j / RAD);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) { const a = i * (RAD + 1) + j, b = a + RAD + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    const u = this.uniforms;
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.slate, roughness: 0.75, metalness: 0.05 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n uniform float uTime; varying vec3 vObj;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vObj = position;
          float tail = smoothstep(4., -16., position.x); transformed.y += sin(uTime*0.9 + position.x*0.22) * tail * tail * 2.2;
          transformed.y += sin(uTime*0.35)*0.05;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n uniform float uTime; varying vec3 vObj; ${NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float top = smoothstep(-3.5, -0.2, vObj.y);
          float belly = smoothstep(-5., -11., vObj.y);
          vec3 skin = mix(vec3(.09,.15,.24), vec3(.17,.27,.36), top);
          float mott = fbm(vObj.xz*0.35 + vObj.y*0.2);
          skin = mix(skin, skin*1.35, smoothstep(0.55,0.8,mott));
          float pleat = smoothstep(0.85, 1., abs(sin(vObj.z*3.2))) * belly;
          skin = mix(skin, vec3(.82,.78,.74), belly*0.7) - pleat*0.12;
          float barn = step(0.78, noise(vObj.xz*2.2 + vObj.y)) * smoothstep(-1.2,-3.,vObj.y) * (1.-belly);
          skin = mix(skin, vec3(.85,.8,.7), barn*0.8);
          diffuseColor.rgb = skin;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 cell = floor(vec2(vObj.x*1.6, vObj.y*2.4)); float spot = step(0.9, hash(cell)) * smoothstep(-0.6,-2.,vObj.y) * smoothstep(-7.,-3.,vObj.y);
          vec2 f = fract(vec2(vObj.x*1.6, vObj.y*2.4)) - 0.5; spot *= smoothstep(0.32, 0.05, length(f));
          totalEmissiveRadiance += vec3(.3,.95,1.)*spot*(0.9+0.4*sin(uTime*1.7 + cell.x));
          // eyes, painted into the body (no extra draw): dark iris with a soft cyan catchlight
          vec2 ed = vec2(vObj.x - ${(X1 - 5.5).toFixed(2)}, vObj.y + 4.2); float eye = smoothstep(0.62, 0.5, length(ed)) * step(4.8, abs(vObj.z - ${(LANE.H * S / 2).toFixed(2)}));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.03,.04,.08), eye);
          totalEmissiveRadiance += vec3(.35,.7,1.) * eye * smoothstep(0.22, 0.05, length(ed - vec2(0.15, 0.18)));`);
    };
    const whale = new THREE.Mesh(g, mat); whale.receiveShadow = true; this.root.add(whale);
    // tail flukes + pectoral fins, flapping in the vertex shader
    const fin = (cx, cz, dir, len, wid) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(len * 0.3, wid, len * 0.8, wid * 0.9, len, wid * 0.2); sh.bezierCurveTo(len * 0.7, -wid * 0.2, len * 0.3, -wid * 0.4, 0, -wid * 0.2);
      const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 10 });
      eg.rotateX(Math.PI / 2); eg.rotateY(dir); eg.translate(cx, 0, cz); return eg; };
    const flukes = [fin(X0 + 1, CZ, Math.PI / 2 + 0.25, 9, 3), fin(X0 + 1, CZ, -Math.PI / 2 - 0.25, 9, 3)];
    const finX = LW * 0.75, fins = [fin(finX, CZ + 6.2, -Math.PI / 2 + 0.5, 8, 2.2), fin(finX, CZ - 6.2, Math.PI / 2 - 0.5, 8, 2.2)];
    const tailY = -3.2;
    for (const f of flukes) f.translate(0, tailY, 0);
    for (const f of fins) f.translate(0, -5.2, 0);
    const finMat = mat.clone(); finMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\n uniform float uTime; varying vec3 vObj;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vObj = position;
          if (position.x < -8.) { float k = smoothstep(-6., -16., position.x); transformed.y += sin(uTime*0.9 - 3.8) * 2.2 * k + sin(uTime*0.9 + position.x*0.22)*k*k*1.8; }
          else { float side = sign(position.z - ${CZ.toFixed(2)}); float k = smoothstep(4., 10., abs(position.z - ${CZ.toFixed(2)})); transformed.y += sin(uTime*0.7)*k*1.6; }`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n varying vec3 vObj;`).replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb = mix(vec3(.17,.26,.34), vec3(.72,.7,.68), smoothstep(-5.,-7.,vObj.y));`);
    };
    const { mergeGeometries } = THREE_UTILS;
    const finMesh = new THREE.Mesh(mergeGeometries([...flukes, ...fins].map((x) => x.index ? x.toNonIndexed() : x)), finMat);
    this.root.add(finMesh);
  }
  buildLane() {
    const W = LANE.W * S, H = (LANE.MAX_Y - LANE.MIN_Y + 140) * S, z0 = (LANE.MIN_Y - 70) * S;
    const g = new THREE.PlaneGeometry(W + 6, H, 120, 16); g.rotateX(-Math.PI / 2); g.translate(W / 2, 0.01, z0 + H / 2);
    const cz = LANE.H * S / 2;
    const u = this.uniforms;
    const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, transparent: true });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u, { cBlue: { value: new THREE.Color(PALETTE.tide) }, cRed: { value: new THREE.Color(PALETTE.coral) } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n varying vec3 vW;').replace('#include <begin_vertex>', `#include <begin_vertex>\n vW = position;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n uniform float uTime, uWarn, uRollDir, uSudden; uniform vec3 cBlue, cRed; varying vec3 vW; ${NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float edge = abs(vW.z - ${cz.toFixed(2)}) / ${((LANE.MAX_Y - LANE.MIN_Y) * S / 2).toFixed(3)};
          float n = fbm(vW.xz*0.8); float n2 = fbm(vW.xz*3.);
          vec3 base = mix(vec3(.15,.27,.36), vec3(.22,.37,.45), n);
          base = mix(base, vec3(.42,.50,.55), smoothstep(0.6,0.72,n2)*0.3);
          float rib = smoothstep(0.7, 1., abs(sin(vW.x*0.9 + n*2.))) * smoothstep(0.1, 0.9, edge) * 0.05; base -= rib;
          float path = smoothstep(0.7, 0.15, edge); base = mix(base, vec3(.40,.47,.50) * (0.85 + n*0.3), path*0.3);
          float spot = smoothstep(0.86, 0.9, noise(vW.xz*3.3)) * smoothstep(0.6, 0.98, edge); base = mix(base, vec3(.76,.72,.64), spot*0.35);
          float xb = vW.x / ${(LANE.W * S).toFixed(1)};
          base = mix(base, mix(base, cBlue, 0.28), smoothstep(0.2, 0.03, xb));
          base = mix(base, mix(base, cRed, 0.28), smoothstep(0.8, 0.97, xb));
          diffuseColor.rgb = base;
          diffuseColor.a = smoothstep(1.2, 1.02, edge);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float side = sign(vW.z - ${cz.toFixed(2)});
          float danger = smoothstep(0.78, 0.98, edge) * smoothstep(1.1, 0.98, edge);
          float warnSide = uRollDir == 0. ? 1. : step(0., side*uRollDir);
          float pulse = 0.5 + 0.5*sin(uTime*10.);
          totalEmissiveRadiance += vec3(1., .45, .3) * danger * warnSide * uWarn * (0.4 + 0.6*pulse) * 1.6;
          totalEmissiveRadiance += vec3(.5,.9,1.) * danger * 0.06;
          totalEmissiveRadiance += vec3(1.,.2,.25) * uSudden * 0.12 * (0.5+0.5*sin(uTime*2.));
          // fountains: team-coloured pools with a bright rim (drawn here instead of separate meshes)
          for (int t = 0; t < 2; t++) {
            vec2 fc = vec2(t == 0 ? ${(MAP.FOUNTAIN_X * S).toFixed(2)} : ${((LANE.W - MAP.FOUNTAIN_X) * S).toFixed(2)}, ${(LANE.H * S / 2).toFixed(2)});
            float fr = length(vW.xz - fc) / ${(MAP.FOUNTAIN_R * S).toFixed(2)};
            vec3 fcCol = t == 0 ? cBlue : cRed;
            totalEmissiveRadiance += fcCol * (smoothstep(0.86, 0.9, fr) * smoothstep(1.0, 0.96, fr) * 0.9 + step(fr, 0.86) * 0.12);
          }`);
    };
    const lane = new THREE.Mesh(g, m); lane.receiveShadow = true; this.root.add(lane);
    // fountains: glowing pools on each base

  }
  buildScenery() {
    // instanced barnacle rocks along both flanks, moss trees on the far side, lamps by the bases
    const rnd = mulberry(99);
    const rockLook = [this.assets.merged(SCENERY.rocks[1], 1)];
    const perRock = Math.round(150 * LW / 40); // same density along any lane length
    rockLook.forEach(({ geometry, material }, ri) => {
      const mat = new THREE.MeshStandardMaterial({ color: '#e3d6bd', roughness: 0.9, flatShading: true });
      const im = new THREE.InstancedMesh(geometry, mat, perRock); const d = new THREE.Object3D();
      for (let i = 0; i < perRock; i++) {
        const far = true; const x = rnd() * (LW + 4) - 2; const z = 0.25 - rnd() * 1.1;
        d.position.set(x, whaleTopY(x, z) - 0.04, z); d.rotation.set(0, rnd() * 6.28, 0); const s = 0.15 + rnd() * (far ? 0.35 : 0.2); d.scale.set(s, s * (0.5 + rnd() * 0.5), s);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      }
      im.receiveShadow = true; this.root.add(im);
    });
    // glowing crystal outcrops on the far flank (instanced, team-neutral dusk cyan)
    const cr = this.assets.merged('crystal-small', 0.8);
    const crMat = new THREE.MeshStandardMaterial({ color: '#7fe3ff', emissive: '#3ad0ff', emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
    const nCrys = Math.round(26 * LW / 40), crys = new THREE.InstancedMesh(cr.geometry, crMat, nCrys); const dc = new THREE.Object3D();
    for (let i = 0; i < nCrys; i++) { const x = 1 + rnd() * (LW - 2), z = 0.1 - rnd() * 1.2; dc.position.set(x, whaleTopY(x, z) - 0.05, z); dc.rotation.set(rnd() * 0.3, rnd() * 6.28, rnd() * 0.3); dc.scale.setScalar(0.5 + rnd() * 0.9); dc.updateMatrix(); crys.setMatrixAt(i, dc.matrix); }
    this.root.add(crys);

  }
  update(dt, world) {
    this.uniforms.uTime.value += dt;
    const wh = world.state.whale;
    const warnT = wh.phase === 'warn' ? 1 : wh.phase === 'roll' ? 1 : 0;
    this.uniforms.uWarn.value += (warnT - this.uniforms.uWarn.value) * Math.min(1, dt * 6);
    this.uniforms.uRollDir.value = wh.phase === 'idle' ? 0 : wh.dir;
    const targetTilt = wh.phase === 'roll' ? wh.dir * 0.2 : wh.phase === 'warn' ? wh.dir * 0.05 : 0;
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 2.2);
    // tilt around the lane's long axis (x), pivoting at the lane centre line; gentle bob
    this.pivot.rotation.x = this.tilt;
    this.pivot.position.y = Math.sin(this.uniforms.uTime.value * 0.35) * 0.05;
    this.uniforms.uSudden.value += ((world.state.suddenDeath ? 1 : 0) - this.uniforms.uSudden.value) * Math.min(1, dt);
  }
  /** follow camera target so shadows stay crisp near the action */
  follow(x, z) { if (this.sun) { this.sun.position.set(x + this.uniforms.uSun.value.x * 40, this.uniforms.uSun.value.y * 40, z + this.uniforms.uSun.value.z * 40); this.sun.target.position.set(x, 0, z); } }
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const THREE_UTILS = BGU;
