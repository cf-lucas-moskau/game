// A fixed pool of point lights for glowing props (candles, lanterns). three.js keys shaders on the
// number of visible lights, so one light per prop recompiled every lit material whenever such a hero
// died, respawned or joined twice. The pool never changes size: each frame its lights move to the
// glowing props nearest the camera, and unused lights fade to zero intensity.
import * as THREE from 'three';

const tmp = new THREE.Vector3();
export class GlowLights {
  constructor(parent, count) {
    this.lights = [];
    for (let i = 0; i < count; i++) { const l = new THREE.PointLight('#ffffff', 0, 2.5, 2); parent.add(l); this.lights.push(l); }
    this.pick = [];
  }
  /** anchors: [{ anchor: Object3D, color: Color, phase, active }] ; cam: { x, z } in render units */
  update(anchors, cam, now) {
    const L = this.lights; if (!L.length) return;
    const pick = this.pick; pick.length = 0;
    for (const a of anchors) {
      if (!a.active) continue;
      a.anchor.getWorldPosition(tmp); a.x = tmp.x; a.y = tmp.y; a.z = tmp.z;
      a.d = (tmp.x - cam.x) ** 2 + (tmp.z - cam.z) ** 2; pick.push(a);
    }
    pick.sort((p, q) => p.d - q.d);
    for (let i = 0; i < L.length; i++) {
      const a = pick[i], l = L[i];
      if (!a) { l.intensity = 0; continue; }
      l.position.set(a.x, a.y, a.z); l.color.copy(a.color);
      l.intensity = 1 + Math.sin(now * 13 + a.phase) * 0.25;
    }
  }
}
