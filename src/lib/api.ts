/* Reusable API service for the Stockly inventory backend.
 *
 * ALL traffic goes through the trusted same-origin gateway (`/api/sheets`),
 * which resolves the caller's verified spreadsheet server-side from the
 * authenticated session. The browser never holds an Apps Script URL, so a
 * modified request cannot reach another user's spreadsheet.
 * - GET is used for reads, POST (JSON body) for writes at the gateway.
 * - Duplicate-submission protection: callers pass an `idempotencyKey`
 *   for stock mutations; in-flight identical requests are de-duplicated.
 * - Never resolves "success" when the request failed — errors throw.
 */

import { SHEETS_API_ROUTE, apiUrl } from './config';
import { getDeviceSession } from './devices';
import { getAuthSession } from './auth';
import { interpretApiResponse } from './api-response';

const IN_FLIGHT = new Map<string, Promise<unknown>>();

function networkFailureMessage(): string {
  return 'Could not reach Stockly’s sheet gateway. Check the connection and /api/sheets deployment, then retry.';
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
  if (res.status === 401 || res.status === 403) {
    try {
      window.dispatchEvent(new CustomEvent('stockly:forbidden', { detail: { status: res.status } }));
    } catch {
      /* non-DOM runtime */
    }
  }
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
  // Deduplicate identical concurrent reads (StrictMode remounts, refresh
  // bursts, reconnect + foreground firing together). Writes are NOT
  // deduped here — apiPost has its own idempotency-key handling.
  const key = `GET:${action}:${JSON.stringify(params)}`;
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const run = (async (): Promise<T> => {
    let res: Response;
    try {
      res = await withTimeout(
        fetch(apiUrl(SHEETS_API_ROUTE), {
          method: 'POST',
          headers: gatewayHeaders(),
          body: JSON.stringify({ action: 'proxy', gsAction: action, method: 'GET', params }),
        }),
      );
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
  const key = `${action}:${(payload.idempotencyKey as string) || JSON.stringify(payload)}`;
  if (opts.dedupe !== false && IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  const run = async (): Promise<T> => {
    let res: Response;
    try {
      res = await withTimeout(
        fetch(apiUrl(SHEETS_API_ROUTE), {
          method: 'POST',
          headers: gatewayHeaders(),
          body: JSON.stringify({ action: 'proxy', gsAction: action, method: 'POST', body: payload }),
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

/** Auth + device credentials for the sheet gateway. The gateway resolves
 *  the verified spreadsheet server-side; identity comes from these
 *  headers, never from request fields the client could forge. */
function gatewayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = getAuthSession();
  if (session) headers.Authorization = `Bearer ${session}`;
  const deviceSession = getDeviceSession();
  if (deviceSession) headers['X-Device-Session'] = deviceSession;
  return headers;
}

/** Identity fields are injected server-side by the gateway; payloads pass
 *  through unchanged. */
function withUser<T extends Record<string, unknown>>(payload: T): T {
  return payload;
}

import type {
  Category,
  DashboardStats,
  Product,
  StockTransaction,
  SyncData,
  UserProfile,
} from './types';

export const api = {
  health: () => apiGet<{ time: string; version: string }>('health'),

  listProducts: () => apiGet<Product[]>('listProducts'),
  getProduct: (id: string) => apiGet<Product>('getProduct', { id }),
  createProduct: (p: Record<string, unknown>) =>
    apiPost<Product>('createProduct', withUser(p), { dedupe: false }),
  updateProduct: (id: string, p: Record<string, unknown>) =>
    apiPost<Product>('updateProduct', withUser({ id, ...p }), { dedupe: false }),
  deleteProduct: (id: string) => apiPost<{ deleted: string }>('deleteProduct', withUser({ id }), { dedupe: false }),

  listCategories: () => apiGet<Category[]>('listCategories'),
  createCategory: (name: string) => apiPost<Category>('createCategory', withUser({ name }), { dedupe: false }),
  updateCategory: (id: string, name: string) =>
    apiPost<Category>('updateCategory', withUser({ id, name }), { dedupe: false }),
  deleteCategory: (id: string) =>
    apiPost<{ deleted: string; cleared: number }>('deleteCategory', withUser({ id }), { dedupe: false }),

  stockIn: (args: {
    productId: string;
    quantity: number;
    price?: number;
    note?: string;
    idempotencyKey: string;
  }) => apiPost<{ product: Product; transaction: StockTransaction }>('stockIn', withUser(args)),

  stockOut: (args: {
    productId: string;
    quantity: number;
    reason: string;
    note?: string;
    idempotencyKey: string;
  }) => apiPost<{ product: Product; transaction: StockTransaction }>('stockOut', withUser(args)),

  listTransactions: (limit = 200) => apiGet<StockTransaction[]>('listTransactions', { limit: String(limit) }),
  dashboard: () => apiGet<DashboardStats>('dashboard'),
  /**
   * Single-call sync — preferred over the individual list* calls.
   * txLimit bounds the transaction payload (dashboard only needs a few
   * recent rows; History pages the rest on demand). Old backends ignore
   * the extra param and return their default window.
   */
  sync: (txLimit = 200) => apiGet<SyncData>('sync', { txLimit: String(txLimit) }),

  /* ---------- User profiles (user database, Apps Script Users tab) ---------- */
  registerUser: (args: { name: string; email: string; userId?: string }) =>
    apiPost<UserProfile>('registerUser', args as Record<string, unknown>, { dedupe: false }),
  getUser: (userId: string) => apiGet<UserProfile>('getUser', { userId }),
  getUserByEmail: (email: string) => apiGet<UserProfile>('getUserByEmail', { email }),
  updateUserProfile: (args: { userId: string; name?: string; email?: string }) =>
    apiPost<UserProfile>('updateUserProfile', args as Record<string, unknown>, { dedupe: false }),
  reportLogin: (userId: string) =>
    apiPost<UserProfile>('reportLogin', { userId }, { dedupe: false }),
  mirrorStatus: (env: { userId: string; accountStatus: string; issuedAt: string; signature: string }) =>
    apiPost<UserProfile>('mirrorStatus', env as Record<string, unknown>, { dedupe: false }),
};
