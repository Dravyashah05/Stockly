/* Stockly owner console — desktop-first administration UI.
 *
 * Layout: sidebar navigation + wide content on desktop (tables, side
 * detail panel), stacked cards + bottom-sheet dialogs on mobile. Purely
 * presentational — every action here is validated server-side by
 * /api/admin (session verified per call, roles checked, mutations
 * audit-logged). Hiding UI or editing local state can never grant access.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  ChevronRight,
  Clock,
  Crown,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserCheck,
  Users,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  adminApi,
  getAdminEmail,
  getAdminToken,
  setAdminToken,
  AdminApiError,
  type AdminLogEntry,
  type RegistryUser,
  type UserStats,
} from '../shared/admin-api';
import { devicesApi, DevicesApiError, type DeviceInfo } from '../shared/devices';
import {
  BrandMark,
  Confirm,
  EmptyState,
  ErrorState,
  Field,
  SearchBar,
  Segmented,
  SkeletonRow,
  inputCls,
} from '../components/ui';

type Section = 'users' | 'devices' | 'roles' | 'settings' | 'logs';

const SECTIONS: { key: Section; label: string; icon: LucideIcon; title: string; blurb: string }[] = [
  { key: 'users', label: 'Users', icon: Users, title: 'Users', blurb: 'Registrations, account status, and sheet connections. Status changes are enforced by the backend and audit-logged.' },
  { key: 'devices', label: 'Devices', icon: Smartphone, title: 'Linked devices', blurb: 'Per-user device sessions. Revocation takes effect server-side on the next call.' },
  { key: 'roles', label: 'Roles', icon: KeyRound, title: 'Roles & access', blurb: 'Owner (full control) and admin (users + settings). Only the owner can change roles.' },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, title: 'App settings', blurb: 'Key-value configuration stored in the private admin spreadsheet. Every write is audit-logged.' },
  { key: 'logs', label: 'Audit logs', icon: ScrollText, title: 'Audit logs', blurb: 'Newest first. Every admin mutation and auth event lands here.' },
];

function deviceErrMsg(e: unknown): string {
  return e instanceof DevicesApiError ? e.message : 'Something went wrong. Try again.';
}

function errMsg(e: unknown): string {
  return e instanceof AdminApiError ? e.message : 'Something went wrong. Try again.';
}

function fmtDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function timeAgo(value?: string | null): string {
  if (!value) return '—';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(value).toLocaleDateString();
}

function initials(name: string): string {
  const c = name.trim().slice(0, 1).toUpperCase();
  return c || '?';
}

/* ------------------------------ primitives ------------------------------ */

type Tone = 'ink' | 'green' | 'amber' | 'rose' | 'sky' | 'violet';

const TONE_TILE: Record<Tone, string> = {
  ink: 'bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]',
  green: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-300',
  sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
};

function StatCard({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: Tone }) {
  return (
    <div className="admin-card flex items-center gap-3 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_TILE[tone]}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="tnum block text-[22px] font-extrabold leading-none tracking-tight text-(--ink)">{value}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-(--ink-2)">{label}</span>
      </span>
    </div>
  );
}

function PageHeader({ eyebrow, title, blurb, actions }: { eyebrow: string; title: string; blurb: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.14em] text-(--ink-3)">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-(--ink) lg:text-[30px]">{title}</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-(--ink-2)">{blurb}</p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function RefreshButton({ onClick, busy, label = 'Refresh' }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="press glass-soft flex min-h-[44px] items-center gap-1.5 rounded-2xl px-4 text-[13.5px] font-extrabold text-(--ink) disabled:opacity-50"
    >
      <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
      {busy ? 'Loading…' : label}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
      : status === 'suspended'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
        : 'bg-rose-500/12 text-rose-600 dark:text-rose-300';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>
      {status}
    </span>
  );
}

function SheetPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[12.5px] font-medium text-(--ink-3)">not connected</span>;
  const cls =
    status === 'verified'
      ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-300';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ${cls}`}>
      {status}
    </span>
  );
}

/* --------------------------------- login --------------------------------- */

