/* Linked Devices — WhatsApp-Web-style Stockly-to-Stockly linking.
 *
 * Two roles, one screen:
 *  - manage: the authenticated PRIMARY device lists devices, links new
 *    ones (QR or code, with primary approval), revokes access.
 *  - link: a SECOND device scans/enters a code, waits for primary
 *    approval, then adopts the account.
 * Every step is verified by the trusted /api/devices backend; the UI only
 * renders the states the server reports (pending/claimed/approved/
 * rejected/expired/failed). No WhatsApp integration of any kind.
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
/* QR renderer loads only when the user actually shows a QR code — the
 * code-based flow never pays for it. */
const QRCodeView = lazy(() => import('react-qr-code'));
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Copy,
  Link2,
  MonitorSmartphone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  buildQrText,
  devicesApi,
  getDeviceSession,
  parseQrText,
  setDeviceSession,
  DevicesApiError,
  type CreatedLink,
  type DeviceInfo,
  type LinkStatus,
  type LinkView,
} from '../../shared/devices';
import { adoptLinkedAccount, ensureDeviceEnrolled, getCachedProfile } from '../../shared/users';
import { getCurrentUserId } from '../../shared/config';
import { Confirm, EmptyState, Field, Segmented, inputCls } from '../components/ui';

function errMsg(e: unknown): string {
  return e instanceof DevicesApiError ? e.message : 'Something went wrong. Try again.';
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function useCountdown(expiresAt: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const ms = Date.parse(expiresAt || '') - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'expired';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------- primary: device list ------------------------- */

function ManageDevices({
  notify,
  onLinkDevice,
  refreshKey,
}: {
  notify: (t: string, k?: 'success' | 'error' | 'info') => void;
  onLinkDevice: () => void;
  refreshKey: number;
}) {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [noSession, setNoSession] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);
  const [revokeOthersOpen, setRevokeOthersOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await devicesApi.listDevices();
      setDevices(res.devices);
      setCurrentId(res.currentDeviceId);
      setNoSession(false);
      void devicesApi.touchDevice();
    } catch (e) {
      if (e instanceof DevicesApiError && (e.status === 401 || e.reason === 'no-session')) setNoSession(true);
      else notify(errMsg(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const enroll = async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      notify('Register or sign in first.', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await ensureDeviceEnrolled(userId);
      if (res === 'enrolled') {
        notify('This device is enrolled.', 'success');
        void load();
      } else if (res === 'link-required') {
        notify('This account already has devices — link from an approved device instead.', 'error');
      } else {
        notify('Device service is not configured yet. See docs/device-linking.md.', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!revokeTarget) return;
    setBusy(true);
    try {
      await devicesApi.revokeDevice(revokeTarget.deviceId);
      setRevokeTarget(null);
      notify('Device access revoked.', 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRevokeOthers = async () => {
    setBusy(true);
    try {
      const res = await devicesApi.revokeOthers();
      setRevokeOthersOpen(false);
      notify(res.revoked === 0 ? 'No other devices to sign out.' : `Signed out ${res.revoked} device(s).`, 'success');
      void load();
    } catch (e) {
      notify(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const doUnlinkSelf = async () => {
    setBusy(true);
    try {
      await devicesApi.unlinkSelf();
    } catch {
      /* session may already be dead — still clear local state */
    } finally {
      setDeviceSession(null);
      setUnlinkOpen(false);
      setBusy(false);
      notify('This device is unlinked.');
      void load();
    }
  };

  if (loading) return <p className="px-1 text-[length:var(--fs-footnote)] text-(--ink-2)">Loading devices…</p>;

  if (noSession) {
    return (
      <div className="glass space-y-3 rounded-[calc(var(--radius-card) - 4px)] p-4">
        <p className="text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
          This device is not enrolled yet. Enrollment happens automatically on registration — or tap below to enroll
          this device now.
        </p>
        <button
          type="button"
          onClick={() => void enroll()}
          disabled={busy}
          className="press min-h-[52px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
        >
          {busy ? 'Checking…' : 'Enroll this device'}
        </button>
      </div>
    );
  }

  const others = devices.filter((d) => d.deviceId !== currentId && d.status === 'active');

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onLinkDevice}
        className="press flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold text-(--primary-foreground)"
      >
        <Link2 size={17} /> Link a Device
      </button>
      {devices.length === 0 ? (
        <EmptyState icon={<Smartphone size={20} />} title="No linked devices" hint="Link a second phone or tablet with the button above." />
      ) : (
        <div className="space-y-1.5">
          {devices.map((d) => {
            const current = d.deviceId === currentId;
            return (
              <div key={d.deviceId} className="rounded-[var(--radius-row)] bg-(--glass-soft) px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--accent-soft) text-(--ink)">
                    <MonitorSmartphone size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[length:var(--fs-subhead)] font-bold text-(--ink)">
                      {d.name} {current ? '· This device' : ''}
                    </span>
                    <span className="block truncate text-[length:var(--fs-caption)] text-(--ink-2)">
                      {d.platform}
                      {d.appInfo ? ` · ${d.appInfo.slice(0, 40)}` : ''}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[length:var(--fs-caption)] font-semibold ${
 d.status === 'active'
 ? 'bg-(--success)/12 text-(--success-ink)'
 : 'bg-(--destructive)/12 text-(--destructive-ink)'
 }`}
                  >
                    {d.status}
                  </span>
                </div>
                <p className="tnum mt-1.5 text-[length:var(--fs-caption)] text-(--ink-2)">
                  Linked {fmtDate(d.linkedAt)} · Last active {fmtDate(d.lastActiveAt)}
                </p>
                {!current && d.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(d)}
                    className="press mt-2 min-h-[44px] w-full rounded-[var(--radius-control)] bg-(--destructive)/12 text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)"
                  >
                    Revoke access
                  </button>
                ) : null}
                {current ? (
                  <button
                    type="button"
                    onClick={() => setUnlinkOpen(true)}
                    className="press mt-2 min-h-[44px] w-full rounded-[var(--radius-control)] bg-(--bg-elev) text-[length:var(--fs-footnote)] font-bold text-(--ink-2)"
                  >
                    Unlink this device
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {others.length > 0 ? (
        <button
          type="button"
          onClick={() => setRevokeOthersOpen(true)}
          className="glass-soft press min-h-[52px] w-full rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink)"
        >
          Sign out all other devices ({others.length})
        </button>
      ) : null}
      <Confirm
        open={revokeTarget !== null}
        title="Revoke this device?"
        body={revokeTarget ? `${revokeTarget.name} will immediately lose access to protected Stockly data — not just disappear from this list. This is audit-logged.` : ''}
        busy={busy}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => void doRevoke()}
      />
      <Confirm
        open={revokeOthersOpen}
        title="Sign out all other devices?"
        body="Every other linked device loses access immediately. This device stays signed in."
        busy={busy}
        onCancel={() => setRevokeOthersOpen(false)}
        onConfirm={() => void doRevokeOthers()}
      />
      <Confirm
        open={unlinkOpen}
        title="Unlink this device?"
        body="This device loses access and must be re-linked to return."
        busy={busy}
        onCancel={() => setUnlinkOpen(false)}
        onConfirm={() => void doUnlinkSelf()}
      />
    </div>
  );
}

/* ------------------------- primary: create + approve ------------------------- */

function LinkADevice({ notify, onDone }: { notify: (t: string, k?: 'success' | 'error' | 'info') => void; onDone: () => void }) {
  const [method, setMethod] = useState<'qr' | 'code'>('qr');
  const [link, setLink] = useState<CreatedLink | null>(null);
  const [view, setView] = useState<LinkView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const countdown = useCountdown(link?.expiresAt ?? '');
  const pollRef = useRef<number | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

  const create = useCallback(
    async (m: 'qr' | 'code') => {
      setBusy(true);
      setError('');
      setView(null);
      try {
        const res = await devicesApi.createLink(m);
        setLink(res);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!link) return;
    const tick = async () => {
      try {
        const v = await devicesApi.getLink(link.linkId);
        setView(v);
        if (v.status !== 'pending' && v.status !== 'claimed') stopPoll();
      } catch {
        /* keep polling; network blips must not kill the flow */
      }
    };
    void tick();
    pollRef.current = window.setInterval(() => void tick(), 3000);
    return stopPoll;
  }, [link, stopPoll]);

  const cancel = async () => {
    if (!link) return;
    try {
      await devicesApi.cancelLink(link.linkId);
    } catch {
      /* best-effort */
    }
    stopPoll();
    setLink(null);
    setView(null);
  };

  const decide = async (approve: boolean) => {
    if (!link) return;
    setBusy(true);
    try {
      const res = approve ? await devicesApi.approveLink(link.linkId) : await devicesApi.rejectLink(link.linkId);
      setView((v) => (v ? { ...v, status: res.status } : v));
      notify(approve ? 'Device linked.' : 'Link request rejected.', approve ? 'success' : 'info');
      if (approve) onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const status: LinkStatus | null = view?.status ?? (link ? 'pending' : null);
  const terminal = status !== null && status !== 'pending' && status !== 'claimed';

  return (
    <div className="glass space-y-3 rounded-[calc(var(--radius-card) - 4px)] p-4">
      <Segmented<'qr' | 'code'>
        value={method}
        onChange={(m) => {
          setMethod(m);
          setLink(null);
          setView(null);
        }}
        options={[
          { key: 'qr', label: 'QR code' },
          { key: 'code', label: 'Linking code' },
        ]}
      />
      {!link ? (
        <button
          type="button"
          onClick={() => void create(method)}
          disabled={busy}
          className="press flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
        >
          <QrCode size={16} /> {busy ? 'Generating…' : method === 'qr' ? 'Show QR code' : 'Generate code'}
        </button>
      ) : (
        <div className="space-y-3">
          {method === 'qr' ? (
            <div className="mx-auto w-fit rounded-[calc(var(--radius-card) - 4px)] bg-white p-4">
              <Suspense
                fallback={
                  <div className="flex h-[216px] w-[216px] items-center justify-center text-[length:var(--fs-footnote)] font-bold text-(--ink-3)">
                    Loading…
                  </div>
                }
              >
                <QRCodeView value={buildQrText(link.linkId, link.token)} size={216} bgColor="#FFFFFF" fgColor="#151515" aria-label="Stockly device linking QR code" />
              </Suspense>
            </div>
          ) : (
            <div className="rounded-[var(--radius-control)] bg-(--glass-soft) px-4 py-4 text-center">
              <p className="tnum text-[length:var(--fs-title1)] font-bold tracking-[0.2em] text-(--ink)">{link.code}</p>
              <button
                type="button"
                onClick={() => {
                  try {
                    void navigator.clipboard?.writeText(link.code ?? '');
                    notify('Code copied.', 'success');
                  } catch {
                    /* clipboard unavailable */
                  }
                }}
                className="press mx-auto mt-1.5 flex items-center gap-1 rounded-[var(--radius-icon)] px-3 py-2 text-[length:var(--fs-footnote)] font-bold text-(--ink-2)"
              >
                <Copy size={14} /> Copy code
              </button>
            </div>
          )}
          <p className="tnum text-center text-[length:var(--fs-footnote)] font-bold text-(--ink-2)">
            {status === 'pending' && !terminal ? (
              <>Expires in {countdown} · single-use</>
            ) : status === 'claimed' ? (
              <>Waiting for your approval…</>
            ) : status === 'approved' ? (
              <span className="inline-flex items-center gap-1 text-(--success-ink)"><CheckCircle2 size={14} /> Device linked</span>
            ) : status ? (
              <span className="inline-flex items-center gap-1 text-(--destructive-ink)"><XCircle size={14} /> {status}</span>
            ) : null}
          </p>
          {view?.status === 'claimed' ? (
            <div className="rounded-[var(--radius-control)] bg-(--warning)/10 px-3.5 py-3 text-[length:var(--fs-footnote)] text-(--ink)">
              <p className="font-bold">Approve this device?</p>
              <p className="text-(--ink-2)">{view.claimantName || 'A new device'} scanned your code.</p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void decide(false)} disabled={busy} className="press min-h-[48px] rounded-[var(--radius-control)] bg-(--bg-elev) text-[length:var(--fs-subhead)] font-semibold text-(--ink) disabled:opacity-50">Reject</button>
                <button type="button" onClick={() => void decide(true)} disabled={busy} className="press min-h-[48px] rounded-[var(--radius-control)] bg-(--success) text-[length:var(--fs-subhead)] font-semibold text-white disabled:opacity-50">Approve</button>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const m = method;
                stopPoll();
                setLink(null);
                setView(null);
                void create(m);
              }}
              disabled={busy}
              className="glass-soft press flex min-h-[48px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink) disabled:opacity-50"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void cancel()}
              className="press min-h-[48px] rounded-[var(--radius-control)] bg-(--destructive)/12 text-[length:var(--fs-subhead)] font-semibold text-(--destructive-ink)"
            >
              Cancel
            </button>
          </div>
          <p className="px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            On the second device open Stockly → Link Existing Account, then scan or enter the code. You must approve
            it here before it connects.
          </p>
        </div>
      )}
      {error ? <p role="alert" className="text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)">{error}</p> : null}
    </div>
  );
}

/* ------------------------- secondary: scan / code / wait ------------------------- */

type ScanState = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable' | 'error';

function LinkExistingAccount({
  notify,
  onLinked,
}: {
  notify: (t: string, k?: 'success' | 'error' | 'info') => void;
  onLinked: () => void;
}) {
  const [tab, setTab] = useState<'scan' | 'code'>('scan');
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanError, setScanError] = useState('');
  const [code, setCode] = useState('');
  const [claim, setClaim] = useState<{ linkId: string; token: string; expiresAt: string } | null>(null);
  const [waitState, setWaitState] = useState<LinkStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scannerRef = useRef<{ stop: () => Promise<unknown>; clear: () => unknown } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const claimedRef = useRef(false);

  const doClaim = useCallback(
    async (args: { linkId?: string; token?: string; code?: string }) => {
      if (claimedRef.current) return;
      claimedRef.current = true;
      setBusy(true);
      setError('');
      try {
        const res = await devicesApi.claimLink(args);
        const secret = args.code && !args.token ? args.code : (args.token ?? '');
        setClaim({ linkId: res.linkId, token: secret, expiresAt: res.expiresAt });
        setWaitState('claimed');
        const s = scannerRef.current;
        if (s) void s.stop().catch(() => undefined);
      } catch (e) {
        claimedRef.current = false;
        setError(errMsg(e));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onQrText = useCallback(
    (text: string) => {
      const p = parseQrText(text);
      if (!p) {
        setScanError('That QR code is not a Stockly linking code.');
        return;
      }
      setScanError('');
      void doClaim({ linkId: p.linkId, token: p.token });
    },
    [doClaim],
  );

  useEffect(() => {
    if (tab !== 'scan' || claim) return;
    let cancelled = false;
    setScanState('starting');
    setScanError('');
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        let cameras: { id: string }[] = [];
        try {
          cameras = (await Html5Qrcode.getCameras()) as { id: string }[];
        } catch {
          cameras = [];
        }
        if (cancelled) return;
        if (cameras.length === 0) {
          setScanState('unavailable');
          return;
        }
        const scanner = new Html5Qrcode('stockly-link-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => onQrText(text),
          () => {},
        );
        if (cancelled) {
          await scanner.stop().catch(() => undefined);
          return;
        }
        setScanState('ready');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? `${e.name} ${e.message}` : '';
        if (/NotAllowedError|permission/i.test(msg)) setScanState('denied');
        else {
          setScanState('error');
          setScanError('The camera could not start here — upload a QR image or enter the code instead.');
        }
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        void (async () => {
          try {
            await s.stop();
          } catch {
            /* already stopped */
          }
          try {
            s.clear();
          } catch {
            /* already torn down */
          }
        })();
      }
    };
  }, [tab, claim, onQrText]);

  // Wait-for-approval polling (proof of possession: linkId + token each poll).
  useEffect(() => {
    if (!claim) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await devicesApi.pollLink({ linkId: claim.linkId, token: claim.token });
        if (cancelled) return;
        if (res.status === 'approved') {
          const profile = await adoptLinkedAccount({
            linkId: claim.linkId,
            token: claim.token,
            deviceId: res.deviceId,
            deviceSession: res.deviceSession,
            name: res.profile?.name ?? 'Linked device',
            email: res.profile?.email ?? '',
          });
          if (cancelled) return;
          setWaitState('approved');
          notify(`Signed in as ${profile.name}.`, 'success');
          onLinked();
        } else if (res.status === 'pending' || res.status === 'claimed') {
          setWaitState(res.status);
        } else {
          setWaitState(res.status);
        }
      } catch {
        /* network blips must not kill the wait */
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [claim, notify, onLinked]);

  const uploadQr = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setScanError('');
    // scanFile is an instance method: decode off-screen without camera.
    const elId = 'stockly-link-upload';
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      let el = document.getElementById(elId);
      if (!el) {
        el = document.createElement('div');
        el.id = elId;
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      const decoder = new Html5Qrcode(elId, false);
      try {
        const text = await decoder.scanFile(file, false);
        onQrText(String(text));
      } finally {
        try {
          decoder.clear();
        } catch {
          /* already torn down */
        }
      }
    } catch {
      setScanError('No Stockly QR code found in that image.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submitCode = () => {
    if (!code.trim()) {
      setError('Enter the linking code from the primary device.');
      return;
    }
    void doClaim({ code: code.trim() });
  };

  if (claim && waitState === 'approved') {
    return (
      <div className="glass rounded-[calc(var(--radius-card) - 4px)] p-5 text-center">
        <CheckCircle2 size={40} className="mx-auto text-(--success)" />
        <p className="mt-2 text-[length:var(--fs-callout)] font-semibold text-(--ink)">Device linked</p>
        <p className="mt-1 text-[length:var(--fs-footnote)] text-(--ink-2)">This device is now signed in. The primary device approved the connection.</p>
      </div>
    );
  }

  if (claim) {
    return (
      <div className="glass space-y-3 rounded-[calc(var(--radius-card) - 4px)] p-4 text-center">
        {waitState === 'rejected' ? (
          <>
            <XCircle size={36} className="mx-auto text-(--destructive-ink)" />
            <p className="text-[length:var(--fs-subhead)] font-semibold text-(--ink)">Request rejected</p>
            <p className="text-[length:var(--fs-footnote)] text-(--ink-2)">The primary device declined this link. Ask for a fresh code to try again.</p>
          </>
        ) : waitState === 'expired' || waitState === 'cancelled' ? (
          <>
            <XCircle size={36} className="mx-auto text-(--warning)" />
            <p className="text-[length:var(--fs-subhead)] font-semibold text-(--ink)">Code {waitState}</p>
            <p className="text-[length:var(--fs-footnote)] text-(--ink-2)">Ask the primary device for a fresh code.</p>
          </>
        ) : (
          <>
            <RefreshCw size={32} className="mx-auto animate-spin text-(--ink-2)" />
            <p className="text-[length:var(--fs-subhead)] font-semibold text-(--ink)">Waiting for approval…</p>
            <p className="text-[length:var(--fs-footnote)] text-(--ink-2)">Approve this device on the primary device to finish signing in.</p>
          </>
        )}
        {(waitState === 'rejected' || waitState === 'expired' || waitState === 'cancelled') && (
          <button
            type="button"
            onClick={() => {
              claimedRef.current = false;
              setClaim(null);
              setWaitState(null);
              setCode('');
            }}
            className="glass-soft press min-h-[48px] w-full rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink)"
          >
            Try another code
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="glass space-y-3 rounded-[calc(var(--radius-card) - 4px)] p-4">
      <Segmented<'scan' | 'code'>
        value={tab}
        onChange={setTab}
        options={[
          { key: 'scan', label: 'Scan QR' },
          { key: 'code', label: 'Enter code' },
        ]}
      />
      {tab === 'scan' ? (
        <div>
          {scanState === 'unavailable' ? (
            <div className="mb-3 flex items-start gap-2.5 rounded-[var(--radius-control)] bg-(--glass-soft) px-3.5 py-3 text-[length:var(--fs-footnote)] text-(--ink-2)">
              <Camera size={16} className="mt-0.5 shrink-0" />
              No camera was found — upload a QR image or enter the code instead.
            </div>
          ) : scanState === 'denied' ? (
            <div className="mb-3 flex items-start gap-2.5 rounded-[var(--radius-control)] bg-(--warning)/10 px-3.5 py-3 text-[length:var(--fs-footnote)] text-(--ink-2)">
              <Camera size={16} className="mt-0.5 shrink-0 text-(--warning-ink)" />
              Camera access was denied. Allow camera access and reopen — or upload an image / enter the code instead.
            </div>
          ) : null}
          {scanState === 'error' && scanError ? (
            <p className="mb-3 rounded-[var(--radius-control)] border border-(--destructive)/25 bg-(--destructive)/10 px-3.5 py-2.5 text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">{scanError}</p>
          ) : null}
          {scanState !== 'unavailable' ? (
            <div id="stockly-link-reader" className="mb-3 min-h-[48px] overflow-hidden rounded-[var(--radius-control)] bg-(--glass-soft)" />
          ) : null}
          {scanState === 'starting' ? <p className="mb-3 px-1 text-[length:var(--fs-footnote)] text-(--ink-2)">Starting camera…</p> : null}
          {scanState === 'ready' && scanError ? (
            <p className="mb-3 rounded-[var(--radius-control)] border border-(--destructive)/25 bg-(--destructive)/10 px-3.5 py-2.5 text-[length:var(--fs-footnote)] font-medium text-(--destructive-ink)">{scanError}</p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Upload QR image"
            className="hidden"
            onChange={(e) => void uploadQr(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="glass-soft press flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink) disabled:opacity-50"
          >
            <Upload size={16} /> {busy ? 'Reading…' : 'Upload QR image'}
          </button>
          <p className="mt-2 px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            Point the camera at the QR code on the primary device (Settings → Linked Devices → Link a Device).
          </p>
        </div>
      ) : (
        <div>
          <Field label="Linking code">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCode();
              }}
              placeholder="XXXX-XXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              aria-label="Linking code"
              className={`${inputCls} tnum text-center text-[length:var(--fs-title3)] font-bold tracking-[0.2em]`}
            />
          </Field>
          <button
            type="button"
            onClick={submitCode}
            disabled={busy}
            className="press mt-3 min-h-[52px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold disabled:opacity-50 text-(--primary-foreground)"
          >
            {busy ? 'Verifying…' : 'Verify code'}
          </button>
          <p className="mt-2 px-1 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
            Codes expire after 10 minutes and work only once. The primary device must approve you afterwards.
          </p>
        </div>
      )}
      {error && !claim ? <p role="alert" className="text-[length:var(--fs-footnote)] font-semibold text-(--destructive-ink)">{error}</p> : null}
    </div>
  );
}

/* ------------------------- screen ------------------------- */

export default function LinkedDevicesScreen({
  onBack,
  notify,
  initialMode,
  onLinked,
}: {
  onBack: () => void;
  notify: (t: string, k?: 'success' | 'error' | 'info') => void;
  initialMode?: 'manage' | 'link';
  onLinked?: () => void;
}) {
  const [mode, setMode] = useState<'manage' | 'link'>(initialMode ?? 'manage');
  const [linking, setLinking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasAccount = getCurrentUserId() !== null || getCachedProfile() !== null;

  return (
    <div className="app-page-viewport mx-auto max-w-md pb-10">
      {/* Screen header. A pushed sub-screen uses the compact nav-bar title
          a clear section title beside a back control, consistent with Android
          you drill into a settings detail — distinct from a root large title. */}
      <div className="safe-top sticky top-0 z-20 border-b border-(--stroke-dim) bg-(--bg)/85 px-4 pb-3 pt-2 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Settings"
            className="press glass-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--ink)"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[length:var(--fs-headline)] font-semibold tracking-[-0.01em] text-(--ink)">
              Linked Devices
            </h1>
            <p className="truncate text-[length:var(--fs-footnote)] font-normal text-(--ink-2)">
              One account, many devices
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-0.5 rounded-[var(--radius-row)] bg-(--glass-soft) p-0.5">
          <button
            type="button"
            onClick={() => setMode('manage')}
            className={`press min-h-[44px] rounded-[var(--radius-icon)] text-[length:var(--fs-footnote)] transition-colors ${
              mode === 'manage'
                ? 'bg-(--bg-elev) font-semibold text-(--ink) shadow-[0_1px_3px_rgba(0,0,0,0.10)]'
                : 'font-medium text-(--ink-2)'
            }`}
          >
            My devices
          </button>
          <button
            type="button"
            onClick={() => setMode('link')}
            className={`press min-h-[44px] rounded-[var(--radius-icon)] text-[length:var(--fs-footnote)] transition-colors ${
              mode === 'link'
                ? 'bg-(--bg-elev) font-semibold text-(--ink) shadow-[0_1px_3px_rgba(0,0,0,0.10)]'
                : 'font-medium text-(--ink-2)'
            }`}
          >
            Link Existing Account
          </button>
        </div>
      </div>
      <div className="space-y-4 px-4 pt-3">
        <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-(--success)/10 px-3.5 py-3 text-[length:var(--fs-footnote)] leading-relaxed text-(--ink-2)">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-(--success-ink)" />
          New devices join only with a short-lived code plus approval from a device that is already signed in.
        </p>
        {mode === 'manage' ? (
          !hasAccount && !getDeviceSession() ? (
            <div className="glass rounded-[calc(var(--radius-card) - 4px)] p-4">
              <p className="text-[length:var(--fs-footnote)] text-(--ink-2)">Register or sign in on this device first — it becomes the primary linked device.</p>
              <button type="button" onClick={() => setMode('link')} className="press mt-3 min-h-[52px] w-full rounded-[var(--radius-control)] bg-(--primary) text-[length:var(--fs-subhead)] font-semibold text-(--primary-foreground)">
                Link Existing Account instead
              </button>
            </div>
          ) : linking ? (
            <div className="space-y-3">
              <LinkADevice
                notify={notify}
                onDone={() => {
                  setRefreshKey((k) => k + 1);
                }}
              />
              <button type="button" onClick={() => setLinking(false)} className="glass-soft press min-h-[48px] w-full rounded-[var(--radius-control)] text-[length:var(--fs-subhead)] font-semibold text-(--ink)">
                Back to devices
              </button>
            </div>
          ) : (
            <ManageDevices notify={notify} refreshKey={refreshKey} onLinkDevice={() => setLinking(true)} />
          )
        ) : (
          <LinkExistingAccount
            notify={notify}
            onLinked={() => {
              setRefreshKey((k) => k + 1);
              onLinked?.();
            }}
          />
        )}
      </div>
    </div>
  );
}
