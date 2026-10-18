import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api, ApiError, isUnknownOutcome, newIdempotencyKey } from './api';
import { LS_KEYS, AUTO_SYNC_MS, SYNC_FRESH_MS, SYNC_TX_LIMIT, TX_CACHE_CAP, TX_MEMORY_CAP, getCurrentUserId } from './config';
import type {
  Category,
  DashboardStats,
  Product,
  StockTransaction,
  ThemeMode,
  ToastMsg,
} from '@stockly/shared-types';

interface CacheShape {
  products: Product[];
  categories: Category[];
  transactions: StockTransaction[];
  dashboard: DashboardStats | null;
  savedAt: number;
}

/** An unconfirmed change that failed to save. Retry is always user-initiated
 *  and stock retries reuse the ORIGINAL idempotency key (never a new one). */
export interface FailedOp {
  key: string;
  /** e.g. "Add product 'Rice 5kg'" — shown so nothing is silently lost. */
  label: string;
  detail: string;
  retry: () => Promise<boolean>;
}

interface Store {
  // data
  products: Product[];
  categories: Category[];
  transactions: StockTransaction[];
  dashboard: DashboardStats | null;
  loading: boolean;
  refreshing: boolean;
  /** True once the first sync attempt has settled (success or fail). Drives
   *  the branded startup loader — screens behind it can already be mounting. */
  ready: boolean;
  error: string | null;
  lastSync: Date | null;
  online: boolean;
  configured: boolean;
  // optimistic sync state
  /** Ids (incl. temporary `temp_*`) with an unconfirmed write in flight. */
  pendingIds: string[];
  /** Saves that failed without confirmation — retryable, never auto-retried. */
  failedOps: FailedOp[];
  isPending: (id: string) => boolean;
  retryFailedOp: (key: string) => Promise<boolean>;
  dismissFailedOp: (key: string) => void;
  // ui
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  dark: boolean;
  toasts: ToastMsg[];
  notify: (text: string, kind?: ToastMsg['kind']) => void;
  dismissToast: (id: number) => void;
  // actions
  refresh: (opts?: { silent?: boolean }) => Promise<boolean>;
  /** Silent fetch only when the cache is older than SYNC_FRESH_MS. */
  ensureFresh: () => void;
  /** Fetch an older transaction page (limit-based, newest-first). */
  loadMoreTransactions: (limit: number) => Promise<void>;
  txLoadingMore: boolean;
  /** True once the backend returned fewer rows than requested. */
  txExhausted: boolean;
  setConfiguredFlag: () => void;
  /** Wipe in-memory + on-device cache (used when switching backend URLs
   *  so the old Sheet's products never linger as "dummy" rows). */
  clearCache: () => void;
  /** Log out: disconnect the cloud database and wipe this device's cache. */
  logout: () => void;
  saveProduct: (input: ProductFormInput, editingId?: string) => Promise<boolean>;
  removeProduct: (id: string) => Promise<boolean>;
  saveCategory: (name: string, editingId?: string) => Promise<boolean>;
  removeCategory: (id: string) => Promise<boolean>;
  doStockIn: (a: { productId: string; quantity: number; price?: number; note?: string }) => Promise<boolean>;
  doStockOut: (a: { productId: string; quantity: number; reason: string; note?: string }) => Promise<boolean>;
  // optimistic primitives (screens use the wrappers above; these share one engine)
  addProductOptimistically: (input: ProductFormInput) => Promise<boolean>;
  updateProductOptimistically: (editingId: string, input: ProductFormInput) => Promise<boolean>;
  deleteProductOptimistically: (id: string) => Promise<boolean>;
  submitStockIn: (a: { productId: string; quantity: number; price?: number; note?: string }, opts?: { idempotencyKey?: string }) => Promise<boolean>;
  submitStockOut: (a: { productId: string; quantity: number; reason: string; note?: string }, opts?: { idempotencyKey?: string }) => Promise<boolean>;
  /** Replace a temporary record with the authoritative server record. */
  reconcileServerResponse: (kind: 'product' | 'transaction', tempId: string, saved: Product | StockTransaction) => void;
  /** Targeted silent re-fetch (no full reload). */
  invalidateAffectedQueries: () => Promise<void>;
  /** Category display name, or '' when unknown. */
  categoryName: (id: string) => string;
}

export interface ProductFormInput {
  name: string;
  sku: string;
  categoryId: string;
  description: string;
  image: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
}

const Ctx = createContext<Store | null>(null);
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

function readCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(LS_KEYS.cache);
    if (!raw) return null;
    return JSON.parse(raw) as CacheShape;
  } catch {
    return null;
  }
}

function readTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(LS_KEYS.theme);
    if (t === 'light' || t === 'dark' || t === 'system') return t;
  } catch { /* noop */ }
  return 'system';
}

let toastId = 1;

/** Temporary client ids for unconfirmed records. Never persisted to cache,
 *  never sent as-is — the server response replaces them on reconcile. */
