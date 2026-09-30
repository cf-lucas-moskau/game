import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Online play only works between identical simulations: the build id is a hash of every file that decides a match
// (sim, core, net). Players on different builds are refused at the lobby door (src/net/lobby.js).
function buildId() {
  const h = createHash('sha1');
  const walk = (d) => readdirSync(d).sort().forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else { h.update(p); h.update(readFileSync(p)); } });
  for (const d of ['src/sim', 'src/core', 'src/net']) walk(d);
  return h.digest('hex').slice(0, 12);
}

// Produces one self-contained dist/index.html: JS, CSS and every asset
// (GLB models, textures) inlined, so the game can be hosted as a single file.
export default defineConfig({
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.glb'],
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 20_000,
    reportCompressedSize: false,
  },
  server: { host: true },
});
