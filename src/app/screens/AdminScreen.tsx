/* Owner-only administration area (Stockly design system).
 *
 * Every action here is validated server-side by /api/admin: the session
 * token is verified on the server on each call, roles are checked there,
 * and all mutations are audit-logged. Hiding this screen or editing local
 * state can never grant admin access.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  adminApi,
  getAdminEmail,
  getAdminToken,
  setAdminToken,
  AdminApiError,
  type AdminLogEntry,
  type RegistryUser,
  type UserStats,
} from '../../shared/admin-api';
import { devicesApi, DevicesApiError, type DeviceInfo } from '../../shared/devices';
import { Confirm, EmptyState, Field, SearchBar, Segmented, inputCls } from '../components/ui';

type Section = 'users' | 'devices' | 'roles' | 'settings' | 'logs';

function deviceErrMsg(e: unknown): string {
  return e instanceof DevicesApiError ? e.message : 'Something went wrong. Try again.';
}

function errMsg(e: unknown): string {
  return e instanceof AdminApiError ? e.message : 'Something went wrong. Try again.';
}

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
    <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
      <Segmented<'login' | 'bootstrap'>
        value={mode}
        onChange={setMode}
        options={[
          { key: 'login', label: 'Owner sign-in' },
          { key: 'bootstrap', label: 'First setup' },
        ]}
      />
      {server && !server.configured ? (
        <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
          The admin API is not configured on the server yet. Set ADMIN_SPREADSHEET_ID, Google service-account
          credentials, ADMIN_SETUP_KEY, and ADMIN_SESSION_SECRET in Vercel environment variables, then redeploy.
        </p>
      ) : null}
      {mode === 'bootstrap' ? (
        <p className="rounded-2xl bg-(--glass-soft) px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
          One-time owner setup. It only works while no owner exists yet, requires the server setup key, and is
          recorded in AdminLogs. The first registered app user is never made owner automatically.
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass space-y-3 rounded-[24px] p-4"
      >
        <Field label="Owner email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="owner@example.com" className={inputCls} />
        </Field>
        {mode === 'bootstrap' ? (
          <Field label="Display name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop owner" className={inputCls} />
          </Field>
        ) : null}
        <Field label={mode === 'bootstrap' ? 'Server setup key' : 'Setup key'}>
          <input value={setupKey} onChange={(e) => setSetupKey(e.target.value)} type="password" autoComplete="off" placeholder="From Vercel env ADMIN_SETUP_KEY" className={inputCls} />
        </Field>
        {error ? <p role="alert" className="text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
        <button type="submit" disabled={busy} className="press min-h-[52px] w-full rounded-2xl bg-[#151515] text-[15px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
          {busy ? 'Checking…' : mode === 'bootstrap' ? 'Create owner' : 'Sign in'}
        </button>
      </form>
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
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<RegistryUser | null>(null);
  const [pending, setPending] = useState<{ user: RegistryUser; next: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deviceCounts, setDeviceCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.listUsers({ search, status, limit: 100 });
      setUsers(res.users);
      setStats(res.stats);
      setTotal(res.total);
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
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyStatus = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await adminApi.setUserStatus({ userId: pending.user.userId, accountStatus: pending.next });
      setUsers((list) => list.map((u) => (u.userId === res.user.userId ? res.user : u)));
      setDetail(res.user);
      setPending(null);
      notify(res.replayed ? 'Already applied — duplicate ignored.' : 'Account status updated.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(
    () => [
      { label: 'Total', value: stats?.total ?? 0 },
      { label: 'Active', value: stats?.active ?? 0 },
      { label: 'Suspended', value: stats?.suspended ?? 0 },
      { label: 'Deactivated', value: stats?.deactivated ?? 0 },
    ],
    [stats],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {counts.map((c) => (
          <div key={c.label} className="glass rounded-2xl px-2 py-3 text-center">
            <p className="tnum text-[18px] font-extrabold leading-none text-(--ink)">{c.value}</p>
            <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-(--ink-2)">{c.label}</p>
          </div>
        ))}
      </div>
      <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, or user ID" />
      <Segmented<string>
        value={status}
        onChange={setStatus}
        options={[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'suspended', label: 'Suspended' },
          { key: 'deactivated', label: 'Off' },
        ]}
      />
      {loading ? (
        <p className="px-1 text-[13px] text-(--ink-2)">Loading users…</p>
      ) : error ? (
        <p role="alert" className="px-1 text-[13px] font-semibold text-rose-600 dark:text-rose-300">{error}</p>
      ) : users.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={20} />} title="No users found" hint="New registrations sync here automatically. Use backfill in Settings for existing users." />
      ) : (
        <div className="space-y-1.5">
          <p className="tnum px-1 text-[11.5px] font-bold text-(--ink-2)">Showing {users.length} of {total}</p>
          {users.map((u) => (
            <button key={u.userId} type="button" onClick={() => setDetail(u)} className="press flex w-full items-center gap-3 rounded-[18px] bg-(--glass-soft) px-3 py-2.5 text-left">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-(--accent-soft) text-[15px] font-extrabold text-(--ink)">
                {u.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-(--ink)">{u.name}</span>
                <span className="block truncate text-[11.5px] font-medium text-(--ink-2)">
                  {u.email}{deviceCounts[u.userId] ? ` · ${deviceCounts[u.userId]} device${deviceCounts[u.userId] === 1 ? '' : 's'}` : ''}{u.providers && u.providers.length > 0 ? ` · ${u.providers.join('+')}` : ''}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${u.accountStatus === 'active' ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' : u.accountStatus === 'suspended' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300' : 'bg-rose-500/12 text-rose-500'}`}>
                {u.accountStatus}
              </span>
            </button>
          ))}
        </div>
      )}
      {detail ? (
        <div className="glass rounded-[24px] p-4">
          <p className="text-[16px] font-extrabold text-(--ink)">{detail.name}</p>
          <p className="text-[12.5px] text-(--ink-2)">{detail.email}</p>
          <dl className="tnum mt-3 space-y-1.5 text-[12.5px] text-(--ink-2)">
            <div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-bold text-(--ink)">{detail.accountStatus}</dd></div>
            <div className="flex justify-between gap-3"><dt>Sign-in</dt><dd>{detail.providers && detail.providers.length > 0 ? detail.providers.join(' + ') : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt>Sheet</dt><dd>{detail.sheetStatus ?? 'not connected'}{detail.sheetVerifiedAt ? ` · ${new Date(detail.sheetVerifiedAt).toLocaleDateString()}` : ''}</dd></div>
            <div className="flex justify-between gap-3"><dt>Registered</dt><dd>{detail.registeredAt ? new Date(detail.registeredAt).toLocaleString() : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt>Last login</dt><dd>{detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : '—'}</dd></div>
            <div className="flex justify-between gap-3"><dt>User ID</dt><dd className="max-w-[60%] truncate">{detail.userId}</dd></div>
          </dl>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {detail.accountStatus !== 'suspended' ? (
              <button type="button" onClick={() => setPending({ user: detail, next: 'suspended' })} className="press min-h-[48px] rounded-2xl bg-amber-500/15 text-[13.5px] font-extrabold text-amber-700 dark:text-amber-300">Suspend</button>
            ) : null}
            {detail.accountStatus !== 'active' ? (
              <button type="button" onClick={() => setPending({ user: detail, next: 'active' })} className="press min-h-[48px] rounded-2xl bg-emerald-600 text-[13.5px] font-extrabold text-white">Reactivate</button>
            ) : null}
            {detail.accountStatus !== 'deactivated' ? (
              <button type="button" onClick={() => setPending({ user: detail, next: 'deactivated' })} className="press min-h-[48px] rounded-2xl bg-rose-500/12 text-[13.5px] font-extrabold text-rose-600 dark:text-rose-300">Deactivate</button>
            ) : null}
          </div>
          <button type="button" onClick={() => setDetail(null)} className="press mt-2 min-h-[44px] w-full rounded-2xl text-[13px] font-bold text-(--ink-2)">Close</button>
        </div>
      ) : null}
      <Confirm
        open={pending !== null}
        title={pending?.next === 'active' ? 'Reactivate account?' : pending?.next === 'suspended' ? 'Suspend account?' : 'Deactivate account?'}
        body={pending ? `${pending.user.name} (${pending.user.email}) will be ${pending.next}. Suspended and deactivated accounts are blocked by the backend, not just hidden in the UI. This is audit-logged.` : ''}
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => void applyStatus()}
      />
    </div>
  );
}

function RolesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [admins, setAdmins] = useState<{ adminId: string; email: string; role: string; status: string }[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await adminApi.listAdmins();
      setAdmins(res.admins);
    } catch (e) {
      setError(errMsg(e));
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
    <div className="space-y-2">
      <p className="px-1 text-[12.5px] leading-relaxed text-(--ink-2)">Permitted roles: owner (full control, can manage roles) and admin (can manage users and settings). Only the owner can change roles.</p>
      {error ? <p role="alert" className="px-1 text-[13px] font-semibold text-rose-600">{error}</p> : null}
      {admins.map((a) => (
        <div key={a.adminId} className="flex items-center gap-3 rounded-[18px] bg-(--glass-soft) px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold text-(--ink)">{a.email}</span>
            <span className="text-[11.5px] text-(--ink-2)">{a.role} · {a.status}</span>
          </span>
          <select
            aria-label={`Role for ${a.email}`}
            value={a.role}
            onChange={(e) => void changeRole(a.adminId, e.target.value)}
            className="rounded-xl bg-(--bg-elev) px-2 py-2 text-[13px] font-bold text-(--ink)"
          >
            <option value="owner">owner</option>
            <option value="admin">admin</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function SettingsSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [settings, setSettings] = useState<{ key: string; value: string; updatedAt: string }[]>([]);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await adminApi.getSettings();
      setSettings(res.settings);
    } catch (e) {
      notify(errMsg(e), 'error');
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
    <div className="space-y-3">
      <div className="glass space-y-2 rounded-[24px] p-4">
        <Field label="Key">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. shopName" className={inputCls} />
        </Field>
        <Field label="Value">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className={inputCls} />
        </Field>
        <button type="button" onClick={() => void save()} disabled={busy || !key.trim()} className="press min-h-[48px] w-full rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
          {busy ? 'Saving…' : 'Save setting'}
        </button>
      </div>
      {settings.map((s) => (
        <div key={s.key} className="rounded-[18px] bg-(--glass-soft) px-3.5 py-3">
          <p className="text-[13.5px] font-bold text-(--ink)">{s.key}</p>
          <p className="break-words text-[12.5px] text-(--ink-2)">{s.value}</p>
        </div>
      ))}
      {settings.length === 0 ? <p className="px-1 text-[12.5px] text-(--ink-2)">No settings yet.</p> : null}
    </div>
  );
}

function DevicesSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {
  const [stats, setStats] = useState<{ totalActive: number; usersWithDevices: number } | null>(null);
  const [userId, setUserId] = useState('');
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) return;
    void devicesApi
      .adminDeviceStats(token)
      .then((s) => setStats({ totalActive: s.totalActive, usersWithDevices: s.usersWithDevices }))
      .catch((e: unknown) => notify(deviceErrMsg(e), 'error'));
  }, [notify]);

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
    } catch (e) {
      notify(deviceErrMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl px-3 py-3 text-center">
          <p className="tnum text-[20px] font-extrabold leading-none text-(--ink)">{stats?.totalActive ?? '—'}</p>
          <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-(--ink-2)">Active devices</p>
        </div>
        <div className="glass rounded-2xl px-3 py-3 text-center">
          <p className="tnum text-[20px] font-extrabold leading-none text-(--ink)">{stats?.usersWithDevices ?? '—'}</p>
          <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-(--ink-2)">Users w/ devices</p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup();
        }}
        className="glass space-y-2 rounded-[24px] p-4"
      >
        <Field label="Look up devices by user ID">
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="usr_…" autoCapitalize="off" autoCorrect="off" className={inputCls} />
        </Field>
        <button type="submit" disabled={busy || !userId.trim()} className="press min-h-[48px] w-full rounded-2xl bg-[#151515] text-[14px] font-extrabold text-white disabled:opacity-50 dark:bg-[#C7FF4D] dark:text-[#151515]">
          {busy ? 'Loading…' : 'Look up devices'}
        </button>
      </form>
      {devices !== null ? (
        devices.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={20} />} title="No devices" hint="This user has no linked devices." />
        ) : (
          <div className="space-y-1.5">
            {devices.map((d) => (
              <div key={d.deviceId} className="rounded-[18px] bg-(--glass-soft) px-3.5 py-3">
                <p className="truncate text-[14px] font-bold text-(--ink)">{d.name}</p>
                <p className="tnum truncate text-[11.5px] text-(--ink-2)">
                  {d.platform} · {d.status} · linked {d.linkedAt ? new Date(d.linkedAt).toLocaleDateString() : '—'} · active {d.lastActiveAt ? new Date(d.lastActiveAt).toLocaleDateString() : '—'}
                </p>
                {d.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(d)}
                    className="press mt-2 min-h-[44px] w-full rounded-2xl bg-rose-500/12 text-[13.5px] font-extrabold text-rose-600 dark:text-rose-300"
                  >
                    Revoke access
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : null}
      <Confirm
        open={revokeTarget !== null}
        title="Revoke this device?"
        body={revokeTarget ? `${revokeTarget.name} (${revokeTarget.userId}) loses access immediately. Audit-logged.` : ''}
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void doRevoke()}
      />
    </div>
  );
}

function LogsSection({ notify }: { notify: (t: string, k?: 'success' | 'error') => void }) {  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void adminApi
      .listLogs(100)
      .then((r) => setLogs(r.logs))
      .catch((e: unknown) => notify(errMsg(e), 'error'))
      .finally(() => setLoading(false));
  }, [notify]);
  if (loading) return <p className="px-1 text-[13px] text-(--ink-2)">Loading audit logs…</p>;
  return (
    <div className="space-y-1.5">
      {logs.map((l) => (
        <div key={l.logId} className="tnum rounded-[16px] bg-(--glass-soft) px-3.5 py-2.5 text-[12px] text-(--ink-2)">
          <p className="font-bold text-(--ink)">{l.action}</p>
          <p className="break-words">{l.targetUserId ? `target ${l.targetUserId} · ` : ''}{l.previousValue ? `${l.previousValue} → ` : ''}{l.newValue}</p>
          <p>{l.timestamp ? new Date(l.timestamp).toLocaleString() : ''}</p>
        </div>
      ))}
      {logs.length === 0 ? <p className="px-1 text-[12.5px] text-(--ink-2)">No audit entries yet.</p> : null}
    </div>
  );
}

export default function AdminScreen({ onBack, notify }: { onBack: () => void; notify: (t: string, k?: 'success' | 'error' | 'info') => void }) {
  const [authed, setAuthed] = useState(() => getAdminToken() !== null);
  const [section, setSection] = useState<Section>('users');
  const [email] = useState(() => getAdminEmail());

  const signOut = useCallback(() => {
    setAdminToken(null);
    setAuthed(false);
  }, []);

  return (
    <div className="app-page-viewport mx-auto max-w-md pb-10">
      <div className="safe-top sticky top-0 z-20 border-b border-(--stroke-dim) bg-(--bg)/90 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} aria-label="Back to Settings" className="press flex h-10 w-10 items-center justify-center rounded-2xl bg-(--glass-soft) text-(--ink)">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[16px] font-extrabold text-(--ink)"><ShieldCheck size={16} /> Administration</p>
            <p className="truncate text-[11.5px] text-(--ink-2)">{email ? `Signed in as ${email}` : 'Owner-only area'}</p>
          </div>
          {authed ? (
            <button type="button" onClick={() => void adminApi.listUsers({ limit: 1 }).catch(() => undefined)} aria-label="Refresh" className="press hidden" />
          ) : null}
          {authed ? (
            <button type="button" onClick={signOut} aria-label="Admin sign out" className="press flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <LogOut size={17} />
            </button>
          ) : null}
        </div>
        {authed ? (
          <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
            {(['users', 'devices', 'roles', 'settings', 'logs'] as Section[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`press shrink-0 rounded-xl px-3 py-2 text-[12.5px] font-extrabold capitalize ${section === s ? 'bg-[#151515] text-white dark:bg-[#C7FF4D] dark:text-[#151515]' : 'bg-(--glass-soft) text-(--ink-2)'}`}
              >
                {s}
              </button>
            ))}
            <button type="button" onClick={() => window.location.reload()} className="press flex shrink-0 items-center gap-1 rounded-xl bg-(--glass-soft) px-3 py-2 text-[12.5px] font-bold text-(--ink-2)">
              <RefreshCw size={13} /> Reload
            </button>
          </div>
        ) : null}
      </div>
      <div className="px-0 pt-1">
        {!authed ? (
          <Gate onAuthed={() => setAuthed(true)} />
        ) : section === 'users' ? (
          <div className="px-4 pt-3"><UsersSection notify={notify} /></div>
        ) : section === 'devices' ? (
          <div className="px-4 pt-3"><DevicesSection notify={notify} /></div>
        ) : section === 'roles' ? (
          <div className="px-4 pt-3"><RolesSection notify={notify} /></div>
        ) : section === 'settings' ? (
          <div className="px-4 pt-3"><SettingsSection notify={notify} /></div>
        ) : (
          <div className="px-4 pt-3"><LogsSection notify={notify} /></div>
        )}
      </div>
    </div>
  );
}
