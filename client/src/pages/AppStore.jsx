import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  Smartphone,
  Download,
  QrCode,
  ShieldCheck,
  Zap,
  Sparkles,
  Camera,
  CheckCircle2,
  Share2,
  Copy,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  Cpu,
  HardDrive,
  Lock,
  Layers,
  Check,
  Info,
  HelpCircle,
  Bell,
  BellRing,
  ArrowUpCircle,
} from "lucide-react";
import AppLogo from "../components/ui/AppLogo";
import { useToast } from "../context/ToastContext";
import AppUpdateModal from "../components/app/AppUpdateModal";
import { checkAppUpdate, APP_CURRENT_VERSION, dismissUpdateVersion, clearDismissedUpdateVersion } from "../api/appUpdate";
import { sendLocalNotification, requestNotificationPermission } from "../utils/notifications";
import { downloadAndAutoInstall, resolveApkUrl } from "../utils/nativeUpdater";
import { hapticSuccess, hapticMedium } from "../utils/haptics";
import { playSuccessSound } from "../utils/sound";

export default function AppStore() {
  const { push } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("/stockly.apk");
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("features");

  // App Update & Notifications
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(() => {
    try {
      return localStorage.getItem("stockly_auto_update") !== "false";
    } catch {
      return true;
    }
  });

  const handleToggleAutoUpdate = () => {
    const next = !autoUpdateEnabled;
    setAutoUpdateEnabled(next);
    try {
      localStorage.setItem("stockly_auto_update", String(next));
    } catch {}
    push?.(next ? "Auto-update check enabled" : "Auto-update check disabled", "info");
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      // Manual check bypasses the "Later" dismissal for this version.
      const res = await checkAppUpdate(true);
      if (res?.hasUpdate) {
        clearDismissedUpdateVersion();
        setUpdateInfo(res);
        setUpdateModalOpen(true);
        push?.(`Update v${res.latestVersion} available`, "info");
      } else {
        setUpdateInfo(null);
        setUpdateModalOpen(false);
        push?.(`v${APP_CURRENT_VERSION} is up to date`, "success");
      }
    } catch (e) {
      setUpdateInfo(null);
      setUpdateModalOpen(false);
      push?.("Check failed: " + e.message, "error");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await requestNotificationPermission();
      const res = await sendLocalNotification({
        title: "📦 Stockly Android Notification",
        body: "Android native notification system is active and running!",
      });
      if (res.success) {
        push?.("Notification sent to device!", "success");
      } else {
        push?.(res.message || "Could not deliver notification", "error");
      }
    } catch (err) {
      push?.("Error: " + err.message, "error");
    }
  };

  useEffect(() => {
    // Generate absolute download URL for the QR code.
    // resolveApkUrl() uses the remote API origin on Capacitor native
    // (window.location.origin is capacitor://localhost there and unusable
    // for QR codes scanned by other devices).
    const fullUrl = resolveApkUrl("/stockly.apk");
    setDownloadUrl(fullUrl);

    QRCode.toDataURL(fullUrl, {
      width: 320,
      margin: 1.5,
      color: {
        dark: "#09090b",
        light: "#ffffff",
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code Error:", err));
  }, []);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadPercent(0);
    hapticMedium();

    try {
      const res = await downloadAndAutoInstall({
        url: updateInfo?.apkUrl || "/stockly.apk",
        version: updateInfo?.latestVersion || APP_CURRENT_VERSION,
        onProgress: (p) => setDownloadPercent(p),
      });

      setDownloading(false);
      setDownloadPercent(100);
      hapticSuccess();
      playSuccessSound();

      if (res?.native) {
        push?.("Stockly APK installer launched! Tap Install to proceed.", "success");
      } else {
        push?.("Stockly APK download ready! Open downloaded file to install.", "success");
      }
    } catch (err) {
      setDownloading(false);
      push?.("Download failed: " + err.message, "error");
    }
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      push?.("Download link copied to clipboard", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Download Stockly Android App",
          text: "Install Stockly Inventory Management Android APK for instant barcode scanning and real-time ledger tracking.",
          url: downloadUrl,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const features = [
    {
      icon: Camera,
      title: "Barcode Scanner",
      desc: "Instant camera hardware integration for stock IN/OUT.",
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
    },
    {
      icon: Zap,
      title: "Widgets & Shortcuts",
      desc: "1-Tap operations from your Android Home Screen.",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      icon: QrCode,
      title: "Device Pairing",
      desc: "Scan web QR to login instantly without passwords.",
      color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10",
    },
    {
      icon: ShieldCheck,
      title: "Offline Sync",
      desc: "Local cache synchronization for warehouse floors.",
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    },
  ];

  const steps = [
    {
      step: "1",
      title: "Download APK",
      desc: "Tap download or scan the QR on your device.",
    },
    {
      step: "2",
      title: "Allow Install",
      desc: "Enable 'Allow from this source' if prompted.",
    },
    {
      step: "3",
      title: "Launch & Pair",
      desc: "Open Stockly and sign in or scan to pair.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10 animate-fade-in">
      {/* 1. TOP HERO STORE HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950 text-white p-5 sm:p-8 shadow-xl border border-zinc-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-violet-300">
              <Sparkles size={13} className="text-violet-400 animate-pulse" />
              <span>Official Android App</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Stockly for Android
              </h1>
              <p className="text-zinc-300 text-xs sm:text-sm mt-1">
                Hardware barcode scanner, home screen widgets, and offline ledger.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-extrabold text-xs shadow-lg active:scale-95 transition flex items-center gap-2"
              >
                {downloading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-violet-600" />
                    <span>Downloading ({downloadPercent}%)…</span>
                  </>
                ) : (
                  <>
                    <Download size={14} className="text-violet-600" />
                    <span>Download APK (36 MB)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-sm border border-white/10 active:scale-95 transition flex items-center gap-2"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copied ? "Copied" : "Share"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400 pt-0.5">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-400" /> v{APP_CURRENT_VERSION} Stable
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-violet-400" /> Verified APK
              </span>
              <span>•</span>
              <span>Android 8.0+</span>
            </div>
          </div>

          {/* QR Code Download Card */}
          <div className="w-full md:w-auto flex flex-col items-center justify-center p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-xl shrink-0">
            <div className="bg-white p-2 rounded-xl shadow-inner mb-2.5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Stockly APK Download QR"
                  className="w-32 h-32 sm:w-36 sm:h-36 object-contain rounded-lg"
                />
              ) : (
                <div className="w-32 h-32 sm:w-36 sm:h-36 grid place-items-center bg-zinc-100 text-zinc-400">
                  <QrCode size={28} />
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1">
                <Smartphone size={12} className="text-violet-300" />
                Scan to Download
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SPECIFICATIONS & SYSTEM BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="card p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
            <HardDrive size={15} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Size</div>
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">36 MB</div>
          </div>
        </div>

        <div className="card p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
            <Cpu size={15} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Architecture</div>
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">ARM / x86</div>
          </div>
        </div>

        <div className="card p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <ShieldCheck size={15} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Security</div>
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">Encrypted</div>
          </div>
        </div>

        <div className="card p-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
            <Smartphone size={15} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Target</div>
            <div className="text-xs font-extrabold text-zinc-900 dark:text-white">Android 8.0+</div>
          </div>
        </div>
      </div>

      {/* 3. KEY FEATURES GRID */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Native Features
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="card p-3.5 sm:p-4 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${feat.color}`}>
                  <Icon size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. APPLICATION UPDATES & NOTIFICATIONS SETTINGS */}
      <div className="space-y-2.5">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            System & Updates
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Update Card */}
          <div className="card p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
                <ArrowUpCircle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    App Update
                  </h3>
                  {updateInfo?.hasUpdate ? (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                      v{updateInfo.latestVersion} Available
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[9px] font-bold">
                      v{APP_CURRENT_VERSION}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {updateInfo?.hasUpdate
                    ? `v${updateInfo.latestVersion} ready to install.`
                    : "App is up to date."}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoUpdate}
                  aria-label="Toggle auto update"
                  className={`relative w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 ${
                    autoUpdateEnabled ? "bg-violet-600" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${
                      autoUpdateEnabled ? "translate-x-3.5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-[11px] font-semibold text-zinc-500">
                  Auto-Check
                </span>
              </div>

              {updateInfo?.hasUpdate ? (
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-1"
                >
                  <ArrowUpCircle size={11} />
                  <span>Update</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckUpdate}
                  disabled={checkingUpdate}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <RefreshCw size={11} className={checkingUpdate ? "animate-spin" : ""} />
                  <span>{checkingUpdate ? "Checking…" : "Check"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification Card */}
          <div className="card p-4 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <BellRing size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    Push Notifications
                  </h3>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Device alerts for stock levels and movements.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400">Local notifications</span>
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-xs text-zinc-700 dark:text-zinc-200 active:scale-95 transition flex items-center gap-1"
              >
                <Bell size={11} />
                <span>Test Alert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. STEP-BY-STEP APK INSTALLATION GUIDE */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center font-bold">
            <Info size={14} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
              Installation Guide
            </h3>
            <p className="text-[11px] text-zinc-500">
              Direct sideload instructions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {steps.map((st) => (
            <div
              key={st.step}
              className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 space-y-1.5"
            >
              <div className="w-6 h-6 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center text-[10px] font-black">
                {st.step}
              </div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{st.title}</h4>
              <p className="text-[11px] text-zinc-500">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. QUICK LINKS FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <AppLogo size="xs" />
          <span>Stockly Android • com.stockly.app</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1"
          >
            Sessions <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* App Update Modal */}
      <AppUpdateModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onRemindLater={(info) => {
          if (info?.latestVersion) dismissUpdateVersion(info.latestVersion);
          setUpdateModalOpen(false);
        }}
      />
    </div>
  );
}
