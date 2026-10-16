/* Stockly owner console — desktop-first administration UI.
 *
 * Layout: sidebar navigation + wide content on desktop (tables, side
 * detail panel), stacked cards + bottom-sheet dialogs on mobile. Purely
 * presentational — every action here is validated server-side by
 * /api/admin (session verified per call, roles checked, mutations
 * audit-logged). Hiding UI or editing local state can never grant access.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Users,
  type LucideIcon} from 'lucide-react';
import {
  adminApi,
  getAdminEmail,
  getAdminToken,
  setAdminToken} from '../shared/admin-api';
import {
  BrandMark,
  Field,
  Segmented,
  inputCls} from '../components/ui';
import {
  errMsg,
  initials} from './widgets';

type Section = 'users' | 'devices' | 'roles' | 'settings' | 'logs';

const SECTIONS: { key: Section; label: string; icon: LucideIcon; title: string; blurb: string }[] = [
  { key: 'users', label: 'Users', icon: Users, title: 'Users', blurb: 'Registrations, account status, and sheet connections. Status changes are enforced by the backend and audit-logged.' },
  { key: 'devices', label: 'Devices', icon: Smartphone, title: 'Linked devices', blurb: 'Per-user device sessions. Revocation takes effect server-side on the next call.' },
  { key: 'roles', label: 'Roles', icon: KeyRound, title: 'Roles & access', blurb: 'Owner (full control) and admin (users + settings). Only the owner can change roles.' },
  { key: 'settings', label: 'Settings', icon: SettingsIcon, title: 'App settings', blurb: 'Key-value configuration stored in the private admin spreadsheet. Every write is audit-logged.' },
  { key: 'logs', label: 'Audit logs', icon: ScrollText, title: 'Audit logs', blurb: 'Newest first. Every admin mutation and auth event lands here.' },
];

import { Suspense, lazy } from 'react';

/* Sections load on demand: the initial bundle carries only shell + Gate. */
const UsersSection = lazy(() => import('./sections/UsersSection'));
const DevicesSection = lazy(() => import('./sections/DevicesSection'));
const RolesSection = lazy(() => import('./sections/RolesSection'));
const SettingsSection = lazy(() => import('./sections/SettingsSection'));
const LogsSection = lazy(() => import('./sections/LogsSection'));

export function SectionFallback() {
  return <div className='admin-card p-6'><p className='empty'>Loading…</p></div>;
}

export function SectionSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<SectionFallback />}>{children}</Suspense>;
}

/* --------------------------------- login --------------------------------- */

function Gate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login');
  const [email, setEmail] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
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
              <input value={setupKey} onChange={(e) => setSetupKey(e.target.value)} type={showKey ? 'text' : 'password'} autoComplete="off" placeholder="ADMIN_SETUP_KEY from the server" className={`${inputCls} pl-11 pr-11`} />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide setup key' : 'Show setup key'}
                aria-pressed={showKey}
                className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-(--ink-3) hover:text-(--ink)"
              >
                {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
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
            <div key="users" className="animate-page-in"><SectionSuspense><UsersSection notify={notify} /></SectionSuspense></div>
          ) : section === 'devices' ? (
            <div key="devices" className="animate-page-in"><SectionSuspense><DevicesSection notify={notify} /></SectionSuspense></div>
          ) : section === 'roles' ? (
            <div key="roles" className="animate-page-in"><SectionSuspense><RolesSection notify={notify} /></SectionSuspense></div>
          ) : section === 'settings' ? (
            <div key="settings" className="animate-page-in"><SectionSuspense><SettingsSection notify={notify} /></SectionSuspense></div>
          ) : (
            <div key="logs" className="animate-page-in"><SectionSuspense><LogsSection notify={notify} /></SectionSuspense></div>
          )}
        </main>
      </div>
    </div>
  );
}