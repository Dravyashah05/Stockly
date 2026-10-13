/* Reusable API service for the Google Apps Script backend.
 *
 * - All requests go through `apiRequest(action, payload)`.
 * - GET is used for reads, POST (JSON body) for writes — avoids CORS
 *   preflight issues with Apps Script.
 * - Duplicate-submission protection: callers pass an `idempotencyKey`
 *   for stock mutations; in-flight identical requests are de-duplicated.
 * - Never resolves "success" when the request failed — errors throw.
 */

import { getApiUrl } from './config';
import type { ApiResponse } from './types';

const IN_FLIGHT = new Map<string, Promise<unknown>>();

/** In Vite dev, call the same-origin server proxy to avoid Apps Script's
 * ContentService redirect failing the browser's CORS check. Production and
 * Capacitor keep their configured backend URL unchanged. */
function devProxyUrl(base: string): URL {
  const url = new URL('/__stockly_api', window.location.origin);
  url.searchParams.set('target', base);
  return url;
}

/** Hosted web (Vercel) goes through the same-origin serverless proxy for
 * the same CORS reason. Probed once per session; anything without the
 * route (Capacitor native, plain static hosts, file://) calls Google
 * directly instead. */
function serverProxyUrl(base: string): URL {
  const url = new URL('/api/stockly', window.location.origin);
  url.searchParams.set('target', base);
  return url;
}

let proxyDecision: 'unknown' | 'yes' | 'no' = 'unknown';
async function shouldUseSameOriginProxy(): Promise<boolean> {
  if (import.meta.env.DEV) return true;
  if (proxyDecision !== 'unknown') return proxyDecision === 'yes';
  try {
    const w = window as unknown as { Capacitor?: unknown };
    if (typeof window === 'undefined' || w.Capacitor || !window.location.origin.startsWith('http')) {
      proxyDecision = 'no';
    } else {
      const probe = await fetch(new URL('/api/stockly?probe=1', window.location.origin), { method: 'GET' });
      proxyDecision = probe.ok ? 'yes' : 'no';
    }
  } catch {
    proxyDecision = 'no';
  }
  return proxyDecision === 'yes';
}

async function requestUrl(base: string): Promise<URL> {
  if (await shouldUseSameOriginProxy()) {
    return import.meta.env.DEV ? devProxyUrl(base) : serverProxyUrl(base);
  }
  return new URL(base);
}

/** FIFO lane for write POSTs — see apiPost. Never rejects (errors are
 *  re-thrown to each caller via their own chained promise). */
let postChain: Promise<unknown> = Promise.resolve();

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

export class ApiError extends Error {
  status?: number;
  /**
   * True when the mutation may have applied server-side despite the error
   * (timeout, network drop, unreadable response). Callers must verify via
   * a targeted read (idempotency key / SKU / id) before retrying — never
   * blindly resubmit. Explicit server rejections set this to false.
   */
  unknownOutcome?: boolean;
  constructor(message: string, status?: number, unknownOutcome?: boolean) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.unknownOutcome = unknownOutcome;
  }
}

/** True when a failed mutation may still have applied — verify, don't resubmit. */
export function isUnknownOutcome(e: unknown): boolean {
  if (e instanceof ApiError) return e.unknownOutcome !== false;
  return true;
}

function withTimeout<T>(p: Promise<T>, ms = 25000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(
      () => reject(new ApiError('Request timed out. Check your connection and retry.', undefined, true)),
      ms,
    );
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function parseBody(res: Response): Promise<ApiResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as ApiResponse;
  } catch {
    throw new ApiError('Unexpected server response. Redeploy the Apps Script as a Web App with “Anyone” access.', undefined, true);
  }
}

/** Non-2xx responses still carry information: the dev proxy and Apps Script
 *  both return `{ success: false, error }` JSON on failures they understand.
 *  Surface that message instead of a bare status code — but ALWAYS keep
 *  unknownOutcome=true: a failed response never proves a mutation didn't
 *  apply, so callers must verify (idempotency key / SKU / id), never assume. */
async function serverError(res: Response): Promise<ApiError> {
  const contentType = res.headers.get('content-type') || '';
  // Non-JSON failures: a bare 404 in dev means the request never reached our
  // middleware (stale or wrong dev server on this port) — say exactly that
  // instead of a mystery status code.
  if (!contentType.includes('json')) {
    if (res.status === 404 && import.meta.env.DEV) {
      return new ApiError(
        'Dev proxy not found — stop all local servers, then run `npm run dev` fresh in the Stockly folder and hard-refresh.',
        res.status,
        true,
      );
    }
    return new ApiError(`Server error (${res.status}). Try again in a moment.`, res.status, true);
  }
  try {
    const body = (await res.json()) as ApiResponse;
    if (body && typeof body.error === 'string' && body.error.trim() !== '') {
      return new ApiError(body.error, res.status, true);
    }
  } catch {
    /* Malformed JSON — fall through to generic. */
  }
  return new ApiError(`Server error (${res.status}). Try again in a moment.`, res.status, true);
}

