import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Stockly owner console — dev on http://localhost:3002.
// /api/* is proxied to the ONE shared backend (server/, port 5000), so the
// admin frontend and the user app always talk to the same API.
const BACKEND = process.env.STOCKLY_API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 3002,
    strictPort: true,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3002,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    chunkSizeWarningLimit: 600,
  },
});
