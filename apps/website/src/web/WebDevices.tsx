import { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import {
  Smartphone,
  Laptop,
  Plus,
  Trash2,
  RefreshCw,
  QrCode,
  Copy,
  Check,
} from 'lucide-react';
import {
  devicesApi,
  type DeviceInfo,
  type CreatedLink,
} from '@stockly/shared-client/devices';
import { GlassCard, GlassButton, StatusBadge, GlassDialog } from '@stockly/ui';

export default function WebDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Link Dialog State
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkData, setLinkData] = useState<CreatedLink | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Revoke Dialog State
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await devicesApi.listDevices();
      setDevices(res.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load linked devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  const handleStartLink = async () => {
    setLinkBusy(true);
    setError('');
    try {
      const res = await devicesApi.createLink('qr');
      setLinkData(res);
      setLinkOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate pairing link.');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    try {
      await devicesApi.revokeDevice(revokeTarget.deviceId);
      setRevokeTarget(null);
      void fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke device.');
    } finally {
      setRevokeBusy(false);
    }
  };

  const copyCode = () => {
    if (!linkData?.code && !linkData?.token) return;
    const textToCopy = linkData.code || linkData.token;
    navigator.clipboard?.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            Linked Devices
          </h1>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            Securely pair mobile phones and trusted terminals to your Stockly workspace
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="ghost"
            size="md"
            onClick={fetchDevices}
            loading={loading}
            iconStart={<RefreshCw size={16} />}
          >
            Refresh
          </GlassButton>
          <GlassButton
            variant="primary"
            size="md"
            onClick={handleStartLink}
            loading={linkBusy}
            iconStart={<Plus size={16} />}
          >
            Link Mobile Device
          </GlassButton>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-[13px] text-rose-600 dark:text-rose-400 font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Devices List Card */}
      <GlassCard tone="regular" radius="24px" className="p-0 overflow-hidden">
        {devices.length === 0 && !loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-200/50 dark:bg-neutral-800 text-neutral-500">
              <Smartphone size={28} />
            </div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">No secondary devices linked</h3>
            <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">
              Link your Android phone to access your inventory and scan barcodes directly from your pocket.
            </p>
            <GlassButton variant="primary" onClick={handleStartLink} iconStart={<Plus size={16} />}>
              Generate Pairing Code
            </GlassButton>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200/50 dark:divide-neutral-800">
            {devices.map((d) => {
              const isRevoked = d.status === 'revoked';
              return (
                <div
                  key={d.deviceId}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200">
                      {d.name.toLowerCase().includes('phone') || d.name.toLowerCase().includes('android') ? (
                        <Smartphone size={20} />
                      ) : (
                        <Laptop size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-[14px] text-neutral-900 dark:text-white truncate">
                          {d.name}
                        </h4>
                        <StatusBadge tone={isRevoked ? 'danger' : 'success'} size="sm" dot>
                          {isRevoked ? 'Revoked' : 'Active'}
                        </StatusBadge>
                      </div>
                      <p className="text-[12px] text-neutral-500 font-mono mt-0.5 truncate">
                        ID: …{d.deviceId.slice(-12)} • Enrolled: {formatDate(d.linkedAt)}
                      </p>
                    </div>
                  </div>

                  {!isRevoked && (
                    <GlassButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setRevokeTarget(d)}
                      iconStart={<Trash2 size={14} className="text-rose-500" />}
                    >
                      Revoke Access
                    </GlassButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Link New Device Modal */}
      <GlassDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <QrCode className="text-[#C7FF4D]" size={22} />
            <span>Pair Android Device</span>
          </div>
        }
        size="md"
      >
        <div className="space-y-5 pt-2 text-center">
          <p className="text-[13px] text-neutral-600 dark:text-neutral-300">
            Open the <strong>Stockly</strong> Android app on your phone, navigate to <strong>Settings → Linked Devices</strong>, and scan this QR code or enter the code below.
          </p>

          {/* QR Code Container */}
          {linkData?.token && (
            <div className="inline-block p-4 rounded-2xl bg-white shadow-md border border-neutral-200">
              <QRCode value={linkData.token} size={180} level="M" />
            </div>
          )}

          {/* Pairing Code */}
          {linkData && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                Or enter this code:
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono text-2xl font-black tracking-widest text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-4 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  {linkData.code || linkData.token.slice(0, 8)}
                </span>
                <button
                  type="button"
                  title="Copy Code"
                  onClick={copyCode}
                  className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[12px] text-amber-700 dark:text-amber-300 font-medium">
            This pairing session expires in 10 minutes. For security, never share this code.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <GlassButton
              variant="primary"
              fullWidth
              onClick={() => {
                setLinkOpen(false);
                void fetchDevices();
              }}
            >
              Done / Refresh List
            </GlassButton>
          </div>
        </div>
      </GlassDialog>

      {/* Revoke Confirmation Dialog */}
      <GlassDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Device Access"
        size="sm"
      >
        <div className="space-y-4 pt-2">
          <p className="text-[14px] text-neutral-600 dark:text-neutral-300">
            Are you sure you want to revoke access for <strong>{revokeTarget?.name}</strong>?
          </p>
          <p className="text-[12px] text-rose-600 dark:text-rose-400 font-medium">
            This device will immediately lose access to your inventory and will need to be re-paired.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <GlassButton variant="secondary" onClick={() => setRevokeTarget(null)} disabled={revokeBusy}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="destructive"
              loading={revokeBusy}
              onClick={() => void handleRevokeConfirm()}
            >
              Revoke Immediately
            </GlassButton>
          </div>
        </div>
      </GlassDialog>
    </div>
  );
}
