import React, { useState, useEffect } from "react";
import {
  Download,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  X,
  ArrowRight,
  ExternalLink,
  Settings,
} from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { useToast } from "../../context/ToastContext";
import { downloadAndAutoInstall, canInstallPackages, openInstallSettings } from "../../utils/nativeUpdater";
import { hapticSuccess, hapticWarning } from "../../utils/haptics";
import { playSuccessSound, playErrorSound } from "../../utils/sound";

export default function AppUpdateModal({
  open,
  onClose,
  updateInfo,
  onRemindLater,
}) {
  const { push } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [installPermissionRequired, setInstallPermissionRequired] = useState(false);

  useEffect(() => {
    if (open) {
      canInstallPackages().then((can) => {
        setInstallPermissionRequired(!can);
      });
    }
  }, [open]);

  if (!updateInfo) return null;

  const {
    currentVersion = "1.0.0",
    latestVersion = "1.1.0",
    releaseNotes = [],
    apkUrl = "/stockly.apk",
    apkSize = "36 MB",
    mandatory = false,
  } = updateInfo;

  const handleStartUpdate = async () => {
    setDownloading(true);
    setProgress(0);
    setDownloadComplete(false);

    try {
      const res = await downloadAndAutoInstall({
        url: apkUrl,
        version: latestVersion,
        onProgress: (p) => setProgress(p),
      });

      setDownloading(false);
      setDownloadComplete(true);
      hapticSuccess();
      playSuccessSound();

      if (res?.native) {
        push?.(`Stockly v${latestVersion} installer launched! Tap 'Install' to apply update.`, "success");
      } else {
        push?.(`Stockly v${latestVersion} downloaded. Open file to install.`, "success");
      }
    } catch (err) {
      setDownloading(false);
      hapticWarning();
      playErrorSound();
      push?.(err.message || "Failed to complete update download", "error");
    }
  };

  const handleGrantPermission = async () => {
    await openInstallSettings();
    setTimeout(async () => {
      const can = await canInstallPackages();
      setInstallPermissionRequired(!can);
    }, 1000);
  };

  return (
    <Modal
      open={open}
      onClose={mandatory ? undefined : onClose}
      title=""
    >
      <div className="space-y-4 pt-1">
        {/* Header Hero */}
        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-md">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center shrink-0 border border-white/20 shadow-inner">
            <Sparkles size={24} className="text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs uppercase tracking-wider text-violet-200">
                Application Update
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black tracking-wide">
                v{latestVersion}
              </span>
            </div>
            <h3 className="text-base font-extrabold text-white mt-0.5">
              New Version Available
            </h3>
            <p className="text-xs text-violet-100/90 mt-0.5">
              Current: v{currentVersion} • Latest: v{latestVersion} ({apkSize})
            </p>
          </div>
        </div>

        {/* Permission Notice if unknown sources needed */}
        {installPermissionRequired && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Allow Stockly to install APK updates automatically.</span>
            </div>
            <button
              type="button"
              onClick={handleGrantPermission}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs whitespace-nowrap active:scale-95 transition"
            >
              Enable
            </button>
          </div>
        )}

        {/* Release Notes */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 px-1">
            <span>What's New in v{latestVersion}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2 max-h-48 overflow-y-auto">
            {releaseNotes && releaseNotes.length > 0 ? (
              releaseNotes.map((note, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{note}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-zinc-500">General performance updates and bug fixes.</div>
            )}
          </div>
        </div>

        {/* Progress Bar when downloading */}
        {downloading && (
          <div className="space-y-2 p-3.5 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-violet-700 dark:text-violet-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw size={13} className="animate-spin text-violet-600 dark:text-violet-400" /> Downloading & preparing auto-installer…
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2.5 bg-violet-200 dark:bg-violet-900/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {downloadComplete && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="font-semibold leading-relaxed">
              Auto-Installer launched! Tap <strong>"Install"</strong> or <strong>"Update"</strong> on the prompt to complete.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {!mandatory && (
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={downloading}
              className="flex-1 min-h-[44px]"
            >
              Later
            </Button>
          )}

          <button
            type="button"
            onClick={handleStartUpdate}
            disabled={downloading}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-xs shadow-md shadow-violet-500/25 active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Installing…</span>
              </>
            ) : downloadComplete ? (
              <>
                <RefreshCw size={15} />
                <span>Re-install</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Auto Update ({apkSize})</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
