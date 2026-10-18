import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// Android app preview — dev on http://localhost:3001. Browser development
// proxies /api/* to the shared backend; native builds embed the public HTTPS
// API origin directly and cannot silently ship with a localhost endpoint.
const BACKEND = process.env.STOCKLY_API_URL || 'http://localhost:5000';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (command === 'build') {
    const configured = env.VITE_API_BASE_URL?.trim();
    let api: URL | undefined;
    try {
      api = configured ? new URL(configured) : undefined;
    } catch {
      throw new Error('Set VITE_API_BASE_URL to the public HTTPS API origin in mobile-app/.env before building Android.');
    }
    if (!api || api.protocol !== 'https:' || api.pathname !== '/' || api.search || api.hash || api.username || api.password) {
      throw new Error('Set VITE_API_BASE_URL to the public HTTPS API origin in mobile-app/.env before building Android.');
    }
  }
  return ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^react$/, replacement: resolve(import.meta.dirname, 'node_modules/react') }],
    dedupe: ['react'],
  },
  server: {
    host: true,
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target: BACKEND,
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
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Lazily imported by rarely-opened screens (QR scanner, QR
            // renderer): keep them in their own on-demand chunks instead of
            // the upfront `libs` bundle.
            if (id.includes('html5-qrcode') || id.includes('react-qr-code')) return undefined;
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            return 'libs';
          }
        },
      },
    },
  },
  });
});
