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
import { sheetsApi, SheetsApiError, type SheetConnection } from '@stockly/shared-client/connection';
import { getApiUrl, setApiUrl } from '@stockly/shared-client/config';
import { signOutAccount } from '@stockly/shared-client/users';
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
      setApiUrl(v);
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
    <div className="app-page-viewport mx-auto max-w-md pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div
        className="mx-auto max-w-md space-y-5 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}
      >
        <div className="relative overflow-hidden rounded-[28px] bg-linear-to-br from-[#007AFF] to-[#0056D6] dark:from-[#0A84FF] dark:to-[#0056D6] p-6 text-white shadow-lg">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-white/20 text-white shadow-inner backdrop-blur-md">
              <Database size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[19px] font-bold leading-tight tracking-tight">Connect Google Sheet</p>
              <p className="mt-1 text-[13px] font-normal leading-snug text-white/80">
                Connect your own Google Sheet to store and manage your Stockly inventory data securely.
              </p>
            </div>
          </div>
        </div>

        {mode === 'repair' ? (
          <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-(--ink-2)">
            Your sheet connection needs attention. Reconnect or verify below — your data stays in your sheet.
          </p>
        ) : null}

        <div className="glass space-y-3 rounded-[24px] p-4">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-(--glass-soft) px-3.5 py-3" role="status" aria-live="polite">
            <span className="flex items-center gap-2 text-[13px] font-bold text-(--ink)">
              <span
                className={`h-2 w-2 rounded-full ${conn?.connected ? 'bg-emerald-500' : error ? 'bg-rose-500' : 'bg-(--ink-3)'}`}
              />
              {conn?.connected ? 'Verified' : error ? 'Not verified' : 'Not connected'}
            </span>
            {conn?.spreadsheetId ? (
              <span className="tnum truncate text-right text-[11px] font-medium text-(--ink-2)">
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
                  className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-(--ink-3)"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </Field>
          {error ? <p role="alert" className="text-[12.5px] font-semibold text-rose-600 dark:text-rose-300">{error}</p> : null}
          {conn?.connected ? (
            <p className="flex items-start gap-1.5 text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Connected and verified.
            </p>
          ) : null}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={busy}
              className="press min-h-[50px] w-full rounded-[14px] bg-(--primary) text-[15px] font-semibold text-white shadow-sm transition-transform hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Connect Sheet'}
            </button>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={verifying}
              className="press flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-(--field) text-[14px] font-semibold text-(--ink) transition-colors hover:bg-(--field-hover) disabled:opacity-50"
            >
              <RefreshCw size={15} className={verifying ? 'animate-spin' : ''} />
              {verifying ? 'Verifying…' : 'Verify Connection'}
            </button>
            {mode === 'repair' && onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="press flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[14px] text-[14px] font-medium text-(--ink-2) hover:text-(--ink)"
              >
                <ArrowLeft size={15} /> Back
              </button>
            ) : null}
          </div>
        </div>

        <div className="glass rounded-[24px] p-4">
          <p className="px-1 text-[12px] font-bold uppercase tracking-wider text-(--ink-2)">How to connect (private sheet stays private)</p>
          <ol className="mt-1.5 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-(--ink)">
            {[
              'Create a new Google Sheet (any name) — keep it private, never make it public.',
              'Open Extensions → Apps Script, paste apps-script/Code.gs from this project, Save.',
              'Run setupDatabase once (authorise when asked).',
              'Deploy → New deployment → Web app: execute as Me, access Anyone. Copy the /exec URL.',
              'Paste the URL above and tap Connect Sheet. The server verifies it before anything is stored.',
            ].map((step, i) => (
              <li key={i} className="rounded-2xl bg-(--glass-soft) px-3 py-2.5">
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
    <div className="app-page-viewport mx-auto max-w-md pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-md space-y-5 px-4 pt-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-rose-500/12 text-rose-500">
          <ShieldAlert size={30} />
        </span>
        <div>
          <p className="text-[19px] font-extrabold text-(--ink)">Access restricted</p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[13.5px] leading-relaxed text-(--ink-2)">
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
          className="press min-h-[50px] w-full rounded-[14px] bg-(--primary) text-[15px] font-semibold text-white shadow-sm transition-transform hover:opacity-90 active:scale-[0.99]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AccessDeniedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="app-page-viewport mx-auto max-w-md pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto max-w-md space-y-5 px-4 pt-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-amber-500/12 text-amber-600 dark:text-amber-300">
          <ShieldAlert size={30} />
        </span>
        <div>
          <p className="text-[19px] font-extrabold text-(--ink)">Owner area only</p>
          <p className="mx-auto mt-1.5 max-w-[36ch] text-[13.5px] leading-relaxed text-(--ink-2)">
            This area is restricted to the verified app owner.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="press min-h-[50px] w-full rounded-[14px] bg-(--primary) text-[15px] font-semibold text-white shadow-sm transition-transform hover:opacity-90 active:scale-[0.99]"
        >
          Back to Settings
        </button>
      </div>
    </div>
  );
}
