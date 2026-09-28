// Input feedback on the ground: attack range, ability aim shapes, drawn strokes, hover ring, click markers.
import * as THREE from 'three';
import { S, PALETTE } from './palette.js';
import { rx, ry } from './interp.js';
import { isClosed } from '../sim/heroes/vesper.js';
import { KIND } from '../sim/constants.js';

const Y = 0.06;
const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function flat(geo) { geo.rotateX(-Math.PI / 2); return geo; }

export class Indicators {
  constructor(parent) {
    this.g = new THREE.Group(); parent.add(this.g);
    this.range = new THREE.Mesh(flat(new THREE.RingGeometry(0.985, 1, 96)), mat('#cfd8ff', 0.5)); this.range.renderOrder = 5;
    this.line = new THREE.Mesh(flat(new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0)), mat(PALETTE.mist, 0.28));
    this.circle = new THREE.Mesh(flat(new THREE.CircleGeometry(1, 48)), mat(PALETTE.mist, 0.22));
    this.circleEdge = new THREE.Mesh(flat(new THREE.RingGeometry(0.95, 1, 64)), mat('#ffffff', 0.55));
    this.cone = new THREE.Mesh(new THREE.BufferGeometry(), mat(PALETTE.mist, 0.25)); this.coneAngle = -1;
    this.hover = new THREE.Mesh(flat(new THREE.RingGeometry(0.9, 1, 48)), mat(PALETTE.coral, 0.9));
    const cap = 200; this.stroke = new THREE.Mesh(new THREE.BufferGeometry(), mat(PALETTE.ink, 0.85));
    this.stroke.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < cap - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } this.stroke.geometry.setIndex(idx); this.strokeCap = cap;
    this.stroke.frustumCulled = false;
    for (const m of [this.range, this.line, this.circle, this.circleEdge, this.cone, this.hover, this.stroke]) { m.visible = false; m.renderOrder = 6; this.g.add(m); }
    this.markers = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(flat(new THREE.RingGeometry(0.7, 1, 32)), mat('#7ee07a', 0.9)); m.visible = false; m.renderOrder = 6; this.g.add(m); return { m, t: 9 }; });
    this.mi = 0;
  }
  marker(x, y, type) {
    const k = this.markers[this.mi++ % this.markers.length]; k.t = 0; k.m.position.set(x * S, Y, y * S);
    k.m.material.color.set(type === 'attack' ? PALETTE.coral : '#7ee07a'); k.m.visible = true;
  }
  buildCone(angle) {
    const seg = 24, pos = [0, 0, 0];
    for (let i = 0; i <= seg; i++) { const a = -angle / 2 + (angle * i) / seg; pos.push(Math.cos(a), 0, Math.sin(a)); }
    const idx = []; for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    this.cone.geometry.dispose(); this.cone.geometry = g; this.coneAngle = angle;
  }
  update(world, alpha, dt, now, r) {
    for (const k of this.markers) { if (!k.m.visible) continue; k.t += dt; const s = 0.55 - k.t * 0.8; if (s <= 0.05) { k.m.visible = false; continue; } k.m.scale.setScalar(s); k.m.material.opacity = Math.min(0.9, s * 1.8); }
    const me = world.entities[r.focusId], aim = r.aim;
    for (const m of [this.range, this.line, this.circle, this.circleEdge, this.cone, this.stroke]) m.visible = false;
    const h = world.entities[r.hoverId];
    this.hover.visible = !!(h && h.alive && !h.dead);
    if (this.hover.visible) { this.hover.position.set(rx(h) * S, Y, ry(h) * S); this.hover.scale.setScalar((h.radius + 14) * S); }
    if (!me || me.dead) return;
    const mx = rx(me) * S, mz = ry(me) * S;
    if (r.showRange && !(aim && aim.active)) { this.range.visible = true; this.range.position.set(mx, Y, mz); this.range.scale.setScalar((me.range + me.radius) * S); }
    if (!aim || !aim.active) return;
    const a = aim.shape; if (!a) return;
    const dx = aim.x - me.x, dy = aim.y - me.y, d = Math.sqrt(dx * dx + dy * dy) || 1, ang = Math.atan2(dy, dx);
    if (a.range) { this.range.visible = true; this.range.position.set(mx, Y, mz); this.range.scale.setScalar(a.range * S); }
    switch (a.kind) {
      case 'line': this.line.visible = true; this.line.position.set(mx, Y, mz); this.line.rotation.y = -ang; this.line.scale.set(a.range * S, 1, a.width * S); break;
      case 'cone': if (this.coneAngle !== a.angle) this.buildCone(a.angle); this.cone.visible = true; this.cone.position.set(mx, Y, mz); this.cone.rotation.y = -ang; this.cone.scale.setScalar(a.range * S); break;
      case 'point': case 'echo': {
        let px = aim.x, py = aim.y;
        if (a.anchored) { px = me.x + Math.cos(ang) * a.range; py = me.y + Math.sin(ang) * a.range; }
        else if (d > a.range) { px = me.x + dx / d * a.range; py = me.y + dy / d * a.range; }
        if (a.kind === 'echo') { const e = me.heroState.echoes && me.heroState.echoes[me.heroState.echoes.length - 1]; if (e) { px = e.x; py = e.y; } }
        const rad = (a.radius || 70) * S;
        this.circle.visible = this.circleEdge.visible = true; this.circle.position.set(px * S, Y, py * S); this.circleEdge.position.copy(this.circle.position);
        this.circle.scale.setScalar(rad); this.circleEdge.scale.setScalar(rad); break;
      }
      case 'self': this.circle.visible = this.circleEdge.visible = true; this.circle.position.set(mx, Y, mz); this.circleEdge.position.set(mx, Y, mz); this.circle.scale.setScalar(a.radius * S); this.circleEdge.scale.setScalar(a.radius * S); this.range.visible = false; break;
      case 'stroke': case 'loop': if (aim.pts && aim.pts.length >= 4) this.drawStroke(aim.pts, a.kind === 'loop'); break;
    }
  }
  drawStroke(pts, loop) {
    const n = Math.min(this.strokeCap, pts.length / 2), p = this.stroke.geometry.attributes.position, w = 0.14;
    for (let i = 0; i < n; i++) {
      const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
      let tx = pts[j * 2] - pts[k * 2], ty = pts[j * 2 + 1] - pts[k * 2 + 1]; const l = Math.sqrt(tx * tx + ty * ty) || 1; tx /= l; ty /= l;
      const x = pts[i * 2] * S, z = pts[i * 2 + 1] * S;
      p.setXYZ(i * 2, x - ty * w, Y + 0.01, z + tx * w); p.setXYZ(i * 2 + 1, x + ty * w, Y + 0.01, z - tx * w);
    }
    p.needsUpdate = true; this.stroke.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6)); this.stroke.visible = true;
    this.stroke.material.color.set(loop ? (isClosed(pts) ? '#7ee07a' : PALETTE.ink) : PALETTE.ink);
  }
}
