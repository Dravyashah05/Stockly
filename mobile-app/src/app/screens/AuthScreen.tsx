/* Stockly sign-in screen: email/password (sign in + register modes).
 *
 * Identity is verified server-side (/api/auth) with scrypt-hashed
 * passwords. The browser never decides who anyone is.
 */

import { Suspense, lazy, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  Lock as LockIcon,
  Mail,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { AuthApiError } from '../../shared/auth';
import { API_BASE_URL, isNativeApp } from '../../shared/config';
import { loginAccount, registerAccount, signOutAccount, type AuthProgressStep } from '../../shared/users';
import { BrandMark, Field, Segmented, inputCls } from '../components/ui';

/* Device-linking screen loads on demand: it carries the QR/scanner UI that
 * the sign-in form itself must never pay for upfront. */
const LinkedDevicesScreen = lazy(() => import('./LinkedDevicesScreen'));

function errMsg(e: unknown): string {
  return e instanceof AuthApiError ? e.message : 'Something went wrong. Try again.';
}

const STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

export default function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Staged progress: verification + device enrollment are separate slow
  // server round-trips — narrate them instead of one static spinner.
  const [progress, setProgress] = useState('');
  /* Signed in, but this device isn't enrolled (account already has devices):
   * inventory stays locked until the link flow completes — never drop the
   * user into a Home that can't sync. */
  const [linkNeeded, setLinkNeeded] = useState(false);

  const stepText = (s: AuthProgressStep) =>
    s === 'device'
      ? 'Securing this device…'
      : registering
        ? 'Creating your account…'
        : 'Verifying credentials…';

  const submit = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    setProgress(registering ? 'Creating your account…' : 'Verifying credentials…');
    try {
      const { device } =
        mode === 'register'
          ? await registerAccount(name, email, password, (s) => setProgress(stepText(s)))
          : await loginAccount(email, password, (s) => setProgress(stepText(s)));
      if (device === 'link-required') {
        // Authenticated but not enrolled: stay here on the link step.
        setLinkNeeded(true);
        return;
      }
      onAuthed();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const backToForm = () => {
    signOutAccount();
    setLinkNeeded(false);
    setBusy(false);
    setError('');
    setInfo('');
    setProgress('');
    setPassword('');
  };

  const valid =
    email.trim().length > 3 &&
    password.length >= (mode === 'register' ? 8 : 1) &&
    (mode === 'login' || name.trim().length > 0);

  const registering = mode === 'register';
  const score = passwordScore(password);
  const checks = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /\d/.test(password), label: 'Includes a number' },
  ];

  /* Authenticated but unenrolled: link this device before entering the app.
   * Showing Home here would fail every sync with a device error. */
  if (linkNeeded) {
    return (
      <div className="relative min-h-dvh bg-(--bg) text-(--ink)">
        <div className="ambient" aria-hidden="true" />
        <div className="relative z-[1] pb-8">
          <div className="mx-auto max-w-md space-y-3 px-4 pt-6">
            <p role="status" className="flex items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-(--ink)">
              <Link2 size={15} className="mt-0.5 shrink-0" />
              Signed in — one more step: this device isn’t linked yet, so inventory stays locked until you link it below.
            </p>
            {error ? (
              <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-rose-600 dark:text-rose-300">
                <CircleAlert size={15} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-300">{info}</p>
            ) : null}
          </div>
          <Suspense
            fallback={
              <div className="mx-auto max-w-md space-y-3 p-4" aria-label="Loading device linking">
                <div className="h-14 animate-pulse rounded-2xl bg-(--accent-soft)" />
                <div className="h-40 animate-pulse rounded-[26px] bg-(--accent-soft)" />
              </div>
            }
          >
            <LinkedDevicesScreen
              initialMode="link"
              onBack={backToForm}
              notify={(t, k) => (k === 'error' ? setError(t) : setInfo(t))}
              onLinked={() => {
                setLinkNeeded(false);
                onAuthed();
              }}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-(--bg) text-(--ink)">
      <div className="ambient" aria-hidden="true" />
      <div className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8 pt-10 sm:justify-center sm:py-12">
        {/* Brand hero */}
        <div className="animate-page-in flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-(--primary) text-white shadow-[var(--card-shadow)] dark:bg-(--primary) dark:text-[#151515]">
            <BrandMark size={34} />
          </span>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.22em] text-(--ink-3)">Stockly</p>
          <h1 className="mt-1.5 text-[28px] font-extrabold leading-tight tracking-tight">
            {registering ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 max-w-[32ch] text-[13.5px] font-medium leading-relaxed text-(--ink-2)">
            {registering
              ? 'One account for your shop — your inventory syncs everywhere.'
              : 'Sign in to pick up where you left off.'}
          </p>
        </div>

        {/* Mode switch */}
        <div className="animate-page-in mt-6">
          <Segmented<'login' | 'register'>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError('');
              setInfo('');
            }}
            label="Sign-in mode"
            options={[
              { key: 'login', label: 'Sign in' },
              { key: 'register', label: 'Create account' },
            ]}
          />
        </div>

        {/* Form card */}
        <form
          key={mode}
          className="glass animate-page-in mt-3 space-y-4 rounded-[28px] p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) void submit();
          }}
        >
          {registering ? (
            <Field label="Your name">
              <div className="relative">
                <UserIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  autoComplete="name"
                  className={`${inputCls} pl-11`}
                />
              </div>
            </Field>
          ) : null}
          <Field label="Email">
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                inputMode="email"
                autoComplete="email"
                className={`${inputCls} pl-11`}
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <LockIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={registering ? 'Choose a strong password' : 'Your password'}
                type={showPassword ? 'text' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                enterKeyHint="go"
                className={`${inputCls} pl-11 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="press absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-(--ink-3) hover:text-(--ink)"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>

          {registering && password.length > 0 ? (
            <div aria-live="polite">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < score
                        ? score <= 1
                          ? 'bg-rose-500'
                          : score === 2
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        : 'bg-(--stroke-dim)'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span className={`text-[11.5px] font-bold ${score <= 1 ? 'text-rose-600 dark:text-rose-300' : score === 2 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                  {STRENGTH_LABELS[score]}
                </span>
                {checks.map((c) => (
                  <span key={c.label} className={`flex items-center gap-1 text-[11.5px] font-semibold ${c.ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-(--ink-3)'}`}>
                    <Check size={12} strokeWidth={3} />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed text-rose-600 dark:text-rose-300">
              <CircleAlert size={15} className="mt-0.5 shrink-0" />
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-300">{info}</p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !valid}
            className="press group flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-(--primary) text-[15px] font-extrabold text-white disabled:opacity-50 dark:bg-(--primary) dark:text-[#151515]"
          >
            {busy ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <ArrowRight size={17} className="transition-transform group-enabled:group-hover:translate-x-0.5" />
            )}
            {busy ? (registering ? (progress || 'Creating account…') : progress || 'Signing in…') : registering ? 'Create account' : 'Sign in'}
          </button>
          <p className="flex items-start justify-center gap-1.5 text-center text-[11.5px] leading-relaxed text-(--ink-3)">
            <ShieldCheck size={13} className="mt-0.5 shrink-0" />
            Passwords are hashed on the server and never stored as plain text.
          </p>
        </form>

        {isNativeApp() && !API_BASE_URL ? (
          <p role="alert" className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
            This build has no backend configured. Set <span className="tnum font-bold">VITE_API_BASE_URL</span> to your
            deployed backend (e.g. https://your-app.vercel.app) and rebuild the app — sign-in needs the server.
          </p>
        ) : null}
      </div>
    </div>
  );
}
