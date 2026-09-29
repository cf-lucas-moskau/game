import { describe, it, expect } from 'vitest';
import { SKINS, PALETTES, DEFAULT_SKIN, resolveLook, skinsFor, pickSkin, validSkin, paletteVariants } from '../src/assets/skins.js';
import { HERO_LOOKS, MODEL_URLS } from '../src/assets/manifest.js';
import { recolor } from '../src/render/atlas.js';
import { HERO_KEYS } from '../src/sim/heroes/index.js';
import { Rng } from '../src/core/rng.js';

/** A fake 8 x 4 palette image (cell = 2 x 2 px): every cell a flat colour, except a gradient cell. */
function palette() {
  const W = 16, H = 8, data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, c = Math.floor(x / 2), r = Math.floor(y / 2);
    data[i] = c * 30; data[i + 1] = r * 60; data[i + 2] = 100 + (y % 2) * 100; data[i + 3] = 255; // blue channel shades inside each cell
  }
  return { data, width: W, height: H };
}
const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

describe('skins', () => {
  it('every skin belongs to a hero with a look, names valid palette colours and valid assets', () => {
    for (const hero in SKINS) {
      const look = HERO_LOOKS[hero]; expect(look, hero).toBeTruthy();
      const layout = PALETTES[look.palette || 'mini']; expect(layout, hero).toBeTruthy();
      for (const key in SKINS[hero]) {
        const s = SKINS[hero][key];
        expect(s.name, `${hero}:${key}`).toBeTruthy();
        for (const [from, to] of Object.entries(s.palette || {})) {
          expect(layout[from], `${hero}:${key} swaps unknown colour ${from}`).toBeTruthy();
          expect(to.startsWith('#') ? /^#[0-9a-f]{6}$/i.test(to) : !!layout[to], `${hero}:${key} -> ${to}`).toBe(true);
        }
        for (const p of Object.values(s.props || {})) if (p && p.key) expect(MODEL_URLS[p.key], `${hero}:${key} prop ${p.key}`).toBeTruthy();
        if (s.model) expect(MODEL_URLS[s.model]).toBeTruthy();
      }
    }
  });
  it('resolves looks: classic is the manifest look, skins patch it', () => {
    const c = resolveLook('saffi', DEFAULT_SKIN);
    expect(c.model).toBe(HERO_LOOKS.saffi.model); expect(c.variant).toBe(null); expect(c.props).toEqual(HERO_LOOKS.saffi.props);
    const b = resolveLook('saffi', 'bluewick');
    expect(b.variant).toBe('saffi:bluewick'); expect(b.accent).toBe(SKINS.saffi.bluewick.accent);
    expect(b.props[1].glow).toBe('#7fd0ff'); expect(b.props[1].key).toBe(HERO_LOOKS.saffi.props[1].key); // patched, not replaced
    expect(b.props[0]).toEqual(HERO_LOOKS.saffi.props[0]);
    expect(HERO_LOOKS.saffi.props[1].glow).toBe('#ffb35c'); // the manifest look is untouched
    expect(resolveLook('saffi', 'nope').skin).toBe(DEFAULT_SKIN);
    expect(resolveLook('gus', 'frost-miner').pebbleTint).toBeTruthy();
  });
  it('lists classic first for every hero and validates keys', () => {
    for (const h of HERO_KEYS) { const l = skinsFor(h); expect(l[0].key).toBe(DEFAULT_SKIN); expect(validSkin(h, DEFAULT_SKIN)).toBe(true); }
    expect(validSkin('morrow', 'tidewright')).toBe(true); expect(validSkin('morrow', 'bluewick')).toBe(false);
    expect(paletteVariants().length).toBe(Object.values(SKINS).reduce((n, s) => n + Object.values(s).filter((x) => x.palette).length, 0));
  });
  it('bot skin picks are deterministic per seed and always valid', () => {
    const run = (seed) => { const r = new Rng(seed); return HERO_KEYS.map((h) => pickSkin(h, () => r.next())); };
    expect(run(5)).toEqual(run(5));
    for (let s = 1; s < 30; s++) run(s).forEach((k, i) => expect(validSkin(HERO_KEYS[i], k)).toBe(true));
  });
  it('recolour copies a named column (with its shading) and tints to hex keeping the gradient', () => {
    const layout = { a: [1, 2], b: [3, 1], c: [5, 3] };
    const img = palette(), before = palette();
    recolor(img, layout, { a: 'b', c: '#ff0000' });
    // a (cell 1,2 = px 2..3, 4..5) now equals b's pixels row by row
    expect(px(img, 2, 4)).toEqual(px(before, 6, 2)); expect(px(img, 3, 5)).toEqual(px(before, 7, 3));
    // c is red, darker on the darker row, brighter on the brighter one
    const lo = px(img, 10, 6), hi = px(img, 10, 7);
    expect(lo[1]).toBe(0); expect(lo[2]).toBe(0); expect(hi[0]).toBeGreaterThan(lo[0]);
    // everything else untouched
    expect(px(img, 0, 0)).toEqual(px(before, 0, 0)); expect(px(img, 14, 6)).toEqual(px(before, 14, 6));
  });
});
