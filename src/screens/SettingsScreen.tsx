import { useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Database,
  Download,
  Link2,
  Moon,
  Package,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Sunset,
  Trash2,
  X,
} from 'lucide-react';
import { APP_VERSION, LS_KEYS, UPDATE_CHECK_URL, formatMoney, getApiUrl, setApiUrl } from '../lib/config';
import { computeCategoryStats, stockStatus, useStore, type CategoryStats } from '../lib/store';
import type { Category } from '../lib/types';
import { Field, Header, Sheet, BrandMark, inputCls } from '../components/ui';

const AVATAR_GRADS = [
  'from-[#151515] to-[#3a3a33]',
  'from-[#3a3a33] to-[#151515]',
  'from-[#6b6b60] to-[#2a2b26]',
  'from-[#2a2b26] to-[#6b6b60]',
  'from-[#151515] to-[#6b6b60]',
  'from-[#4a4b42] to-[#151515]',
];

function avatarGrad(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADS[h % AVATAR_GRADS.length];
}

export default function SettingsScreen() {
  const {
    theme, setTheme, categories, products, suppliers, refresh, refreshing,
    saveCategory, removeCategory, setConfiguredFlag, clearCache, notify,
    failedOps, lastSync, retryFailedOp,
  } = useStore();

  const [url, setUrl] = useState(getApiUrl());
  const [savedTick, setSavedTick] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [catListOpen, setCatListOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  // Delete dialog choice: move assigned products to Uncategorized or reassign.
  const [delMode, setDelMode] = useState<'none' | 'move'>('none');
  const [delMoveTo, setDelMoveTo] = useState('');
  const openDelCat = (c: Category) => {
    setDelCat(c);
    setDelMode('none');
    setDelMoveTo(categories.find((x) => x.id !== c.id)?.id || '');
  };
  const delCount = useMemo(
    () => (delCat ? products.filter((p) => p.categoryId === delCat.id).length : 0),
    [delCat, products],
  );
  const delOthers = useMemo(
    () => (delCat ? categories.filter((c) => c.id !== delCat.id) : []),
    [delCat, categories],
  );
  const confirmDelCat = async () => {
    if (!delCat) return;
    if (delMode === 'move' && !delMoveTo) {
      notify('Pick a category to move these products to.', 'error');
      return;
    }
    setBusy(true);
    const ok = await removeCategory(delCat.id, delMode === 'move' ? delMoveTo : '');
    setBusy(false);
    if (ok) setDelCat(null);
  };
  const catStats = useMemo(() => computeCategoryStats(products), [products]);
  // Inline add form inside the Manage popup (stays open for adding several).
  const [quickCat, setQuickCat] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const quickCatRef = useRef<HTMLInputElement>(null);
  // Expanded category in the Manage popup (shows its products).
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const connected = useMemo(() => (url.trim() || getApiUrl()).length > 10, [url]);

  // ---- Sync status (durable outbox visibility) ----
  const failedCount = failedOps.length;
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
  // Compares this build against a hosted version.json — nothing is invented:
  // with no manifest configured the UI says checks aren't set up yet.
  type UpdateStatus = 'idle' | 'checking' | 'uptodate' | 'available' | 'unsetup' | 'error';
  const [updStatus, setUpdStatus] = useState<UpdateStatus>('idle');
  const [updLatest, setUpdLatest] = useState('');
  const [updApk, setUpdApk] = useState('');
  const [updNotes, setUpdNotes] = useState('');
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
    if (!UPDATE_CHECK_URL) {
      setUpdStatus('unsetup');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setUpdError('You’re offline — connect and try again.');
      setUpdStatus('error');
      return;
    }
    setUpdStatus('checking');
    setUpdError('');
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(UPDATE_CHECK_URL, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { version?: unknown; apkUrl?: unknown; notes?: unknown };
      const latest = String(data.version || '').trim();
      if (!latest) throw new Error('Bad version file.');
      const at = Date.now();
      try {
        localStorage.setItem('stockly.updateCheck', JSON.stringify({ at, latest }));
      } catch {
        /* storage unavailable — timestamp simply won't persist */
      }
      setUpdCheckedAt(at);
      if (cmpVersions(latest, APP_VERSION) > 0) {
        setUpdLatest(latest);
        setUpdApk(String(data.apkUrl || ''));
        setUpdNotes(String(data.notes || ''));
        setUpdStatus('available');
      } else {
        setUpdStatus('uptodate');
      }
    } catch {
      setUpdError('Couldn’t reach the update server — try again later.');
      setUpdStatus('error');
    } finally {
      window.clearTimeout(timer);
    }
  };

  const saveUrl = async () => {
    const v = url.trim();
    if (v && !/^https:\/\/script\.google(users)?\.com\//.test(v) && !/^https:\/\//.test(v)) {
      notify('That does not look like a valid https URL.', 'error');
      return;
    }
    // New backend = new data. Drop the old Sheet's cached products first so
    // stale/demo rows never linger if the sync fails.
    if (v !== getApiUrl()) clearCache();
    setApiUrl(v);
    setConfiguredFlag();
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 2000);
    if (v) await refresh();
  };

  const openCat = (c?: Category) => {
    setEditingCat(c || null);
    setCatName(c?.name || '');
    setCatOpen(true);
  };
  /** Open the Manage popup; focusAdd jumps the cursor into the add field. */
  const openCatList = (focusAdd = false) => {
    setCatListOpen(true);
    if (focusAdd) window.setTimeout(() => quickCatRef.current?.focus(), 350);
  };
  /** Inline add inside the Manage popup — popup stays open for the next one. */
  const submitQuickCat = async () => {
    const name = quickCat.trim();
    if (!name) return notify('Category name is required.', 'error');
    setQuickBusy(true);
    const ok = await saveCategory(name);
    setQuickBusy(false);
    if (ok) {
      setQuickCat('');
      quickCatRef.current?.focus();
    }
  };
  const submitCat = async () => {
    const name = catName.trim();
    if (!name) return notify('Category name is required.', 'error');
    setBusy(true);
    const ok = await saveCategory(name, editingCat?.id);
    setBusy(false);
    if (ok) setCatOpen(false);
  };

  const themeOptions = [
    { k: 'light', label: 'Light', hint: 'Bright', icon: <Sun size={16} /> },
    { k: 'dark', label: 'Dark', hint: 'Night', icon: <Moon size={16} /> },
    { k: 'system', label: 'Auto', hint: 'System', icon: <Sunset size={16} /> },
  ] as const;

  return (
    <div className="app-page-viewport mx-auto max-w-md">
      <Header title="Settings" subtitle={`Stockly v${APP_VERSION}`} />

      <div className="mx-auto max-w-md space-y-5 px-4 pt-4">
        {/* App identity — premium dark hero */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#111210] p-5 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.07] blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#C7FF4D] text-[#151515]">
              <BrandMark size={32} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-extrabold leading-tight tracking-tight">Stockly</p>
              <p className="text-[12px] font-medium text-white/60">Inventory on Google Sheets · v{APP_VERSION}</p>
              <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${connected ? 'bg-white/10 text-white/80' : 'bg-amber-400/15 text-amber-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#C7FF4D]' : 'bg-amber-400'}`} />
                {connected ? 'Cloud connected' : 'Not connected'}
              </span>
            </div>
          </div>
          <div className="tnum relative mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            {[
              { v: String(products.length), l: 'Products' },
              { v: String(categories.length), l: 'Categories' },
              { v: String(suppliers.length), l: 'Suppliers' },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/[0.07] px-3 py-2.5">
                <p className="text-[17px] font-extrabold leading-none">{s.v}</p>
                <p className="mt-1 text-[11px] font-semibold text-white/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App update — version check against the hosted manifest */}
        <section className="glass rounded-[24px] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <Download size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-(--ink)">App update</span>
              <span className="tnum block text-[12px] font-medium text-(--ink-2)">
                v{APP_VERSION}
                {updStatus === 'available' && updLatest ? ` → v${updLatest} available` : null}
                {updStatus !== 'available' && updCheckedAt
                  ? ` · checked ${new Date(updCheckedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                  : null}
                {updStatus !== 'available' && !updCheckedAt ? ' · not checked yet' : null}
              </span>
            </span>
            {updStatus === 'available' ? (
              <span className="shrink-0 rounded-full bg-[#151515] px-2.5 py-1 text-[11px] font-extrabold text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]">
                New
              </span>
            ) : null}
          </div>
          {updStatus === 'available' && updApk ? (
            <div className="mt-3">
              {updNotes ? (
                <p className="mb-2.5 px-1 text-[13px] leading-relaxed text-(--ink-2)">{updNotes}</p>
              ) : null}
              <a
                href={updApk}
                target="_blank"
                rel="noreferrer"
                className="press flex min-h-[52px] items-center justify-center gap-1.5 rounded-2xl bg-[#151515] text-[15px] font-extrabold text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
              >
                <Download size={16} /> Download v{updLatest}
              </a>
            </div>
          ) : updStatus === 'unsetup' ? (
            <p className="mt-3 rounded-2xl bg-(--glass-soft) px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
              Automatic update checks aren’t set up for this build yet — ask whoever gave you the app for the latest
              APK.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void checkUpdates()}
              disabled={updStatus === 'checking'}
              className="glass-soft press mt-3 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl text-[14px] font-extrabold text-(--ink) disabled:opacity-50"
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
            <p className="mt-2.5 px-1 text-[12.5px] font-semibold text-(--ink-2)">You’re on the latest version.</p>
          ) : null}
          {updStatus === 'error' && updError ? (
            <p className="mt-2.5 px-1 text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{updError}</p>
          ) : null}
        </section>

        {/* Cloud connection — summary row only, URL form lives in a popup */}
        <section className="glass rounded-[24px] p-4">
          <button
            type="button"
            onClick={() => setCloudOpen(true)}
            className="press flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <Cloud size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-(--ink)">Cloud database</span>
              <span className="block truncate text-[12px] font-medium text-(--ink-2)">
                {connected ? 'Connected — tap to manage' : 'Not connected — tap to connect'}
              </span>
            </span>
            {connected ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 size={16} />
              </span>
            ) : null}
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
        </section>

        {/* Sync status — durable outbox at a glance */}
        <section className="glass rounded-[24px] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-(--ink)">Sync status</span>
              <span className="tnum block text-[12px] font-medium text-(--ink-2)">
                Last sync: {lastSyncLabel} · Cache {cacheKb} KB
              </span>
            </span>
          </div>
          {failedCount > 0 ? (
            <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3">
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
                className="press mt-2.5 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]"
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
            className="glass-soft press mt-3 flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl text-[14px] font-extrabold text-(--ink) disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Syncing…' : 'Sync now'}
          </button>
        </section>

        {/* Appearance — compact card matching Cloud/Categories style */}
        <section className="glass rounded-[20px] p-3">
          <div className="flex items-center gap-2.5 px-1 pb-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <Palette size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold tracking-tight text-(--ink)">Appearance</p>
              <p className="text-[11.5px] font-medium text-(--ink-2)">
                {theme === 'system' ? 'Follows your system' : theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </p>
            </div>
          </div>
          <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-(--glass-soft) p-1">
            {themeOptions.map((t) => {
              const active = theme === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setTheme(t.k)}
                  aria-pressed={active}
                  className={`press flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[12.5px] font-extrabold transition ${
                    active
                      ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]'
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

        {/* Categories — summary row only, full list lives in a popup sheet */}
        <section className="glass rounded-[24px] p-4">
          <button
            type="button"
            onClick={() => openCatList(false)}
            className="press flex w-full items-center gap-2 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <Package size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold tracking-tight text-(--ink)">Categories</span>
              <span className="block text-[12px] font-medium text-(--ink-2)">
                {categories.length === 0 ? 'Group products for faster search' : `${categories.length} group${categories.length === 1 ? '' : 's'} — tap to manage`}
              </span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-(--ink-3)" />
          </button>
          <div className="mt-3 grid grid-cols-[1.2fr_1fr] gap-2">
            <button
              onClick={() => openCatList(false)}
              className="press glass-soft flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl text-[14px] font-extrabold text-(--ink)"
            >
              <Package size={16} /> Manage
            </button>
            <button
              onClick={() => openCatList(true)}
              className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white dark:bg-[#C7FF4D] dark:text-[#151515]"
            >
              <Plus size={16} /> Add
            </button>
          </div>
        </section>

        {/* Data & about */}
        <section className="glass rounded-[24px] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
              <Database size={20} />
            </span>
            <p className="text-[13px] leading-relaxed text-(--ink-2)">
              Data lives in <b className="text-(--ink)">your Google Sheet</b> — this phone only caches it. Works across multiple devices via sync.
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-[18px] bg-(--glass-soft)">
            <div className="flex w-full items-center gap-3 px-3.5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAEAE4] text-[#151515] dark:bg-white/10 dark:text-[#C7FF4D]">
                <ShieldCheck size={16} />
              </span>
              <span className="flex-1 text-[14px] font-bold text-(--ink)">Version</span>
              <span className="tnum rounded-full bg-(--stroke-dim)/60 px-2.5 py-1 text-[11px] font-extrabold text-(--ink-2)">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        <p className="px-2 pb-2 text-center text-[11.5px] font-medium text-(--ink-3)">
          Made for small businesses · your data stays yours
        </p>
      </div>

      {/* Cloud database popup — URL form lives here, not inline */}
      <Sheet open={cloudOpen} onClose={() => setCloudOpen(false)} title="Cloud database">
        <p className="mb-3 text-[12px] font-medium text-(--ink-2)">Google Sheets via Apps Script</p>
        <Field label="Apps Script Web-App URL">
          <div className="relative">
            <Link2 size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/…/exec"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              className={`${inputCls} pl-11 pr-11`}
            />
            {url ? (
              <button
                type="button"
                onClick={() => setUrl('')}
                aria-label="Clear URL"
                className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-(--ink-3) hover:bg-(--accent-soft)"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </Field>
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          Same URL on every phone — all devices share one Sheet. No account needed.
        </p>
        <div className="mt-3 space-y-2 pb-2">
          <button
            onClick={saveUrl}
            className={`press flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl text-[15px] font-extrabold transition ${
              savedTick
                ? 'bg-[#1E7B3C] text-white'
                : 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]'
            }`}
          >
            {savedTick ? <Check size={16} /> : <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />}
            {savedTick ? 'Saved' : 'Save & sync'}
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
            'Create a new Google Sheet (any name).',
            'Open Extensions → Apps Script, paste the code from apps-script/Code.gs in this project.',
            'Run setupDatabase once, then setupDemoData (optional).',
            'Deploy → New deployment → Web app: execute as Me, access Anyone. Copy the /exec URL.',
            'Paste the URL above and tap Save & sync. Repeat on every device — all phones share the same Sheet.',
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

      {/* Categories popup — manage list + add form in one place */}
      <Sheet open={catListOpen} onClose={() => setCatListOpen(false)} title={`Categories${categories.length ? ` (${categories.length})` : ''}`}>
        {/* Inline add form — pinned at top, popup stays open for several adds */}
        <div className="mb-3 flex gap-2">
          <input
            ref={quickCatRef}
            value={quickCat}
            onChange={(e) => setQuickCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submitQuickCat();
            }}
            placeholder="New category name…"
            aria-label="New category name"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => void submitQuickCat()}
            disabled={quickBusy}
            className="press flex min-h-[48px] shrink-0 items-center gap-1 rounded-2xl bg-[#151515] px-4 text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]"
          >
            <Plus size={16} /> {quickBusy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {categories.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-(--stroke-dim) px-4 py-6 text-center">
            <p className="text-[14px] font-bold text-(--ink)">No categories yet</p>
            <p className="mx-auto mt-1 max-w-[30ch] text-[12.5px] text-(--ink-2)">Type a name above and tap Add — e.g. Beverages, Snacks, Essentials.</p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-2">
            {categories.map((c) => {
              const items = products.filter((p) => p.categoryId === c.id);
              const expanded = expandedCat === c.id;
              const shown = items.slice(0, 30);
              return (
                <div key={c.id} className="rounded-[18px] bg-(--glass-soft) px-2.5 py-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedCat(expanded ? null : c.id)}
                      aria-expanded={expanded}
                      className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${avatarGrad(c.name)} text-[15px] font-extrabold text-white shadow-sm`}>
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-(--ink)">{c.name}</span>
                        <span className="tnum block text-[11.5px] font-medium text-(--ink-2)">
                          {items.length} product{items.length === 1 ? '' : 's'} — tap to {expanded ? 'hide' : 'view'}
                        </span>
                      </span>
                      <ChevronRight size={16} className={`shrink-0 text-(--ink-3) transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    </button>
                    <button type="button" onClick={() => openCat(c)} aria-label={`Edit ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--bg-elev)/60 text-(--ink-2) shadow-sm">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => openDelCat(c)} aria-label={`Delete ${c.name}`} className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:text-rose-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="mt-1.5 space-y-1 border-t border-(--stroke-dim) pt-1.5">
                      <CatStatsStrip stats={catStats.get(c.id)} />
                      {shown.length === 0 ? (
                        <p className="px-2 py-2 text-[12.5px] text-(--ink-2)">No products in this category yet.</p>
                      ) : (
                        shown.map((p) => {
                          const st = stockStatus(p);
                          return (
                            <div key={p.id} className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[13px] font-bold text-(--ink) dark:text-(--accent)">
                                {p.name.slice(0, 1).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold text-(--ink)">{p.name}</span>
                                <span className="tnum block text-[11px] font-medium text-(--ink-2)">
                                  {p.sku} · {formatMoney(p.sellingPrice)}
                                </span>
                              </span>
                              <span
                                className={`tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                                  st === 'out'
                                    ? 'bg-rose-500/14 text-rose-600 dark:text-rose-300'
                                    : st === 'low'
                                      ? 'bg-amber-500/16 text-amber-700 dark:text-amber-300'
                                      : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                                }`}
                              >
                                {st === 'out' ? 'Out' : `${p.currentStock} left`}
                              </span>
                            </div>
                          );
                        })
                      )}
                      {items.length > shown.length ? (
                        <p className="tnum px-2 pb-1 text-[11.5px] font-medium text-(--ink-3)">
                          +{items.length - shown.length} more
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {products.some((p) => !p.categoryId) ? (
              <UncategorisedBlock
                items={products.filter((p) => !p.categoryId)}
                expanded={expandedCat === '__none'}
                onToggle={() => setExpandedCat(expandedCat === '__none' ? null : '__none')}
              />
            ) : null}
          </div>
        )}
      </Sheet>

      {/* Category form sheet (opens on top of the list popup) */}
      <Sheet open={catOpen} onClose={() => setCatOpen(false)} title={editingCat ? 'Edit category' : 'New category'}>
        <Field label="Category name">
          <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Beverages" className={inputCls} />
        </Field>
        <div className="mt-4">
          <button
            onClick={submitCat}
            disabled={busy}
            className="press w-full min-h-[52px] rounded-2xl bg-[#151515] py-3.5 text-[15px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]"
          >
            {busy ? 'Saving…' : editingCat ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </Sheet>

      {/* Delete category — shows usage, offers Uncategorized or reassign */}
      <Sheet open={!!delCat} onClose={() => setDelCat(null)} title="Delete category?">
        {delCat ? (
          <div>
            <p className="text-[14px] leading-relaxed text-(--ink-2)">
              <b className="text-(--ink)">“{delCat.name}”</b> will be removed permanently.{' '}
              {delCount === 0 ? (
                <>No products use it.</>
              ) : (
                <>
                  <b className="tnum text-(--ink)">{delCount} product{delCount === 1 ? '' : 's'} use{delCount === 1 ? 's' : ''} it</b> — choose
                  where they go. Nothing is deleted until you confirm.
                </>
              )}
            </p>
            {delCount > 0 ? (
              <div className="mt-3 space-y-2" role="radiogroup" aria-label="What to do with assigned products">
                <button
                  type="button"
                  role="radio"
                  aria-checked={delMode === 'none'}
                  onClick={() => setDelMode('none')}
                  className={`press flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition ${
                    delMode === 'none'
                      ? 'border-(--accent) bg-(--accent-soft)'
                      : 'border-transparent bg-(--glass-soft)'
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${delMode === 'none' ? 'border-(--accent)' : 'border-(--ink-3)'}`}>
                    {delMode === 'none' ? <span className="h-2.5 w-2.5 rounded-full bg-(--accent)" /> : null}
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold text-(--ink)">Move to Uncategorized</span>
                    <span className="block text-[12px] text-(--ink-2)">Products stay in stock, just ungrouped</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={delMode === 'move'}
                  onClick={() => delOthers.length > 0 && setDelMode('move')}
                  disabled={delOthers.length === 0}
                  className={`press flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition ${
                    delMode === 'move'
                      ? 'border-(--accent) bg-(--accent-soft)'
                      : 'border-transparent bg-(--glass-soft)'
                  } disabled:opacity-50`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${delMode === 'move' ? 'border-(--accent)' : 'border-(--ink-3)'}`}>
                    {delMode === 'move' ? <span className="h-2.5 w-2.5 rounded-full bg-(--accent)" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-(--ink)">Reassign to another category</span>
                    <span className="block text-[12px] text-(--ink-2)">
                      {delOthers.length === 0 ? 'No other category exists yet' : 'Products keep their stock and history'}
                    </span>
                  </span>
                </button>
                {delMode === 'move' && delOthers.length > 0 ? (
                  <Field label="Move products to">
                    <select value={delMoveTo} onChange={(e) => setDelMoveTo(e.target.value)} className={inputCls}>
                      {delOthers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2 pb-1">
              <button
                type="button"
                onClick={() => setDelCat(null)}
                className="press glass-soft min-h-[52px] rounded-2xl py-3.5 text-[15px] font-bold text-(--ink)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelCat()}
                disabled={busy || (delMode === 'move' && !delMoveTo)}
                className="press min-h-[52px] rounded-2xl bg-[#C2332D] py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>

    </div>
  );
}

/** Per-category statistics strip (single-pass, no extra API calls). */
function CatStatsStrip({ stats }: { stats?: CategoryStats }) {
  const s = stats || { productCount: 0, totalUnits: 0, inventoryCostValue: 0, lowStockCount: 0, outOfStockCount: 0 };
  const cells = [
    { v: String(s.productCount), l: 'Products' },
    { v: s.totalUnits.toLocaleString('en-IN'), l: 'Units' },
    { v: formatMoney(s.inventoryCostValue), l: 'Cost value' },
    { v: s.lowStockCount + s.outOfStockCount > 0 ? `${s.lowStockCount + s.outOfStockCount}` : '0', l: 'Low · Out' },
  ];
  return (
    <div className="tnum mb-1 grid grid-cols-4 gap-1.5">
      {cells.map((c) => (
        <div key={c.l} className="rounded-xl bg-(--bg-elev)/60 px-1.5 py-2 text-center shadow-sm">
          <p className="truncate text-[13px] font-extrabold leading-none text-(--ink)">{c.v}</p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-(--ink-2)">{c.l}</p>
        </div>
      ))}
    </div>
  );
}

/** Uncategorized products group at the end of the Manage popup. */
function UncategorisedBlock({
  items,
  expanded,
  onToggle,
}: {
  items: import('../lib/types').Product[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const shown = items.slice(0, 30);
  return (
    <div className="rounded-[18px] bg-(--glass-soft) px-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="press flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--stroke-dim) text-[15px] font-extrabold text-(--ink-2)">
          ?
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-(--ink)">Uncategorised</span>
          <span className="tnum block text-[11.5px] font-medium text-(--ink-2)">
            {items.length} product{items.length === 1 ? '' : 's'} — tap to {expanded ? 'hide' : 'view'}
          </span>
        </span>
        <ChevronRight size={16} className={`shrink-0 text-(--ink-3) transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded ? (
        <div className="mt-1.5 space-y-1 border-t border-(--stroke-dim) pt-1.5">
          {shown.map((p) => {
            const st = stockStatus(p);
            return (
              <div key={p.id} className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[13px] font-bold text-(--ink) dark:text-(--accent)">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-(--ink)">{p.name}</span>
                  <span className="tnum block text-[11px] font-medium text-(--ink-2)">
                    {p.sku} · {formatMoney(p.sellingPrice)}
                  </span>
                </span>
                <span
                  className={`tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    st === 'out'
                      ? 'bg-rose-500/14 text-rose-600 dark:text-rose-300'
                      : st === 'low'
                        ? 'bg-amber-500/16 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
                  }`}
                >
                  {st === 'out' ? 'Out' : `${p.currentStock} left`}
                </span>
              </div>
            );
          })}
          {items.length > shown.length ? (
            <p className="tnum px-2 pb-1 text-[11.5px] font-medium text-(--ink-3)">+{items.length - shown.length} more</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
