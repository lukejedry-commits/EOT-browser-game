import { defineConfig } from 'vite';

// Project pages live at https://<user>.github.io/EOT-browser-game/
export default defineConfig({
  base: '/EOT-browser-game/',
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat'],
  },
  build: {
    target: 'es2022',
    // Rapier's compat build inlines ~1.5 MB of WASM. That is expected.
    chunkSizeWarningLimit: 6000,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
