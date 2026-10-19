/* Stockly sign-in screen: email/password.
 *
 * Identity is verified server-side (/api/auth) with scrypt-hashed
 * passwords. The browser never decides who anyone is.
 */

import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon } from 'lucide-react';
import { AuthApiError } from '@stockly/shared-client/auth';
import { API_BASE_URL, isNativeApp } from '@stockly/shared-client/config';
import { loginAccount, registerAccount } from '@stockly/shared-client/users';
import { BrandMark, Field, Segmented, inputCls } from '../components/ui';

function errMsg(e: unknown): string {
  return e instanceof AuthApiError ? e.message : 'Something went wrong. Try again.';
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

  const submit = async () => {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'register') {
        await registerAccount(name, email, password);
      } else {
        await loginAccount(email, password);
      }
      onAuthed();
    } catch (e) {
      const msg = errMsg(e);
      if (mode === 'login' && msg.toLowerCase().includes('incorrect email or password')) {
        setError('Incorrect email or password. If you are new, switch to "Register" to create your account.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const valid =
    email.trim().length > 3 &&
    password.length >= (mode === 'register' ? 8 : 1) &&
    (mode === 'login' || name.trim().length > 0);

  return (
    <div className="app-page-viewport mx-auto max-w-md pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div
        className="mx-auto max-w-md space-y-5 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        <div className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#007AFF] to-[#0056D6] dark:from-[#0A84FF] dark:to-[#0056D6] p-6 text-white shadow-lg">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/20 text-white shadow-inner backdrop-blur-md">
              <BrandMark size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[20px] font-bold leading-tight tracking-tight">Welcome to Stockly</p>
              <p className="mt-0.5 text-[13px] font-normal text-white/80">Sign in to manage your inventory</p>
            </div>
          </div>
        </div>

        <Segmented<'login' | 'register'>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
            setInfo('');
          }}
          options={[
            { key: 'login', label: 'Sign in' },
            { key: 'register', label: 'Register' },
          ]}
        />

        <form
          className="glass space-y-3 rounded-[24px] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) void submit();
          }}
        >
          {mode === 'register' ? (
            <Field label="Name">
              <div className="relative">
                <UserIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
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
              <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-3)" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters, letters + numbers' : 'Your password'}
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className={`${inputCls} pl-11 pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-(--ink-3)"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          {error ? <p role="alert" className="text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
          {info ? <p className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-300">{info}</p> : null}
          <button
            type="submit"
            disabled={busy || !valid}
            className="press min-h-[50px] w-full rounded-[14px] bg-(--primary) text-[15px] font-semibold text-white shadow-sm transition-transform hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? (mode === 'register' ? 'Creating account…' : 'Signing in…') : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="px-2 text-center text-[11.5px] leading-relaxed text-(--ink-3)">
          Passwords are hashed on the server and never stored as plain text.
        </p>
        {isNativeApp() && !API_BASE_URL ? (
          <p role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
            This build has no backend configured. Set <span className="tnum font-bold">VITE_API_BASE_URL</span> to your
            deployed backend (e.g. https://your-app.vercel.app) and rebuild the app — sign-in needs the server.
          </p>
        ) : null}
      </div>
    </div>
  );
}
