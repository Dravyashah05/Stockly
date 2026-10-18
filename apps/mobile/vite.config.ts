import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { stocklyApiProxy } from '../../scripts/vite.stockly-proxy.ts';

/* Mobile app dev/build.
 *
 * Environment: the repository root `.env` is the single source of local
 * configuration. `envDir` is anchored to this file (never process.cwd()),
 * so `npm run dev:mobile` and `npm run build:mobile` work from anywhere.
 * Only VITE_-prefixed variables reach the browser bundle; server secrets
 * stay in Node (the guard below fails the build if that is ever violated).
 *
 * Dev backend: /api/* is proxied to the shared Express backend on PORT
 * (root .env, default 5000). /__stockly_api mirrors the deployed Vercel
 * rewrite for legacy Apps Script traffic. */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const publicEnv = loadEnv(mode, repoRoot, 'VITE_');
  const portEnv = loadEnv(mode, repoRoot, ['PORT', 'NODE_ENV']);
  for (const key of Object.keys(publicEnv)) {
    if (/(SECRET|TOKEN|PASSWORD|PRIVATE|API_?KEY)/i.test(key)) {
      throw new Error(
        `[stockly] ${key} is exposed to the frontend (VITE_ prefix) but looks sensitive. ` +
          `Remove the VITE_ prefix so it stays server-side, and never bundle secrets.`,
      );
    }
  }
  const backendPort = (portEnv.PORT || '5000').trim();

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss(), stocklyApiProxy()],
    server: {
      host: true,
      port: 3001,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3001,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // The QR scanner loads lazily only when linking a device —
              // keep it out of the shared upfront chunk.
              if (id.includes('html5-qrcode')) return undefined;
              if (id.includes('react') || id.includes('react-dom')) return 'vendor';
              return 'libs';
            }
          },
        },
      },
    },
  };
});
