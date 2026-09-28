// Loads every GLB from the manifest once, normalizes scale, and hands out cheap clones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODEL_URLS } from '../assets/manifest.js';

export class AssetLibrary {
  constructor() { this.gltf = {}; this.loader = new GLTFLoader(); this.mergedCache = {}; }
  async loadAll(onProgress) {
    const keys = Object.keys(MODEL_URLS); let done = 0;
    await Promise.all(keys.map(async (k) => {
      const g = await this.loader.loadAsync(MODEL_URLS[k]);
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = false; o.frustumCulled = !o.isSkinnedMesh;
          const m = o.material; if (m && m.map) { m.map.anisotropy = 4; m.map.colorSpace = THREE.SRGBColorSpace; }
        }
      });
      this.gltf[k] = g; done++; onProgress && onProgress(done / keys.length);
    }));
  }
  has(k) { return !!this.gltf[k]; }
  clips(k) { return this.gltf[k].animations; }
  clip(k, name) { return this.gltf[k].animations.find((a) => a.name === name) || null; }
  /** Deep clone (skeleton-aware) scaled so its height equals `height`. */
  instance(k, height) {
    const obj = skeletonClone(this.gltf[k].scene);
    return height ? fitHeight(obj, height) : obj;
  }
  /**
   * One merged, non-skinned geometry + material for a static model (for InstancedMesh).
   * Returns { geometry, material } normalized to height.
   */
  merged(k, height = 1) {
    const ck = `${k}@${height}`; if (this.mergedCache[ck]) return this.mergedCache[ck];
    const root = this.gltf[k].scene; root.updateMatrixWorld(true);
    const geos = []; let material = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      dequantize(g);
      geos.push(g.index ? g.toNonIndexed() : g); material = material || o.material;
    });
    let geometry = mergeGeometries(geos, false);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox, h = bb.max.y - bb.min.y, s = height / (h || 1);
    geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geometry.scale(s, s, s);
    geometry.computeBoundingSphere();
    const res = { geometry, material: material.clone() };
    this.mergedCache[ck] = res; return res;
  }
}
function dequantize(g) {
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name]; if (!a) continue;
    if (a.array instanceof Float32Array && !a.normalized && !a.isInterleavedBufferAttribute) continue;
    const f = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(f, a.itemSize));
  }
}
export function fitHeight(obj, height) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const h = box.max.y - box.min.y;
  if (h > 0) obj.scale.multiplyScalar(height / h);
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj, true);
  obj.position.y -= b2.min.y;
  if (!obj.getObjectByProperty('isSkinnedMesh', true)) { obj.position.x -= (b2.min.x + b2.max.x) / 2; obj.position.z -= (b2.min.z + b2.max.z) / 2; }
  const pivot = new THREE.Group(); pivot.add(obj); return pivot;
}
