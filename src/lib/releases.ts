/* Published-release client (GitHub Releases as source of truth).
 *
 * No committed metadata files: the website, the store page, and the in-app
 * updater all read the live release state straight from the GitHub Releases
 * API, cached briefly. Nothing here logs URLs, tokens, or checksums.
 */

export interface ReleaseInfo {
  /** Release tag without the leading v, e.g. "1.0.0". */
  tag: string;
  version: string;
  versionCode: number;
  /** "release" (store-signed) or "debug" (debug-signed sideload build). */
  build: string;
  publishedAt: string;
  minimumSupportedVersion: string;
  releaseNotes: string[];
  apkUrl: string;
  /** Bytes, 0 when unknown. */
  apkSize: number;
  /** Hex digest when the release publishes one, else null. */
  sha256: string | null;
  releaseUrl: string;
  commit: string;
  /** Whether fields came from the release.json asset or were derived. */
  source: 'release.json' | 'assets';
}

export interface ReleaseSummary {
  tag: string;
  version: string;
  publishedAt: string;
  releaseUrl: string;
  apkUrl: string;
  apkSize: number;
}

const REPO = 'Dravyashah05/Stockly';
const API_BASE = 'https://api.github.com/repos/' + REPO + '/releases';
const CACHE_KEY = 'stockly.releaseCache.v1';
/** Release metadata refreshes promptly but is never fetched per render. */
const CACHE_TTL_MS = 60 * 60 * 1000;

interface GhAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GhRelease {
  tag_name: string;
  body: string | null;
  published_at: string | null;
  html_url: string;
  assets: GhAsset[] | null;
}

function stripV(tag: string): string {
  return String(tag || '').replace(/^v/i, '');
}

function apkAsset(rel: GhRelease): GhAsset | null {
  const assets = Array.isArray(rel.assets) ? rel.assets : [];
  return assets.find((a) => typeof a.name === 'string' && /\.apk$/i.test(a.name)) || null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Pure mapping of one GitHub release (+ optional release.json payload) to
 * ReleaseInfo. Exported for tests; network code below stays thin.
 */
export function mapReleasePayload(rel: GhRelease, meta: unknown): ReleaseInfo {
  const m = isRecord(meta) &&
    typeof meta.version === 'string' && meta.version.trim() !== '' &&
    typeof meta.apkUrl === 'string' && meta.apkUrl.trim() !== ''
    ? meta
    : null;
  const apk = apkAsset(rel);
  const tag = stripV(rel.tag_name);
  return {
    tag,
    version: m && typeof m.version === 'string' ? String(m.version) : tag,
    versionCode: m && typeof m.versionCode === 'number' && Number.isFinite(m.versionCode) ? Math.floor(m.versionCode) : 0,
    build: m && typeof m.build === 'string' ? String(m.build) : 'debug',
    publishedAt: typeof rel.published_at === 'string' ? rel.published_at : '',
    minimumSupportedVersion: m && typeof m.minimumSupportedVersion === 'string' ? String(m.minimumSupportedVersion) : '1.0.0',
    releaseNotes: m && Array.isArray(m.releaseNotes) ? m.releaseNotes.filter((n): n is string => typeof n === 'string').slice(0, 12) : [],
    apkUrl: m && typeof m.apkUrl === 'string' ? String(m.apkUrl) : apk ? apk.browser_download_url : '',
    apkSize: apk && typeof apk.size === 'number' ? apk.size : 0,
    sha256: m && typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(m.sha256) ? m.sha256.toLowerCase() : null,
    releaseUrl: typeof rel.html_url === 'string' ? rel.html_url : '',
    commit: m && typeof m.commit === 'string' ? String(m.commit) : '',
    source: m ? 'release.json' : 'assets',
  };
}

function readCache(): { at: number; info: ReleaseInfo } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; info?: unknown };
    if (typeof parsed.at !== 'number' || !isRecord(parsed.info)) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { at: parsed.at, info: parsed.info as unknown as ReleaseInfo };
  } catch {
    return null;
  }
}

