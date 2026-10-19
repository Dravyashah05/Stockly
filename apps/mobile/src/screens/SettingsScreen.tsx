import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Download,
  ShieldCheck,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Sun,
  Sunset,
  Tag,
  Trash2,
} from 'lucide-react';
import { APP_VERSION, APP_VERSION_CODE, LS_KEYS, UPDATE_CHECK_URL, setApiUrl } from '@stockly/shared-client/config';
import { fetchLatestRelease, formatApkSize, isNewerVersion } from '@stockly/shared-client/releases';


import { useStore } from '@stockly/shared-client/store';
import type { Category } from '@stockly/shared-types';
import { sheetsApi } from '@stockly/shared-client/connection';
import LinkedDevicesScreen from './LinkedDevicesScreen';
import { SheetSetupScreen } from './AccessScreens';
import { Confirm, Field, Header, Sheet, BrandMark, inputCls } from '../components/ui';

export default function SettingsScreen() {
  const {
    theme, setTheme, products, categories, refresh, refreshing, online, configured, pendingIds, error,
    saveCategory, removeCategory, clearCache, notify,
    failedOps, lastSync, retryFailedOp, logout,
  } = useStore();

  const [cloudOpen, setCloudOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Sheet connection
  const [connState, setConnState] = useState<string | null>(null);
  const [connVerifiedAt, setConnVerifiedAt] = useState<string | null>(null);
  const [connError, setConnError] = useState('');
  const [connBusy, setConnBusy] = useState(false);
  const [sheetChangeOpen, setSheetChangeOpen] = useState(false);
  // Linked devices
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devicesMode] = useState<'manage' | 'link'>('manage');
  // Categories manager
  const [catListOpen, setCatListOpen] = useState(false);
  const [quickCat, setQuickCat] = useState('');
  const [catError, setCatError] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [delBusy, setDelBusy] = useState(false);
  const submitQuickCat = async () => {
    const name = quickCat.trim().replace(/\s+/g, ' ');
    if (!name) {
      setCatError('Enter a category name.');
      return;
    }
    if (categories.some((c) => c.id !== editingCat?.id && c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCatError('A category with this name already exists.');
      return;
    }
    setCatError('');
    setQuickBusy(true);
    const ok = await saveCategory(name, editingCat?.id);
    setQuickBusy(false);
    if (ok) {
      setQuickCat('');
      setEditingCat(null);
      setCatError('');
    } else {
      setCatError('Could not save the category. Check your connection and try again.');
    }
  };
  const confirmDelCat = async () => {
    if (!delCat) return;
    setDelBusy(true);
    const ok = await removeCategory(delCat.id);
    setDelBusy(false);
    if (ok) setDelCat(null);
  };

  const connected = configured;

  // ---- Sync status (durable outbox visibility) ----
  const failedCount = failedOps.length;
  const syncState = refreshing
    ? 'Syncing'
    : !online
      ? 'Offline'
      : error || failedCount > 0
        ? 'Failed'
        : pendingIds.length > 0
          ? 'Changes syncing'
          : lastSync
            ? 'Synced'
            : 'Not synced yet';
  const lastSyncLabel = lastSync
    ? lastSync.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Never';
  // On-device cache footprint, measured once (not per render).
  const [cacheKb] = useState(() => {
    try {
      let bytes = 0;
      for (const k of Object.values(LS_KEYS)) bytes += (localStorage.getItem(k) || '').length;
      return Math.max(1, Math.round(bytes / 1024));
    } catch {
      return 0;
    }
  });
  const [syncBusy, setSyncBusy] = useState(false);
  const retryAll = async () => {
    if (failedOps.length === 0 || syncBusy) return;
    setSyncBusy(true);
    try {
      for (const op of failedOps) {
        await retryFailedOp(op.key);
      }
    } finally {
      setSyncBusy(false);
    }
  };

  // ---- App update (top of Settings) ----
  // Primary source is the published GitHub release (see src/shared/releases.ts);
  // a hosted version.json manifest is still honoured when configured.
  type UpdateStatus = 'idle' | 'checking' | 'uptodate' | 'available' | 'error';
  const [updStatus, setUpdStatus] = useState<UpdateStatus>('idle');
  const [updLatest, setUpdLatest] = useState('');
  const [updApk, setUpdApk] = useState('');
  const [updNotes, setUpdNotes] = useState('');
  const [updMeta, setUpdMeta] = useState('');
  const [updError, setUpdError] = useState('');
  const [updCheckedAt, setUpdCheckedAt] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem('stockly.updateCheck');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { at?: unknown };
      return typeof parsed.at === 'number' ? parsed.at : null;
    } catch {
      return null;
    }
  });
  const checkUpdates = async (force = false) => {
    if (updStatus === 'checking') return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setUpdError('You’re offline — connect and try again.');
      setUpdStatus('error');
      return;
    }
    setUpdStatus('checking');
    setUpdError('');
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 15000);
    const remember = (latest: string) => {
      const at = Date.now();
      try {
        localStorage.setItem('stockly.updateCheck', JSON.stringify({ at, latest }));
      } catch {
        /* storage unavailable — timestamp simply won't persist */
      }
      setUpdCheckedAt(at);
    };
    try {
      if (UPDATE_CHECK_URL) {
        const res = await fetch(UPDATE_CHECK_URL, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { version?: unknown; apkUrl?: unknown; notes?: unknown; versionCode?: unknown };
        const latest = String(data.version || '').trim();
        if (!latest) throw new Error('Bad version file.');
        remember(latest);
        const remoteCode = typeof data.versionCode === 'number' ? data.versionCode : 0;
        if (isNewerVersion(latest, APP_VERSION, remoteCode, APP_VERSION_CODE)) {
          setUpdLatest(latest);
          setUpdApk(String(data.apkUrl || ''));
          setUpdNotes(String(data.notes || ''));
          setUpdMeta('');
          setUpdStatus('available');
        } else {
          setUpdStatus('uptodate');
        }
      } else {
        const rel = await fetchLatestRelease({ noCache: force });
        remember(rel.version);
        if (isNewerVersion(rel.version, APP_VERSION, rel.versionCode, APP_VERSION_CODE)) {
          setUpdLatest(rel.version);
          setUpdApk(rel.apkUrl);
          setUpdNotes(rel.releaseNotes.join('\n'));
          const bits = [
            rel.publishedAt
              ? new Date(rel.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '',
            formatApkSize(rel.apkSize),
            rel.build === 'debug' ? 'debug build' : '',
          ].filter(Boolean);
          setUpdMeta(bits.join(' · '));
          setUpdStatus('available');
        } else {
          setUpdStatus('uptodate');
        }
      }
    } catch (e) {
      setUpdError(e instanceof Error && e.message ? e.message : 'Couldn’t reach the update server — try again later.');
      setUpdStatus('error');
    } finally {
      window.clearTimeout(timer);
    }
  };

  useEffect(() => {
    void checkUpdates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ---- Server-verified sheet connection (read-only here) ---- */
  const checkConnection = async () => {
    setConnBusy(true);
    setConnError('');
    try {
      const conn = await sheetsApi.getConnection();
      setConnState(conn.status);
      setConnVerifiedAt(conn.verifiedAt);
      if (!conn.connected) setConnError('No verified sheet connection.');
    } catch (e) {
      setConnError(e instanceof Error ? e.message : 'Could not check the connection.');
    } finally {
      setConnBusy(false);
    }
  };

  useEffect(() => {
    if (cloudOpen) void checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudOpen]);

  const themeOptions = [
    { k: 'light', label: 'Light', hint: 'Bright', icon: <Sun size={16} /> },
    { k: 'dark', label: 'Dark', hint: 'Night', icon: <Moon size={16} /> },
    { k: 'system', label: 'System', hint: 'System', icon: <Sunset size={16} /> },
  ] as const;



  return (
    <div className="app-page-viewport mx-auto max-w-md">
      <Header title="Settings" subtitle={`Stockly v${APP_VERSION}`} />

      <div className="settings-content mx-auto max-w-md space-y-4 px-4 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        {/* App identity — Apple-style hero header */}
        <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#007AFF] to-[#0055D4] dark:from-[#0A84FF] dark:to-[#0055B8] p-5 text-white shadow-sm">
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/20 text-white backdrop-blur-md">
              <BrandMark size={32} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-bold leading-tight tracking-tight">Stockly</p>
              <p className="text-[12px] font-normal text-white/80">Inventory on Google Sheets · v{APP_VERSION}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-white/20 text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected & Synced
              </span>
            </div>
          </div>
          <div className="tnum relative mt-4 grid grid-cols-1 gap-2 border-t border-white/20 pt-3">
            <div className="rounded-[14px] bg-white/15 px-3 py-2.5 backdrop-blur-md">
              <p className="text-[18px] font-bold leading-none">{String(products.length)}</p>
              <p className="mt-1 text-[11px] font-medium text-white/80">Products in catalogue</p>
            </div>
          </div>
        </div>

        {/* App update — version check against the hosted manifest */}
        <section className={`glass rounded-[24px] p-4 transition-all ${updStatus === 'available' ? 'border-[#007AFF]/30 shadow-md ring-1 ring-[#007AFF]/20' : ''}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${updStatus === 'available' ? 'bg-[#007AFF] text-white shadow-sm' : 'bg-(--field) text-(--ink-2)'}`}>
              <Download size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-(--ink)">App update</span>
              <span className="tnum block text-[12px] font-normal text-(--ink-2)">
                v{APP_VERSION}
                {updStatus === 'available' && updLatest ? ` → v${updLatest} available` : null}
                {updStatus !== 'available' && updCheckedAt
                  ? ` · checked ${new Date(updCheckedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : null}
                {updStatus !== 'available' && !updCheckedAt ? ' · not checked yet' : null}
              </span>
            </span>
            {updStatus === 'available' ? (
              <span className="shrink-0 rounded-full bg-[#007AFF] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                New
              </span>
            ) : null}
          </div>

          {updStatus === 'available' && updApk ? (
            <div className="mt-3.5 space-y-3">
              <div className="rounded-[18px] border border-[#007AFF]/25 bg-[#007AFF]/10 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-[#007AFF] dark:text-[#0A84FF]">
                    Update Ready to Install
                  </span>
                  <span className="rounded-full bg-[#007AFF] px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
                    v{updLatest}
                  </span>
                </div>
                {updMeta ? (
                  <p className="tnum mt-1 text-[12px] font-semibold text-(--ink-2)">{updMeta}</p>
                ) : null}
                {updNotes ? (
                  <div className="mt-2.5 max-h-36 overflow-y-auto rounded-[12px] bg-(--glass-soft) p-2.5 text-[12.5px] leading-relaxed text-(--ink-2) whitespace-pre-line">
                    {updNotes}
                  </div>
                ) : null}
              </div>

              <a
                href={updApk}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  try {
                    window.open(updApk, '_system');
                  } catch {}
                }}
                className="press flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] bg-[#007AFF] text-[15px] font-semibold text-white shadow-sm hover:opacity-95"
              >
                <Download size={18} /> Download & Update (v{updLatest})
              </a>

              <div className="flex items-center justify-between px-1">
                <p className="text-[11.5px] text-(--ink-3)">
                  Official APK update · Preserves existing data
                </p>
                <button
                  type="button"
                  onClick={() => void checkUpdates(true)}
                  className="press inline-flex items-center gap-1 text-[12px] font-semibold text-(--ink-2) hover:text-(--ink)"
                >
                  <RefreshCw size={12} />
                  Check again
                </button>
              </div>
            </div>
          ) : updStatus === 'uptodate' ? (
            <div className="mt-3 flex items-center justify-between rounded-[16px] bg-(--glass-soft) px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
                You’re on the latest version
              </span>
              <button
                type="button"
                onClick={() => void checkUpdates(true)}
                className="press inline-flex items-center gap-1.5 rounded-xl bg-(--bg-elev)/70 px-2.5 py-1 text-[12px] font-semibold text-(--ink) shadow-sm"
              >
                <RefreshCw size={12} />
                Check now
              </button>
            </div>
          ) : updStatus === 'error' && updError ? (
            <div className="mt-3 rounded-[16px] bg-rose-500/10 p-3">
              <p className="text-[12px] font-semibold text-rose-600 dark:text-rose-400">{updError}</p>
              <button
                type="button"
                onClick={() => void checkUpdates(true)}
                className="press mt-2 text-[12px] font-bold text-rose-600 dark:text-rose-400 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void checkUpdates(true)}
              disabled={updStatus === 'checking'}
              className="press mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-(--field) text-[13.5px] font-semibold text-(--ink) disabled:opacity-50 hover:bg-(--field)/80"
            >
              <RefreshCw size={16} className={updStatus === 'checking' ? 'animate-spin' : ''} />
              {updStatus === 'checking' ? 'Checking for updates…' : 'Check for updates'}
            </button>
          )}
        </section>

        {/* Cloud connection — summary row only, URL form lives in a popup */}
        <section className="glass rounded-[20px] p-4">
          <button
            type="button"
            onClick={() => setCloudOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-(--field) text-(--ink-2)">
              <Cloud size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-(--ink)">Cloud database</span>
              <span className="block truncate text-[12px] font-normal text-(--ink-2)">
                {connected ? 'Sheet verified — tap to manage' : 'Not configured — tap to connect'}
              </span>
            </span>
            {connected ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={15} />
              </span>
            ) : null}
            <ChevronRight size={17} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Categories — full list lives in a popup sheet */}
        <section className="glass rounded-[20px] p-4">
          <button
            type="button"
            onClick={() => setCatListOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-(--field) text-(--ink-2)">
              <Tag size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-(--ink)">Categories</span>
              <span className="block text-[12px] font-normal text-(--ink-2)">
                {categories.length === 0 ? 'Group products for faster search' : `${categories.length} group${categories.length === 1 ? '' : 's'} — tap to manage`}
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-(--ink-3)" />
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setCatListOpen(true)}
              className="press flex min-h-[44px] items-center justify-center gap-1.5 rounded-[12px] bg-(--field) text-[13.5px] font-semibold text-(--ink)"
            >
              <Tag size={15} /> Manage
            </button>
            <button
              onClick={() => { setEditingCat(null); setQuickCat(''); setCatError(''); setCatListOpen(true); }}
              className="press flex min-h-[44px] items-center justify-center gap-1 rounded-[12px] bg-(--primary) text-[13.5px] font-semibold text-white shadow-sm"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </section>

        {/* Sync status — durable outbox at a glance */}
        <section className="glass rounded-[20px] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-(--field) text-(--ink-2)">
              <RefreshCw size={19} className={refreshing ? 'animate-spin' : ''} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-(--ink)">{syncState}</span>
              <span className="tnum block text-[12px] font-normal text-(--ink-2)">
                Last sync: {lastSyncLabel} · Cache {cacheKb} KB
              </span>
            </span>
          </div>
          {failedCount > 0 ? (
            <div className="mt-3 rounded-[14px] border border-rose-500/25 bg-rose-500/10 px-3.5 py-3">
              <p className="text-[13px] font-bold text-(--ink)">
                {failedCount} change{failedCount === 1 ? '' : 's'} couldn&apos;t sync
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-(--ink-2)">
                Nothing is lost — review each one from the sync banner or retry them all here.
              </p>
              <button
                type="button"
                onClick={() => void retryAll()}
                disabled={syncBusy}
                className="press mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] bg-(--primary) text-[13.5px] font-semibold text-white shadow-sm disabled:opacity-50"
              >
                <RefreshCw size={15} className={syncBusy ? 'animate-spin' : ''} />
                {syncBusy ? 'Retrying…' : `Retry all (${failedCount})`}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="press mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[12px] bg-(--field) text-[13.5px] font-semibold text-(--ink) disabled:opacity-50 hover:bg-(--field)/80"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </section>

        {/* Appearance — Apple iOS segmented style */}
        <section className="glass rounded-[20px] p-3.5">
          <div className="flex items-center gap-2.5 px-1 pb-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-(--field) text-(--ink-2)">
              <Sun size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold tracking-tight text-(--ink)">Appearance</p>
              <p className="text-[11.5px] font-normal text-(--ink-2)">
                {theme === 'system' ? 'Follows your system' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </p>
            </div>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-(--field) p-1">
            {themeOptions.map((t) => {
              const active = theme === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setTheme(t.k)}
                  aria-pressed={active}
                  className={`press flex items-center justify-center gap-1.5 rounded-[9px] px-2 py-2 text-[12.5px] font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-(--bg-elev) text-(--ink) shadow-sm'
                      : 'text-(--ink-2) hover:text-(--ink)'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Data & about */}
        <section className="glass rounded-[20px] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-(--field) text-(--ink-2)">
              <Database size={19} />
            </span>
            <p className="text-[13px] leading-relaxed text-(--ink-2)">
              Data lives in <b className="text-(--ink)">your Google Sheet</b> — this phone only caches it. Works across multiple devices via sync.
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-[14px] bg-(--field)">
            <div className="flex w-full items-center gap-3 px-3.5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-(--bg-elev) text-(--ink-2)">
                <ShieldCheck size={16} />
              </span>
              <span className="flex-1 text-[13.5px] font-medium text-(--ink)">Version</span>
              <span className="tnum rounded-full bg-(--bg-elev) px-2.5 py-0.5 text-[11px] font-semibold text-(--ink-2)">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        {/* Disconnect — disconnects the cloud database and clears this phone */}
        <section className="glass rounded-[20px] border-red-500/20 p-4">
          <button
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-red-500/10 text-red-500">
              <LogOut size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-tight text-red-500">Disconnect Database</span>
              <span className="block text-[12px] font-normal text-(--ink-2)">
                Disconnects your Google Sheet and clears this phone’s cache
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        <p className="settings-footnote px-2 pb-2 text-center text-[11.5px] font-normal text-(--ink-3)">
          Made for small businesses · your data stays yours
        </p>
      </div>

      {/* Cloud database popup — server-verified connection (no URLs held here) */}
      <Sheet open={cloudOpen} onClose={() => setCloudOpen(false)} title="Cloud database">
        <p className="mb-3 text-[12px] font-medium text-(--ink-2)">Your own Google Sheet, verified by the server</p>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
          <span className="flex items-center gap-2 text-[13px] font-bold text-(--ink)">
            <span className={`h-2 w-2 rounded-full ${syncState === 'Synced' ? 'bg-emerald-500' : syncState === 'Failed' ? 'bg-rose-500' : syncState === 'Offline' ? 'bg-amber-500' : 'bg-(--ink-3)'}`} />
            {syncState}
          </span>
          <span className="tnum text-right text-[11px] font-medium text-(--ink-2)">Last successful sync · {lastSyncLabel}</span>
        </div>
        <div className="mb-3 rounded-xl bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-[13px] font-bold text-(--ink)">
            <span className={`h-2 w-2 rounded-full ${connState === 'verified' ? 'bg-emerald-500' : connState ? 'bg-amber-500' : 'bg-(--ink-3)'}`} />
            {connState === 'verified'
              ? `Sheet verified${connVerifiedAt ? ` · ${new Date(connVerifiedAt).toLocaleDateString()}` : ''}`
              : connState
                ? `Sheet ${connState} — reconnect below`
                : 'Checking connection…'}
          </p>
          {connError ? <p className="mt-1 text-[12px] font-medium text-rose-600 dark:text-rose-300">{connError}</p> : null}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          Your sheet association is stored and verified server-side. Linked devices share this same sheet automatically.
        </p>
        <div className="mt-3 space-y-2 pb-2">
          <button
            type="button"
            onClick={() => void checkConnection()}
            disabled={connBusy}
            className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl text-[14px] font-extrabold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={connBusy ? 'animate-spin' : ''} />
            {connBusy ? 'Verifying…' : 'Verify connection'}
          </button>
          <button
            type="button"
            onClick={() => { setCloudOpen(false); setSheetChangeOpen(true); }}
            className="press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[14px] bg-(--primary) text-[15px] font-semibold text-white shadow-sm"
          >
            Change sheet
          </button>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl text-[14px] font-extrabold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        {/* How syncing works — merged into the Cloud popup */}
        <p className="mt-3 px-1 text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">How syncing works</p>
        <ol className="mt-1.5 list-decimal space-y-2 pl-5 text-[13.5px] leading-relaxed text-(--ink)">
          {[
            'Create your own Google Sheet (keep it private).',
            'Open Extensions → Apps Script, paste the code from apps-script/Code.gs in this project.',
            'Run setupDatabase once, then deploy as a Web app (execute as Me, access Anyone).',
            'Connect it once from the setup screen — the server verifies access before storing anything.',
            'Linked devices share the same verified sheet automatically.',
          ].map((step, i) => (
            <li key={i} className="rounded-2xl bg-(--glass-soft) px-3 py-2.5">
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 flex items-start gap-2 rounded-[20px] bg-emerald-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          Data lives in your Google Sheet — this phone only caches it. Stock changes apply inside a sheet lock with
          idempotency keys, so retries and two phones updating at once stay consistent.
        </p>
      </Sheet>

      {/* Categories popup — add / rename / delete in one place */}
      <Sheet open={catListOpen} onClose={() => { setCatListOpen(false); setEditingCat(null); setQuickCat(''); setCatError(''); }} title={`Categories · ${categories.length}`}>
        <form className="mb-4" onSubmit={(e) => { e.preventDefault(); void submitQuickCat(); }}>
          <Field label={editingCat ? 'Category name' : 'New category'}>
            <input
              value={quickCat}
              onChange={(e) => { setQuickCat(e.target.value); setCatError(''); }}
              placeholder="e.g. Beverages"
              aria-label={editingCat ? 'Rename category' : 'New category name'}
              aria-invalid={!!catError}
              aria-describedby={catError ? 'category-form-error' : undefined}
              className={inputCls}
              autoFocus
            />
          </Field>
          {catError ? <p id="category-form-error" className="mt-1.5 text-[12px] font-semibold text-rose-600 dark:text-rose-300" role="alert">{catError}</p> : null}
          <div className="mt-2 flex justify-end gap-2">
            {editingCat ? (
              <button type="button" onClick={() => { setEditingCat(null); setQuickCat(''); setCatError(''); }} className="press min-h-11 rounded-xl px-4 text-[13px] font-bold text-(--ink-2)">Cancel</button>
            ) : null}
          <button
            type="submit"
            disabled={quickBusy}
            className="press flex min-h-10 items-center gap-1.5 rounded-[12px] bg-(--primary) px-4 text-[13.5px] font-semibold text-white disabled:opacity-50 shadow-sm"
          >
            {quickBusy ? 'Saving…' : editingCat ? 'Save category' : 'Add category'}
          </button>
          </div>
        </form>
        {categories.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-(--stroke-dim) px-4 py-6 text-center">
            <p className="text-[14px] font-bold text-(--ink)">No categories yet</p>
            <p className="mx-auto mt-1 max-w-[30ch] text-[12.5px] text-(--ink-2)">Type a name above and tap Add — e.g. Beverages, Snacks, Essentials.</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-2">
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              const editing = editingCat?.id === c.id;
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-[18px] px-2.5 py-2 ${editing ? 'bg-(--accent-soft)' : 'bg-(--glass-soft)'}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[15px] font-extrabold text-(--ink) dark:text-(--accent)">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-(--ink)">{c.name}</span>
                    <span className="tnum block text-[11.5px] font-medium text-(--ink-2)">
                      {count} product{count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button type="button" onClick={() => { setEditingCat(c); setQuickCat(c.name); setCatError(''); }} aria-label={`Rename ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--bg-elev)/60 text-(--ink-2) shadow-sm">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => setDelCat(c)} aria-label={`Delete ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

      <Confirm
        open={!!delCat}
        title="Delete category?"
        body={delCat ? (() => {
          const linked = products.filter((p) => p.categoryId === delCat.id).length;
          return linked
            ? `“${delCat.name}” has ${linked} linked product${linked === 1 ? '' : 's'}. Deleting it moves ${linked === 1 ? 'that product' : 'those products'} to Uncategorized; product records remain. This cannot be undone.`
            : `“${delCat.name}” has no linked products and will be removed. This cannot be undone.`;
        })() : ''}
        busy={delBusy}
        onCancel={() => setDelCat(null)}
        onConfirm={() => void confirmDelCat()}
      />

      <Confirm
        open={logoutOpen}
        title="Disconnect database?"
        body="This will disconnect your Google Sheet and clear this device’s local cache. Your Google Sheet data remains completely untouched."
        confirmLabel="Disconnect"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          setApiUrl('');
          logout();
        }}
      />

      {/* Linked devices */}
      {devicesOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-(--bg)">
          <LinkedDevicesScreen
            onBack={() => setDevicesOpen(false)}
            notify={notify}
            initialMode={devicesMode}
            onLinked={() => {
              setDevicesOpen(false);
              void refresh();
            }}
          />
        </div>
      ) : null}

      {/* Change sheet (server-verified; replaces the stored association) */}
      {sheetChangeOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-(--bg)">
          <SheetSetupScreen
            mode="repair"
            initialMessage="Connect a different sheet. Verification replaces your current association."
            onConnected={() => {
              setSheetChangeOpen(false);
              clearCache();
              void checkConnection();
              void refresh();
              notify('Sheet connection updated and verified.', 'success');
            }}
            onBack={() => setSheetChangeOpen(false)}
          />
        </div>
      ) : null}

    </div>
  );
}
