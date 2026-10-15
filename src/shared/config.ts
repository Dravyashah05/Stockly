/* Single API configuration file for the frontend. The Apps Script Web-App URL is stored in local settings; the endpoint itself is public to URL holders. */

export const APP_NAME = 'Stockly';
export const APP_ID = 'com.stockly.inventory';
export const APP_VERSION = '1.0.0';

/** Update manifest for the in-app updater (Settings → App update).
 *  Point this at the version.json hosted next to your APK download, e.g.
 *  `https://your-site.com/version.json` shaped like:
 *  `{ "version": "1.1.0", "apkUrl": "https://your-site.com/stockly.apk", "notes": "What changed" }`.
 *  Empty means automatic checks stay disabled — the UI says so instead of
 *  pretending to check. */
export const UPDATE_CHECK_URL = '';

/** Default backend URL. Prefers the public endpoint env var when the
 *  deployment configures one; otherwise empty until the user connects.
 *  Only a public URL belongs here — never secrets (Vite env is public). */
const ENV_USER_SCRIPT_URL = import.meta.env?.VITE_USER_SCRIPT_URL;
export const DEFAULT_API_URL = typeof ENV_USER_SCRIPT_URL === 'string' ? ENV_USER_SCRIPT_URL.trim() : '';

/** Same-origin trusted admin API (Vercel serverless). The private admin
 *  spreadsheet ID and Google credentials stay server-side; the browser
 *  only ever talks to this route with a short-lived session token. */
export const ADMIN_API_ROUTE = '/api/admin';

/** Same-origin trusted device-linking API (Vercel serverless). Issues
 *  short-lived linking tokens and per-device sessions; the browser never
 *  sees server secrets. */
export const DEVICES_API_ROUTE = '/api/devices';

/** Same-origin trusted user-sheet gateway (Vercel serverless). Resolves
 *  the caller's verified spreadsheet server-side and forwards inventory
 *  traffic. The browser never holds an exec URL. */
export const SHEETS_API_ROUTE = '/api/sheets';

/** Base URL of the deployed backend (Vercel). Web builds use same-origin
 *  (empty). Installed Android builds have no same-origin server, so they
 *  need the deployment URL, e.g. VITE_API_BASE_URL=https://your-app.vercel.app
 *  (public origin only — never secrets). */
const API_ENV_RAW = import.meta.env?.VITE_API_BASE_URL;
export const API_BASE_URL = (typeof API_ENV_RAW === 'string' ? API_ENV_RAW : '').trim().replace(/\/+$/, '');

export function isNativeApp(): boolean {
  try {
    return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
  } catch {
    return false;
  }
}

/** Absolute backend URL on native builds (same-origin on web). All
 *  /api/* calls go through here so Android reaches the deployment. */
export function apiUrl(route: string): string {
  if (API_BASE_URL) return `${API_BASE_URL}${route}`;
  return route;
}

/** localStorage keys — used ONLY as a cache / for settings, never as the DB. */
export const LS_KEYS = {
  apiUrl: 'stockly.apiUrl',
  theme: 'stockly.theme',
  cache: 'stockly.cache.v1',
  queue: 'stockly.outbox.v1',
  sidebar: 'stockly.sidebarCollapsed',
  userId: 'stockly.userId',
  userProfile: 'stockly.userProfile.v1',
  deviceId: 'stockly.deviceId',
  deviceSession: 'stockly.deviceSession.v1',
  authSession: 'stockly.authSession.v1',
} as const;

/** sessionStorage keys — short-lived, cleared when the tab closes. */
export const SS_KEYS = {
  adminToken: 'stockly.adminToken',
  adminEmail: 'stockly.adminEmail',
} as const;

export const STOCK_OUT_REASONS = [
  'Sale',
  'Damaged',
  'Lost',
  'Return',
  'Other',
] as const;

export const CURRENCY_SYMBOL = '₹';

/* ------------------------------ sync policy ------------------------------ */
/** Background/foreground refreshes skip the network while cache is this fresh. */
export const SYNC_FRESH_MS = 30_000;
/** Automatic background sync while the app is open (silent, visible tab only). */
export const AUTO_SYNC_MS = 120_000;
/** Transactions shipped inside every sync (dashboard needs ~6, history pages the rest). */
export const SYNC_TX_LIMIT = 60;
/** Caps to bound memory + localStorage quota (transactions are append-only). */
export const TX_MEMORY_CAP = 500;
export const TX_CACHE_CAP = 200;

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return `${CURRENCY_SYMBOL}0`;
  return `${CURRENCY_SYMBOL}${n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  })}`;
}

export function getApiUrl(): string {
  try {
    return localStorage.getItem(LS_KEYS.apiUrl) || DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

/** Accept only the deployed Apps Script Web App URL format used by Stockly. */
export function isAppsScriptExecUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      url.hostname === 'script.google.com' &&
      !url.port &&
      /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function setApiUrl(url: string): void {
  try {
    if (url) localStorage.setItem(LS_KEYS.apiUrl, url);
    else localStorage.removeItem(LS_KEYS.apiUrl);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function isConfigured(): boolean {
  return getApiUrl().length > 10;
}

/* ------------------------------ user identity ------------------------------ */
/** Stable user id for the registered profile on this device. Stored only as
 *  a cache key — the user spreadsheet is authoritative for the profile. */
export function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem(LS_KEYS.userId);
  } catch {
    return null;
  }
}

export function setCurrentUserId(userId: string): void {
  try {
    if (userId) localStorage.setItem(LS_KEYS.userId, userId);
    else localStorage.removeItem(LS_KEYS.userId);
  } catch {
    /* storage unavailable — ignore */
  }
}
