// Runtime texture atlas for the CC0 models. Every textured model ships its own palette or prop
// texture (19 distinct maps, 512-1024 px) and so its own material; the renderer then switched
// programs and re-uploaded uniforms for each. At load, identical images are merged, each distinct
// image gets a padded cell in one atlas, UVs are remapped into the cell, and all textured meshes
// share one material. Replacing a model's art needs no change here: the atlas is rebuilt from
// whatever the models carry.
import * as THREE from 'three';

const SIZE = 2048, TILE = 256, PAD = 8, CELL = TILE + PAD * 2, COLS = Math.floor(SIZE / CELL);

/** FNV-1a over a downscaled copy of the image: identical art in different files maps to one cell. */
function hashPixels(data) { let h = 0x811c9dc5; for (let i = 0; i < data.length; i += 3) { h ^= data[i]; h = Math.imul(h, 0x01000193); } return h >>> 0; }

function remapUV(geometry, cell) {
  if (geometry.userData.atlasCell) return;
  const a = geometry.attributes.uv; if (!a) return;
  const f = new Float32Array(a.count * 2);
  const ox = (cell.x + PAD) / SIZE, oy = (cell.y + PAD) / SIZE, s = TILE / SIZE;
  for (let i = 0; i < a.count; i++) {
    const u = Math.min(1, Math.max(0, a.getX(i))), v = Math.min(1, Math.max(0, a.getY(i)));
    f[i * 2] = ox + u * s; f[i * 2 + 1] = oy + v * s;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(f, 2));
  geometry.userData.atlasCell = cell;
}

const GRID_X = 8, GRID_Y = 4;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/**
 * Apply palette swaps to a TILE x TILE copy of a palette texture. layout: { name: [col, row] } on an
 * 8 x 4 grid; swaps: { name: otherName | '#rrggbb' }. A named target copies that column's pixels (its
 * shading included); a hex target tints the column, scaling the colour by each pixel's luminance
 * relative to the column's mean so the gradient survives.
 */
export function recolor(img, layout, swaps) {
  const d = img.data, W = img.width, cw = W / GRID_X, ch = img.height / GRID_Y, src = new Uint8ClampedArray(d);
  const lum = (i) => 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
  for (const name in swaps) {
    const at = layout[name], to = swaps[name]; if (!at) continue;
    const x0 = Math.round(at[0] * cw), y0 = Math.round(at[1] * ch), w = Math.round(cw), h = Math.round(ch);
    if (to[0] === '#') {
      const rgb = hexRgb(to); let mean = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) mean += lum((y * W + x) * 4);
      mean /= w * h || 1;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
        const i = (y * W + x) * 4, k = lum(i) / (mean || 1);
        d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k;
      }
    } else {
      const from = layout[to]; if (!from) continue;
      const fx = Math.round(from[0] * cw), fy = Math.round(from[1] * ch);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = ((y0 + y) * W + x0 + x) * 4, j = ((fy + y) * W + fx + x) * 4;
        d[i] = src[j]; d[i + 1] = src[j + 1]; d[i + 2] = src[j + 2];
      }
    }
  }
  return img;
}
/**
 * Pack every textured MeshStandardMaterial in the given glTF scenes into one atlas.
 * Returns { texture, material, cells, sources } (material is shared by all remapped meshes).
 */
export function buildAtlas(gltfs, variants = []) {
  const meshes = [], modelImage = {};
  for (const k in gltfs) gltfs[k].scene.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material.map && o.material.map.image) { meshes.push(o); if (o.isSkinnedMesh && !modelImage[k]) modelImage[k] = o.material.map.image; }
  });
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const probe = document.createElement('canvas'); probe.width = probe.height = TILE;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  const byImage = new Map(), byHash = new Map(); let n = 0;
  const cellFor = (img) => {
    let cell = byImage.get(img); if (cell) return cell;
    pctx.clearRect(0, 0, TILE, TILE); pctx.drawImage(img, 0, 0, TILE, TILE);
    const h = hashPixels(pctx.getImageData(0, 0, TILE, TILE).data);
    cell = byHash.get(h);
    if (!cell) {
      if (n >= COLS * COLS) return null; // atlas full: the mesh keeps its own texture
      cell = { x: (n % COLS) * CELL, y: Math.floor(n / COLS) * CELL, index: n++ };
      // stretched copy under the tile extends its border colours into the padding (no bleeding at mips)
      ctx.drawImage(probe, cell.x, cell.y, CELL, CELL);
      ctx.drawImage(probe, cell.x + PAD, cell.y + PAD);
      byHash.set(h, cell);
    }
    byImage.set(img, cell); return cell;
  };
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false; // glTF UV convention: origin at the top-left
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0, name: 'atlas' });
  // palette variants (skins): a recoloured copy of a model's palette in its own cell
  const out = {};
  for (const v of variants) {
    const img = modelImage[v.model]; if (!img) continue;
    const from = cellFor(img); if (!from || n >= COLS * COLS) continue;
    pctx.clearRect(0, 0, TILE, TILE); pctx.drawImage(img, 0, 0, TILE, TILE);
    const data = pctx.getImageData(0, 0, TILE, TILE); recolor(data, v.layout, v.swaps); pctx.putImageData(data, 0, 0);
    const to = { x: (n % COLS) * CELL, y: Math.floor(n / COLS) * CELL, index: n++ };
    ctx.drawImage(probe, to.x, to.y, CELL, CELL); ctx.drawImage(probe, to.x + PAD, to.y + PAD);
    out[v.id] = { u0: (from.x + PAD) / SIZE, v0: (from.y + PAD) / SIZE, size: TILE / SIZE, du: (to.x - from.x) / SIZE, dv: (to.y - from.y) / SIZE };
  }
  const old = new Set();
  for (const m of meshes) {
    const cell = cellFor(m.material.map.image); if (!cell) continue;
    remapUV(m.geometry, cell); old.add(m.material); m.material = material;
  }
  for (const mat of old) { if (mat.map) mat.map.dispose(); mat.dispose(); }
  return { texture, material, cells: n, sources: byImage.size, variants: out };
}
