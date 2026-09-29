// Combat readability: every attack gets its own launch, trail, swipe and impact (attack-styles.js),
// and towers show their range and who they are shooting. Presentation only; reads the world and the
// sim event stream. Three extra draws: swipes, tower rings, tether beams.
import * as THREE from 'three';
import { S, PALETTE } from './palette.js';
import { EV } from '../core/events.js';
import { KIND, TICK_HZ } from '../sim/constants.js';
import { PROJECTILE_STYLES, DEFAULT_PROJECTILE, MELEE_STYLES } from './attack-styles.js';
import { rx, ry } from './interp.js';

const C = (hex) => new THREE.Color(hex);
const rnd = (a, b) => a + Math.random() * (b - a);
const STONE = C('#bfae93'), DUST = C('#d7c9b0'), PENDING_CAP = 256, LAUNCH = 0, SWIPE = 1;
const SWIPE_CAP = 32, SEG = 14, TOWER_CAP = 8;
const STYLE_COLORS = new Map();
const colorsOf = (s) => { let c = STYLE_COLORS.get(s); if (!c) { c = { a: C(s.color || s.edge || '#fff'), b: C(s.color2 || s.edge || '#fff'), team: s.team ? s.team.map(C) : null }; STYLE_COLORS.set(s, c); } return c; };
const MINION_KEY = ['minion-0', 'minion-1'];
const TRACKED = (k) => k.endsWith('-auto') || k === 'tower-bolt' || k === 'minion-bolt' || k === 'siege-shot';

