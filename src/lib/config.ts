/* Single API configuration file for the whole frontend.
 * No secrets live here — the Apps Script URL is public-by-design
 * (access is controlled inside Apps Script + the Sheet sharing settings).
 * Users paste their Web-App URL once in Settings; it is stored on-device.
 */

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

/** Default backend URL. Empty until the user connects a deployment. */
export const DEFAULT_API_URL = '';

/** localStorage keys — used ONLY as a cache / for settings, never as the DB. */
export const LS_KEYS = {
  apiUrl: 'stockly.apiUrl',
  theme: 'stockly.theme',
  cache: 'stockly.cache.v1',
  queue: 'stockly.outbox.v1',
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