export async function apiGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new ApiError('Backend not connected. Open Settings and paste your Apps Script Web-App URL.');

  const url = await requestUrl(base);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Deduplicate identical concurrent reads (StrictMode remounts, refresh
  // bursts, reconnect + foreground firing together). Writes are NOT
  // deduped here — apiPost has its own idempotency-key handling.
  const key = `GET:${url.toString()}`;
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const run = (async (): Promise<T> => {
    let res: Response;
    try {
      res = await withTimeout(fetch(url.toString(), { method: 'GET', redirect: 'follow' }));
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError('Network error. Check your internet connection and try again.', undefined, true);
    }
    if (!res.ok) throw await serverError(res);
    const body = await parseBody(res);
    if (!body.success) throw new ApiError(body.error || 'Request failed.', undefined, false);
    return body.data as T;
  })();

  IN_FLIGHT.set(key, run);
  try {
    return await run;
  } finally {
    IN_FLIGHT.delete(key);
  }
}

export async function apiPost<T>(
  action: string,
  payload: Record<string, unknown> = {},
  opts: { dedupe?: boolean } = {},
): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new ApiError('Backend not connected. Open Settings and paste your Apps Script Web-App URL.');

  const key = `${action}:${(payload.idempotencyKey as string) || JSON.stringify(payload)}`;
  if (opts.dedupe !== false && IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const run = async (): Promise<T> => {
    let res: Response;
    try {
      res = await withTimeout(
        fetch((await requestUrl(base)).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload }),
        }),
        30000,
      );
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError('Network error. Check your internet connection and try again.', undefined, true);
    }
    if (!res.ok) throw await serverError(res);
    const body = await parseBody(res);
    if (!body.success) throw new ApiError(body.error || 'Request failed.', undefined, false);
    return body.data as T;
  };

  // Apps Script cold-starts slowly and serialises writes behind a script
  // lock — firing N concurrent POSTs (e.g. bulk-added products) piles every
  // execution onto LockService, so all rows sit on "Saving…" and late ones
  // time out. Queue writes FIFO: one POST in flight at a time (the backend
  // is sequential anyway). Reads stay parallel; identical concurrent calls
  // still share one flight via IN_FLIGHT above.
  const queued = postChain.then(run, run);
  postChain = queued.catch(() => undefined);
  IN_FLIGHT.set(key, queued);
  try {
    return await queued;
  } finally {
    IN_FLIGHT.delete(key);
  }
}

/* ---------- Typed endpoints ---------- */

import type {
  Category,
  DashboardStats,
  Product,
  StockTransaction,
  Supplier,
  SyncData,
} from './types';

export const api = {
  health: () => apiGet<{ time: string; version: string }>('health'),

  listProducts: () => apiGet<Product[]>('listProducts'),
  getProduct: (id: string) => apiGet<Product>('getProduct', { id }),
  createProduct: (p: Record<string, unknown>) => apiPost<Product>('createProduct', p, { dedupe: false }),
  updateProduct: (id: string, p: Record<string, unknown>) =>
    apiPost<Product>('updateProduct', { id, ...p }, { dedupe: false }),
  deleteProduct: (id: string) => apiPost<{ deleted: string }>('deleteProduct', { id }, { dedupe: false }),

  listCategories: () => apiGet<Category[]>('listCategories'),
  createCategory: (name: string) => apiPost<Category>('createCategory', { name }, { dedupe: false }),
  updateCategory: (id: string, name: string) =>
    apiPost<Category>('updateCategory', { id, name }, { dedupe: false }),
  deleteCategory: (id: string, reassignTo?: string) =>
    apiPost<{ deleted: string; reassigned: number }>('deleteCategory', { id, reassignTo: reassignTo || '' }, { dedupe: false }),

  listSuppliers: () => apiGet<Supplier[]>('listSuppliers'),
  createSupplier: (s: Record<string, unknown>) => apiPost<Supplier>('createSupplier', s, { dedupe: false }),
  updateSupplier: (id: string, s: Record<string, unknown>) =>
    apiPost<Supplier>('updateSupplier', { id, ...s }, { dedupe: false }),
  deleteSupplier: (id: string) => apiPost('deleteSupplier', { id }, { dedupe: false }),

  stockIn: (args: {
    productId: string;
    quantity: number;
    price?: number;
    supplierId?: string;
    note?: string;
    idempotencyKey: string;
  }) => apiPost<{ product: Product; transaction: StockTransaction }>('stockIn', args),

  stockOut: (args: {
    productId: string;
    quantity: number;
    reason: string;
    note?: string;
    idempotencyKey: string;
  }) => apiPost<{ product: Product; transaction: StockTransaction }>('stockOut', args),

  listTransactions: (limit = 200) => apiGet<StockTransaction[]>('listTransactions', { limit: String(limit) }),
  dashboard: () => apiGet<DashboardStats>('dashboard'),
  /**
   * Single-call sync — preferred over the individual list* calls.
   * txLimit bounds the transaction payload (dashboard only needs a few
   * recent rows; History pages the rest on demand). Old backends ignore
   * the extra param and return their default window.
   */
  sync: (txLimit = 200) => apiGet<SyncData>('sync', { txLimit: String(txLimit) }),
};
