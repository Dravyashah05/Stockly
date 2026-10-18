import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { stocklyApiProxy } from './vite.stockly-proxy.ts'

/**
 * Website-only build → dist-web (Vercel output for the marketing site).
 * Entries: index.html + store.html → src/web/*. No mobile-app code bundled.
 * Usage: `npm run build:web`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), stocklyApiProxy()],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        site: resolve(import.meta.dirname, 'index.html'),
        store: resolve(import.meta.dirname, 'store.html'),
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
})
