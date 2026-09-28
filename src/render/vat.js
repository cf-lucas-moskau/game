// Vertex Animation Textures: bake skinned clips into float textures once at load, then draw
// every minion of a rig with ONE instanced draw call. Each instance picks its own frame.
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const FPS = 24;
/**
 * @param gltf loaded gltf (scene + animations)
 * @param clipNames names to bake, in order
 * @param height target height (render units)
 * @returns {{geometry, posTex, nrmTex, clips:{[name]:{start,frames,duration}}, frames}}
 */
export function bakeVAT(gltf, clipNames, height) {
  const root = skeletonClone(gltf.scene);
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  // Build one merged, non-indexed geometry (uv + vertex order shared by all frames)
  let vcount = 0; for (const m of meshes) vcount += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count);
  const uv = new Float32Array(vcount * 2), idx = new Float32Array(vcount);
  const refs = []; // [mesh, vertexIndex]
  let v = 0;
  for (const m of meshes) {
    const g = m.geometry, ia = g.index, n = ia ? ia.count : g.attributes.position.count, uva = g.attributes.uv;
    for (let k = 0; k < n; k++) {
      const vi = ia ? ia.getX(k) : k; refs.push(m, vi);
      if (uva) { uv[v * 2] = uva.getX(vi); uv[v * 2 + 1] = uva.getY(vi); }
      idx[v] = v; v++;
    }
  }
  const mixer = new THREE.AnimationMixer(root);
  const clips = {}; const frameData = []; let total = 0;
  const tmp = new THREE.Vector3(), scratch = new THREE.BufferGeometry();
  const pos = new Float32Array(vcount * 3); scratch.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  let minY = Infinity, maxY = -Infinity;
  for (const name of clipNames) {
    const clip = gltf.animations.find((a) => a.name === name); if (!clip) continue;
    mixer.stopAllAction(); const act = mixer.clipAction(clip); act.reset().play();
    const frames = Math.max(2, Math.round(clip.duration * FPS));
    clips[name] = { start: total, frames, duration: clip.duration };
    for (let f = 0; f < frames; f++) {
      mixer.setTime((f / frames) * clip.duration); root.updateMatrixWorld(true);
      for (let i = 0; i < vcount; i++) {
        const m = refs[i * 2], vi = refs[i * 2 + 1];
        if (m.isSkinnedMesh) m.getVertexPosition(vi, tmp); else tmp.fromBufferAttribute(m.geometry.attributes.position, vi);
        tmp.applyMatrix4(m.matrixWorld);
        pos[i * 3] = tmp.x; pos[i * 3 + 1] = tmp.y; pos[i * 3 + 2] = tmp.z;
        if (name === clipNames[0] && f === 0) { minY = Math.min(minY, tmp.y); maxY = Math.max(maxY, tmp.y); }
      }
      scratch.computeVertexNormals(); // non-indexed -> flat normals, matches the low-poly style
      frameData.push(pos.slice(), scratch.attributes.normal.array.slice());
      total++;
    }
  }
  const s = height / ((maxY - minY) || 1);
  const W = vcount, H = total;
  const P = new Float32Array(W * H * 4), N = new Float32Array(W * H * 4);
  for (let f = 0; f < H; f++) {
    const fp = frameData[f * 2], fn = frameData[f * 2 + 1];
    for (let i = 0; i < W; i++) {
      const o = (f * W + i) * 4;
      P[o] = fp[i * 3] * s; P[o + 1] = (fp[i * 3 + 1] - minY) * s; P[o + 2] = fp[i * 3 + 2] * s; P[o + 3] = 1;
      N[o] = fn[i * 3]; N[o + 1] = fn[i * 3 + 1]; N[o + 2] = fn[i * 3 + 2]; N[o + 3] = 0;
    }
  }
  const mk = (arr) => { const t = new THREE.DataTexture(arr, W, H, THREE.RGBAFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; };
  const geometry = new THREE.BufferGeometry();
  const first = frameData[0], fpos = new Float32Array(W * 3); for (let i = 0; i < W * 3; i++) fpos[i] = i % 3 === 1 ? (first[i] - minY) * s : first[i] * s;
  geometry.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(frameData[1].slice(), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('vatIndex', new THREE.BufferAttribute(idx, 1));
  geometry.computeBoundingSphere(); geometry.boundingSphere.radius *= 1.6;
  mixer.stopAllAction();
  let material = meshes[0].material;
  return { geometry, material, posTex: mk(P), nrmTex: mk(N), clips, frames: H, width: W, fps: FPS };
}

/** Patch a standard material so it reads positions/normals from the VAT textures per instance. */
export function vatMaterial(baseMaterial, vat) {
  const mat = baseMaterial.clone();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uVatPos = { value: vat.posTex }; sh.uniforms.uVatNrm = { value: vat.nrmTex };
    sh.uniforms.uVatSize = { value: new THREE.Vector2(vat.width, vat.frames) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uVatPos; uniform sampler2D uVatNrm; uniform vec2 uVatSize;
        attribute float vatIndex; attribute vec3 iFrame; attribute vec4 iTint; varying vec4 vTint;
        vec3 vatFetch(sampler2D t, float f) { return texelFetch(t, ivec2(int(vatIndex), int(f)), 0).xyz; }`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(mix(vatFetch(uVatNrm, iFrame.x), vatFetch(uVatNrm, iFrame.y), iFrame.z));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = mix(vatFetch(uVatPos, iFrame.x), vatFetch(uVatPos, iFrame.y), iFrame.z); vTint = iTint;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vTint;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vTint.rgb * vTint.a;');
  };
  mat.customProgramCacheKey = () => 'vat';
  return mat;
}
