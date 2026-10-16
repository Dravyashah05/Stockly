import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Stockly user frontend — dev on http://localhost:3001.
// /api/* is proxied to the ONE shared backend (server/, port 5000), so the
// app and the admin frontend always talk to the same API implementation.
const BACKEND = process.env.STOCKLY_API_URL || 'http://localhost:5000';

export default defineConfig({
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
