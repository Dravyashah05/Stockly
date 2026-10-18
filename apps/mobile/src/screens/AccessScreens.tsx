/* Connect Your Google Sheet + access states.
 *
 * Mandatory first-run gate: users enter only after authentication,
 * an active account, AND a backend-verified sheet connection.
 * Verification happens server-side (/api/sheets): the browser only
 * submits a candidate URL. Frontend redirects are convenience only —
 * every protected API re-validates independently.
 */

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Database, Link2, RefreshCw, ShieldAlert, X } from 'lucide-react';
<<<<<<<< HEAD:apps/mobile/src/screens/AccessScreens.tsx
import { sheetsApi, SheetsApiError, type SheetConnection } from '@stockly/shared-client/connection';
import { getApiUrl } from '@stockly/shared-client/config';
import { signOutAccount } from '@stockly/shared-client/users';
========
import { sheetsApi, SheetsApiError, type SheetConnection } from '../../shared/connection';
import { getApiUrl } from '../../shared/config';
import { signOutAccount } from '../../shared/users';
>>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d:mobile-app/src/app/screens/AccessScreens.tsx
import { Field, inputCls } from '../components/ui';

function errMsg(e: unknown): string {
  return e instanceof SheetsApiError ? e.message : 'Something went wrong. Try again.';
}

