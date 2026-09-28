// HDR scene target -> dual-filter bloom at half resolution -> ACES tone map + sRGB, one composite.
import * as THREE from 'three';

const quadVS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
export class PostFX {
  constructor(renderer, { levels = 4, msaa = 0 } = {}) {
    this.r = renderer; this.levels = levels;
    const opts = { type: THREE.HalfFloatType, depthBuffer: true, samples: msaa };
    this.scene = new THREE.WebGLRenderTarget(1, 1, opts);
    this.mips = []; for (let i = 0; i < levels; i++) this.mips.push(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }));
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.down = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } }, vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
        void main(){ vec3 c = s(vec2(0))*4. + s(vec2(-1,-1)) + s(vec2(1,-1)) + s(vec2(-1,1)) + s(vec2(1,1)); c /= 8.;
          if (uThreshold > 0.) { float l = max(c.r, max(c.g, c.b)); c *= smoothstep(uThreshold, uThreshold + 0.6, l); }
          gl_FragColor = vec4(c, 1.); }` });
    this.up = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, vertexShader: quadVS, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
      fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
        void main(){ vec3 c = s(vec2(-2,0)) + s(vec2(2,0)) + s(vec2(0,-2)) + s(vec2(0,2)) + (s(vec2(-1,1)) + s(vec2(1,1)) + s(vec2(-1,-1)) + s(vec2(1,-1)))*2.;
          gl_FragColor = vec4(c/12., 1.); }` });
    this.comp = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.55 }, uVignette: { value: 0.35 }, uFlash: { value: new THREE.Vector4(0, 0, 0, 0) } }, vertexShader: quadVS,
      fragmentShader: `uniform sampler2D tScene, tBloom; uniform float uBloom, uVignette; uniform vec4 uFlash; varying vec2 vUv;
        void main(){ vec3 c = texture2D(tScene, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
          c = mix(c, uFlash.rgb, uFlash.a);
          vec2 d = vUv - 0.5; c *= 1. - dot(d,d) * uVignette * 1.6;
          gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
    this.comp.toneMapped = true;
  }
  setSize(w, h) {
    this.scene.setSize(w, h);
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (const m of this.mips) { m.setSize(mw, mh); mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1); }
  }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qscene, this.cam); }
  render(scene, camera, info) {
    const r = this.r;
    r.setRenderTarget(this.scene); r.render(scene, camera);
    this.sceneCalls = info ? info.render.calls : 0;
    // downsample chain (first pass thresholds)
    let src = this.scene.texture, sw = this.scene.width, sh = this.scene.height;
    this.mips.forEach((m, i) => {
      this.down.uniforms.tSrc.value = src; this.down.uniforms.uTexel.value.set(1 / sw, 1 / sh); this.down.uniforms.uThreshold.value = i === 0 ? 1.0 : 0;
      this.pass(this.down, m); src = m.texture; sw = m.width; sh = m.height;
    });
    // upsample, accumulating into the next larger mip
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i], d = this.mips[i - 1];
      this.up.uniforms.tSrc.value = s.texture; this.up.uniforms.uTexel.value.set(0.5 / s.width, 0.5 / s.height);
      d.texture; r.autoClear = false; this.pass(this.up, d); r.autoClear = true;
    }
    this.comp.uniforms.tScene.value = this.scene.texture; this.comp.uniforms.tBloom.value = this.mips[0].texture;
    this.pass(this.comp, null);
  }
}
