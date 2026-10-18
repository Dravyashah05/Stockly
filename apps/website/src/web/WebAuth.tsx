import { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User as UserIcon, ShieldCheck } from 'lucide-react';
import { AuthApiError } from '@stockly/shared-client/auth';
import { loginAccount, registerAccount } from '@stockly/shared-client/users';
import { GlassCard, GlassButton, GlassTextField, Segmented, StatusBadge } from '@stockly/ui';

function errMsg(e: unknown): string {
  return e instanceof AuthApiError ? e.message : e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

export default function WebAuth({ onAuthed }: { onAuthed: () => void }) {
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
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8 bg-(--st-bg) text-(--st-ink)">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header card */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#111210] p-6 text-white shadow-xl">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.07] blur-3xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#C7FF4D] text-[#151515] font-black text-2xl shadow-inner">
              S
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-extrabold tracking-tight">Stockly Web</h1>
                <StatusBadge tone="neutral" size="sm">Cloud</StatusBadge>
              </div>
              <p className="text-[13px] font-medium text-white/60">
                {mode === 'login' ? 'Sign in to access your inventory' : 'Create an account to manage your stock'}
              </p>
            </div>
          </div>
        </div>

        {/* Mode selector */}
        <Segmented<'login' | 'register'>
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError('');
            setInfo('');
          }}
          options={[
            { key: 'login', label: 'Sign In' },
            { key: 'register', label: 'Create Account' },
          ]}
        />

        {/* Form card */}
        <GlassCard tone="regular" radius="24px" className="p-6 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && !busy) void submit();
            }}
            className="space-y-4"
          >
            {mode === 'register' && (
              <GlassTextField
                label="Full Name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                leadingIcon={<UserIcon size={16} className="text-neutral-400" />}
                required
              />
            )}

            <GlassTextField
              label="Email Address"
              placeholder="you@company.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              leadingIcon={<Mail size={16} className="text-neutral-400" />}
              required
            />

            <div className="relative">
              <GlassTextField
                label="Password"
                placeholder={mode === 'register' ? 'At least 8 characters, letters & numbers' : 'Enter your password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                leadingIcon={<Lock size={16} className="text-neutral-400" />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-[38px] flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            {info && (
              <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                {info}
              </div>
            )}

            <GlassButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={busy}
              disabled={!valid || busy}
            >
              {mode === 'register' ? 'Create Account' : 'Sign In to Workspace'}
            </GlassButton>
          </form>

          <div className="pt-2 flex items-center justify-between text-[12px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" /> Server-side scrypt hashing
            </span>
            <a href="#/" className="font-semibold hover:underline">
              ← Back to home
            </a>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
