// The game renderer: owns the WebGL context, camera, environment, unit and overlay views.
// Presentation only; it reads the world and the sim event stream.
import * as THREE from 'three';
import { S } from './palette.js';
import { LANE } from '../sim/constants.js';
import { Environment } from './environment.js';
import { UnitRenderer } from './units.js';
import { HealthBars, GroundDecals, ProjectileViews } from './overlays.js';
import { PostFX } from './post.js';
import { QUALITY, ResolutionGuard } from './quality.js';
import { view, rx, ry } from './interp.js';
import { Indicators } from './indicators.js';
import { FX } from './fx.js';
import { ZoneViews } from './zones.js';
import { GlowLights } from './glow-lights.js';
import { CombatFX } from './combat-fx.js';
import { AbilityFX } from './ability-fx.js';
import { HeroFx } from './hero-fx.js';

export class GameRenderer {
  constructor(canvas, lib, world, { quality = 'medium', telemetry = null, fixedBuffer = null } = {}) {
    this.fixedBuffer = fixedBuffer; // [w, h]: CPU-measurement mode renders the full scene into a tiny buffer
    this.canvas = canvas; this.lib = lib; this.world = world; this.telemetry = telemetry;
    this.q = QUALITY[quality] || QUALITY.medium;
    const gl = new THREE.WebGLRenderer({ canvas, antialias: !this.q.post && this.q.name !== 'low', powerPreference: 'high-performance', alpha: false, stencil: false });
    gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05;
    gl.shadowMap.enabled = this.q.shadows; gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.info.autoReset = false;
    // opaque draws grouped by program/material first, then front-to-back: fewer program and
    // uniform re-uploads (the biggest source of per-frame allocation inside three.js)
    gl.setOpaqueSort((a, b) => a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || a.material.id - b.material.id || a.z - b.z || a.id - b.id);
    this.gl = gl;
    if (telemetry) { const ext = gl.getContext().getExtension('WEBGL_debug_renderer_info'); telemetry.gpu = ext ? gl.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; }
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#b98aa0', 70, 260);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1500);
    this.env = new Environment(this.scene, lib, this.q);
    this.units = new UnitRenderer(lib, world, this.env.root);
    this.bars = new HealthBars(this.env.root); this.decals = new GroundDecals(this.env.root); this.projectiles = new ProjectileViews(this.env.root);
    this.extra = []; // pluggable views (fx, zones) with update(world, alpha, dt, now, renderer)
    this.zones = new ZoneViews(this.env.root); this.fx = new FX(this.env.root, this.q);
    this.indicators = new Indicators(this.env.root); this.combat = new CombatFX(this.env.root); this.abilities = new AbilityFX(this.env.root);
    this.heroFx = new HeroFx(this); // presentation packs: events here, per-frame work in the engines' hooks
    this.extra.push(this.heroFx, this.zones, this.abilities, this.fx, this.combat, this.indicators);
    this.units.fx = this.fx;
    this.glowLights = new GlowLights(this.env.root, this.q.glowLights || 0);
    this.aim = { active: false }; this.hoverId = -1; this.showRange = false;
    this.post = this.q.post ? new PostFX(gl, { levels: this.q.bloomLevels, msaa: this.q.msaa }) : null;
    this.guard = new ResolutionGuard(0.55, 1);
    this.cam = { x: 8, z: 4.5, shake: 0, zoom: 1 }; this.focusId = -1; this.myTeam = 0;
    this.shakeScale = 1; // user setting (0 disables camera shake)
    this._pv = new THREE.Vector3();
    this.now = 0; this.resize(); addEventListener('resize', (this._onResize = () => this.resize()));
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.cssW = w; this.cssH = h; // cached: reading clientWidth per frame would force a layout
    let dpr = Math.min(devicePixelRatio || 1, 2) * this.q.pixelRatio * this.guard.scale;
    if (this.fixedBuffer) { dpr = this.fixedBuffer[0] / w; this.guard.enabled = false; }
    this.gl.setPixelRatio(dpr); this.gl.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.post) this.post.setSize(Math.floor(w * dpr), Math.floor(h * dpr));
    if (this.telemetry) this.telemetry.gauges.renderScale = +(this.guard.scale).toFixed(2);
  }
  marker(x, y, type) { this.indicators.marker(x, y, type); }
  shake(amount) { this.cam.shake = Math.min(1, this.cam.shake + amount * this.shakeScale); }
  /** Camera: follows the focus unit, clamped to the lane. Narrow screens pull back to keep the same lane width in view. */
  updateCamera(alpha, dt) {
    // lab / tooling: an explicit camera ({ pos: [x,y,z], target: [x,y,z] } in render units)
    if (this.cameraOverride) { const o = this.cameraOverride; this.camera.position.set(o.pos[0], o.pos[1], o.pos[2]); this.camera.lookAt(o.target[0], o.target[1], o.target[2]); this.env.follow(o.target[0], o.target[2]); return; }
    const f = this.world.entities[this.focusId];
    let tx = this.cam.x, tz = 4.5;
    if (f) { tx = rx(f) * S; tz = ry(f) * S; }
    if (this.freeCam) { tx = this.freeCam.x; tz = this.freeCam.z; }
    const k = Math.min(1, dt * 7);
    this.cam.x += (tx - this.cam.x) * k; this.cam.z += (Math.max(3.2, Math.min(5.8, tz)) - this.cam.z) * k;
    const aspect = this.camera.aspect, pull = aspect < 1.5 ? 1.5 / aspect : 1;
    const dist = 14.5 * Math.min(1.45, pull) * this.cam.zoom;
    const x = Math.max(4, Math.min(LANE.W * S - 4, this.cam.x));
    const sh = this.cam.shake; this.cam.shake = Math.max(0, sh - dt * 2.5);
    const jx = sh ? (Math.sin(this.now * 91) * 0.25) * sh : 0, jy = sh ? (Math.cos(this.now * 73) * 0.2) * sh : 0;
    this.camera.position.set(x + jx, dist * 0.84 + jy, this.cam.z + dist * 0.56);
    this.camera.lookAt(x + jx * 0.5, 0, this.cam.z - 0.4);
    this.env.follow(x, this.cam.z);
  }
  /** Draw one frame. alpha = interpolation between previous and current sim tick. */
  render(alpha, dt) {
    if (this.pendingResize) { this.pendingResize = false; this.resize(); }
    const t0 = performance.now(); this.now += dt; const w = this.world;
    view.alpha = alpha; const pr = this.predictor;
    if (pr) { view.predId = pr.id; view.ox = pr.ox; view.oy = pr.oy; } else view.predId = -1;
    if (!this._onEvent) this._onEvent = (e) => { this.units.onEvent(e, this.world, this.now); for (const x of this.extra) if (x.onEvent) x.onEvent(e, this.world, this.now, this); };
    w.events.drain(this._onEvent);
    this.env.update(dt, w);
    this.units.update(w, alpha, dt, this.now);
    const me = w.entities[this.focusId];
    this.gl.getDrawingBufferSize(this._res || (this._res = new THREE.Vector2())); this.bars.update(w, alpha, this.myTeam, me ? me.id : -1, this._res);
    this.decals.update(w, alpha, this.myTeam, me ? me.id : -1, dt);
    this.projectiles.update(w, alpha, dt);
    for (const x of this.extra) x.update(w, alpha, dt, this.now, this);
    this.updateCamera(alpha, dt);
    this.glowLights.update(this.units.glowAnchors, this.cam, this.now);
    const tSubmit = performance.now();
    this.gl.info.reset();
    if (this.post) this.post.render(this.scene, this.camera, this.gl.info); else { this.gl.setRenderTarget(null); this.gl.render(this.scene, this.camera); }
    // scene draw calls (post-processing fullscreen passes are a fixed, separately reported cost)
    const sceneCalls = this.post ? this.post.sceneCalls : this.gl.info.render.calls;
    const cpu = performance.now() - t0;
    if (this.telemetry) {
      this.telemetry.render.push(cpu); this.telemetry.renderUpdate.push(tSubmit - t0); this.telemetry.renderSubmit.push(performance.now() - tSubmit);
      this.telemetry.draws.push(sceneCalls); this.telemetry.tris.push(this.gl.info.render.triangles);
      this.telemetry.gauges.postPasses = this.post ? this.gl.info.render.calls - sceneCalls : 0;
      this.telemetry.gauges.quality = this.q.name;
      const ft = this.telemetry.frame.count ? this.telemetry.frame.last() : 16;
      // resizing clears the canvas: apply it before the next frame draws, never after this one
      if (this.guard.sample(ft)) this.pendingResize = true;
    }
  }
  /** Screen pixel -> sim ground coordinate (for input). */
  screenToWorld(px, py) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x / S, y: hit.z / S };
  }
  /** Allocation-free projection for per-frame UI (canvas-relative CSS px); out.visible = in front of the camera. */
  project(x, y, h, out) {
    const v = this._pv.set(x * S, h, y * S).project(this.camera);
    out.x = (v.x + 1) / 2 * this.cssW; out.y = (1 - v.y) / 2 * this.cssH; out.visible = v.z < 1;
    return out;
  }
  /** Release the GL context and listeners; the shared AssetLibrary stays loaded for the next match. */
  dispose() {
    removeEventListener('resize', this._onResize);
    if (this.post && this.post.dispose) this.post.dispose();
    this.gl.dispose(); this.gl.forceContextLoss();
  }
  worldToScreen(x, y, h = 0) {
    const v = new THREE.Vector3(x * S, h, y * S).project(this.camera); const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, visible: v.z < 1 };
  }
}