function Gate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [email, setEmail] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState<{ configured: boolean; bootstrapAvailable: boolean | null } | null>(null);

  useEffect(() => {
    void adminApi.status().then(setServer).catch(() => setServer(null));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res =
        mode === 'bootstrap'
          ? await adminApi.bootstrap({ setupKey, email, name })
          : await adminApi.login({ email, setupKey });
      setAdminToken(res.token, res.admin.email);
      onAuthed();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-0 overflow-hidden rounded-[28px] border border-(--stroke-dim) bg-(--glass) shadow-[var(--card-shadow)] md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative overflow-hidden bg-[#111210] p-7 text-white md:p-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#C7FF4D]/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <span className="flex h-13 w-13 items-center justify-center rounded-[20px] bg-[#C7FF4D] p-3 text-[#151515]">
            <BrandMark size={30} />
          </span>
          <h1 className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight">Stockly Admin</h1>
          <p className="mt-1 text-[13.5px] font-medium text-white/60">Owner console — users, devices, settings & audit logs.</p>
          <ul className="mt-6 space-y-3 text-[13px] font-medium text-white/75">
            {[
              { icon: <Users size={15} />, text: 'Suspend or reactivate accounts in one tap' },
              { icon: <Smartphone size={15} />, text: 'Revoke linked devices instantly' },
              { icon: <ScrollText size={15} />, text: 'Every change lands in the audit log' },
            ].map((r) => (
              <li key={r.text} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#C7FF4D]">{r.icon}</span>
                {r.text}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex items-center gap-2 rounded-2xl bg-white/[0.07] px-3.5 py-3 text-[12.5px] font-semibold text-white/80" role="status">
            <span className={`h-2 w-2 shrink-0 rounded-full ${server?.configured ? 'bg-emerald-400' : server ? 'bg-amber-400' : 'bg-white/40'}`} />
            {server ? (server.configured ? 'Backend connected — sign in below.' : 'Backend not configured yet — see the server checklist.') : 'Checking backend status…'}
          </div>
        </div>
      </div>
      {/* Form panel */}
      <div className="space-y-4 p-6 md:p-8">
        <Segmented<'login' | 'bootstrap'>
          value={mode}
          onChange={setMode}
          label="Sign-in mode"
          options={[
            { key: 'login', label: 'Owner sign-in' },
            { key: 'bootstrap', label: 'First setup' },
          ]}
        />
        {server && !server.configured ? (
          <p className="flex gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)" role="alert">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>The admin API is not configured on the server yet. Set <b>ADMIN_SCRIPT_URL</b>, <b>ADMIN_SCRIPT_TOKEN</b>, <b>ADMIN_SETUP_KEY</b>, and <b>ADMIN_SESSION_SECRET</b> as server-side environment variables, then redeploy.</span>
          </p>
        ) : null}
        {mode === 'bootstrap' ? (
          <p className="rounded-2xl bg-(--glass-soft) px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
            One-time owner setup. It only works while no owner exists yet, requires the server setup key, and is
            recorded in AdminLogs. The first registered app user is never made owner automatically.
            {server?.bootstrapAvailable === false ? ' An owner already exists — use Owner sign-in instead.' : ''}
          </p>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <Field label="Owner email">
            <div className="relative">
              <Mail size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="owner@example.com" className={`${inputCls} pl-11`} />
            </div>
          </Field>
          {mode === 'bootstrap' ? (
            <Field label="Display name (optional)">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop owner" className={inputCls} />
            </Field>
          ) : null}
          <Field label={mode === 'bootstrap' ? 'Server setup key' : 'Setup key'}>
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
              <input value={setupKey} onChange={(e) => setSetupKey(e.target.value)} type="password" autoComplete="off" placeholder="ADMIN_SETUP_KEY from the server" className={`${inputCls} pl-11`} />
            </div>
          </Field>
          {error ? <p role="alert" className="text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
          <button type="submit" disabled={busy} className="press flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#151515] text-[15px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {busy ? 'Checking…' : mode === 'bootstrap' ? 'Create owner' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-[11.5px] leading-relaxed text-(--ink-3)">
          Sessions are short-lived, verified server-side on every call, and kept in this tab only.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------- users --------------------------------- */

function UserDetail({
  user,
  deviceCount,
  onClose,
  onAction,
}: {
  user: RegistryUser;
  deviceCount?: number;
  onClose?: () => void;
  onAction: (user: RegistryUser, next: 'active' | 'suspended' | 'deactivated') => void;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Status', value: <StatusPill status={user.accountStatus} /> },
    { label: 'Sign-in', value: user.providers && user.providers.length > 0 ? user.providers.join(' + ') : '—' },
    {
      label: 'Sheet',
      value: (
        <span className="flex items-center justify-end gap-1.5">
          <SheetPill status={user.sheetStatus} />
          {user.sheetVerifiedAt ? <span className="text-(--ink-3)">· {fmtDate(user.sheetVerifiedAt)}</span> : null}
        </span>
      ),
    },
    { label: 'Devices', value: deviceCount ? `${deviceCount} linked` : 'none' },
    { label: 'Registered', value: fmtDateTime(user.registeredAt) },
    { label: 'Last login', value: fmtDateTime(user.lastLoginAt) },
    { label: 'User ID', value: <span className="max-w-[16rem] truncate" title={user.userId}>{user.userId}</span> },
  ];
  return (
    <div className="admin-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[18px] font-extrabold text-(--ink)">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-extrabold tracking-tight text-(--ink)">{user.name}</p>
          <p className="truncate text-[12.5px] text-(--ink-2)">{user.email}</p>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close details" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--glass-soft) text-(--ink-2)">
            <X size={16} />
          </button>
        ) : null}
      </div>
      <dl className="tnum mt-4 space-y-2 border-t border-(--stroke-dim) pt-3 text-[12.5px] text-(--ink-2)">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="shrink-0 font-semibold">{r.label}</dt>
            <dd className="min-w-0 text-right font-medium text-(--ink)">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {user.accountStatus !== 'suspended' ? (
          <button type="button" onClick={() => onAction(user, 'suspended')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-amber-500/15 px-1 text-[13px] font-extrabold text-amber-700 dark:text-amber-300">
            <Ban size={14} /> Suspend
          </button>
        ) : null}
        {user.accountStatus !== 'active' ? (
          <button type="button" onClick={() => onAction(user, 'active')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-emerald-600 px-1 text-[13px] font-extrabold text-white">
            <UserCheck size={14} /> Activate
          </button>
        ) : null}
        {user.accountStatus !== 'deactivated' ? (
          <button type="button" onClick={() => onAction(user, 'deactivated')} className="press flex min-h-[48px] items-center justify-center gap-1 rounded-2xl bg-rose-500/12 px-1 text-[13px] font-extrabold text-rose-600 dark:text-rose-300">
            <UserX size={14} /> Offboard
          </button>
        ) : null}
      </div>
    </div>
  );
}

function UsersSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [users, setUsers] = useState<RegistryUser[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<RegistryUser | null>(null);
  const [pending, setPending] = useState<{ user: RegistryUser; next: 'active' | 'suspended' | 'deactivated' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await adminApi.listUsers({ search, status, limit: 100 });
      setUsers(res.users);
      setStats(res.stats);
      setTotal(res.total);
      if (detail) {
        const stillThere = res.users.find((u) => u.userId === detail.userId) ?? null;
        setDetail(stillThere);
      }
      const token = getAdminToken();
      if (token) {
        try {
          const ds = await devicesApi.adminDeviceStats(token);
          const map: Record<string, number> = {};
          for (const p of ds.perUser) map[p.userId] = p.count;
          setDeviceCounts(map);
        } catch {
          /* device stats are additive — never break the user list */
        }
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, status, detail]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  const applyStatus = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await adminApi.setUserStatus({ userId: pending.user.userId, accountStatus: pending.next });
      setUsers((list) => list.map((u) => (u.userId === res.user.userId ? res.user : u)));
      setDetail(res.user);
      setPending(null);
      notify(res.replayed ? 'Already applied — duplicate ignored.' : 'Account status updated.', 'success');
      void load(true);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(
    () => [
      { label: 'Total users', value: stats?.total ?? 0, icon: <Users size={19} />, tone: 'ink' as Tone },
      { label: 'Active', value: stats?.active ?? 0, icon: <UserCheck size={19} />, tone: 'green' as Tone },
      { label: 'Suspended', value: stats?.suspended ?? 0, icon: <Ban size={19} />, tone: 'amber' as Tone },
      { label: 'Deactivated', value: stats?.deactivated ?? 0, icon: <UserX size={19} />, tone: 'rose' as Tone },
    ],
    [stats],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        blurb="Registrations, account status, and sheet connections. Status changes are enforced by the backend and audit-logged."
        actions={<RefreshButton onClick={() => void load(true)} busy={refreshing} />}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {counts.map((c) => (
          <StatCard key={c.label} icon={c.icon} value={c.value} label={c.label} tone={c.tone} />
        ))}
      </div>

      <div className="admin-card mt-4 p-4">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
          <div className="min-w-0 flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Search name, email, or user ID" /></div>
          <div className="md:w-80"><Segmented<string> value={status} onChange={setStatus} label="Account status filter" options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'suspended', label: 'Suspended' },
            { key: 'deactivated', label: 'Off' },
          ]} /></div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          <SkeletonRow h={64} /><SkeletonRow h={64} /><SkeletonRow h={64} />
        </div>
      ) : error ? (
        <div className="mt-4"><ErrorState message={error} onRetry={() => void load()} /></div>
      ) : users.length === 0 ? (
        <div className="mt-4"><EmptyState icon={<ShieldCheck size={20} />} title="No users found" hint="New registrations sync here automatically. Adjust the search or filter." /></div>
      ) : (
        <div className="mt-4 xl:grid xl:grid-cols-5 xl:items-start xl:gap-5">
          <div className="min-w-0 xl:col-span-3">
            <p className="tnum mb-2 px-1 text-[11.5px] font-bold text-(--ink-2)">Showing {users.length} of {total}</p>
            {/* Desktop table */}
            <div className="admin-card hidden overflow-x-auto lg:block">
              <table className="admin-table">
                <thead>
                  <tr><th>User</th><th>Sign-in</th><th>Devices</th><th>Sheet</th><th>Status</th><th>Registered</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId} onClick={() => setDetail(u)} className={`cursor-pointer ${detail?.userId === u.userId ? 'is-selected' : ''}`}>
                      <td>
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[13px] font-extrabold text-(--ink)">{initials(u.name)}</span>
                          <span className="min-w-0">
                            <span className="block max-w-44 truncate text-[13.5px] font-bold text-(--ink)">{u.name}</span>
                            <span className="block max-w-44 truncate text-[11.5px] text-(--ink-2)">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[12.5px] text-(--ink-2)">{u.providers && u.providers.length > 0 ? u.providers.join(' + ') : '—'}</td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{deviceCounts[u.userId] ?? 0}</td>
                      <td><SheetPill status={u.sheetStatus} /></td>
                      <td><StatusPill status={u.accountStatus} /></td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDate(u.registeredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {users.map((u) => (
                <button key={u.userId} type="button" onClick={() => setDetail(u)} className="press admin-card flex w-full items-center gap-3 p-3 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[15px] font-extrabold text-(--ink)">
                    {initials(u.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-(--ink)">{u.name}</span>
                    <span className="block truncate text-[11.5px] font-medium text-(--ink-2)">
                      {u.email}{deviceCounts[u.userId] ? ` · ${deviceCounts[u.userId]} device${deviceCounts[u.userId] === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  <StatusPill status={u.accountStatus} />
                  <ChevronRight size={16} className="shrink-0 text-(--ink-3)" />
                </button>
              ))}
            </div>
          </div>
          {/* Desktop side panel */}
          <div className="hidden min-w-0 xl:col-span-2 xl:block">
            <div className="sticky top-5">
              {detail ? (
                <UserDetail user={detail} deviceCount={deviceCounts[detail.userId]} onAction={(u, next) => setPending({ user: u, next })} />
              ) : (
                <div className="admin-card flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="glass-soft flex h-12 w-12 items-center justify-center rounded-2xl text-(--ink-2)"><Users size={20} /></span>
                  <p className="text-[14px] font-bold text-(--ink)">Select a user</p>
                  <p className="max-w-[26ch] text-[12.5px] leading-relaxed text-(--ink-2)">Account details and suspend / reactivate controls appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile detail overlay */}
      {detail ? (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-(--bg) xl:hidden">
          <div className="mx-auto max-w-md px-4 pb-16 pt-4">
            <button type="button" onClick={() => setDetail(null)} className="press mb-3 flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-(--glass-soft) px-4 text-[13.5px] font-extrabold text-(--ink)">
              <ArrowLeft size={16} /> Back to users
            </button>
            <UserDetail user={detail} deviceCount={deviceCounts[detail.userId]} onAction={(u, next) => setPending({ user: u, next })} />
          </div>
        </div>
      ) : null}

      <Confirm
        open={pending !== null}
        title={pending?.next === 'active' ? 'Reactivate account?' : pending?.next === 'suspended' ? 'Suspend account?' : 'Deactivate account?'}
        body={pending ? `${pending.user.name} (${pending.user.email}) will be set to ${pending.next}. Suspended and deactivated accounts are blocked by the backend, not just hidden in the UI. This is audit-logged.` : ''}
        confirmLabel={pending?.next === 'active' ? 'Reactivate' : pending?.next === 'suspended' ? 'Suspend' : 'Deactivate'}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}

/* --------------------------------- roles --------------------------------- */

function RolesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [admins, setAdmins] = useState<{ adminId: string; email: string; role: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listAdmins();
      setAdmins(res.admins);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const changeRole = async (adminId: string, role: string) => {
    try {
      await adminApi.setAdminRole({ adminId, role });
      notify('Role updated.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Roles & access"
        blurb="Owner (full control, can manage roles) and admin (can manage users and settings). Only the owner can change roles."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      {loading ? (
        <div className="space-y-2.5"><SkeletonRow h={64} /><SkeletonRow h={64} /></div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : admins.length === 0 ? (
        <EmptyState icon={<KeyRound size={20} />} title="No administrators" hint="Complete first setup to create the owner account." />
      ) : (
        <div className="admin-card divide-y divide-(--stroke-dim)">
          {admins.map((a) => (
            <div key={a.adminId} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${a.role === 'owner' ? 'bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]' : 'bg-(--accent-soft) text-(--ink)'}`}>
                {a.role === 'owner' ? <Crown size={17} /> : <KeyRound size={17} />}
              </span>
              <span className="min-w-0 flex-1 basis-40">
                <span className="block truncate text-[14px] font-bold text-(--ink)">{a.email}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-(--ink-2)">
                  <StatusPill status={a.status} />
                </span>
              </span>
              <label className="flex items-center gap-2 text-[12px] font-bold text-(--ink-2)">
                Role
                <select
                  aria-label={`Role for ${a.email}`}
                  value={a.role}
                  onChange={(e) => void changeRole(a.adminId, e.target.value)}
                  className="min-h-[44px] rounded-xl border border-(--stroke-dim) bg-(--field) px-3 text-[13px] font-bold text-(--ink) outline-none focus:border-(--accent)"
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- settings ------------------------------- */

function SettingsSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [settings, setSettings] = useState<{ key: string; value: string; updatedAt: string }[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getSettings();
      setSettings(res.settings);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void load();
  }, [load]);
  const save = async () => {
    if (!key.trim()) return;
    setBusy(true);
    try {
      await adminApi.setSetting(key.trim(), value);
      setKey('');
      setValue('');
      notify('Setting saved.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="App settings"
        blurb="Key-value configuration for the backend. Every write is audit-logged with its previous value."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        <form
          className="admin-card space-y-3 p-5 xl:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p className="text-[14px] font-extrabold tracking-tight text-(--ink)">New setting</p>
          <Field label="Key">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. shopName" autoCapitalize="off" autoCorrect="off" className={inputCls} />
          </Field>
          <Field label="Value">
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={inputCls} />
          </Field>
          <button type="submit" disabled={busy || !key.trim()} className="press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Saving…' : 'Save setting'}
          </button>
        </form>
        <div className="xl:col-span-3">
          {loading ? (
            <div className="space-y-2.5"><SkeletonRow h={60} /><SkeletonRow h={60} /></div>
          ) : settings.length === 0 ? (
            <EmptyState icon={<SettingsIcon size={20} />} title="No settings yet" hint="Add the first key-value setting with the form." />
          ) : (
            <div className="admin-card hidden overflow-x-auto lg:block">
              <table className="admin-table">
                <thead><tr><th>Key</th><th>Value</th><th>Updated</th></tr></thead>
                <tbody>
                  {settings.map((s) => (
                    <tr key={s.key}>
                      <td className="whitespace-nowrap font-bold text-(--ink)">{s.key}</td>
                      <td className="max-w-72 break-words text-(--ink-2)">{s.value || '—'}</td>
                      <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDateTime(s.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {settings.length > 0 ? (
            <div className="space-y-2 lg:hidden">
              {settings.map((s) => (
                <div key={s.key} className="admin-card px-4 py-3">
                  <p className="text-[13.5px] font-bold text-(--ink)">{s.key}</p>
                  <p className="mt-0.5 break-words text-[12.5px] text-(--ink-2)">{s.value || '—'}</p>
                  <p className="tnum mt-1 text-[11px] text-(--ink-3)">Updated {fmtDateTime(s.updatedAt)}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- devices -------------------------------- */

function DevicesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<{ totalActive: number; usersWithDevices: number } | null>(null);
  const [userId, setUserId] = useState('');
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);

  const loadStats = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    try {
      const s = await devicesApi.adminDeviceStats(token);
      setStats({ totalActive: s.totalActive, usersWithDevices: s.usersWithDevices });
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setLoadingStats(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const lookup = async () => {
    const token = getAdminToken();
    if (!token || !userId.trim()) return;
    setBusy(true);
    try {
      const res = await devicesApi.adminListDevices(token, userId.trim());
      setDevices(res.devices);
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    const token = getAdminToken();
    if (!token || !revokeTarget) return;
    setBusy(true);
    try {
      await devicesApi.adminRevokeDevice(token, revokeTarget.deviceId);
      setRevokeTarget(null);
      notify('Device access revoked.', 'success');
      void lookup();
      void loadStats();
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Linked devices"
        blurb="Per-user device sessions. Revoked devices fail closed on their next backend call."
        actions={<RefreshButton onClick={() => void loadStats()} busy={loadingStats} />}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={<Smartphone size={19} />} value={stats?.totalActive ?? '—'} label="Active devices" tone="sky" />
        <StatCard icon={<Users size={19} />} value={stats?.usersWithDevices ?? '—'} label="Users w/ devices" tone="violet" />
      </div>
      <div className="grid gap-4 xl:grid-cols-5 xl:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
          className="admin-card mt-4 space-y-3 p-5 xl:col-span-2 xl:mt-0"
        >
          <p className="text-[14px] font-extrabold tracking-tight text-(--ink)">Look up a user&apos;s devices</p>
          <Field label="User ID">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="usr_…" autoCapitalize="off" autoCorrect="off" className={inputCls} />
          </Field>
          <button type="submit" disabled={busy || !userId.trim()} className="press flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Loading…' : 'Look up devices'}
          </button>
        </form>
        <div className="mt-4 min-w-0 xl:col-span-3 xl:mt-0">
          {devices === null ? (
            <EmptyState icon={<Smartphone size={20} />} title="No lookup yet" hint="Enter a user ID to list every device linked to that account." />
          ) : devices.length === 0 ? (
            <EmptyState icon={<Smartphone size={20} />} title="No devices" hint="This user has no linked devices." />
          ) : (
            <>
              <div className="admin-card hidden overflow-x-auto lg:block">
                <table className="admin-table">
                  <thead><tr><th>Device</th><th>Platform</th><th>Status</th><th>Linked</th><th>Last active</th><th><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>
                    {devices.map((d) => (
                      <tr key={d.deviceId}>
                        <td>
                          <span className="block max-w-48 truncate font-bold text-(--ink)">{d.name}</span>
                          <span className="tnum block max-w-48 truncate text-[11px] text-(--ink-3)">{d.deviceId}</span>
                        </td>
                        <td className="whitespace-nowrap text-[12.5px] text-(--ink-2)">{d.platform}</td>
                        <td><StatusPill status={d.status} /></td>
                        <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{fmtDate(d.linkedAt)}</td>
                        <td className="tnum whitespace-nowrap text-[12.5px] text-(--ink-2)">{timeAgo(d.lastActiveAt)}</td>
                        <td className="text-right">
                          {d.status === 'active' ? (
                            <button type="button" onClick={() => setRevokeTarget(d)} className="press whitespace-nowrap rounded-xl bg-rose-500/12 px-3 py-2 text-[12.5px] font-extrabold text-rose-600 dark:text-rose-300">
                              Revoke
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 lg:hidden">
                {devices.map((d) => (
                  <div key={d.deviceId} className="admin-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-(--ink)">{d.name}</p>
                      <StatusPill status={d.status} />
                    </div>
                    <p className="tnum mt-1 truncate text-[11.5px] text-(--ink-2)">
                      {d.platform} · linked {fmtDate(d.linkedAt)} · active {timeAgo(d.lastActiveAt)}
                    </p>
                    {d.status === 'active' ? (
                      <button type="button" onClick={() => setRevokeTarget(d)} className="press mt-2.5 min-h-[44px] w-full rounded-2xl bg-rose-500/12 text-[13.5px] font-extrabold text-rose-600 dark:text-rose-300">
                        Revoke access
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <Confirm
        open={revokeTarget !== null}
        title="Revoke this device?"
        body={revokeTarget ? `${revokeTarget.name} (${revokeTarget.userId}) loses access immediately on its next backend call. This is audit-logged.` : ''}
        confirmLabel="Revoke access"
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void doRevoke()}
      />
    </div>
  );
}

/* ---------------------------------- logs ---------------------------------- */

function logTone(action: string): Tone {
  if (action.startsWith('auth.')) return 'green';
  if (action.startsWith('device.')) return 'sky';
  if (action.startsWith('sheet.')) return 'amber';
  if (action.startsWith('admin.')) return 'violet';
  if (action.startsWith('user.')) return 'amber';
  return 'ink';
}

function LogsSection({ notify }: { notify: (t: string, k?: 'success' | 'error' | 'info') => void }) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.listLogs(200);
      setLogs(r.logs);
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) =>
      `${l.action} ${l.targetUserId} ${l.adminId} ${l.newValue} ${l.previousValue}`.toLowerCase().includes(q),
    );
  }, [logs, filter]);

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Audit logs"
        blurb="Newest first — who changed what, and when. Filter by action, user, or value."
        actions={<RefreshButton onClick={() => void load()} busy={loading} />}
      />
      <div className="admin-card mb-4 p-4">
        <SearchBar value={filter} onChange={setFilter} placeholder="Filter logs — e.g. suspend, usr_…, device" />
      </div>
      {loading ? (
        <div className="space-y-2.5"><SkeletonRow h={72} /><SkeletonRow h={72} /><SkeletonRow h={72} /></div>
      ) : visible.length === 0 ? (
        <EmptyState icon={<ScrollText size={20} />} title={logs.length === 0 ? 'No audit entries yet' : 'No matching entries'} hint={logs.length === 0 ? 'Admin actions will appear here as they happen.' : 'Try a different filter.'} />
      ) : (
        <div className="admin-card divide-y divide-(--stroke-dim)">
          {visible.map((l) => (
            <div key={l.logId} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TONE_TILE[logTone(l.action)]}`}>
                <ScrollText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="tnum rounded-lg bg-(--glass-soft) px-2 py-0.5 text-[12px] font-extrabold text-(--ink)">{l.action}</span>
                  {l.targetUserId ? <span className="tnum max-w-56 truncate text-[11.5px] font-medium text-(--ink-3)" title={l.targetUserId}>{l.targetUserId}</span> : null}
                </p>
                {(l.previousValue || l.newValue) ? (
                  <p className="mt-1 break-words text-[12.5px] leading-relaxed text-(--ink-2)">
                    {l.previousValue ? <span className="tnum">{l.previousValue} → </span> : ''}<span className="tnum font-semibold text-(--ink)">{l.newValue}</span>
                  </p>
                ) : null}
              </div>
              <span className="tnum flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-(--ink-3)" title={fmtDateTime(l.timestamp)}>
                <Clock size={12} />
                {timeAgo(l.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- shell --------------------------------- */

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`press flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-[13.5px] font-extrabold transition ${
        active ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]' : 'text-(--ink-2) hover:bg-(--glass-soft) hover:text-(--ink)'
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </button>
  );
}

export default function AdminScreen({ onBack, notify }: { onBack?: () => void; notify: (t: string, k?: 'success' | 'error' | 'info') => void }) {
  const [authed, setAuthed] = useState(() => getAdminToken() !== null);
  const [section, setSection] = useState<Section>('users');
  const email = authed ? getAdminEmail() : null;

  const signOut = useCallback(() => {
    setAdminToken(null);
    setAuthed(false);
    setSection('users');
  }, []);

  return (
    <div className="min-h-dvh bg-(--bg) text-(--ink) lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <div className="ambient" aria-hidden="true" />
      {/* Desktop sidebar */}
      <aside className="relative z-[1] hidden border-r border-(--stroke-dim) bg-(--glass) lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-4 lg:py-6">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]">
            <BrandMark size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-extrabold leading-tight tracking-tight">Stockly Admin</span>
            <span className="block text-[11px] font-semibold text-(--ink-3)">Owner console</span>
          </span>
        </div>
        {authed ? (
          <nav className="mt-7 space-y-1" aria-label="Administration">
            {SECTIONS.map((s) => (
              <NavButton key={s.key} active={section === s.key} onClick={() => setSection(s.key)} icon={<s.icon size={18} />} label={s.label} />
            ))}
          </nav>
        ) : (
          <p className="mt-7 rounded-2xl bg-(--glass-soft) px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
            Owner-only area. Sign in to manage users, devices, settings, and audit logs.
          </p>
        )}
        <div className="mt-auto pt-6">
          {email ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-(--glass-soft) px-3.5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-[13px] font-extrabold text-(--ink)">
                {initials(email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-(--ink)">{email}</span>
                <span className="tnum flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> session active
                </span>
              </span>
              <button type="button" onClick={signOut} aria-label="Admin sign out" title="Sign out" className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-500/10">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <p className="px-2 text-center text-[11px] font-medium text-(--ink-3)">Sessions are verified server-side on every call.</p>
          )}
        </div>
      </aside>

      {/* Main column */}
      <div className="relative z-[1] min-w-0">
        {/* Mobile top bar */}
        <header className="safe-top sticky top-0 z-20 border-b border-(--stroke-dim) bg-(--bg)/90 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 px-4 pb-3 pt-3">
            {onBack ? (
              <button type="button" onClick={onBack} aria-label="Back" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--glass-soft) text-(--ink)">
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#151515] text-[#C7FF4D] dark:bg-[#C7FF4D] dark:text-[#151515]">
              <BrandMark size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-tight tracking-tight text-(--ink)">Stockly Admin</p>
              <p className="truncate text-[11px] text-(--ink-2)">{email ? `Signed in as ${email}` : 'Owner-only area'}</p>
            </div>
            {authed ? (
              <button type="button" onClick={signOut} aria-label="Admin sign out" className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                <LogOut size={17} />
              </button>
            ) : null}
          </div>
          {authed ? (
            <nav className="flex gap-1.5 overflow-x-auto px-4 pb-3" aria-label="Administration">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  aria-current={section === s.key ? 'page' : undefined}
                  className={`press flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-extrabold ${section === s.key ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]' : 'bg-(--glass-soft) text-(--ink-2)'}`}
                >
                  <s.icon size={14} />
                  {s.label}
                </button>
              ))}
            </nav>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 lg:px-8 lg:pt-8">
          {!authed ? (
            <div className="grid place-items-center py-6">
              <Gate onAuthed={() => setAuthed(true)} />
            </div>
          ) : section === 'users' ? (
            <div key="users" className="animate-page-in"><UsersSection notify={notify} /></div>
          ) : section === 'devices' ? (
            <div key="devices" className="animate-page-in"><DevicesSection notify={notify} /></div>
          ) : section === 'roles' ? (
            <div key="roles" className="animate-page-in"><RolesSection notify={notify} /></div>
          ) : section === 'settings' ? (
            <div key="settings" className="animate-page-in"><SettingsSection notify={notify} /></div>
          ) : (
            <div key="logs" className="animate-page-in"><LogsSection notify={notify} /></div>
          )}
        </main>
      </div>
    </div>
  );
}