export function SheetSetupScreen({
  mode,
  initialMessage,
  onConnected,
  onBack,
}: {
  mode: 'setup' | 'repair';
  initialMessage?: string;
  onConnected: () => void;
  onBack?: () => void;
}) {
  const [url, setUrl] = useState(() => {
    try {
      return getApiUrl();
    } catch {
      return '';
    }
  });
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(initialMessage ?? '');
  const [conn, setConn] = useState<SheetConnection | null>(null);

  const connect = async () => {
    const v = url.trim();
    if (!v) {
      setError('Paste your Apps Script Web App /exec URL.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await sheetsApi.connectSheet(v);
      setConn(res);
      onConnected();
    } catch (e) {
      setError(`${errMsg(e)} ${repairHint(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError('');
    try {
      const res = await sheetsApi.reverify();
      setConn(res);
      onConnected();
    } catch (e) {
      setError(`${errMsg(e)} ${repairHint(e)}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="app-page-viewport mx-auto max-w-md pb-10">
<<<<<<<< HEAD:apps/mobile/src/screens/AccessScreens.tsx
      <div
        className="mx-auto max-w-md space-y-5 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        <div className="relative overflow-hidden rounded-[28px] bg-[#111210] p-5 text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.07] blur-3xl" />
========
      <div className="gate-screen mx-auto w-full max-w-md gap-4 px-4 pt-8">
        <div className="glass relative overflow-hidden rounded-[var(--radius-hero)] p-5">
>>>>>>>> bc90ae3b25b8be70ddda745a7984f0a2ba4ae22d:mobile-app/src/app/screens/AccessScreens.tsx
          <div className="relative flex items-center gap-3.5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--accent-soft) text-(--accent)">
              <Database size={28} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[length:var(--fs-title3)] font-semibold leading-tight tracking-[-0.02em]">Connect Your Google Sheet</p>
              <p className="text-[length:var(--fs-footnote)] font-medium text-(--ink-2)">
                Connect your own Google Sheet to store and manage your Stockly inventory data.
              </p>
            </div>
          </div>
        </div>

        {mode === 'repair' ? (
          <p className="rounded-[var(--radius-control)] border border-(--warning)/25 bg-(--warning)/10 px-3.5 py-3 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            Your sheet connection needs attention. Reconnect or verify below — your data stays in your sheet.
          </p>
        ) : null}

        <div className="gate-panel">
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-icon)] bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
            <span className="flex items-center gap-2 text-[length:var(--fs-footnote)] font-semibold text-(--ink)">
              <span
                className={`h-2 w-2 rounded-full ${conn?.connected ? 'bg-(--success)' : error ? 'bg-(--destructive)' : 'bg-(--ink-3)'}`}
              />
              {conn?.connected ? 'Verified' : error ? 'Not verified' : 'Not connected'}
            </span>
            {conn?.spreadsheetId ? (
              <span className="tnum truncate text-right text-[length:var(--fs-caption)] font-medium text-(--ink-2)">
                Sheet …{conn.spreadsheetId.slice(-6)}
              </span>
            ) : null}
          </div>

          <Field label="Your sheet's Apps Script Web-App URL">
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
                  className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-icon)] text-(--ink-3)"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </Field>
          {error ? <p role="alert" className="text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">{error}</p> : null}
          {conn?.connected ? (
            <p className="flex items-start gap-1.5 text-[length:var(--fs-footnote)] font-medium text-(--success-ink)">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Connected and verified.
            </p>
          ) : null}

          <div className="gate-actions">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="press min-h-[50px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
            >
              {busy ? 'Verifying…' : 'Connect Sheet'}
            </button>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={verifying}
              className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-semibold text-(--ink) disabled:opacity-50"
            >
              <RefreshCw size={15} className={verifying ? 'animate-spin' : ''} />
              {verifying ? 'Verifying…' : 'Verify Connection'}
            </button>
            {mode === 'repair' && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-headline)] font-medium text-(--ink-2)"
              >
                <ArrowLeft size={15} /> Back
              </button>
            ) : null}
          </div>
        </div>

        <div className="gate-panel">
          <p className="px-1 text-[length:var(--fs-caption)] font-semibold uppercase tracking-[0.06em] text-(--ink-3)">How to connect (private sheet stays private)</p>
          <ol className="mt-1.5 list-decimal space-y-2 pl-5 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink)">
            {[
              'Create a new Google Sheet (any name) — keep it private, never make it public.',
              'Open Extensions → Apps Script, paste apps-script/Code.gs from this project, Save.',
              'Run setupDatabase once (authorise when asked).',
              'Deploy → New deployment → Web app: execute as Me, access Anyone. Copy the /exec URL.',
              'Paste the URL above and tap Connect Sheet. The server verifies it before anything is stored.',
            ].map((step, i) => (
              <li key={i} className="rounded-[var(--radius-control)] bg-(--glass-soft) px-3 py-2.5">
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function repairHint(e: unknown): string {
  if (!(e instanceof SheetsApiError)) return '';
  if (e.status === 400 && /deployment|exec/i.test(e.message)) {
    return 'Use the /exec URL from Deploy → New deployment (not the script editor URL).';
  }
  if (e.status === 502 || /JSON|redeploy/i.test(e.message)) {
    return 'Make sure the deployment executes as you with “Anyone” access, using the latest Code.gs.';
  }
  return '';
}

export function RestrictedScreen({ status, onSignOut }: { status: string; onSignOut: () => void }) {
  return (
    <div className="app-page-viewport mx-auto max-w-md pb-10">
      <div className="gate-screen mx-auto w-full max-w-md gap-5 px-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-(--destructive)/12 text-(--destructive-ink)">
          <ShieldAlert size={30} />
        </span>
        <div>
          <p className="text-[length:var(--fs-title2)] font-semibold tracking-[-0.02em] text-(--ink)">Access restricted</p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            {status === 'suspended'
              ? 'Your account is suspended, so the main application is unavailable. Contact the owner to reactivate it.'
              : 'Your account is deactivated, so the main application is unavailable. Contact the owner.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            signOutAccount();
            onSignOut();
          }}
          className="press min-h-[50px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold text-(--primary-foreground)"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AccessDeniedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="app-page-viewport mx-auto max-w-md pb-10">
      <div className="gate-screen mx-auto w-full max-w-md gap-5 px-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-card)] bg-(--warning)/12 text-(--warning-ink)">
          <ShieldAlert size={30} />
        </span>
        <div>
          <p className="text-[length:var(--fs-title2)] font-semibold tracking-[-0.02em] text-(--ink)">Owner area only</p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            This area is restricted to the verified app owner.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="press min-h-[50px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-headline)] font-semibold text-(--primary-foreground)"
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}
