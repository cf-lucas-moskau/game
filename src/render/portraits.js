// Portrait studio: paints a portrait of any hero in any skin at runtime, from the same model, props and
// palette the game draws. A bust shot is lit like a studio portrait (warm key, cool fill, a rim light in the
// hero's accent), then a painterly pass turns it into a painting: a Kuwahara filter flattens shading into
// brush strokes, the silhouette gets an ink edge and an accent halo, the backdrop is a tinted wash with
// directional strokes, and a canvas grain sits on top. New heroes and skins get portraits for free.
//
//   const studio = new PortraitStudio(lib); const url = await studio.paint('saffi', 'bluewick');
// One WebGL context, created on first use and released after a short idle; portraits are cached as data URLs.
import * as THREE from 'three';
import { HeroView } from './units.js';
import { resolveLook } from '../assets/skins.js';

const SIZE = 320;
const POST = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `precision highp float;
    uniform sampler2D tFig; uniform vec2 texel; uniform vec3 accent, deep; uniform float seed;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    // Kuwahara (4 quadrants, radius R): take the mean of the quadrant with the lowest variance -> flat strokes
    vec4 kuwahara(vec2 uv){
      const int R = 4; vec3 m[4]; vec3 s[4]; float a[4];
      for (int k = 0; k < 4; k++) { m[k] = vec3(0.); s[k] = vec3(0.); a[k] = 0.; }
      for (int j = -R; j <= R; j++) for (int i = -R; i <= R; i++) {
        vec4 c = texture2D(tFig, uv + vec2(float(i), float(j)) * texel); vec3 v = c.rgb;
        if (i <= 0 && j <= 0) { m[0] += v; s[0] += v * v; a[0] += c.a; }
        if (i >= 0 && j <= 0) { m[1] += v; s[1] += v * v; a[1] += c.a; }
        if (i <= 0 && j >= 0) { m[2] += v; s[2] += v * v; a[2] += c.a; }
        if (i >= 0 && j >= 0) { m[3] += v; s[3] += v * v; a[3] += c.a; }
      }
      float n = float((R + 1) * (R + 1)), best = 1e9; vec4 outc = vec4(0.);
      for (int k = 0; k < 4; k++) {
        vec3 mu = m[k] / n, va = abs(s[k] / n - mu * mu); float v = va.r + va.g + va.b;
        if (v < best) { best = v; outc = vec4(mu, a[k] / n); }
      }
      return outc;
    }
    void main(){
      vec2 uv = vUv, p = uv - .5;
      // backdrop: accent wash from light (top-left) to deep, with diagonal brush strokes and blotches
      float strokes = noise(vec2(uv.x * 3. + uv.y * 9., uv.y * 2.) * 4. + seed) * .6 + noise(uv * 18. + seed) * .4;
      vec3 bg = mix(accent * 1.05, deep, smoothstep(-.1, .9, uv.x * .45 + (1. - uv.y) * .75 + strokes * .25));
      bg *= .88 + .24 * strokes; bg = mix(bg, accent * 1.3, smoothstep(.55, .0, length(p - vec2(-.1, .15))) * .35);
      // figure, painted
      vec4 fig = kuwahara(uv); vec3 col = pow(aces(fig.rgb * 0.95), vec3(1. / 2.2));
      col = mix(col, col * (.9 + .2 * noise(uv * 60. + seed)), .6);        // bristle variation
      float lum = dot(col, vec3(.299, .587, .114)); col = mix(vec3(lum), col, 1.05); // a touch more colour
      // silhouette: ink edge from the alpha gradient, and an accent halo outside it
      float ax = texture2D(tFig, uv + vec2(texel.x * 1.5, 0.)).a - texture2D(tFig, uv - vec2(texel.x * 1.5, 0.)).a;
      float ay = texture2D(tFig, uv + vec2(0., texel.y * 1.5)).a - texture2D(tFig, uv - vec2(0., texel.y * 1.5)).a;
      float edge = smoothstep(.15, .7, length(vec2(ax, ay)));
      float halo = 0.; for (int k = 0; k < 8; k++) { float an = float(k) * .7854; halo += texture2D(tFig, uv + vec2(cos(an), sin(an)) * texel * 7.).a; }
      halo = clamp(halo / 8. - fig.a, 0., 1.);
      vec3 c = mix(bg + accent * halo * .9, col, smoothstep(.35, .65, fig.a));
      c = mix(c, deep * .35, edge * .75);
      // canvas: fine grain and a faint weave, soft vignette
      float grain = hash(uv * 900. + seed) - .5, weave = (sin(uv.x * 640.) * sin(uv.y * 640.)) * .5;
      c += grain * .05 + weave * .015; c *= 1. - dot(p, p) * .55;
      gl_FragColor = vec4(c, 1.);
    }`,
};

