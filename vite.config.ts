import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      // Two independent pages: the Capacitor app (index.html, unchanged)
      // and the marketing + store site (site.html). Neither loads the other.
      input: {
        app: resolve(import.meta.dirname, 'index.html'),
        site: resolve(import.meta.dirname, 'site.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            return 'libs';
          }
        },
      },
    },
  },
})
