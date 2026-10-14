/* Reusable API service for the Google Apps Script backend.
 *
 * - All requests go through `apiRequest(action, payload)`.
 * - GET is used for reads, POST (JSON body) for writes — avoids CORS
 *   preflight issues with Apps Script.
 * - Duplicate-submission protection: callers pass an `idempotencyKey`
 *   for stock mutations; in-flight identical requests are de-duplicated.
 * - Never resolves "success" when the request failed — errors throw.
 */

import { getApiUrl, isAppsScriptExecUrl } from './config';
import { interpretApiResponse } from './api-response';

const IN_FLIGHT = new Map<string, Promise<unknown>>();

/** Same-origin API proxy for browser builds. Apps Script's ContentService
 * redirect drops CORS headers, so browsers can't call Google directly:
 * - Vite dev serves it via middleware;
 * - Vercel rewrites it to the serverless function (see vercel.json).
 * Same URL and contract (`?target=&action=&…`, JSON POST bodies) in both
 * places. Installed native builds (Capacitor) call Google directly. */
function proxyUrl(base: string): URL {
  const url = new URL('/__stockly_api', window.location.origin);
  url.searchParams.set('target', base);
  return url;
}

function isNativeApp(): boolean {
  try {
    return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
  } catch {
    return false;
  }
}

function requestUrl(base: string): URL {
  if (!isAppsScriptExecUrl(base)) {
    throw new ApiError('The saved backend URL is not a deployed Apps Script Web App /exec URL. Update it in Settings.', undefined, false);
  }
  if (!import.meta.env.DEV && isNativeApp()) return new URL(base);
  return proxyUrl(base);
}

function networkFailureMessage(): string {
  return isNativeApp()
    ? 'Could not read the Apps Script response. Check the device connection and Web App access; the browser may report network and CORS failures the same way.'
    : 'Could not reach Stockly’s Vercel API route. Check the connection and /__stockly_api deployment; browser CORS failures can look like network errors.';
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

async function responseData<T>(res: Response): Promise<T> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    throw new ApiError('The connection ended before the API response could be read. Retry; verify the last operation before resubmitting.', res.status, true);
  }
  const result = interpretApiResponse(
    {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get('content-type') || '',
      url: res.url,
      redirected: res.redirected || res.headers.get('x-stockly-upstream-redirected') === 'true',
      upstreamHost: res.headers.get('x-stockly-upstream-host') || undefined,
    },
    text,
  );
  if (result.ok === false) throw new ApiError(result.message, result.status, result.unknownOutcome);
  return result.data as T;
}

export async function apiGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new ApiError('Backend not connected. Open Settings and paste your Apps Script Web-App URL.');

  const url = requestUrl(base);
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
      throw new ApiError(networkFailureMessage(), undefined, true);
    }
    return responseData<T>(res);
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
        fetch(requestUrl(base).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...payload }),
        }),
        30000,
      );
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(networkFailureMessage(), undefined, true);
    }
    return responseData<T>(res);
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
  deleteCategory: (id: string) =>
    apiPost<{ deleted: string; cleared: number }>('deleteCategory', { id }, { dedupe: false }),

  stockIn: (args: {
    productId: string;
    quantity: number;
    price?: number;
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