let memory: { at: number; info: ReleaseInfo } | null = null;

async function getJson(url: string, timeoutMs: number): Promise<{ status: number; data: unknown }> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Latest published release. Throws a user-readable Error when unavailable —
 * callers show the message with a retry action. Pass { noCache: true } for
 * an explicit user-initiated refresh.
 */
export async function fetchLatestRelease(opts?: { noCache?: boolean }): Promise<ReleaseInfo> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('You’re offline — connect and try again.');
  }
  if (!opts?.noCache) {
    if (memory && Date.now() - memory.at <= CACHE_TTL_MS) return memory.info;
    const cached = readCache();
    if (cached) {
      memory = cached;
      return cached.info;
    }
  }
  const { status, data } = await getJson(API_BASE + '/latest', 12000);
  if (status === 404 || (status === 200 && !isRecord(data))) {
    throw new Error('No Stockly releases are published yet — check back soon.');
  }
  if (status !== 200 || !isRecord(data)) {
    throw new Error(`Couldn’t reach the release server (HTTP ${status}) — try again later.`);
  }
  const rel = data as unknown as GhRelease;
  // Prefer the machine-readable release.json asset; fall back to the raw
  // release payload so older releases still resolve a download.
  let meta: unknown = null;
  const assets = Array.isArray(rel.assets) ? rel.assets : [];
  const metaAsset = assets.find((a) => a.name === 'release.json');
  if (metaAsset) {
    try {
      const m = await getJson(metaAsset.browser_download_url, 12000);
      if (m.status === 200) meta = m.data;
    } catch {
      meta = null;
    }
  }
  const info = mapReleasePayload(rel, meta);
  if (!info.apkUrl) throw new Error('The latest release has no APK attached yet.');
  memory = { at: Date.now(), info };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable — memory cache still applies */
  }
  return info;
}

/** Newest-first release list for version history (one request, no N+1). */
export async function fetchReleaseHistory(limit = 10): Promise<ReleaseSummary[]> {
  const { status, data } = await getJson(API_BASE + `?per_page=${Math.min(Math.max(limit, 1), 20)}`, 12000);
  if (status !== 200 || !Array.isArray(data)) {
    throw new Error(`Couldn’t load the release history (HTTP ${status}).`);
  }
  return (data as GhRelease[]).map((rel) => {
    const apk = apkAsset(rel);
    return {
      tag: stripV(rel.tag_name),
      version: stripV(rel.tag_name),
      publishedAt: typeof rel.published_at === 'string' ? rel.published_at : '',
      releaseUrl: typeof rel.html_url === 'string' ? rel.html_url : '',
      apkUrl: apk ? apk.browser_download_url : '',
      apkSize: apk && typeof apk.size === 'number' ? apk.size : 0,
    };
  });
}

/** SHA-256 digest for a release tag, parsed from its SHA256SUMS.txt asset. */
export async function fetchReleaseChecksum(tag: string): Promise<string | null> {
  const clean = stripV(tag);
  if (!clean) return null;
  const { status, data } = await getJson(`${API_BASE}/tags/v${encodeURIComponent(clean)}`, 12000);
  if (status !== 200 || !isRecord(data)) return null;
  const rel = data as unknown as GhRelease;
  const assets = Array.isArray(rel.assets) ? rel.assets : [];
  const sums = assets.find((a) => /sha256/i.test(a.name) && /\.txt$/i.test(a.name));
  if (!sums) return null;
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(sums.browser_download_url, { cache: 'no-store', signal: ctrl.signal });
      if (!res.ok) return null;
      const text = await res.text();
      for (const line of text.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && /^[0-9a-f]{64}$/i.test(parts[0]) && /\.apk$/i.test(parts[parts.length - 1])) {
          return parts[0].toLowerCase();
        }
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    return null;
  }
  return null;
}

/** "4314200" → "4.1 MB". Pure helper for download UI. */
export function formatApkSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
