import { Suspense, lazy, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Download,
  Link2,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Sunset,
  Tag,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
<<<<<<<< HEAD:apps/mobile/src/screens/SettingsScreen.tsx
import { APP_VERSION, LS_KEYS, UPDATE_CHECK_URL } from '@stockly/shared-client/config';
import { fetchLatestRelease, formatApkSize } from '@stockly/shared-client/releases';
import { useStore } from '@stockly/shared-client/store';
import type { Category, UserProfile } from '@stockly/shared-types';
import { getCachedProfile, refreshMyProfile, signOutAccount } from '@stockly/shared-client/users';
import { sheetsApi } from '@stockly/shared-client/connection';
import AdminScreen from './AdminScreen';
import LinkedDevicesScreen from './LinkedDevicesScreen';
========
import { APP_VERSION, LS_KEYS, UPDATE_CHECK_URL } from '../../shared/config';
import { fetchLatestRelease, formatApkSize } from '../../shared/releases';
import { useStore } from '../../shared/store';
import type { Category, UserProfile } from '../../shared/types';
import { getCachedProfile, refreshMyProfile, signOutAccount } from '../../shared/users';
import { sheetsApi } from '../../shared/connection';
// Rarely-opened device-linking page (pulls react-qr-code + scanner UI):
// split out so opening Settings stays light. Preloaded on hover/tap below.
const LinkedDevicesScreen = lazy(() => import('./LinkedDevicesScreen'));
>>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d:mobile-app/src/app/screens/SettingsScreen.tsx
import { SheetSetupScreen } from './AccessScreens';
import { Confirm, Field, Header, Sheet, BrandMark, inputCls } from '../components/ui';
const AdminScreen = lazy(() => import('./AdminScreen'));

export default function SettingsScreen() {
  const {
    theme, setTheme, products, categories, refresh, refreshing, online, configured, pendingIds, error,
    saveCategory, removeCategory, clearCache, notify,
    failedOps, lastSync, retryFailedOp, logout,
  } = useStore();

  const [cloudOpen, setCloudOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Account (server-verified identity)
  const [profile, setProfile] = useState<UserProfile | null>(() => getCachedProfile());
  const [accountOpen, setAccountOpen] = useState(false);
  const [accBusy, setAccBusy] = useState(false);
  const [accError, setAccError] = useState('');
  const [accStatus, setAccStatus] = useState('');
  // Server-verified sheet connection (never a client-held URL)
  const [connState, setConnState] = useState<string | null>(null);
  const [connVerifiedAt, setConnVerifiedAt] = useState<string | null>(null);
  const [connError, setConnError] = useState('');
  const [connBusy, setConnBusy] = useState(false);
  const [sheetChangeOpen, setSheetChangeOpen] = useState(false);
  // Linked devices (WhatsApp-style Stockly-to-Stockly linking)
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devicesMode, setDevicesMode] = useState<'manage' | 'link'>('manage');
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
<<<<<<<< HEAD:apps/mobile/src/screens/SettingsScreen.tsx
  // Primary source is the published GitHub release (see src/shared/releases.ts);
========
  // Primary source is the published GitHub release (see shared/releases.ts);
>>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d:mobile-app/src/app/screens/SettingsScreen.tsx
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
  const cmpVersions = (a: string, b: string): number => {
    const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
    const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  };
  const checkUpdates = async () => {
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
        const data = (await res.json()) as { version?: unknown; apkUrl?: unknown; notes?: unknown };
        const latest = String(data.version || '').trim();
        if (!latest) throw new Error('Bad version file.');
        remember(latest);
        if (cmpVersions(latest, APP_VERSION) > 0) {
          setUpdLatest(latest);
          setUpdApk(String(data.apkUrl || ''));
          setUpdNotes(String(data.notes || ''));
          setUpdMeta('');
          setUpdStatus('available');
        } else {
          setUpdStatus('uptodate');
        }
      } else {
        const rel = await fetchLatestRelease({ noCache: true });
        remember(rel.version);
        if (cmpVersions(rel.version, APP_VERSION) > 0) {
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

  /* ---- Account (server-verified identity; sign-in lives on AuthScreen) ---- */
  const doRefreshStatus = async () => {
    setAccBusy(true);
    setAccError('');
    try {
      const latest = await refreshMyProfile();
      const current = latest ?? profile;
      if (current) setProfile(current);
      try {
        const conn = await sheetsApi.getConnection();
        setAccStatus(
          conn.connected
            ? `Account is ${current?.accountStatus ?? 'active'} · sheet verified${conn.verifiedAt ? ` ${new Date(conn.verifiedAt).toLocaleDateString()}` : ''}.`
            : 'Account is active · sheet not connected.',
        );
      } catch {
        setAccStatus(`Account is ${current?.accountStatus ?? 'active'}.`);
      }
    } finally {
      setAccBusy(false);
    }
  };

  if (adminOpen) {
    return <AdminScreen onBack={() => setAdminOpen(false)} notify={notify} />;
  }

  return (
    <div className="app-page-viewport mx-auto max-w-md">
      <Header title="Settings" subtitle={`Stockly v${APP_VERSION}`} />

      {/* The settings column is a grouped preference surface; each section is
          a row with a subtle divider rather than a stack of unrelated cards. */}
      <div className="settings-content glass mx-auto max-w-md px-4 pt-4">
        {/* App identity */}
        <div className="glass relative overflow-hidden rounded-[var(--radius-hero)] p-5">
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-row)] bg-(--accent-soft) text-(--accent)">
              <BrandMark size={32} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--fs-title3)] font-semibold leading-tight tracking-[-0.02em]">Stockly</p>
              <p className="text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">Inventory on Google Sheets · v{APP_VERSION}</p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-(--accent-soft) px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--accent)">
                <span className="h-1.5 w-1.5 rounded-full bg-(--accent)" />
                Signed in
              </span>
            </div>
          </div>
          <div className="tnum relative mt-4 grid grid-cols-1 gap-2 border-t border-(--stroke-dim) pt-3">
            <div className="rounded-[var(--radius-control)] bg-(--glass-soft) px-3 py-2.5">
              <p className="text-[length:var(--fs-title3)] font-bold leading-none">{String(products.length)}</p>
              <p className="mt-1 text-[length:var(--fs-caption)] font-medium text-(--ink-2)">Products</p>
            </div>
          </div>
        </div>

        {/* App update — version check against the hosted manifest */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Download size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">App update</span>
              <span className="tnum block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                v{APP_VERSION}
                {updStatus === 'available' && updLatest ? ` → v${updLatest} available` : null}
                {updStatus !== 'available' && updCheckedAt
                  ? ` · checked ${new Date(updCheckedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : null}
                {updStatus !== 'available' && !updCheckedAt ? ' · not checked yet' : null}
              </span>
            </span>
            {updStatus === 'available' ? (
              <span className="shrink-0 rounded-full bg-(--primary) px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--primary-foreground)">
                New
              </span>
            ) : null}
          </div>
          {updStatus === 'available' && updApk ? (
            <div className="mt-3">
              {updMeta ? (
                <p className="tnum mb-2.5 px-1 text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">{updMeta}</p>
              ) : null}
              {updNotes ? (
                <p className="mb-2.5 whitespace-pre-line px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">{updNotes}</p>
              ) : null}
              <a
                href={updApk}
                target="_blank"
                rel="noreferrer"
                className="press flex min-h-[52px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold text-(--primary-foreground)"
              >
                <Download size={16} /> Download v{updLatest}
              </a>
              <p className="mt-2.5 px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
                On Android, opening the file asks you to confirm installation — updates must carry Stockly’s official
                release signature to install over your current app.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void checkUpdates()}
              disabled={updStatus === 'checking'}
              className="glass-soft press mt-3 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
            >
              <Download size={16} />
              {updStatus === 'checking'
                ? 'Checking…'
                : updStatus === 'uptodate'
                  ? 'Check again'
                  : 'Check for updates'}
            </button>
          )}
          {updStatus === 'uptodate' ? (
            <p className="mt-2.5 px-1 text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">You’re on the latest version.</p>
          ) : null}
          {updStatus === 'error' && updError ? (
            <p className="mt-2.5 px-1 text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)">{updError}</p>
          ) : null}
        </section>

        {/* Cloud connection — summary row only, URL form lives in a popup */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <button
            type="button"
            onClick={() => setCloudOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Cloud size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">Cloud database</span>
              <span className="block truncate text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                {connected ? 'Sheet verified — tap to manage' : 'Not configured — tap to connect'}
              </span>
            </span>
            {connected ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--success)/12 text-(--success-ink)">
                <CheckCircle2 size={16} />
              </span>
            ) : null}
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Account — user database profile (no passwords, no secrets) */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <UserIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">Account</span>
              <span className="block truncate text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                {profile ? `${profile.name} · ${profile.accountStatus}` : 'Register or sign in on this device'}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Linked Devices — one account, many devices */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <button
            type="button"
            onClick={() => { setDevicesMode('manage'); setDevicesOpen(true); }}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Link2 size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">Linked Devices</span>
              <span className="block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                Link phones & tablets to this account
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Owner-only administration uses the existing server-verified admin API. */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <button
            type="button"
            onClick={() => setAdminOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <ShieldCheck size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">Administration</span>
              <span className="block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                Owner tools for users, devices, roles, settings and audit logs
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Categories — full list lives in a popup sheet */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <button
            type="button"
            onClick={() => setCatListOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Tag size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">Categories</span>
              <span className="block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                {categories.length === 0 ? 'Group products for faster search' : `${categories.length} group${categories.length === 1 ? '' : 's'} — tap to manage`}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setCatListOpen(true)}
              className="press glass-soft flex min-h-[48px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink)"
            >
              <Tag size={16} /> Manage
            </button>
            <button
              onClick={() => { setEditingCat(null); setQuickCat(''); setCatError(''); setCatListOpen(true); }}
              className="press flex min-h-[48px] items-center justify-center gap-1 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold text-(--primary-foreground)"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </section>

        {/* Sync status — durable outbox at a glance */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">{syncState}</span>
              <span className="tnum block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                Last sync: {lastSyncLabel} · Cache {cacheKb} KB
              </span>
            </span>
          </div>
          {failedCount > 0 ? (
            <div className="mt-3 rounded-[var(--radius-control)] border border-(--destructive)/25 bg-(--destructive)/10 px-3.5 py-3">
              <p className="text-[length:var(--fs-footnote)] font-bold text-(--ink)">
                {failedCount} change{failedCount === 1 ? '' : 's'} couldn&apos;t sync
              </p>
              <p className="mt-0.5 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
                Nothing is lost — review each one from the sync banner or retry them all here.
              </p>
              <button
                type="button"
                onClick={() => void retryAll()}
                disabled={syncBusy}
                className="press mt-2.5 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
              >
                <RefreshCw size={16} className={syncBusy ? 'animate-spin' : ''} />
                {syncBusy ? 'Retrying…' : `Retry all (${failedCount})`}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="glass-soft press mt-3 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </section>

        {/* Appearance — compact card matching Cloud style */}
        <section className="glass rounded-[var(--radius-row)] p-3">
          <div className="flex items-center gap-2.5 px-1 pb-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Sun size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--fs-subhead)] font-semibold tracking-tight text-(--ink)">Appearance</p>
              <p className="text-[length:var(--fs-caption)] font-medium text-(--ink-2)">
                {theme === 'system' ? 'Follows your system' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </p>
            </div>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-control)] bg-(--glass-soft) p-1">
            {themeOptions.map((t) => {
              const active = theme === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setTheme(t.k)}
                  aria-pressed={active}
                  className={`press flex items-center justify-center gap-1.5 rounded-[var(--radius-icon)] px-2 py-2.5 text-[length:var(--fs-footnote)] font-semibold transition ${
 active
 ? 'bg-(--primary) text-(--primary-foreground)'
 : 'text-(--ink-2) hover:bg-(--accent-soft)/50'
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
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--glass-soft) text-(--ink-2)">
              <Database size={20} />
            </span>
            <p className="text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
              Data lives in <b className="text-(--ink)">your Google Sheet</b> — this phone only caches it. Works across multiple devices via sync.
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-[var(--radius-row)] bg-(--glass-soft)">
            <div className="flex w-full items-center gap-3 px-3.5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-icon)] bg-(--glass-soft) text-(--ink-2)">
                <ShieldCheck size={16} />
              </span>
              <span className="flex-1 text-[length:var(--fs-subhead)] font-bold text-(--ink)">Version</span>
              <span className="tnum rounded-full bg-(--stroke-dim)/60 px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold text-(--ink-2)">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        {/* Log out — disconnects the cloud database and clears this phone */}
        <section className="glass rounded-[calc(var(--radius-card) - 4px)] border-(--destructive)/20 p-4">
          <button
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--destructive)/10 text-(--destructive-ink)">
              <LogOut size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--destructive-ink)">Log out</span>
              <span className="block text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
                Disconnects the cloud database and clears this phone’s cache
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        <p className="settings-footnote px-2 pb-2 text-center text-[length:var(--fs-caption)] font-medium text-(--ink-3)">
          Made for small businesses · your data stays yours
        </p>
      </div>

      {/* Cloud database popup — server-verified connection (no URLs held here) */}
      <Sheet open={cloudOpen} onClose={() => setCloudOpen(false)} title="Cloud database">
        <p className="mb-3 text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">Your own Google Sheet, verified by the server</p>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-icon)] bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
          <span className="flex items-center gap-2 text-[length:var(--fs-footnote)] font-bold text-(--ink)">
            <span className={`h-2 w-2 rounded-full ${syncState === 'Synced' ? 'bg-(--success)' : syncState === 'Failed' ? 'bg-(--destructive)' : syncState === 'Offline' ? 'bg-(--warning)' : 'bg-(--ink-3)'}`} />
            {syncState}
          </span>
          <span className="tnum text-right text-[length:var(--fs-caption)] font-medium text-(--ink-2)">Last successful sync · {lastSyncLabel}</span>
        </div>
        <div className="mb-3 rounded-[var(--radius-icon)] bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-[length:var(--fs-footnote)] font-bold text-(--ink)">
            <span className={`h-2 w-2 rounded-full ${connState === 'verified' ? 'bg-(--success)' : connState ? 'bg-(--warning)' : 'bg-(--ink-3)'}`} />
            {connState === 'verified'
              ? `Sheet verified${connVerifiedAt ? ` · ${new Date(connVerifiedAt).toLocaleDateString()}` : ''}`
              : connState
                ? `Sheet ${connState} — reconnect below`
                : 'Checking connection…'}
          </p>
          {connError ? <p className="mt-1 text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">{connError}</p> : null}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-(--success-ink)" />
          Your sheet association is stored and verified server-side. Linked devices share this same sheet automatically.
        </p>
        <div className="mt-3 space-y-2 pb-2">
          <button
            type="button"
            onClick={() => void checkConnection()}
            disabled={connBusy}
            className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={connBusy ? 'animate-spin' : ''} />
            {connBusy ? 'Verifying…' : 'Verify connection'}
          </button>
          <button
            type="button"
            onClick={() => { setCloudOpen(false); setSheetChangeOpen(true); }}
            className="press flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold text-(--primary-foreground)"
          >
            Change sheet
          </button>
          <button
            onClick={() => void refresh()}
            disabled={refreshing}
            className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        {/* How syncing works — merged into the Cloud popup */}
        <p className="mt-3 px-1 text-[length:var(--fs-footnote)] font-bold uppercase tracking-wider text-(--ink-2)">How syncing works</p>
        <ol className="mt-1.5 list-decimal space-y-2 pl-5 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink)">
          {[
            'Create your own Google Sheet (keep it private).',
            'Open Extensions → Apps Script, paste the code from apps-script/Code.gs in this project.',
            'Run setupDatabase once, then deploy as a Web app (execute as Me, access Anyone).',
            'Connect it once from the setup screen — the server verifies access before storing anything.',
            'Linked devices share the same verified sheet automatically.',
          ].map((step, i) => (
            <li key={i} className="rounded-[var(--radius-control)] bg-(--glass-soft) px-3 py-2.5">
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-2.5 flex items-start gap-2 rounded-[var(--radius-row)] bg-(--success)/10 px-3.5 py-3 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-(--success-ink)" />
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
          {catError ? <p id="category-form-error" className="mt-1.5 text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)" role="alert">{catError}</p> : null}
          <div className="mt-2 flex justify-end gap-2">
            {editingCat ? (
              <button type="button" onClick={() => { setEditingCat(null); setQuickCat(''); setCatError(''); }} className="press min-h-11 rounded-[var(--radius-icon)] px-4 text-[length:var(--fs-footnote)] font-bold text-(--ink-2)">Cancel</button>
            ) : null}
          <button
            type="submit"
            disabled={quickBusy}
            className="press flex min-h-11 items-center gap-1.5 rounded-[var(--radius-icon)] bg-(--primary) px-4 text-[length:var(--fs-footnote)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
          >
            {quickBusy ? 'Saving…' : editingCat ? 'Save category' : 'Add category'}
          </button>
          </div>
        </form>
        {categories.length === 0 ? (
          <div className="rounded-[var(--radius-row)] border border-dashed border-(--stroke-dim) px-4 py-6 text-center">
            <p className="text-[length:var(--fs-subhead)] font-bold text-(--ink)">No categories yet</p>
            <p className="mx-auto mt-1 max-w-[30ch] text-[length:var(--fs-footnote)] text-(--ink-2)">Type a name above and tap Add — e.g. Beverages, Snacks, Essentials.</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-2">
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              const editing = editingCat?.id === c.id;
              return (
                <div key={c.id} className={`flex items-center gap-3 rounded-[var(--radius-row)] px-2.5 py-2 ${editing ? 'bg-(--accent-soft)' : 'bg-(--glass-soft)'}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--accent-soft) text-[length:var(--fs-headline)] font-semibold text-(--ink) dark:text-(--accent)">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:var(--fs-subhead)] font-bold text-(--ink)">{c.name}</span>
                    <span className="tnum block text-[length:var(--fs-caption)] font-medium text-(--ink-2)">
                      {count} product{count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <button type="button" onClick={() => { setEditingCat(c); setQuickCat(c.name); setCatError(''); }} aria-label={`Rename ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--bg-elev)/60 text-(--ink-2) shadow-sm">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => setDelCat(c)} aria-label={`Delete ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--destructive)/10 text-(--destructive-ink) dark:text-(--destructive-ink)">
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
        title="Log out?"
        body="You will be signed out on this device and this phone’s cached data cleared. Your Google Sheet is untouched — sign in again any time."
        confirmLabel="Log out"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          signOutAccount();
          setProfile(null);
          logout();
        }}
      />

      {/* Account popup — register / sign in / status */}
      <Sheet open={accountOpen} onClose={() => { setAccountOpen(false); setAccError(''); setAccStatus(''); }} title="Account">
        {profile ? (
          <div>
            <div className="rounded-[var(--radius-row)] bg-(--glass-soft) px-3.5 py-3">
              <p className="text-[length:var(--fs-headline)] font-semibold text-(--ink)">{profile.name}</p>
              <p className="text-[length:var(--fs-footnote)] text-(--ink-2)">{profile.email}</p>
              <p className="tnum mt-1 text-[length:var(--fs-caption)] font-bold text-(--ink-2)">Status: {profile.accountStatus}</p>
            </div>
            {accStatus ? <p className="mt-2 px-1 text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">{accStatus}</p> : null}
            <div className="mt-3 grid grid-cols-2 gap-2 pb-1">
              <button
                type="button"
                onClick={() => void doRefreshStatus()}
                disabled={accBusy}
                className="glass-soft press min-h-[52px] rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
              >
                {accBusy ? 'Checking…' : 'Check status'}
              </button>
              <button
                type="button"
                onClick={() => { signOutAccount(); setProfile(null); setAccountOpen(false); notify('Signed out on this device.'); }}
                className="press min-h-[52px] rounded-[var(--radius-control)] bg-(--destructive)/12 text-[length:var(--fs-subhead)] font-semibold text-(--destructive-ink)"
              >
                Sign out
              </button>
            </div>
            <p className="mt-2 px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
              Profiles sync to the owner’s admin area automatically. Account status is owner-managed and enforced by
              the backend.
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
              Signed in with a server-verified Stockly account. Sign-in methods attach to one identity — Google and
              password logins for the same verified email share this account.
            </p>
            {accError ? <p role="alert" className="mt-2 text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)">{accError}</p> : null}
            <button
              type="button"
              onClick={() => { setAccountOpen(false); setDevicesMode('link'); setDevicesOpen(true); }}
              className="glass-soft press mt-2 flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink)"
            >
              <Link2 size={16} /> Link another device
            </button>
            <button
              type="button"
              onClick={() => { signOutAccount(); setProfile(null); setAccountOpen(false); logout(); }}
              className="press mt-2 min-h-[52px] w-full rounded-[var(--radius-control)] bg-(--destructive)/12 text-[length:var(--fs-subhead)] font-semibold text-(--destructive-ink)"
            >
              Sign out
            </button>
          </div>
        )}
      </Sheet>

      {/* Linked devices */}
      {devicesOpen ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-(--bg)">
          <Suspense
            fallback={
              <div className="mx-auto max-w-md space-y-3 p-4" aria-label="Loading device linking">
                <div className="h-14 animate-pulse rounded-[var(--radius-control)] bg-(--accent-soft)" />
                <div className="h-40 animate-pulse rounded-[calc(var(--radius-card) - 4px)] bg-(--accent-soft)" />
                <div className="h-24 animate-pulse rounded-[calc(var(--radius-card) - 4px)] bg-(--accent-soft)" />
              </div>
            }
          >
            <LinkedDevicesScreen
              onBack={() => setDevicesOpen(false)}
              notify={notify}
              initialMode={devicesMode}
              onLinked={() => {
                void refreshMyProfile().then((p) => {
                  if (p) setProfile(p);
                  setDevicesOpen(false);
                  void refresh();
                });
              }}
            />
          </Suspense>
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
