import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const backend = process.env.STOCKLY_API_URL || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react$/,
        replacement: resolve(import.meta.dirname, "node_modules/react"),
      },
    ],
    dedupe: ["react"],
  },
  server: {
    host: true,
    port: 3003,
    strictPort: true,
    proxy: { "/api": { target: backend, changeOrigin: true } },
  },
  preview: { port: 3003 },
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
