import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'stockly-apps-script-dev-proxy',
    configureServer(server) {
    // Google Apps Script ContentService redirects its response to
    // script.googleusercontent.com without CORS headers. Fetch upstream from
    // Node in dev so the browser only talks to its own Vite origin.
    // Registered WITHOUT a path prefix on purpose: an explicit prefix check
    // below guarantees every /__stockly_api hit gets a JSON answer (a bare
    // 404 then proves the page is talking to a stale/wrong dev server).
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.startsWith('/__stockly_api')) {
        next();
        return;
      }
      void (async () => {
        if (req.method !== 'GET' && req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const requestUrl = new URL(req.url || '/', 'http://localhost');
          const targetValue = requestUrl.searchParams.get('target');
          if (!targetValue) throw new Error('Missing Apps Script URL.');

          const target = new URL(targetValue);
          if (
            target.protocol !== 'https:' ||
            target.hostname !== 'script.google.com' ||
            !target.pathname.startsWith('/macros/s/')
          ) {
            throw new Error('The API proxy only accepts Google Apps Script Web-App URLs.');
          }
          requestUrl.searchParams.forEach((value, key) => {
            if (key !== 'target') target.searchParams.set(key, value);
          });

          const init: RequestInit = { method: req.method, redirect: 'follow' };
          if (req.method === 'POST') {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            init.body = Buffer.concat(chunks);
            init.headers = { 'Content-Type': req.headers['content-type'] || 'text/plain;charset=utf-8' };
          }

          const upstream = await fetch(target, init);
          console.log(`[stockly-proxy] ${req.method} ${target.pathname} action=${target.searchParams.get('action') || '?'} → upstream ${upstream.status}`);
          let upstreamHost = '';
          try {
            upstreamHost = new URL(upstream.url).hostname;
          } catch {
            upstreamHost = target.hostname;
          }
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
          // Same contract as the Vercel proxy (api/stockly.ts): the frontend
          // detects Google sign-in/access pages via these headers + body sniffing.
          if (upstreamHost) res.setHeader('X-Stockly-Upstream-Host', upstreamHost);
          res.setHeader('X-Stockly-Upstream-Redirected', String(upstream.redirected));
          res.setHeader('X-Stockly-Upstream-Status', String(upstream.status));
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Apps Script proxy request failed.';
          console.error(`[stockly-proxy] ${message}`);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: message }));
        }
      })();
    });
    },
  }],
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
      // Two independent pages: the app (app.html) and the marketing + store
      // site (index.html, the main landing page). Neither loads the other.
      // Capacitor Android boots index.html, which hands native runtimes
      // straight to app.html (see the inline snippet there).
      input: {
        app: resolve(import.meta.dirname, 'app.html'),
        site: resolve(import.meta.dirname, 'index.html'),
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
