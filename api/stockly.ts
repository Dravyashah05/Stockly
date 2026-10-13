/* Vercel serverless proxy for the Stockly Apps Script backend.
 *
 * Browsers cannot call Apps Script directly (its ContentService redirect
 * drops CORS headers), so hosted web builds go through this same-origin
 * route instead: `vercel.json` rewrites `/__stockly_api` here, so dev
 * (Vite middleware) and production share ONE frontend URL and contract.
 * Native Capacitor builds never touch this route (they call Google direct).
 *
 * Routes: GET/POST /__stockly_api?target=<exec-url>&action=... (proxied).
 *         GET      /api/stockly?probe=1 (liveness check, no target needed).
 */

type QueryValue = string | string[] | undefined;

interface ProxyReq {
  method?: string;
  query: Record<string, QueryValue>;
  body?: unknown;
}

interface ProxyRes {
  status: (code: number) => ProxyRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
}

function first(v: QueryValue): string | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

export default async function handler(req: ProxyReq, res: ProxyRes): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).send('');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }
  // Liveness probe the client uses to detect this route (no target needed).
  if (first(req.query.probe) === '1' && !first(req.query.target)) {
    res.status(200).json({ success: true, proxy: 'stockly' });
    return;
  }
  try {
    const targetValue = first(req.query.target);
    if (!targetValue) throw new Error('Missing Apps Script URL.');
    const target = new URL(targetValue);
    if (
      target.protocol !== 'https:' ||
      target.hostname !== 'script.google.com' ||
      !target.pathname.startsWith('/macros/s/')
    ) {
      throw new Error('The API proxy only accepts Google Apps Script Web-App URLs.');
    }
    if (req.method === 'GET') {
      for (const [key, value] of Object.entries(req.query)) {
        const v = first(value);
        if (key !== 'target' && key !== 'probe' && v !== undefined) target.searchParams.set(key, v);
      }
    }
    const init: RequestInit = { method: req.method, redirect: 'follow' };
    if (req.method === 'POST') {
      // Vercel hands text/plain bodies to us as a string; stay correct if a
      // runtime ever gives parsed JSON or raw bytes instead of corrupting it.
      const rawBody = req.body;
      init.body =
        typeof rawBody === 'string'
          ? rawBody
          : typeof Buffer !== 'undefined' && Buffer.isBuffer(rawBody)
            ? rawBody.toString('utf-8')
            : JSON.stringify(rawBody ?? {});
      init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    }
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    console.log(`[stockly-proxy] ${req.method} action=${target.searchParams.get('action') || '?'} -> upstream ${upstream.status}`);
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.send(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apps Script proxy request failed.';
    console.error(`[stockly-proxy] ${message}`);
    res.status(502).json({ success: false, error: message });
  }
}
