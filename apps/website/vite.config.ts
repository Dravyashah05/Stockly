import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { stocklyApiProxy } from '../../scripts/vite.stockly-proxy.ts';

/* Responsive website dev/build (marketing pages + the web app).
 *
 * Environment: the repository root `.env` is the single source of local
 * configuration, anchored to this file — never process.cwd(). Only
 * VITE_-prefixed variables reach the browser bundle; the guard below
 * fails the build if a secret-looking key is ever exposed.
 *
 * Dev backend: /api/* is proxied to the shared Express backend on PORT
 * (root .env, default 5000), so the website and the mobile app always
 * talk to the same API implementation during development.
 *
 * Output goes to the repository root `dist/` — the directory the Vercel
 * deployment serves (see vercel.json). */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const outDir = fileURLToPath(new URL('../../dist', import.meta.url));

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
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      target: 'esnext',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        input: {
          site: fileURLToPath(new URL('./index.html', import.meta.url)),
          store: fileURLToPath(new URL('./store.html', import.meta.url)),
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
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
