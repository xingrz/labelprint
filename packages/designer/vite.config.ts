import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Use the shared source directly so the designer preview and the server print
      // path are literally the same compiler — and HMR works without rebuilding shared.
      '@labelprint/shared': path.resolve(here, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 so the port is reachable from the host (Docker dev)
    proxy: {
      // Same-origin /api during dev -> the Fastify server (no CORS needed).
      // In Docker compose this is http://server:5179; locally it's localhost.
      '/api': process.env.LABELPRINT_API_PROXY ?? 'http://localhost:5179',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
