import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import { stocklyApiProxy } from './vite.stockly-proxy.ts'

/**
 * Mobile-app-only build → mobile/dist-app (Capacitor `webDir`, see mobile/).
 * Entry: app.html → src/app/main.tsx, emitted as index.html because Capacitor
 * boots webDir/index.html directly (no redirect hop). No site code bundled.
 * Usage: `npm run build:app`, then `npm run cap:sync`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), stocklyApiProxy()],
  build: {
    outDir: 'mobile/dist-app',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // HTML entries keep their filename; the finalize step below renames
      // app.html → index.html (Capacitor boots webDir/index.html directly).
      input: {
        app: resolve(import.meta.dirname, 'app.html'),
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
