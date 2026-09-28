import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Produces one self-contained dist/index.html: JS, CSS and every asset
// (GLB models, textures) inlined, so the game can be hosted as a single file.
export default defineConfig({
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'es2022',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 20_000,
    reportCompressedSize: false,
  },
  server: { host: true },
});
