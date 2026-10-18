/* Stockly shared backend — ONE Express process, ONE API implementation.
 *
 * Transport adapter only: every route below delegates to the canonical
 * handlers in ../../api/*.ts — the exact same modules the Vercel
 * serverless functions use. No business logic lives here, so there is no
 * second backend to drift out of sync.
 *
 * Logical route map (all served by this process on PORT, default 5000):
 *   /api/auth      user authentication + sessions      (api/auth.ts)
 *   /api/users     alias of /api/auth (account APIs)   (api/auth.ts)
 *   /api/sheets    user sheet gateway + inventory      (api/sheets.ts)
 *   /api/inventory alias of /api/sheets (inventory)    (api/sheets.ts)
 *   /api/devices   device linking + revocation         (api/devices.ts)
 *   /api/admin     protected owner APIs                (api/admin.ts)
 *   /api/stockly   legacy Apps Script proxy            (api/stockly.ts)
 *   /api/health    liveness probe (this file only)
 *
 * Owner authorization is enforced server-side inside api/admin.ts (and the
 * dual-auth device admin actions inside api/devices.ts) on EVERY request.
 * Frontend route protection is cosmetic only.
 *
 * Vercel note: a persistent Express process cannot run as a Vercel
 * serverless function. On Vercel, deploy the api/*.ts functions directly
 * (they import the same handlers). Run THIS server on any long-lived Node
 * host (VPS, Render, Fly, local dev) — or `npm run dev:server` locally
 * while both frontends proxy /api/* to it.
 */

<<<<<<< HEAD
import cors from 'cors';
=======
import dotenv from 'dotenv';
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
<<<<<<< HEAD

// Load + validate the SINGLE root .env before any handler module runs
// (path anchored to this file — independent of the caller's cwd).
// Import order matters: ./env executes its loader at import time, ahead
// of the api/* handlers below.
import { loadRootEnv, validateEnvOrExit } from './env.ts';

loadRootEnv();

// Canonical handlers — the single implementation (also used by Vercel).
import adminHandler from '../../api/admin.ts';
import authHandler from '../../api/auth.ts';
import devicesHandler from '../../api/devices.ts';
import sheetsHandler from '../../api/sheets.ts';
import stocklyHandler from '../../api/stockly.ts';
=======
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load server/.env first, then fall back to repo-root .env so existing
// local setups keep working without copying files around.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../.env') });
dotenv.config({ path: path.resolve(here, '../../.env') });

// Canonical handlers — the single implementation (also used by Vercel).
import adminHandler from '../../api/admin.js';
import authHandler from '../../api/auth.js';
import devicesHandler from '../../api/devices.js';
import sheetsHandler from '../../api/sheets.js';
import stocklyHandler from '../../api/stockly.js';
import { applyApiCors } from '../../api/cors.js';
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d

type VercelQuery = Record<string, string | string[] | undefined>;
type VercelHeaders = Record<string, string | string[] | undefined>;

interface VercelStyleReq {
  method?: string;
  headers?: VercelHeaders;
  query?: VercelQuery;
  body?: unknown;
}

interface VercelStyleRes {
  status: (code: number) => VercelStyleRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  send: (body: unknown) => void;
}

type ApiHandler = (req: VercelStyleReq, res: VercelStyleRes) => Promise<void>;

/** Adapt an api/* handler (Vercel req/res shape) to Express. */
function adapt(handler: ApiHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const vReq: VercelStyleReq = {
      method: req.method,
      headers: req.headers as VercelHeaders,
      query: req.query as VercelQuery,
      body: (req as unknown as { body?: unknown }).body,
    };
    let statusCode = 200;
    const vRes: VercelStyleRes = {
      status(code: number) {
        statusCode = code;
        return vRes;
      },
      setHeader(name: string, value: string) {
        res.setHeader(name, value);
      },
      json(body: unknown) {
        res.status(statusCode).json(body);
      },
      send(body: unknown) {
        res.status(statusCode).send(body as never);
      },
    };
    void handler(vReq, vRes).catch(next);
  };
}

<<<<<<< HEAD
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  // Same CORS posture as the handlers themselves (open, token-auth, no cookies).
  app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Session'] }));
=======
/** Required secrets (names only — values are never read here beyond
 *  presence). Missing entries are logged at startup so a misconfigured
 *  deploy fails visibly instead of serving 501s from every route. */
const REQUIRED_ENV = [
  'ADMIN_SCRIPT_URL',
  'ADMIN_SCRIPT_TOKEN',
  'ADMIN_SETUP_KEY',
  'ADMIN_SESSION_SECRET',
  'DEVICE_SESSION_SECRET',
  'AUTH_SESSION_SECRET',
] as const;

export function missingEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
  return REQUIRED_ENV.filter((name) => !(env[name] ?? '').trim());
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    applyApiCors(req, res);
    next();
  });
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ type: 'text/plain', limit: '1mb' }));

  const auth = adapt(authHandler as ApiHandler);
  const admin = adapt(adminHandler as ApiHandler);
  const devices = adapt(devicesHandler as ApiHandler);
  const sheets = adapt(sheetsHandler as ApiHandler);
  const stockly = adapt(stocklyHandler as unknown as ApiHandler);

  app.get('/api/health', (_req, res) => {
<<<<<<< HEAD
    res.json({ success: true, data: { ok: true, time: new Date().toISOString(), version: '1.0.0' } });
=======
    // Liveness + configuration report (secret names and booleans only —
    // never values). A healthy-looking 200 with missing_* entries explains
    // per-route 501s without exposing anything sensitive.
    res.json({
      success: true,
      data: { ok: true, time: new Date().toISOString(), version: '1.0.0', missing: missingEnvVars() },
    });
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d
  });

  // Canonical routes (identical paths to the Vercel deployment).
  app.all('/api/auth', auth);
  app.all('/api/admin', admin);
  app.all('/api/devices', devices);
  app.all('/api/sheets', sheets);
  app.all('/api/stockly', stockly);

  // Logical aliases — same handlers, same implementation. Lets the user
  // frontend call /api/users + /api/inventory while the admin frontend
  // calls /api/admin, all reaching one backend process.
  app.all('/api/users', auth);
  app.all('/api/inventory', sheets);

<<<<<<< HEAD
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[stockly-server] unhandled error');
=======
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[stockly-server] unhandled error:', err);
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Internal server error.' });
  });

  return app;
}

const PORT = Number(process.env.PORT || '5000');
if (process.env.NODE_ENV !== 'test') {
<<<<<<< HEAD
  validateEnvOrExit();
=======
  const missing = missingEnvVars();
  if (missing.length > 0) {
    console.warn(`[stockly-server] missing env (routes using them answer 501): ${missing.join(', ')}`);
  }
>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d
  createApp().listen(PORT, () => {
    console.info(`[stockly-server] listening on http://localhost:${PORT}`);
  });
}