export class PortraitStudio {
  constructor(lib) { this.lib = lib; this.cache = new Map(); this.pending = new Map(); this.queue = Promise.resolve(); this.gl = null; this.idle = 0; }
  /** Cached portrait (data URL) or null. */
  get(hero, skin = 'classic') { return this.cache.get(`${hero}:${skin}`) || null; }
  /** Portrait for a hero/skin (data URL), painted once and cached. Paints one at a time. */
  paint(hero, skin = 'classic') {
    const key = `${hero}:${skin}`;
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const job = this.queue = this.queue.then(() => new Promise((res) => requestAnimationFrame(() => res()))).then(() => {
      const url = this.render(hero, skin); this.cache.set(key, url); this.pending.delete(key); this.scheduleRelease(); return url;
    });
    this.pending.set(key, job);
    return job;
  }
  setup() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
    const gl = this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    gl.setPixelRatio(1); gl.setSize(SIZE, SIZE, false); gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 4, type: THREE.HalfFloatType });
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
    this.post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...POST, depthTest: false, depthWrite: false,
      uniforms: { tFig: { value: this.rt.texture }, texel: { value: new THREE.Vector2(1 / SIZE, 1 / SIZE) }, accent: { value: new THREE.Color() }, deep: { value: new THREE.Color() }, seed: { value: 0 } } }));
    this.postScene = new THREE.Scene(); this.postScene.add(this.post); this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(hero, skin) {
    if (!this.gl) this.setup();
    const look = resolveLook(hero, skin), scene = new THREE.Scene();
    // lights: warm key (front-left, high), cool fill (right), accent rim (behind), soft sky
    const accent = new THREE.Color(look.accent);
    const key = new THREE.DirectionalLight('#fff1dc', 2.1); key.position.set(-1.2, 2.2, 2.4);
    const fill = new THREE.DirectionalLight('#9fb8ff', 0.9); fill.position.set(2, 0.6, 1.2);
    const rim = new THREE.DirectionalLight(accent, 3.2); rim.position.set(0.6, 1.4, -2.5);
    scene.add(key, fill, rim, new THREE.HemisphereLight('#c9d4ff', '#3a2e48', 0.7));
    const view = new HeroView(this.lib, { heroKey: hero, id: -1, team: 0 }, scene, skin);
    for (const g of view.glows) { const l = new THREE.PointLight(g.color, 1.2, 1.2, 1.5); g.anchor.add(l); }
    const a = view.actions.idle; if (a) { a.time = 0.35; }
    view.mixer.update(0); view.body.updateMatrixWorld(true);
    // frame from what is actually drawn: a small front silhouette gives the true top and height of the posed
    // body (bone matrices and fitted heights are not reliable before a render), then the camera frames the head
    // and shoulders: a chibi head is about the top 45% of the figure.
    const sil = this.silhouette(scene), top = sil.top, height = Math.max(0.2, sil.top - sil.bottom);
    const target = new THREE.Vector3(sil.cx, top - height * 0.33, 0), d = (height * 0.78) / (2 * Math.tan((13 * Math.PI) / 180));
    this.camera.position.set(target.x + d * 0.3, target.y + d * 0.06, target.z + d * 0.95); this.camera.lookAt(target);
    this.lastFrame = { top, height, cx: sil.cx };
    const gl = this.gl;
    gl.setRenderTarget(this.rt); gl.setClearColor(0x000000, 0); gl.clear(); gl.render(scene, this.camera);
    const u = this.post.material.uniforms;
    u.accent.value.copy(accent); u.deep.value.copy(accent).multiplyScalar(0.18).lerp(new THREE.Color('#141633'), 0.55); u.seed.value = (hash(hero + skin) % 997) / 97;
    gl.setRenderTarget(null); gl.render(this.postScene, this.postCam);
    const url = gl.domElement.toDataURL('image/png');
    view.dispose(); scene.traverse((o) => { if (o.isSkinnedMesh) { o.geometry.dispose(); o.material.dispose(); } });
    return url;
  }
  /** Bounds of the drawn figure seen from the front: render alpha at 96 x 96 over 3 x 3 units and scan it. */
  silhouette(scene) {
    const N = 96, ext = 3, gl = this.gl;
    if (!this.silRt) { this.silRt = new THREE.WebGLRenderTarget(N, N); this.silCam = new THREE.OrthographicCamera(-ext / 2, ext / 2, ext, 0, -10, 10); this.silPx = new Uint8Array(N * N * 4); }
    this.silCam.position.set(0, 0, 5); this.silCam.lookAt(0, 0, 0); this.silCam.updateMatrixWorld();
    gl.setRenderTarget(this.silRt); gl.setClearColor(0x000000, 0); gl.clear(); gl.render(scene, this.silCam);
    gl.readRenderTargetPixels(this.silRt, 0, 0, N, N, this.silPx); gl.setRenderTarget(null);
    let top = -1, bottom = N, minX = N, maxX = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.silPx[(y * N + x) * 4 + 3] > 20) { if (y > top) top = y; if (y < bottom) bottom = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
    if (top < 0) return { top: 1, bottom: 0, cx: 0 };
    return { top: ((top + 1) / N) * ext, bottom: (bottom / N) * ext, cx: (((minX + maxX + 1) / 2) / N - 0.5) * ext };
  }
  /** Release the GL context once nothing has been painted for a while (portraits stay cached). */
  scheduleRelease() { clearTimeout(this.idle); this.idle = setTimeout(() => this.release(), 3000); }
  release() {
    if (!this.gl) return;
    this.rt.dispose(); this.post.geometry.dispose(); this.post.material.dispose(); if (this.silRt) { this.silRt.dispose(); this.silRt = null; }
    this.gl.dispose(); this.gl.forceContextLoss(); this.gl = null;
  }
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