const TEMP_PREFIX = 'temp_';
function tempId(prefix: string): string {
  return `${TEMP_PREFIX}${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
}
function isTempId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(TEMP_PREFIX);
}

/* ---------------- durable outbox (survives restarts) ----------------
 * Serializable descriptors for every unconfirmed write. Live-session
 * behavior is unchanged (optimistic UI + in-memory FailedOps); the outbox
 * adds crash durability:
 * - `pending` stock descriptors are written BEFORE the POST runs and
 *   removed on every terminal branch. Leftovers at boot = the app died
 *   mid-flight → auto-verified read-only by idempotency key.
 * - `failed` descriptors mirror in-memory FailedOps so manual retry works
 *   after a restart. Attempt count survives with them.
 * Closures can't persist, so retries dispatch through runOutboxOp by kind.
 * Stock retries always reuse the ORIGINAL idempotency key (never a new one).
 * Bounded (OUTBOX_CAP) and quota-guarded; secrets are never stored here. */
export type OutboxKind =
  | 'stock-in'
  | 'stock-out'
  | 'save-product'
  | 'delete-product';

export interface OutboxDesc {
  /** Same key as its FailedOp (`fail-…`) or pending id (`pend-stock-…`). */
  key: string;
  kind: OutboxKind;
  status: 'pending' | 'failed';
  label: string;
  detail: string;
  /** Serializable mutation args (no closures, no File objects). */
  payload: Record<string, unknown>;
  /** Stock idempotency key — stable across retries of the same tap. */
  idem?: string;
  /** Backend origin: descriptors never retry against a different Sheet. */
  base: string;
  createdAt: number;
  attemptCount: number;
  /** Auto-verify worker only touches `pending` ops past this time. */
  retryAfter: number;
  lastError?: string;
}

const OUTBOX_CAP = 50;
const OUTBOX_VERSION = 1;

function readOutbox(): OutboxDesc[] {
  try {
    const raw = localStorage.getItem(LS_KEYS.queue);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: number; ops?: unknown } | unknown[];
    const ops = Array.isArray(parsed) ? parsed : parsed.ops;
    if (!Array.isArray(ops)) return [];
    return (ops as Partial<OutboxDesc>[]).filter(
      (o): o is OutboxDesc =>
        !!o &&
        typeof o.key === 'string' &&
        typeof o.kind === 'string' &&
        (o.status === 'pending' || o.status === 'failed') &&
        typeof o.payload === 'object' &&
        o.payload !== null,
    );
  } catch {
    return [];
  }
}

function writeOutbox(list: OutboxDesc[]): void {
  try {
    localStorage.setItem(
      LS_KEYS.queue,
      JSON.stringify({ version: OUTBOX_VERSION, savedAt: Date.now(), ops: list.slice(-OUTBOX_CAP) }),
    );
  } catch {
    /* quota — the in-memory op still works for this session */
  }
}

/** Exponential backoff with jitter for auto-verify attempts. */
function outboxBackoffMs(attempt: number): number {
  const capped = Math.min(attempt, 6);
  return Math.min(5 * 1000 * 2 ** capped, 5 * 60 * 1000) + Math.floor(Math.random() * 1000);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Read the on-device cache exactly once (lazy initializer, no ref access in render).
  const [initial] = useState<CacheShape | null>(() => readCache());

  const [products, setProducts] = useState<Product[]>(initial?.products || []);
  const [categories, setCategories] = useState<Category[]>(initial?.categories || []);
  const [transactions, setTransactions] = useState<StockTransaction[]>(initial?.transactions || []);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(initial?.dashboard || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(
    initial?.savedAt ? new Date(initial.savedAt) : null,
  );
  const [online, setOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [configured, setConfigured] = useState<boolean>(false);
  const [theme, setThemeState] = useState<ThemeMode>(readTheme);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [txExhausted, setTxExhausted] = useState(false);
  // ---- optimistic engine: unconfirmed writes --------------------------------
  // pendingIds holds real + temporary (`temp_*`) ids with a write in flight.
  // Rows render instantly with a "Saving…" badge; the server response later
  // reconciles them. Nothing here is treated as saved until confirmed.
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [failedOps, setFailedOps] = useState<FailedOp[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());
  // Double-tap guard: identical mutation keys are ignored inside the window.
  const claimTimestamps = useRef(new Map<string, number>());
  // ---- durable outbox mirror ------------------------------------------------
  // Read once at boot; every mutation below keeps ref + storage in sync.
  const [initialOutbox] = useState<OutboxDesc[]>(() => readOutbox());
  const outboxRef = useRef<Map<string, OutboxDesc> | null>(null);
  if (!outboxRef.current) {
    outboxRef.current = new Map(initialOutbox.map((o) => [o.key, o]));
  }

  const dark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', dark ? '#111210' : '#F7F7F2');
    });
    try {
      localStorage.setItem(LS_KEYS.theme, theme);
    } catch { /* noop */ }
    // Keep native status bar in sync (Capacitor only; safe no-op on web)
    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
        await StatusBar.setBackgroundColor({ color: dark ? '#111210' : '#f7f7f2' });
      } catch { /* web — ignore */ }
    })();
  }, [dark, theme]);

  // React to OS theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.classList.toggle('dark', mq.matches);
      document.documentElement.style.colorScheme = mq.matches ? 'dark' : 'light';
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', mq.matches ? '#111210' : '#F7F7F2');
      });
    };
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [theme]);

  const notify = useCallback((text: string, kind: ToastMsg['kind'] = 'success') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3400);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);

  const persistCache = useCallback(
    (d: DashboardStats | null, p: Product[], c: Category[], t: StockTransaction[]) => {
      // Perf: JSON.stringify of the whole cache on the UI thread drops frames
      // on 60/90Hz phones during scroll + commit. Defer to idle.
      const write = () => {
        try {
          // localStorage is a cache, never the DB: strip unconfirmed temp
          // records so a restart can never resurrect ghost rows.
          const shape: CacheShape = {
            dashboard: d,
            products: p.filter((x) => !isTempId(x.id)),
            categories: c.filter((x) => !isTempId(x.id)),
            transactions: t.filter((x) => !isTempId(x.id)),
            savedAt: Date.now(),
          };
          localStorage.setItem(LS_KEYS.cache, JSON.stringify(shape));
        } catch { /* quota — ignore */ }
      };
      try {
        const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
        if (ric) ric(write);
        else window.setTimeout(write, 0);
      } catch {
        write();
      }
    },
    [],
  );

  const booted = useRef(false);
  // Sequence guard: overlapping refreshes (pull-to-refresh spam, reconnect
  // bursts) must not let a stale response overwrite fresher data.
  const refreshSeq = useRef(0);
  // Last successful sync (ms epoch). Drives the SYNC_FRESH_MS background gate.
  const lastSyncAt = useRef<number>(initial?.savedAt || 0);
  // Fresh snapshot mirror for event handlers (foreground/resume listeners).
  const live = useRef({ products, transactions, categories });
  useEffect(() => {
    live.current = { products, transactions, categories };
  });

  const markSynced = useCallback(() => {
    lastSyncAt.current = Date.now();
    setLastSync(new Date());
  }, []);

  /**
   * Apply state locally WITHOUT claiming a sync (used for optimistic rows).
   * Dashboard is recomputed in memory with the same math as the backend.
   * Server state stays the source of truth; reconcile or refresh replaces this.
   */
  const applyLocal = useCallback(
    (next: {
      products?: Product[];
      transactions?: StockTransaction[];
      categories?: Category[];
    }) => {
      const cur = live.current;
      const p = next.products ?? cur.products;
      const t = next.transactions ?? cur.transactions;
      const c = next.categories ?? cur.categories;
      const d = computeDashboard(p, t);
      live.current = { products: p, transactions: t, categories: c };
      setProducts(p);
      setTransactions(t);
      setCategories(c);
      setDashboard(d);
      persistCache(d, p, c, t.slice(0, TX_CACHE_CAP));
    },
    [persistCache],
  );

  /**
   * Commit authoritative data without a network round trip.
   * Used after mutations: the POST response already carries the updated
   * product/transaction, and the dashboard is recomputed in memory with
   * the same math as the backend. Server state stays the source of truth;
   * the next refresh replaces these approximations with real totals.
   */
  const commit = useCallback(
    (next: {
      products?: Product[];
      transactions?: StockTransaction[];
      categories?: Category[];
    }) => {
      applyLocal(next);
      markSynced();
    },
    [applyLocal, markSynced],
  );

  /* ---------------- optimistic primitives ---------------- */

  const markPending = useCallback((ids: string[]) => {
    ids.forEach((id) => pendingRef.current.add(id));
    setPendingIds(Array.from(pendingRef.current));
  }, []);

  const unmarkPending = useCallback((ids: string[]) => {
    ids.forEach((id) => pendingRef.current.delete(id));
    setPendingIds(Array.from(pendingRef.current));
  }, []);

  const isPending = useCallback(
    (id: string) => pendingRef.current.has(id),
    // pendingIds in deps so consumers re-render on every mark/unmark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingIds],
  );

  /** Double-tap guard with a time window (no release needed). */
  const claimSubmit = useCallback(
    (key: string, windowMs = 2500): boolean => {
      const now = Date.now();
      if (now - (claimTimestamps.current.get(key) || 0) < windowMs) {
        notify('Already processing — please wait.', 'info');
        return false;
      }
      claimTimestamps.current.set(key, now);
      return true;
    },
    [notify],
  );

  const failedOpsRef = useRef(new Map<string, FailedOp>());

  const saveOutbox = useCallback(() => {
    const ref = outboxRef.current;
    if (ref) writeOutbox(Array.from(ref.values()));
  }, []);

  const putDesc = useCallback(
    (d: OutboxDesc) => {
      outboxRef.current?.set(d.key, d);
      saveOutbox();
    },
    [saveOutbox],
  );

  const dropDesc = useCallback(
    (key: string) => {
      if (outboxRef.current?.delete(key)) saveOutbox();
    },
    [saveOutbox],
  );

  /** Descriptor fields every persisted failed op needs. Callers pass their
   *  serializable mutation args; status/attempt bookkeeping is filled here. */
  const descFor = useCallback(
    (
      op: FailedOp,
      init: Pick<OutboxDesc, 'kind' | 'payload' | 'base'> & Partial<Pick<OutboxDesc, 'idem'>>,
    ): OutboxDesc => ({
      key: op.key,
      status: 'failed',
      label: op.label,
      detail: op.detail,
      createdAt: Date.now(),
      attemptCount: 0,
      retryAfter: 0,
      ...init,
    }),
    [],
  );

  const pushFailedOp = useCallback(
    (op: FailedOp, desc?: OutboxDesc) => {
      failedOpsRef.current.set(op.key, op);
      setFailedOps((ops) => {
        const rest = ops.filter((o) => o.key !== op.key);
        return [...rest, op].slice(-5);
      });
      if (desc) putDesc(desc);
    },
    [putDesc],
  );

  const dismissFailedOp = useCallback(
    (key: string) => {
      failedOpsRef.current.delete(key);
      setFailedOps((ops) => ops.filter((o) => o.key !== key));
      dropDesc(key);
    },
    [dropDesc],
  );

  /** User-initiated retry of a failed save. Stock retries reuse the original
   *  idempotency key captured in the op — never a fresh one. If the retry is
   *  ignored (double-tap window), the op is re-queued so it can't be lost.
   *  Descriptor bookkeeping follows the op: dropped on success, attempt
   *  bumped on failure, so restarts never lose or duplicate the retry. */
  const retryFailedOp = useCallback(
    async (key: string): Promise<boolean> => {
      const op = failedOpsRef.current.get(key);
      if (!op) return false;
      const prev = outboxRef.current?.get(key);
      failedOpsRef.current.delete(key);
      setFailedOps((ops) => ops.filter((o) => o.key !== key));
      try {
        const ok = await op.retry();
        if (!ok) {
          pushFailedOp(op);
          if (prev) putDesc({ ...prev, attemptCount: prev.attemptCount + 1 });
        } else {
          dropDesc(key);
        }
        return ok;
      } catch {
        pushFailedOp(op);
        if (prev) putDesc({ ...prev, attemptCount: prev.attemptCount + 1 });
        return false;
      }
    },
    [pushFailedOp, putDesc, dropDesc],
  );

  /** Shallow compare of editable product fields (used to detect whether a
   *  lost-response update actually applied server-side). */
  function productMatchesInput(p: Product, input: ProductFormInput): boolean {
    return (
      p.name === input.name &&
      p.sku === input.sku &&
      (p.categoryId || '') === (input.categoryId || '') &&
      (p.description || '') === (input.description || '') &&
      (p.image || '') === (input.image || '') &&
      Number(p.costPrice) === Number(input.costPrice) &&
      Number(p.sellingPrice) === Number(input.sellingPrice) &&
      Math.floor(Number(p.currentStock)) === Math.floor(Number(input.currentStock)) &&
      Math.floor(Number(p.minimumStock)) === Math.floor(Number(input.minimumStock))
    );
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  /**
   * Replace a temporary record with the authoritative server record.
   * Products swap by id; transactions swap by id
   * and are de-duplicated by idempotency key (lost-response replays).
   */
  const reconcileServerResponse = useCallback(
    (
      kind: 'product' | 'transaction',
      tempId: string,
      saved: Product | StockTransaction,
    ) => {
      const cur = live.current;
      if (kind === 'product') {
        const s = saved as Product;
        const without = cur.products.filter((p) => p.id !== tempId);
        commit({ products: upsertProduct(without, s) });
      } else {
        const s = saved as StockTransaction;
        const without = cur.transactions.filter(
          (t) => t.id !== tempId && t.idempotencyKey !== s.idempotencyKey,
        );
        commit({ transactions: prependTransaction(without, s) });
      }
      unmarkPending([tempId]);
    },
    [commit, unmarkPending],
  );

  /**
   * Targeted silent re-fetch.
   * Single `sync` call, silent, no UI blocking — never a full reload.
   */
  const invalidateAffectedQueries = useCallback(async () => {
    await refreshRef.current({ silent: true });
  }, []);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      const silent = opts?.silent ?? false;
      const mySeq = ++refreshSeq.current;
      const isLatest = () => mySeq === refreshSeq.current;
      if (!silent) {
        if (!booted.current) setLoading(true);
        else setRefreshing(true);
      }
      setError(null);
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      try {
        let d: DashboardStats, p: Product[], t: StockTransaction[];
        let c: Category[] = [];
        let freshTx = 0;
        let txRequested = SYNC_TX_LIMIT;
        try {
          // One round trip instead of five (Apps Script calls are slow).
          // Transaction window is bounded: dashboard needs ~6 recent rows,
          // History pages older rows on demand via loadMoreTransactions.
          const sync = await api.sync(SYNC_TX_LIMIT);
          d = sync.dashboard;
          p = sync.products;
          // Older backends return no categories — tolerate the missing field.
          c = Array.isArray(sync.categories) ? sync.categories : [];
          freshTx = sync.transactions.length;
          t = mergeTransactions(live.current.transactions, sync.transactions, TX_MEMORY_CAP);
        } catch (e) {
          // Older deployments lack the sync action — fall back to parallel reads.
          const msg = e instanceof ApiError ? e.message : '';
          if (!/unknown action/i.test(msg)) throw e;
          txRequested = 200;
          let fetched: StockTransaction[];
          let fetchedCats: Category[] = [];
          [d, p, fetched] = await Promise.all([
            api.dashboard(),
            api.listProducts(),
            api.listTransactions(200),
          ]);
          try {
            fetchedCats = await api.listCategories();
          } catch {
            fetchedCats = [];
          }
          c = fetchedCats;
          freshTx = fetched.length;
          t = mergeTransactions(live.current.transactions, fetched, TX_MEMORY_CAP);
        }
        if (!isLatest()) return false;
        const pend = pendingRef.current;
        // Manual refreshes always commit. Silent background syncs with zero
        // changes skip setState so 50+ rows + images aren't reconciled.
        if (pend.size === 0 && silent) {
          const cur = live.current;
          if (
            sigProducts(cur.products) === sigProducts(p) &&
            sigTx(cur.transactions) === sigTx(t) &&
            sigCategories(cur.categories) === sigCategories(c)
          ) {
            setTxExhausted(freshTx < txRequested);
            markSynced();
            return true;
          }
        }
        // Never let a background sync clobber unconfirmed optimistic rows:
        // pending products/transactions keep their local (newer) versions
        // until the server response reconciles them.
        if (pend.size > 0) {
          const curProds = new Map(live.current.products.map((x) => [x.id, x]));
          const mergedP = p.map((x) => (pend.has(x.id) && curProds.get(x.id) ? curProds.get(x.id)! : x));
          for (const [id, prod] of curProds) {
            if (pend.has(id) && !mergedP.some((x) => x.id === id)) mergedP.push(prod);
          }
          p = mergedP;
          const curTx = new Map(live.current.transactions.map((x) => [x.id, x]));
          const mergedT = t.map((x) => (pend.has(x.id) && curTx.get(x.id) ? curTx.get(x.id)! : x));
          for (const [id, tx] of curTx) {
            if (pend.has(id) && !mergedT.some((x) => x.id === id)) mergedT.push(tx);
          }
          t = mergedT;
        }
        setDashboard(d);
        setProducts(p);
        setCategories(c);
        setTransactions(t);
        // Fewer rows than requested ⇒ server has nothing older.
        setTxExhausted(freshTx < txRequested);
        live.current = { products: p, transactions: t, categories: c };
        markSynced();
        persistCache(d, p, c, t.slice(0, TX_CACHE_CAP));
        if (typeof performance !== 'undefined' && import.meta.env.DEV) {
          console.debug(`[sync] refresh ok in ${Math.round(performance.now() - t0)}ms (${p.length} products, ${t.length} tx)`);
        }
      } catch (e) {
        if (!isLatest()) return false;
        const msg = e instanceof ApiError ? e.message : 'Failed to sync. Showing cached data.';
        setError(msg);
        if (!silent) notify(msg, 'error');
        return false;
      } finally {
        booted.current = true;
        // Same-value sets bail out — exactly one extra render at startup.
        setReady(true);
        if (isLatest()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      return true;
    },
    [notify, persistCache, markSynced],
  );

  // Initial load (stable deps — runs once per backend change, not per render)
  useEffect(() => {
    if (configured) void refresh({ silent: (initial?.products?.length ?? 0) > 0 });
  }, [configured, refresh, initial]);

  /**
   * Silent refresh only when the last success is older than SYNC_FRESH_MS.
   * Used by foreground/resume triggers — manual refresh always fetches.
   * Skipped while optimistic writes are unconfirmed (their own reconcile
   * refreshes; a concurrent sync must not overwrite pending rows' basis).
   */
  const ensureFresh = useCallback(() => {
    if (pendingRef.current.size > 0) return;
    if (Date.now() - lastSyncAt.current > SYNC_FRESH_MS) {
      void refresh({ silent: true });
    }
  }, [refresh]);

  /**
   * Older transaction page. Limit-based, newest-first: the backend returns
   * the newest `limit` rows and we merge by id, so concurrent new rows on
   * another device can never duplicate or drop entries. No polling here —
   * History calls this only when the user asks for more.
   * Stable identity (refs, not state, in deps) so the store context value
   * doesn't churn and re-render every consumer on each page load.
   */
  const txBusyRef = useRef(false);
  const txDoneRef = useRef(false);
  useEffect(() => {
    txDoneRef.current = txExhausted;
  }, [txExhausted]);
  const loadMoreTransactions = useCallback(
    async (limit: number) => {
      if (txBusyRef.current || txDoneRef.current) return;
      txBusyRef.current = true;
      setTxLoadingMore(true);
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      try {
        const fetched = await api.listTransactions(limit);
        const merged = mergeTransactions(live.current.transactions, fetched, TX_MEMORY_CAP);
        live.current = { ...live.current, transactions: merged };
        setTransactions(merged);
        if (fetched.length < limit) setTxExhausted(true);
        if (typeof performance !== 'undefined' && import.meta.env.DEV) {
          console.debug(`[sync] tx page ok in ${Math.round(performance.now() - t0)}ms (limit ${limit}, ${merged.length} cached)`);
        }
      } catch (e) {
        notify(e instanceof ApiError ? e.message : 'Could not load older history.', 'error');
      } finally {
        txBusyRef.current = false;
        setTxLoadingMore(false);
      }
    },
    [notify],
  );

  // Latest action refs for listeners registered once (no resubscribe churn).
  const refreshRef = useRef(refresh);
  const ensureFreshRef = useRef(ensureFresh);
  useEffect(() => {
    refreshRef.current = refresh;
    ensureFreshRef.current = ensureFresh;
  });

  // Online / offline (browser + Capacitor Network). Reconnect forces a
  // silent refresh — another device may have changed inventory meanwhile,
  // and cache must never pose as current after a gap in connectivity.
  // Skipped while optimistic writes are pending (their reconcile refreshes).
  useEffect(() => {
    const on = () => {
      setOnline(true);
      if (pendingRef.current.size === 0) void refreshRef.current({ silent: true });
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    let remove: (() => void) | undefined;
    let wasConnected = typeof navigator === 'undefined' ? true : navigator.onLine;
    (async () => {
      try {
        const { Network } = await import('@capacitor/network');
        const s = await Network.getStatus();
        setOnline(s.connected);
        wasConnected = s.connected;
        const h = await Network.addListener('networkStatusChange', (st) => {
          setOnline(st.connected);
          if (st.connected && !wasConnected && pendingRef.current.size === 0) {
            void refreshRef.current({ silent: true });
          }
          wasConnected = st.connected;
        });
        remove = () => {
          void h.remove();
        };
      } catch { /* web fallback already wired */ }
    })();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      remove?.();
    };
  }, []);

  // Refresh stale read-only data when the app returns to the foreground.
  // Gated by SYNC_FRESH_MS — no request when the cache is still fresh.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') ensureFreshRef.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Automatic background sync while the app is open: silent refresh every
  // AUTO_SYNC_MS when the tab is visible and the device is online, so
  // other devices' stock changes arrive with no manual refresh button.
  // Paused while optimistic writes are unconfirmed.
  useEffect(() => {
    if (!configured) return;
    const id = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        navigator.onLine &&
        pendingRef.current.size === 0
      ) {
        void refreshRef.current({ silent: true });
      }
    }, AUTO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [configured]);

  const setConfiguredFlag = useCallback(() => {
    setConfigured(true);
  }, []);

  const clearCache = useCallback(() => {
    live.current = { products: [], transactions: [], categories: [] };
    setProducts([]);
    setCategories([]);
    setTransactions([]);
    setDashboard(null);
    setTxExhausted(false);
    setError(null);
    setLastSync(null);
    lastSyncAt.current = 0;
    // Drop unconfirmed + failed ops of the old backend: their background
    // handlers check the backend epoch and stand down (never write old
    // records into the new backend's state).
    pendingRef.current.clear();
    setPendingIds([]);
    failedOpsRef.current.clear();
    setFailedOps([]);
    claimTimestamps.current.clear();
    // Durable outbox belongs to the old backend: its idempotency keys are
    // meaningless on the new Sheet, so retrying there would corrupt data.
    // Counted and announced — never silently discarded.
    const droppedOutbox = outboxRef.current?.size ?? 0;
    outboxRef.current?.clear();
    saveOutbox();
    if (droppedOutbox > 0) {
      notify(
        `Cleared ${droppedOutbox} unsynced change(s) from the previous backend — they can't apply to the new Sheet.`,
        'info',
      );
    }
    try {
      localStorage.removeItem(LS_KEYS.cache);
    } catch { /* ignore */ }
  }, [notify, saveOutbox]);

  /** Log out: wipe every trace of cached data + pending work. The auth
   *  session itself is cleared by signOutAccount; the gate returns to login. */
  const logout = useCallback(() => {
    clearCache();
    setConfigured(false);
    notify('Logged out — local data cleared.', 'info');
  }, [clearCache, notify]);

  /** True while `base` is still the active account (account switches stand
   *  in-flight background work down — see clearCache). Backend identity is
   *  the authenticated user id; the sheet URL is never client-held. */
  function isCurrentBackend(base: string): boolean {
    try {
      return (getCurrentUserId() ?? '') === base;
    } catch {
      return false;
    }
  }

  /**
   * Serialize background stock writes per product so two rapid taps can
   * never reconcile out of order (older response overwriting newer data).
   * Optimistic UI still applies instantly; only the POSTs queue.
   */
  const stockChains = useRef(new Map<string, Promise<void>>());
  const chainStockWork = useCallback((productId: string, work: () => Promise<void>) => {
    const prev = stockChains.current.get(productId) || Promise.resolve();
    const next = prev.then(work, work);
    stockChains.current.set(productId, next);
    void next.then(() => {
      if (stockChains.current.get(productId) === next) stockChains.current.delete(productId);
    });
  }, []);

  /* ---------------- optimistic mutations ----------------
   * Every write follows one engine:
   *  1. claimSubmit — identical double-taps ignored (2.5s window).
   *  2. UI updated immediately (temporary `temp_*` ids for creates),
   *     pending ids marked, forms may close at once (returns true).
   *  3. EXACTLY ONE POST runs in the background (stock reuses its key).
   *  4. Success → temp reconciled with the server record + toast.
   *  5. Failure with KNOWN rejection → manual rollback + clear error.
   *     Failure with UNKNOWN outcome → unmark, silent refresh to learn the
   *     truth: applied-but-lost-response is adopted; otherwise rollback and
   *     a FailedOp is queued for explicit user retry (never auto-retried).
   * Google Sheets stays the source of truth; nothing claims "saved" until
   * the server confirms it. Related screens stay usable throughout.
   */

  const addProductOptimistically = useCallback(
    async (input: ProductFormInput): Promise<boolean> => {
      const key = `new-prod-${input.sku}-${input.name}`;
      if (!claimSubmit(key)) return false;
      const base = getCurrentUserId() ?? '';
      const cur = live.current;
      const t = nowIso();
      const temp: Product = {
        id: tempId('prd'),
        name: input.name.trim(),
        sku: input.sku.trim(),
        categoryId: input.categoryId || '',
        categoryName: cur.categories.find((c) => c.id === input.categoryId)?.name || '',
        description: input.description || '',
        image: input.image || '',
        costPrice: Number(input.costPrice),
        sellingPrice: Number(input.sellingPrice),
        currentStock: Math.floor(Number(input.currentStock)),
        minimumStock: Math.floor(Number(input.minimumStock)),
        status: 'active',
        createdAt: t,
        updatedAt: t,
      };
      // 1-2: instant row, pending badge.
      applyLocal({ products: [...cur.products, temp] });
      markPending([temp.id]);

      // 3-6: exactly one POST in the background.
      void (async () => {
        try {
          const saved = await api.createProduct({ ...input });
          if (!isCurrentBackend(base)) {
            unmarkPending([temp.id]);
            return;
          }
          reconcileServerResponse('product', temp.id, saved);
          notify('Product added.');
        } catch (e) {
          if (!isCurrentBackend(base)) {
            unmarkPending([temp.id]);
            return;
          }
          const msg = e instanceof ApiError ? e.message : 'Save failed.';
          unmarkPending([temp.id]);
          if (!isUnknownOutcome(e)) {
            // Explicit server rejection — nothing was saved.
            applyLocal({ products: live.current.products.filter((p) => p.id !== temp.id) });
            notify(msg, 'error');
            return;
          }
          // Unknown outcome: did it apply? Check by SKU (single silent sync).
          const refreshed = await refresh({ silent: true });
          if (!isCurrentBackend(base)) {
            unmarkPending([temp.id]);
            return;
          }
          const adopted = refreshed
            ? live.current.products.find((p) => p.sku.toUpperCase() === temp.sku.toUpperCase())
            : undefined;
          if (adopted) {
            notify('Product added.');
            return;
          }
          if (!refreshed) {
            applyLocal({ products: live.current.products.filter((p) => p.id !== temp.id) });
          }
          const addOp: FailedOp = {
            key: `fail-${temp.id}`,
            label: `Add product “${temp.name}”`,
            detail: msg,
            retry: () => addProductOptimistically(input),
          };
          pushFailedOp(addOp, descFor(addOp, { kind: 'save-product', payload: { input }, base }));
          notify(`Couldn't save “${temp.name}” — kept as an unsaved change. Retry from the sync banner.`, 'error');
        }
      })();
      return true;
    },
    [claimSubmit, applyLocal, markPending, unmarkPending, reconcileServerResponse, notify, refresh, pushFailedOp, descFor],
  );

  const updateProductOptimistically = useCallback(
    async (editingId: string, input: ProductFormInput): Promise<boolean> => {
      const key = `upd-prod-${editingId}`;
      if (!claimSubmit(key)) return false;
      const base = getCurrentUserId() ?? '';
      const cur = live.current;
      const prev = cur.products.find((p) => p.id === editingId);
      if (!prev) {
        notify('Product not found — syncing latest data.', 'error');
        void refresh({ silent: true });
        return true;
      }
      const next: Product = {
        ...prev,
        name: input.name.trim(),
        sku: input.sku.trim(),
        categoryId: input.categoryId || '',
        categoryName: cur.categories.find((c) => c.id === input.categoryId)?.name || prev.categoryName || '',
        description: input.description || '',
        image: input.image || '',
        costPrice: Number(input.costPrice),
        sellingPrice: Number(input.sellingPrice),
        currentStock: Math.floor(Number(input.currentStock)),
        minimumStock: Math.floor(Number(input.minimumStock)),
        updatedAt: nowIso(),
      };
      applyLocal({ products: upsertProduct(cur.products, next) });
      markPending([editingId]);

      void (async () => {
        try {
          const saved = await api.updateProduct(editingId, { ...input });
          if (!isCurrentBackend(base)) {
            unmarkPending([editingId]);
            return;
          }
          reconcileServerResponse('product', editingId, saved);
          notify('Product updated.');
        } catch (e) {
          if (!isCurrentBackend(base)) {
            unmarkPending([editingId]);
            return;
          }
          const msg = e instanceof ApiError ? e.message : 'Save failed.';
          unmarkPending([editingId]);
          if (!isUnknownOutcome(e)) {
            applyLocal({ products: upsertProduct(live.current.products, prev) });
            notify(msg, 'error');
            return;
          }
          // Unknown outcome — server truth wins; adopt it if it matches.
          const refreshed = await refresh({ silent: true });
          if (!isCurrentBackend(base)) {
            unmarkPending([editingId]);
            return;
          }
          const server = live.current.products.find((p) => p.id === editingId);
          if (refreshed && server && productMatchesInput(server, { ...input, sku: next.sku, name: next.name })) {
            notify('Product updated.');
            return;
          }
          if (!refreshed) {
            applyLocal({ products: upsertProduct(live.current.products, prev) });
          }
          const updOp: FailedOp = {
            key: `fail-upd-${editingId}-${Date.now()}`,
            label: `Edit product “${next.name}”`,
            detail: msg,
            retry: () => updateProductOptimistically(editingId, input),
          };
          pushFailedOp(
            updOp,
            descFor(updOp, { kind: 'save-product', payload: { input, editingId }, base }),
          );
          notify(`Couldn't save edits to “${next.name}” — kept as an unsaved change. Retry from the sync banner.`, 'error');
        }
      })();
      return true;
    },
    [claimSubmit, applyLocal, markPending, unmarkPending, reconcileServerResponse, notify, refresh, pushFailedOp, descFor],
  );

  const saveProduct = useCallback(
    async (input: ProductFormInput, editingId?: string): Promise<boolean> => {
      return editingId
        ? updateProductOptimistically(editingId, input)
        : addProductOptimistically(input);
    },
    [addProductOptimistically, updateProductOptimistically],
  );

  /* ---------------- categories ----------------
   * Simple confirmed writes (no optimistic temp records): the list is tiny,
   * so save → silent refresh → toast keeps every screen consistent. */
  const saveCategory = useCallback(
    async (name: string, editingId?: string): Promise<boolean> => {
      const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
      if (!trimmed) {
        notify('Category name is required.', 'error');
        return false;
      }
      const dup = live.current.categories.some(
        (c) => String(c.id) !== String(editingId || '') && c.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (dup) {
        notify(`Category "${trimmed}" already exists.`, 'error');
        return false;
      }
      const key = `cat-${editingId || trimmed.toLowerCase()}`;
      if (!claimSubmit(key)) return false;
      try {
        if (editingId) await api.updateCategory(editingId, trimmed);
        else await api.createCategory(trimmed);
        await refresh({ silent: true });
        notify(editingId ? 'Category updated.' : 'Category added.');
        return true;
      } catch (e) {
        notify(e instanceof ApiError ? e.message : 'Save failed.', 'error');
        return false;
      }
    },
    [claimSubmit, notify, refresh],
  );

  const removeCategory = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = live.current.categories.find((c) => c.id === id);
      if (!prev) {
        notify('Category not found — syncing latest data.', 'error');
        void refresh({ silent: true });
        return false;
      }
      const key = `del-cat-${id}`;
      if (!claimSubmit(key)) return false;
      try {
        const res = await api.deleteCategory(id);
        await refresh({ silent: true });
        notify(
          res.cleared > 0
            ? `Category deleted. ${res.cleared} product${res.cleared === 1 ? '' : 's'} moved to Uncategorized.`
            : 'Category deleted.',
        );
        return true;
      } catch (e) {
        notify(e instanceof ApiError ? e.message : 'Delete failed.', 'error');
        return false;
      }
    },
    [claimSubmit, notify, refresh],
  );

  const deleteProductOptimistically = useCallback(
    async (id: string): Promise<boolean> => {
      const key = `del-prod-${id}`;
      if (!claimSubmit(key)) return false;
      const base = getCurrentUserId() ?? '';
      const cur = live.current;
      const idx = cur.products.findIndex((p) => p.id === id);
      if (idx === -1) {
        notify('Product not found — syncing latest data.', 'error');
        void refresh({ silent: true });
        return true;
      }
      const prev = cur.products[idx];
      // Past transactions are kept (backend preserves them; UI keeps rows).
      applyLocal({ products: cur.products.filter((p) => p.id !== id) });
      markPending([id]);

      void (async () => {
        try {
          await api.deleteProduct(id);
          if (!isCurrentBackend(base)) {
            unmarkPending([id]);
            return;
          }
          unmarkPending([id]);
          commit({});
          notify('Product deleted.');
        } catch (e) {
          if (!isCurrentBackend(base)) {
            unmarkPending([id]);
            return;
          }
          const msg = e instanceof ApiError ? e.message : 'Delete failed.';
          unmarkPending([id]);
          if (!isUnknownOutcome(e)) {
            const back = live.current.products;
            applyLocal({ products: [...back.slice(0, idx), prev, ...back.slice(idx)] });
            notify(msg, 'error');
            return;
          }
          // Unknown outcome — ask the server: gone means deleted.
          const refreshed = await refresh({ silent: true });
          if (!isCurrentBackend(base)) {
            unmarkPending([id]);
            return;
          }
          const stillThere = live.current.products.some((p) => p.id === id);
          if (refreshed && !stillThere) {
            notify('Product deleted.');
            return;
          }
          if (!refreshed) {
            const back = live.current.products;
            if (!back.some((p) => p.id === id)) {
              applyLocal({ products: [...back.slice(0, idx), prev, ...back.slice(idx)] });
            }
          }
          const delOp: FailedOp = {
            key: `fail-del-${id}-${Date.now()}`,
            label: `Delete product “${prev.name}”`,
            detail: msg,
            retry: () => deleteProductOptimistically(id),
          };
          pushFailedOp(delOp, descFor(delOp, { kind: 'delete-product', payload: { id }, base }));
          notify(`Couldn't delete “${prev.name}” — it was restored. Retry from the sync banner.`, 'error');
        }
      })();
      return true;
    },
    [claimSubmit, applyLocal, markPending, unmarkPending, commit, notify, refresh, pushFailedOp, descFor],
  );

  const removeProduct = useCallback(
    async (id: string): Promise<boolean> => deleteProductOptimistically(id),
    [deleteProductOptimistically],
  );

  const submitStockIn = useCallback(
    async (
      a: { productId: string; quantity: number; price?: number; note?: string },
      opts?: { idempotencyKey?: string },
    ): Promise<boolean> => {
      // Stock keys embed a UUID: every tap is distinct, rapid legit retaps
      // are never blocked — but the SAME tap can't double-submit (2.5s).
      const idem = opts?.idempotencyKey || newIdempotencyKey();
      if (!claimSubmit(`in-${a.productId}-${a.quantity}-${idem}`)) return false;
      const base = getCurrentUserId() ?? '';
      const cur = live.current;
      const prev = cur.products.find((p) => p.id === a.productId);
      if (!prev) {
        notify('Product not found — syncing latest data.', 'error');
        void refresh({ silent: true });
        return true;
      }
      const nextQty = prev.currentStock + Math.floor(Number(a.quantity));
      const tempTx: StockTransaction = {
        id: tempId('txn'),
        productId: prev.id,
        productName: prev.name,
        type: 'IN',
        quantity: Math.floor(Number(a.quantity)),
        price: a.price ?? 0,
        reason: '',
        note: a.note || '',
        idempotencyKey: idem,
        createdAt: nowIso(),
      };
      // Instant quantity + pending activity row (expected values shown now).
      applyLocal({
        products: upsertProduct(cur.products, { ...prev, currentStock: nextQty, updatedAt: nowIso() }),
        transactions: prependTransaction(cur.transactions, tempTx),
      });
      markPending([prev.id, tempTx.id]);
      // Durable outbox: written BEFORE the POST. Removed on every terminal
      // branch below; a leftover at boot means the app died mid-flight.
      const pendKey = `pend-stock-${idem}`;
      const stockPayload = {
        productId: a.productId,
        quantity: Math.floor(Number(a.quantity)),
        price: a.price ?? null,
        note: a.note || '',
      };
      putDesc({
        key: pendKey,
        kind: 'stock-in',
        status: 'pending',
        label: `Stock In ${a.quantity} × “${prev.name}”`,
        detail: 'Unconfirmed — verifying automatically.',
        payload: stockPayload,
        idem,
        base,
        createdAt: Date.now(),
        attemptCount: 0,
        retryAfter: 0,
      });

      // Exactly ONE mutation — never blindly retried with a new key.
      // Chained per product so rapid taps reconcile in order.
      chainStockWork(prev.id, async () => {
        const fail = (label: string, detail: string, rollback: () => void) => {
          unmarkPending([prev.id, tempTx.id]);
          rollback();
          dropDesc(pendKey);
          const op: FailedOp = {
            key: `fail-${tempTx.id}`,
            label,
            detail,
            retry: () => submitStockIn(a, { idempotencyKey: idem }),
          };
          pushFailedOp(op, descFor(op, { kind: 'stock-in', payload: stockPayload, base, idem }));
          notify(`${detail} Kept as an unsaved change — retry from the sync banner.`, 'error');
        };
        try {
          const res = await api.stockIn({ ...a, idempotencyKey: idem });
          if (!isCurrentBackend(base)) {
            unmarkPending([prev.id, tempTx.id]);
            dropDesc(pendKey);
            return;
          }
          const latest = live.current;
          unmarkPending([prev.id, tempTx.id]);
          dropDesc(pendKey);
          commit({
            products: res.product ? upsertProduct(latest.products, res.product) : latest.products,
            transactions: (() => {
              const without = latest.transactions.filter(
                (t) => t.id !== tempTx.id && t.idempotencyKey !== idem,
              );
              return prependTransaction(without, res.transaction);
            })(),
          });
          notify(`Stock added (+${a.quantity}).`);
        } catch (e) {
          if (!isCurrentBackend(base)) {
            unmarkPending([prev.id, tempTx.id]);
            dropDesc(pendKey);
            return;
          }
          const msg = e instanceof ApiError ? e.message : 'Stock In failed.';
          if (!isUnknownOutcome(e)) {
            // Explicit rejection (e.g. bad quantity) — roll back, refresh basis.
            fail(`Stock In ${a.quantity} × “${prev.name}”`, msg, () => {
              const latest = live.current;
              applyLocal({
                products: upsertProduct(latest.products, prev),
                transactions: latest.transactions.filter((t) => t.id !== tempTx.id),
              });
              void refresh({ silent: true });
            });
            return;
          }
          // Unknown outcome (timeout/offline): check by idempotency key.
          unmarkPending([prev.id, tempTx.id]);
          const refreshed = await refresh({ silent: true });
          if (!isCurrentBackend(base)) {
            dropDesc(pendKey);
            return;
          }
          const found = refreshed
            ? live.current.transactions.find((t) => t.idempotencyKey === idem)
            : undefined;
          if (found) {
            // Applied — the response was just lost. Server state already adopted.
            dropDesc(pendKey);
            notify(`Stock added (+${a.quantity}).`);
            return;
          }
          if (!refreshed) {
            const latest = live.current;
            applyLocal({
              products: upsertProduct(latest.products, prev),
              transactions: latest.transactions.filter((t) => t.id !== tempTx.id),
            });
          }
          dropDesc(pendKey);
          const unknownOp: FailedOp = {
            key: `fail-${tempTx.id}`,
            label: `Stock In ${a.quantity} × “${prev.name}”`,
            detail: msg,
            retry: () => submitStockIn(a, { idempotencyKey: idem }),
          };
          pushFailedOp(
            unknownOp,
            descFor(unknownOp, { kind: 'stock-in', payload: stockPayload, base, idem }),
          );
          notify(`${msg} Kept as an unsaved change — retry from the sync banner.`, 'error');
        }
      });
      return true;
    },
    [claimSubmit, applyLocal, markPending, unmarkPending, commit, notify, refresh, pushFailedOp, chainStockWork, putDesc, dropDesc, descFor],
  );

  const doStockIn = useCallback(
    async (a: { productId: string; quantity: number; price?: number; note?: string }) =>
      submitStockIn(a),
    [submitStockIn],
  );

  const submitStockOut = useCallback(
    async (
      a: { productId: string; quantity: number; reason: string; note?: string },
      opts?: { idempotencyKey?: string },
    ): Promise<boolean> => {
      const idem = opts?.idempotencyKey || newIdempotencyKey();
      if (!claimSubmit(`out-${a.productId}-${a.quantity}-${idem}`)) return false;
      const base = getCurrentUserId() ?? '';
      const cur = live.current;
      const prev = cur.products.find((p) => p.id === a.productId);
      if (!prev) {
        notify('Product not found — syncing latest data.', 'error');
        void refresh({ silent: true });
        return true;
      }
      const qty = Math.floor(Number(a.quantity));
      // Never show negative stock: clamp the preview at zero (backend
      // re-validates against real stock and rejects overdraws).
      const nextQty = Math.max(0, prev.currentStock - qty);
      const tempTx: StockTransaction = {
        id: tempId('txn'),
        productId: prev.id,
        productName: prev.name,
        type: 'OUT',
        quantity: qty,
        price: 0,
        reason: a.reason,
        note: a.note || '',
        idempotencyKey: idem,
        createdAt: nowIso(),
      };
      applyLocal({
        products: upsertProduct(cur.products, { ...prev, currentStock: nextQty, updatedAt: nowIso() }),
        transactions: prependTransaction(cur.transactions, tempTx),
      });
      markPending([prev.id, tempTx.id]);
      // Durable outbox: written BEFORE the POST. Removed on every terminal
      // branch below; a leftover at boot means the app died mid-flight.
      const pendKey = `pend-stock-${idem}`;
      const stockPayload = {
        productId: a.productId,
        quantity: qty,
        reason: a.reason,
        note: a.note || '',
      };
      putDesc({
        key: pendKey,
        kind: 'stock-out',
        status: 'pending',
        label: `Stock Out ${a.quantity} × “${prev.name}”`,
        detail: 'Unconfirmed — verifying automatically.',
        payload: stockPayload,
        idem,
        base,
        createdAt: Date.now(),
        attemptCount: 0,
        retryAfter: 0,
      });

      // Chained per product so rapid taps reconcile in order.
      chainStockWork(prev.id, async () => {
        try {
          const res = await api.stockOut({ ...a, idempotencyKey: idem });
          if (!isCurrentBackend(base)) {
            unmarkPending([prev.id, tempTx.id]);
            dropDesc(pendKey);
            return;
          }
          const latest = live.current;
          unmarkPending([prev.id, tempTx.id]);
          dropDesc(pendKey);
          commit({
            products: res.product ? upsertProduct(latest.products, res.product) : latest.products,
            transactions: (() => {
              const without = latest.transactions.filter(
                (t) => t.id !== tempTx.id && t.idempotencyKey !== idem,
              );
              return prependTransaction(without, res.transaction);
            })(),
          });
          notify(`Stock removed (−${a.quantity}).`);
        } catch (e) {
          if (!isCurrentBackend(base)) {
            unmarkPending([prev.id, tempTx.id]);
            dropDesc(pendKey);
            return;
          }
          const msg = e instanceof ApiError ? e.message : 'Stock Out failed.';
          if (!isUnknownOutcome(e)) {
            // Explicit rejection — e.g. stale cache overdraw. Roll back to the
            // snapshot, then pull true stock so the next attempt validates
            // against real numbers.
            unmarkPending([prev.id, tempTx.id]);
            dropDesc(pendKey);
            const latest = live.current;
            applyLocal({
              products: upsertProduct(latest.products, prev),
              transactions: latest.transactions.filter((t) => t.id !== tempTx.id),
            });
            void refresh({ silent: true });
            notify(msg, 'error');
            return;
          }
          // Unknown outcome: verify by idempotency key before deciding.
          unmarkPending([prev.id, tempTx.id]);
          const refreshed = await refresh({ silent: true });
          if (!isCurrentBackend(base)) {
            dropDesc(pendKey);
            return;
          }
          const found = refreshed
            ? live.current.transactions.find((t) => t.idempotencyKey === idem)
            : undefined;
          if (found) {
            dropDesc(pendKey);
            notify(`Stock removed (−${a.quantity}).`);
            return;
          }
          if (!refreshed) {
            const latest = live.current;
            applyLocal({
              products: upsertProduct(latest.products, prev),
              transactions: latest.transactions.filter((t) => t.id !== tempTx.id),
            });
          }
          dropDesc(pendKey);
          const unknownOp: FailedOp = {
            key: `fail-${tempTx.id}`,
            label: `Stock Out ${a.quantity} × “${prev.name}”`,
            detail: msg,
            retry: () => submitStockOut(a, { idempotencyKey: idem }),
          };
          pushFailedOp(
            unknownOp,
            descFor(unknownOp, { kind: 'stock-out', payload: stockPayload, base, idem }),
          );
          notify(`${msg} Kept as an unsaved change — retry from the sync banner.`, 'error');
        }
      });
      return true;
    },
    [claimSubmit, applyLocal, markPending, unmarkPending, commit, notify, refresh, pushFailedOp, chainStockWork, putDesc, dropDesc, descFor],
  );

  const doStockOut = useCallback(
    async (a: { productId: string; quantity: number; reason: string; note?: string }) =>
      submitStockOut(a),
    [submitStockOut],
  );


  /* ---------------- outbox dispatcher + recovery ----------------
   * Re-runs a persisted descriptor through the SAME mutation functions the
   * live UI uses (same validation, same idempotency keys, same reconcile).
   * Used for post-restart manual retries and never for blind auto-submit. */
  const runOutboxOp = useCallback(
    async (d: OutboxDesc): Promise<boolean> => {
      const p = d.payload as {
        input?: ProductFormInput;
        editingId?: string;
        id?: string;
        name?: string;
        target?: string;
        productId?: string;
        quantity?: number;
        price?: number | null;
        reason?: string;
        note?: string;
      };
      switch (d.kind) {
        case 'stock-in':
          if (!p.productId || !p.quantity) return false;
          return submitStockIn(
            {
              productId: p.productId,
              quantity: p.quantity,
              price: p.price ?? undefined,
              note: p.note,
            },
            { idempotencyKey: d.idem || newIdempotencyKey() },
          );
        case 'stock-out':
          if (!p.productId || !p.quantity) return false;
          return submitStockOut(
            {
              productId: p.productId,
              quantity: p.quantity,
              reason: p.reason || 'Sale',
              note: p.note,
            },
            { idempotencyKey: d.idem || newIdempotencyKey() },
          );
        case 'save-product':
          if (!p.input) return false;
          return saveProduct(p.input as ProductFormInput, p.editingId);
        case 'delete-product':
          if (!p.id) return false;
          return deleteProductOptimistically(p.id);
        default:
          return false;
      }
    },
    [
      submitStockIn,
      submitStockOut,
      saveProduct,
      deleteProductOptimistically,
    ],
  );

  const verifyingRef = useRef(false);
  /** Recovery for ops left `pending` by a kill or force-close. Read-only:
   *  one silent refresh, then adopt-by-idempotency-key or convert to a
   *  manual failed op. Never resubmits blindly, so no duplicates. */
  const verifyPendingStock = useCallback(async () => {
    if (verifyingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const dues = Array.from(outboxRef.current?.values() ?? []).filter(
      (o) => o.status === 'pending' && (o.kind === 'stock-in' || o.kind === 'stock-out') && o.retryAfter <= Date.now(),
    );
    if (dues.length === 0) return;
    verifyingRef.current = true;
    try {
      for (const d of dues) {
        const qty = Math.floor(Number((d.payload as { quantity?: number }).quantity) || 0);
        markPending([d.key]);
        let refreshed = false;
        try {
          refreshed = await refresh({ silent: true });
        } catch {
          refreshed = false;
        }
        unmarkPending([d.key]);
        if (!isCurrentBackend(d.base)) {
          dropDesc(d.key);
          continue;
        }
        const found = refreshed
          ? live.current.transactions.find((t) => t.idempotencyKey && t.idempotencyKey === d.idem)
          : undefined;
        if (found) {
          dropDesc(d.key);
          notify(d.kind === 'stock-in' ? `Stock added (+${qty}).` : `Stock removed (−${qty}).`);
        } else if (!refreshed) {
          putDesc({
            ...d,
            attemptCount: d.attemptCount + 1,
            retryAfter: Date.now() + outboxBackoffMs(d.attemptCount),
            lastError: 'Sync failed — will retry automatically.',
          });
        } else {
          // Server reachable and the key is absent ⇒ never applied.
          dropDesc(d.key);
          const op: FailedOp = {
            key: `fail-${d.key}`,
            label: d.label,
            detail: 'Not found on the server — review and retry manually.',
            retry: () => runOutboxOp(d),
          };
          pushFailedOp(
            op,
            descFor(op, { kind: d.kind, payload: d.payload, base: d.base, idem: d.idem }),
          );
          notify(`“${d.label}” was not applied — kept for manual retry.`, 'error');
        }
      }
    } finally {
      verifyingRef.current = false;
    }
  }, [refresh, notify, markPending, unmarkPending, pushFailedOp, putDesc, dropDesc, descFor, runOutboxOp]);

  // Auto-verify worker: due `pending` ops when online + visible. Manual
  // `failed` ops are never auto-retried — the user retries them by hand.
  useEffect(() => {
    if (!configured) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void verifyPendingStock();
    }, 20000);
    const on = () => {
      if (navigator.onLine) void verifyPendingStock();
    };
    window.addEventListener('online', on);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', on);
    };
  }, [configured, verifyPendingStock]);

  // Boot hydration: restore manual failed ops (with working retry) and verify
  // leftovers from a kill. Runs once, after the first sync settles.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!ready || !configured || hydratedRef.current) return;
    hydratedRef.current = true;
    const curBase = getCurrentUserId() ?? '';
    let droppedBase = 0;
    for (const d of outboxRef.current?.values() ?? []) {
      if (d.base && d.base !== curBase) {
        outboxRef.current?.delete(d.key);
        droppedBase += 1;
        continue;
      }
      if (d.status === 'failed') {
        const op: FailedOp = {
          key: d.key,
          label: d.label,
          detail: d.attemptCount > 0 ? `${d.detail} · retry ${d.attemptCount}` : d.detail,
          retry: () => runOutboxOp(d),
        };
        failedOpsRef.current.set(d.key, op);
      }
    }
    if (failedOpsRef.current.size > 0) {
      setFailedOps(Array.from(failedOpsRef.current.values()).slice(-5));
    }
    if (droppedBase > 0) {
      saveOutbox();
      notify(
        `Dropped ${droppedBase} unsynced change(s) saved for a previous backend — they can't apply to this Sheet.`,
        'info',
      );
    }
    void verifyPendingStock();
  }, [ready, configured, notify, saveOutbox, runOutboxOp, verifyPendingStock]);

  // O(1) category display-name lookup for product rows.
  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(String(c.id), c.name);
    return m;
  }, [categories]);
  const categoryName = useCallback((id: string) => catMap.get(String(id)) || '', [catMap]);

  const value = useMemo<Store>(
    () => ({
      products,
      categories,
      transactions,
      dashboard,
      loading,
      refreshing,
      ready,
      error,
      lastSync,
      online,
      configured,
      pendingIds,
      failedOps,
      isPending,
      retryFailedOp,
      dismissFailedOp,
      theme,
      setTheme,
      dark,
      toasts,
      notify,
      dismissToast,
      refresh,
      ensureFresh,
      loadMoreTransactions,
      txLoadingMore,
      txExhausted,
      setConfiguredFlag,
      clearCache,
      logout,
      saveProduct,
      removeProduct,
      saveCategory,
      removeCategory,
      doStockIn,
      doStockOut,
      addProductOptimistically,
      updateProductOptimistically,
      deleteProductOptimistically,
      submitStockIn,
      submitStockOut,
      reconcileServerResponse,
      invalidateAffectedQueries,
      categoryName,
    }),
    [
      products, categories, transactions, dashboard, loading,
      refreshing, ready, error, lastSync, online, configured,
      pendingIds, failedOps, isPending, retryFailedOp, dismissFailedOp,
      theme, setTheme,
      dark, toasts, notify, dismissToast, refresh, ensureFresh,
      loadMoreTransactions, txLoadingMore, txExhausted, setConfiguredFlag, clearCache, logout,
      saveProduct, removeProduct, saveCategory, removeCategory, doStockIn, doStockOut,
      addProductOptimistically, updateProductOptimistically, deleteProductOptimistically,
      submitStockIn, submitStockOut, reconcileServerResponse, invalidateAffectedQueries,
      categoryName,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------- shared helpers ---------- */

/* stock status + product-input validation live in the shared validation
 * package (one rule set for both frontends and the backend). */
export { stockStatus, validateProductInput } from '@stockly/shared-validation';

/**
 * In-memory dashboard math — mirrors Apps Script `dashboard_()` exactly.
 * Used for instant post-mutation UI; the next server refresh replaces it
 * with authoritative totals. Never treated as source of truth.
 */
export function computeDashboard(products: Product[], tx: StockTransaction[]): DashboardStats {
  let totalUnits = 0;
  let costValue = 0;
  let retailValue = 0;
  const low: Product[] = [];
  const out: Product[] = [];
  for (const p of products) {
    totalUnits += p.currentStock;
    costValue += p.currentStock * p.costPrice;
    retailValue += p.currentStock * p.sellingPrice;
    if (p.currentStock <= 0) out.push(p);
    else if (p.currentStock <= p.minimumStock) low.push(p);
  }
  return {
    totalProducts: products.length,
    totalUnits,
    lowStockCount: low.length,
    outOfStockCount: out.length,
    inventoryCostValue: Math.round(costValue * 100) / 100,
    inventoryRetailValue: Math.round(retailValue * 100) / 100,
    recentMovements: tx.slice(0, 6),
    lowStockItems: out.concat(low).slice(0, 8),
  };
}

function byCreatedDesc(a: StockTransaction, b: StockTransaction): number {
  return String(b.createdAt) < String(a.createdAt) ? -1 : 1;
}

/* Cheap change signatures for the refresh bail-out: linear string build,
 * capped so a huge catalogue can't stall the UI thread. Order-sensitive
 * (a reorder counts as changed — rare and safe to re-render). */
function sigProducts(list: Product[]): string {
  let s = list.length + '|';
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    s += p.id + '#' + p.currentStock + '#' + (p.updatedAt || '') + ';';
    if (s.length > 30000) break;
  }
  return s;
}
function sigCategories(list: Category[]): string {
  let s = list.length + '|';
  for (let i = 0; i < list.length; i++) {
    s += list[i].id + '#' + list[i].name + ';';
    if (s.length > 10000) break;
  }
  return s;
}
function sigTx(list: StockTransaction[]): string {
  let s = list.length + '|';
  for (let i = 0; i < list.length; i++) {
    s += list[i].id + ';';
    if (s.length > 20000) break;
  }
  return s;
}
/**
 * Merge transaction windows by id (transactions are immutable +
 * append-only, so id-keyed merge is safe across devices). Newest first,
 * bounded by `cap` to protect memory on huge histories.
 */
export function mergeTransactions(
  existing: StockTransaction[],
  fresh: StockTransaction[],
  cap: number,
): StockTransaction[] {
  if (fresh.length === 0) return existing;
  const seen = new Set(existing.map((t) => t.id));
  const merged = existing.slice();
  for (const t of fresh) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      merged.push(t);
    }
  }
  merged.sort(byCreatedDesc);
  return merged.slice(0, cap);
}

/** Insert-or-replace a product by id (preserves list order on update). */
export function upsertProduct(list: Product[], p: Product): Product[] {
  const i = list.findIndex((x) => x.id === p.id);
  if (i === -1) return [...list, p];
  const next = list.slice();
  next[i] = p;
  return next;
}

/** Prepend a transaction unless it is already cached (idempotent replay). */
export function prependTransaction(list: StockTransaction[], t: StockTransaction): StockTransaction[] {
  if (list.some((x) => x.id === t.id)) return list;
  return [t, ...list];
}
