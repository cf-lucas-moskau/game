// Asset pipeline: source GLBs (with external textures) -> self-contained, optimized GLBs in
// src/assets/models, plus src/assets/CREDITS.md. Run: node tools/assets.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, resample, quantize } from '@gltf-transform/functions';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSETS, SOURCE_ROOT } from './assets.config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/assets/models');
mkdirSync(out, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
let total = 0; const rows = [];
for (const [key, a] of Object.entries(ASSETS)) {
  const doc = await io.read(join(SOURCE_ROOT, a.src)); // resolves Textures/colormap.png relative to the file
  await doc.transform(dedup(), prune(), weld(), resample(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const anims = doc.getRoot().listAnimations().map((x) => x.getName());
  const bytes = await io.writeBinary(doc);
  writeFileSync(join(out, `${key}.glb`), bytes);
  total += bytes.byteLength;
  rows.push(`| \`${key}\` | ${a.pack} | ${a.author} | CC0 1.0 | ${(bytes.byteLength / 1024).toFixed(1)} KB | ${anims.length ? anims.join(', ') : '-'} |`);
  console.log(key.padEnd(20), (bytes.byteLength / 1024).toFixed(1).padStart(7), 'KB', anims.length ? `anims: ${anims.join(',')}` : '');
}
writeFileSync(join(root, 'src/assets/CREDITS.md'), `# Asset credits

All 3D models are released under **CC0 1.0** (public domain) by their authors:
[Kenney](https://kenney.nl) and [Kay Lousberg / KayKit](https://kaylousberg.com).
Sourced from the [Code3DBench](https://github.com/VladimirGl/Code3DBench) asset collection.
Processed by \`tools/assets.mjs\` (textures embedded, deduplicated, quantized).
Everything else (whale, sky, clouds, water, particles, UI, audio) is procedural and original.

| Key | Pack | Author | License | Size | Animations |
|---|---|---|---|---|---|
${rows.join('\n')}

Total: ${(total / 1024).toFixed(0)} KB
`);
console.log('total', (total / 1024).toFixed(0), 'KB');