export class CombatFX {
  constructor(parent) {
    // ---- melee swipes: crescent ribbons, rebuilt each frame from the active list
    const g = new THREE.BufferGeometry(), V = SWIPE_CAP * (SEG + 1) * 2;
    this.sPos = new THREE.BufferAttribute(new Float32Array(V * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.sCol = new THREE.BufferAttribute(new Float32Array(V * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb, alpha
    this.sDat = new THREE.BufferAttribute(new Float32Array(V * 4), 4).setUsage(THREE.DynamicDrawUsage); // along, across, progress, edge boost
    g.setAttribute('position', this.sPos); g.setAttribute('col', this.sCol); g.setAttribute('dat', this.sDat);
    const idx = []; for (let s = 0; s < SWIPE_CAP; s++) for (let i = 0; i < SEG; i++) { const a = (s * (SEG + 1) + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.swipeMesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec4 col, dat; varying vec4 vC, vD; void main(){ vC = col; vD = dat; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec4 vC, vD;
        void main(){ float u = vD.x, v = vD.y, prog = vD.z;
          if (u > prog) discard;
          float tail = smoothstep(prog - .75, prog, u);           // bright head, fading tail
          float edge = smoothstep(.35, 1., v) * (1. + vD.w);      // hot outer rim
          float body = smoothstep(0., .5, v) * smoothstep(1., .85, v);
          vec3 c = vC.rgb * (body * .75 + edge * .9); float a = vC.a * tail * max(body * .8, edge * .7);
          if (a < .01) discard; gl_FragColor = vec4(c * a, a); }` }));
    this.swipeMesh.frustumCulled = false; this.swipeMesh.renderOrder = 45; parent.add(this.swipeMesh);
    // pooled records: minions attack constantly, so nothing here allocates per attack
    this.swipes = Array.from({ length: SWIPE_CAP }, () => ({ x: 0, z: 0, face: 0, s: null, c: null, flip: 1, start: 0 })); this.nSwipes = 0;
    this.pending = Array.from({ length: PENDING_CAP }, () => ({ at: 0, id: 0, kind: 0, key: '', target: -1 })); this.nPending = 0;
    this.freeTracked = []; this.sweepCtx = { world: null, r: null, me: null }; this.sweep = (t, id) => this.sweepOne(t, id);
    // ---- tower range rings: ground decals
    const rg = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2));
    this.rA = new THREE.InstancedBufferAttribute(new Float32Array(TOWER_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // x, z, radius, alpha
    this.rB = new THREE.InstancedBufferAttribute(new Float32Array(TOWER_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb, danger
    rg.setAttribute('iA', this.rA); rg.setAttribute('iB', this.rB); rg.instanceCount = 0;
    this.uniforms = { uTime: { value: 0 } };
    this.ringMesh = new THREE.Mesh(rg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.uniforms,
      vertexShader: `attribute vec4 iA, iB; varying vec2 vP; varying vec4 vA, vB;
        void main(){ vP = position.xz; vA = iA; vB = iB; vec3 p = vec3(position.x * iA.z + iA.x, 0.06, position.z * iA.z + iA.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform float uTime; varying vec2 vP; varying vec4 vA, vB;
        void main(){ float r = length(vP); if (r > 1.02) discard; float danger = vB.w;
          float px = fwidth(r) * 1.5;
          float line = smoothstep(px + .012, .012, abs(r - .985));                            // the range edge
          float ang = atan(vP.y, vP.x); float dash = step(.35, fract(ang * 14. / 6.2832 + uTime * .08));
          float fill = smoothstep(.55, 1., r) * .16 * danger * (.7 + .3 * sin(uTime * 9.));   // pulsing inner glow when targeted
          float a = vA.w * (line * mix(.55 * dash + .15, 1., danger) + fill);
          if (a < .01) discard; gl_FragColor = vec4(vB.rgb, a); }` }));
    this.ringMesh.frustumCulled = false; this.ringMesh.renderOrder = 8; parent.add(this.ringMesh);
    // ---- tethers: camera-facing beams from a tower to its target
    const tg = new THREE.InstancedBufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -.5, 0, 1, -.5, 0, 0, .5, 0, 1, .5, 0]), 3)); tg.setIndex([0, 1, 2, 1, 3, 2]);
    this.tS = new THREE.InstancedBufferAttribute(new Float32Array(TOWER_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // start xyz, width
    this.tE = new THREE.InstancedBufferAttribute(new Float32Array(TOWER_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // end xyz, danger
    this.tC = new THREE.InstancedBufferAttribute(new Float32Array(TOWER_CAP * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb, alpha
    tg.setAttribute('iS', this.tS); tg.setAttribute('iE', this.tE); tg.setAttribute('iC', this.tC); tg.instanceCount = 0;
    this.tetherMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.uniforms,
      vertexShader: `attribute vec4 iS, iE, iC; varying vec2 vUv; varying vec4 vC; varying float vDanger;
        void main(){ vUv = vec2(position.x, position.y * 2.); vC = iC; vDanger = iE.w;
          vec4 a = viewMatrix * vec4(iS.xyz, 1.), b = viewMatrix * vec4(iE.xyz, 1.);
          vec2 d = normalize(b.xy - a.xy + 1e-5); vec4 p = mix(a, b, position.x); p.xy += vec2(-d.y, d.x) * position.y * iS.w;
          gl_Position = projectionMatrix * p; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec4 vC; varying float vDanger;
        void main(){ float y = abs(vUv.y); float core = smoothstep(.35, 0., y), glow = smoothstep(1., 0., y);
          float flow = .55 + .45 * step(.5, fract(vUv.x * 10. - uTime * (3. + 4. * vDanger)));   // pulses run toward the target
          float a = vC.a * (core * .9 + glow * .35) * flow * smoothstep(0., .06, vUv.x);
          if (a < .01) discard; gl_FragColor = vec4(vC.rgb * a, a); }` }));
    this.tetherMesh.frustumCulled = false; this.tetherMesh.renderOrder = 55; parent.add(this.tetherMesh);
    this.tracked = new Map(); // projectile id -> { kind, team, x, y, alive }
    this.col = { danger: C('#ff3b3b'), warn: C(PALETTE.coral), ally: C('#ffb14a'), white: C('#ffffff') };
    this.frameSeen = 0;
  }
  // --------------------------------------------------------------- events
  onEvent(e, world, now, r) {
    if (e.type !== EV.AUTO_ATTACK) return;
    const a = world.entities[e.a]; if (!a) return;
    const delay = Math.max(1, e.v) / TICK_HZ; // the hit lands when the windup ends
    if (a.projectileSpeed > 0 || a.kind === KIND.TOWER) { this.queue(now + delay, a.id, LAUNCH, '', -1); return; }
    const key = a.kind === KIND.HERO ? a.heroKey : a.kind === KIND.PEBBLE ? 'pebble' : MINION_KEY[a.team];
    if (MELEE_STYLES[key]) this.queue(now + delay, a.id, SWIPE, key, e.b);
  }
  queue(at, id, kind, key, target) {
    if (this.nPending >= PENDING_CAP) return;
    const p = this.pending[this.nPending++]; p.at = at; p.id = id; p.kind = kind; p.key = key; p.target = target;
  }
  launch(a, r) {
    const kind = a.kind === KIND.TOWER ? 'tower-bolt' : a.kind === KIND.HERO ? `${a.heroKey}-auto` : a.kind === KIND.SIEGE ? 'siege-shot' : 'minion-bolt';
    const s = PROJECTILE_STYLES[kind] || DEFAULT_PROJECTILE, c = colorsOf(s), col = c.team ? c.team[a.team] : c.a;
    const x = rx(a) * S, z = ry(a) * S, fx = r.fx, dx = Math.cos(a.facing), dz = Math.sin(a.facing);
    switch (s.launch) {
      case 'tower': fx.burst(x, z, 2.6, 18, 2.2, c.a, 0.35, 0.3, 0.04, { drag: 4, intensity: 2.2 }); fx.ring(x, z, 2.5, 16, 0.4, c.a, 0.3, 0.16, 2.5); break;
      case 'brass': for (let i = 0; i < fx.n(6); i++) fx.p.spawn(x + dx * 0.4, 0.9, z + dz * 0.4, dx * rnd(1, 3) + rnd(-1, 1), rnd(0.5, 2), dz * rnd(1, 3) + rnd(-1, 1), 0.35, c.b.r, c.b.g, c.b.b, 2, 0.07, 0.02, 6, 1); break;
      case 'ink': fx.burst(x + dx * 0.4, z + dz * 0.4, 0.9, 6, 1.2, c.b, 0.4, 0.16, 0.03, { drag: 3 }); break;
      case 'honey': fx.burst(x + dx * 0.35, z + dz * 0.35, 1, 4, 0.8, c.a, 0.3, 0.08, 0.02, { drag: 3 }); break;
      case 'coin': fx.burst(x + dx * 0.4, z + dz * 0.4, 1.1, 5, 1.4, c.b, 0.3, 0.1, 0.02, { drag: 4, up: 1 }); break;
      default: fx.burst(x + dx * 0.3, z + dz * 0.3, 0.9, 3, 1, col, 0.2, 0.1, 0.02, { drag: 5 });
    }
  }
  impact(type, x, z, y, col, col2, r, onMe) {
    const fx = r.fx;
    switch (type) {
      case 'tower': // heavy: flash, shockwave, embers; shakes the camera when it hits you
        fx.burst(x, z, y, 30, 4.5, col, 0.45, 0.36, 0.04, { drag: 3.5, up: 1.2, intensity: 2.4 });
        fx.ring(x, z, 0.15, 26, 0.3, col, 0.45, 0.22, 5.5); fx.burst(x, z, y, 3, 0.3, col, 0.16, 0.5, 0.15, { drag: 2, intensity: 1.4 });
        if (onMe) r.shake(0.45); break;
      case 'siege': fx.burst(x, z, 0.4, 20, 3, STONE, 0.6, 0.24, 0.05, { up: 2, gravity: 9, intensity: 0.9 }); fx.ring(x, z, 0.1, 18, 0.3, DUST, 0.45, 0.22, 3); break;
      case 'brass': for (let i = 0; i < fx.n(12); i++) fx.p.spawn(x, y, z, rnd(-3, 3), rnd(1, 3.5), rnd(-3, 3), 0.45, col.r, col.g, col.b, 2.2, 0.07, 0.02, 9, 0.5); fx.ring(x, z, y, 8, 0.15, col2, 0.2, 0.08, 2); break;
      case 'ink': fx.burst(x, z, y, 12, 2.2, col2, 0.5, 0.2, 0.03, { drag: 3, gravity: 4 }); fx.ring(x, z, 0.08, 10, 0.2, col2, 0.5, 0.14, 1.4); break;
      case 'honey': fx.burst(x, z, y, 10, 1.6, col, 0.45, 0.12, 0.03, { gravity: 3, drag: 2 }); break;
      case 'coin': for (let i = 0; i < fx.n(8); i++) fx.p.spawn(x, y, z, rnd(-2, 2), rnd(2, 4), rnd(-2, 2), 0.6, col.r, col.g, col.b, 2, 0.1, 0.06, 10, 0.3); fx.burst(x, z, y, 6, 1.5, col2, 0.25, 0.14, 0.02, { drag: 5 }); break;
      case 'ember': fx.burst(x, z, y, 12, 3, col, 0.4, 0.16, 0.02, { drag: 4, up: 0.8, intensity: 2.2 }); break;
      case 'dust': fx.burst(x, z, 0.3, 16, 2.6, col, 0.55, 0.26, 0.05, { up: 1.2, gravity: 6, intensity: 0.9 }); fx.ring(x, z, 0.08, 14, 0.3, col2, 0.4, 0.2, 2.4); break;
      default: fx.burst(x, z, y, 6, 2.4, col, 0.25, 0.12, 0.02, { drag: 5 });
    }
  }
  // --------------------------------------------------------------- per frame
  update(world, alpha, dt, now, r) {
    this.uniforms.uTime.value = now;
    const me = world.entities[r.focusId];
    // scheduled launches and swipes (their windup has ended)
    let w = 0;
    for (let i = 0; i < this.nPending; i++) {
      const p = this.pending[i];
      if (p.at > now) { if (w !== i) { const keep = this.pending[w]; this.pending[w] = p; this.pending[i] = keep; } w++; continue; }
      const a = world.entities[p.id]; if (!a || !a.alive || a.dead) continue;
      if (p.kind === LAUNCH) this.launch(a, r);
      else this.startSwipe(a, p.key, world.entities[p.target], now, r, me);
    }
    this.nPending = w;
    this.updateProjectiles(world, alpha, dt, r, me);
    this.drawSwipes(now);
    this.drawTowers(world, alpha, r, me);
  }
  startSwipe(a, key, target, now, r, me) {
    const s = MELEE_STYLES[key]; if (!s) return;
    const flip = s.alternate ? (a.attackCount & 1 ? -1 : 1) : 1;
    const c = colorsOf(s);
    if (this.nSwipes >= SWIPE_CAP) { const old = this.swipes[0]; this.swipes.copyWithin(0, 1); this.swipes[SWIPE_CAP - 1] = old; this.nSwipes--; }
    const sw = this.swipes[this.nSwipes++];
    sw.x = rx(a) * S; sw.z = ry(a) * S; sw.face = a.facing; sw.s = s; sw.c = c; sw.flip = flip; sw.start = now;
    if (target) {
      const tx = rx(target) * S, tz = ry(target) * S, h = target.kind === KIND.HERO ? 0.9 : target.kind === KIND.TOWER ? 2 : 0.6;
      this.impact(s.impact, tx, tz, h, c.a, c.b, r, target === me);
      if (s.heavy) r.fx.ring(tx, tz, 0.1, 12, 0.35, c.a, 0.35, 0.2, 3);
    }
  }
  updateProjectiles(world, alpha, dt, r, me) {
    const fx = r.fx, rate = dt * 60 * fx.density; this.frameSeen++;
    for (const p of world.projectiles) {
      if (!TRACKED(p.kind)) continue;
      let t = this.tracked.get(p.id);
      if (!t) { t = this.freeTracked.pop() || { kind: '', team: 0, x: 0, z: 0, target: -1, seen: 0, alive: true }; t.kind = p.kind; t.team = p.team; t.target = p.targetId; this.tracked.set(p.id, t); }
      t.seen = this.frameSeen; t.alive = p.alive;
      if (!p.alive) continue;
      t.x = (p.px + (p.x - p.px) * alpha) * S; t.z = (p.py + (p.y - p.py) * alpha) * S;
      const s = PROJECTILE_STYLES[p.kind]; if (!s || !s.trail) continue;
      const tr = s.trail, c = colorsOf(s), col = tr.team && c.team ? c.team[p.team] : C_TRAIL(tr);
      if (Math.random() < rate * tr.rate) {
        const y = (s.y ?? 0.85);
        if (tr.sparks) fx.p.spawn(t.x, y, t.z, rnd(-1, 1), rnd(0.3, 1.5), rnd(-1, 1), tr.life, col.r, col.g, col.b, 2.2, tr.size, 0.01, 5, 1);
        else if (tr.drip) fx.p.spawn(t.x, y, t.z, rnd(-0.2, 0.2), -0.2, rnd(-0.2, 0.2), tr.life, col.r, col.g, col.b, 1.6, tr.size, 0.03, 3, 1);
        else if (tr.smoke) fx.p.spawn(t.x, y + 0.4, t.z, rnd(-0.2, 0.2), tr.up || 0.3, rnd(-0.2, 0.2), tr.life, col.r, col.g, col.b, 0.6, tr.size, tr.size * 2.2, 0, 1.5);
        else fx.p.spawn(t.x, y, t.z, rnd(-0.15, 0.15), tr.up || 0.1, rnd(-0.15, 0.15), tr.life, col.r, col.g, col.b, tr.glint ? 2.6 : 1.8, tr.size, 0.01, 0, 1.5);
      }
    }
    // projectiles that ended this frame: impact where they were
    // (forEach with a callback made once: for..of over a Map allocates an entry array per element)
    this.sweepCtx.world = world; this.sweepCtx.r = r; this.sweepCtx.me = me;
    this.tracked.forEach(this.sweep);
  }
  sweepOne(t, id) {
    if (t.alive && t.seen === this.frameSeen) return;
    this.tracked.delete(id); this.freeTracked.push(t);
    const { world, r, me } = this.sweepCtx, tg = world.entities[t.target];
    if (!tg || !tg.alive || tg.dead) return; // fizzled (target gone): no impact
    const s = PROJECTILE_STYLES[t.kind] || DEFAULT_PROJECTILE, c = colorsOf(s), col = c.team ? c.team[t.team] : c.a;
    const h = tg.kind === KIND.HERO ? 0.9 : tg.kind === KIND.TOWER ? 2 : 0.6;
    this.impact(s.impact, rx(tg) * S, ry(tg) * S, h, col, c.b, r, tg === me);
  }
  drawSwipes(now) {
    const P = this.sPos, Cc = this.sCol, D = this.sDat, pa = P.array, ca4 = Cc.array, da = D.array; let n = 0, w = 0;
    for (let si = 0; si < this.nSwipes; si++) {
      const sw = this.swipes[si];
      const k = (now - sw.start) / sw.s.dur; if (k > 1.6) continue;
      if (w !== si) { const keep = this.swipes[w]; this.swipes[w] = sw; this.swipes[si] = keep; } w++;
      const s = sw.s, prog = Math.min(1.75, k * 1.75), fade = k > 1 ? 1 - (k - 1) / 0.6 : 1;
      const r0 = s.radius - s.width, r1 = s.radius, base = n * (SEG + 1) * 2, ea = sw.c.a, eb = sw.c.b;
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG, ang = sw.face + sw.flip * (u - 0.5) * s.arc, ca = Math.cos(ang), sa = Math.sin(ang);
        const v = base + i * 2, lift = 0.55 + (s.heavy ? 0.1 : 0.25) * Math.sin(u * Math.PI), boost = s.heavy ? 0.3 : 0.6;
        // direct typed-array writes: calling setXYZ per vertex boxed every double argument (measured ~40 KB/s)
        let o = v * 3; pa[o] = sw.x + ca * r0; pa[o + 1] = lift; pa[o + 2] = sw.z + sa * r0; pa[o + 3] = sw.x + ca * r1; pa[o + 4] = lift + 0.05; pa[o + 5] = sw.z + sa * r1;
        o = v * 4; ca4[o] = ea.r; ca4[o + 1] = ea.g; ca4[o + 2] = ea.b; ca4[o + 3] = fade; ca4[o + 4] = eb.r; ca4[o + 5] = eb.g; ca4[o + 6] = eb.b; ca4[o + 7] = fade;
        da[o] = u; da[o + 1] = 0; da[o + 2] = prog; da[o + 3] = boost; da[o + 4] = u; da[o + 5] = 1; da[o + 6] = prog; da[o + 7] = boost;
      }
      n++;
    }
    this.nSwipes = w;
    this.swipeMesh.geometry.setDrawRange(0, n * SEG * 6); this.swipeMesh.visible = n > 0;
    if (n) { P.needsUpdate = Cc.needsUpdate = D.needsUpdate = true; }
  }
  drawTowers(world, alpha, r, me) {
    let nr = 0, nt = 0;
    for (const t of world.structures) {
      if (!t.alive || t.kind !== KIND.TOWER) continue;
      const tg = t.targetId >= 0 ? world.entities[t.targetId] : null, onMe = !!me && tg === me && !me.dead;
      // range ring: enemy towers you are close to (always when they target you)
      if (me && t.team !== me.team && nr < TOWER_CAP) {
        const d = Math.hypot(me.x - t.x, me.y - t.y), near = 1 - Math.max(0, d - t.range) / 500;
        if (near > 0 || onMe) {
          const c = onMe ? this.col.danger : this.col.warn;
          this.rA.setXYZW(nr, t.x * S, t.y * S, t.range * S, onMe ? 1 : Math.min(1, near) * 0.8);
          this.rB.setXYZW(nr, c.r, c.g, c.b, onMe ? 1 : 0); nr++;
        }
      }
      // beam to the hero it is shooting (red on you, amber on your allies, faint on enemies)
      if (tg && tg.kind === KIND.HERO && !tg.dead && nt < TOWER_CAP) {
        const c = onMe ? this.col.danger : me && tg.team === me.team ? this.col.ally : this.col.white;
        this.tS.setXYZW(nt, t.x * S, 2.55, t.y * S, onMe ? 0.2 : 0.1);
        this.tE.setXYZW(nt, rx(tg) * S, 1, ry(tg) * S, onMe ? 1 : 0);
        this.tC.setXYZW(nt, c.r, c.g, c.b, onMe ? 1 : me && tg.team === me.team ? 0.7 : 0.35); nt++;
      }
    }
    this.ringMesh.geometry.instanceCount = nr; this.ringMesh.visible = nr > 0; if (nr) this.rA.needsUpdate = this.rB.needsUpdate = true;
    this.tetherMesh.geometry.instanceCount = nt; this.tetherMesh.visible = nt > 0; if (nt) this.tS.needsUpdate = this.tE.needsUpdate = this.tC.needsUpdate = true;
  }
}
const TRAIL_COLORS = new Map();
function C_TRAIL(tr) { let c = TRAIL_COLORS.get(tr); if (!c) { c = new THREE.Color(tr.color || '#ffffff'); TRAIL_COLORS.set(tr, c); } return c; }
