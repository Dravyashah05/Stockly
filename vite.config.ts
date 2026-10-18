import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { stocklyApiProxy } from './vite.stockly-proxy.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), stocklyApiProxy()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Independent pages: the mobile app (app.html → src/app), the
      // marketing site (index.html → src/web) and the dedicated store page
      // (store.html → src/web). None loads the others. For isolated
      // artifacts use `npm run build:app` (mobile/dist-app, Capacitor) and
      // `npm run build:web` (dist-web, Vercel).
      // Capacitor Android boots index.html, which hands native runtimes
      // straight to app.html (see the inline snippet there).
      input: {
        app: resolve(import.meta.dirname, 'app.html'),
        site: resolve(import.meta.dirname, 'index.html'),
        store: resolve(import.meta.dirname, 'store.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // The QR scanner is loaded lazily only when linking a device —
            // keep it out of the shared upfront chunk.
            if (id.includes('html5-qrcode')) return undefined;
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            return 'libs';
          }
        },
      },
    },
  },
})
