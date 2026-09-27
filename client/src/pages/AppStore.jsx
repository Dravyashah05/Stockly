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
import { checkAppUpdate, APP_CURRENT_VERSION } from "../api/appUpdate";
import { sendLocalNotification, requestNotificationPermission } from "../utils/notifications";

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
      const res = await checkAppUpdate();
      if (res?.hasUpdate) {
        setUpdateInfo(res);
        setUpdateModalOpen(true);
      } else {
        push?.(`Stockly v${APP_CURRENT_VERSION} is currently the latest version.`, "success");
      }
    } catch (e) {
      push?.("Failed to check for updates: " + e.message, "error");
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
    // Generate absolute download URL for the QR code
    const origin = typeof window !== "undefined" ? window.location.origin : "https://stocklybydns.vercel.app";
    const fullUrl = `${origin}/stockly.apk`;
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

  const handleDownload = () => {
    setDownloading(true);
    setDownloadPercent(0);

    const interval = setInterval(() => {
      setDownloadPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setDownloading(false);
          // Trigger actual file download
          const a = document.createElement("a");
          a.href = "/stockly.apk";
          a.download = "stockly-v1.0.0.apk";
          document.body.appendChild(a);
          a.click();
          a.remove();
          push?.("Stockly APK download started!", "success");
          return 100;
        }
        return prev + 25;
      });
    }, 150);
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
      title: "Barcode & QR Scanner",
      desc: "Instant camera hardware integration for rapid stock IN/OUT ledger operations.",
      color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
    },
    {
      icon: Zap,
      title: "Home Screen Widget & Shortcuts",
      desc: "1-Tap Stock IN, Stock OUT & Product creation right from your Android Home Screen widget or app launcher menu.",
      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      icon: QrCode,
      title: "Instant Device Pairing",
      desc: "Scan QR ticket from web desktop to log in immediately without typing passwords.",
      color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10",
    },
    {
      icon: ShieldCheck,
      title: "Encrypted & Offline-Ready",
      desc: "Operate in low-connectivity warehouse environments with local cache syncing.",
      color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10",
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Download APK File",
      desc: "Tap 'Download Android APK' or scan the QR Code on your Android phone.",
    },
    {
      step: "02",
      title: "Allow Unknown Sources",
      desc: "If prompted by Chrome or Files, tap Settings and enable 'Allow from this source'.",
    },
    {
      step: "03",
      title: "Install & Launch",
      desc: "Tap Install. Launch Stockly from your app drawer and sign in or pair via QR.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* 1. TOP HERO STORE HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-violet-950 text-white p-6 sm:p-10 shadow-xl border border-zinc-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-bold text-violet-300">
              <Sparkles size={13} className="text-violet-400 animate-pulse" />
              <span>Official Stockly Mobile App</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>

            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Stockly for Android
              </h1>
              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed mt-2">
                High-speed warehouse inventory management, camera barcode scanning, stock ledger audits, and instant multi-device pairing on your mobile device.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="px-5 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-zinc-900 font-extrabold text-xs sm:text-sm shadow-lg active:scale-95 transition flex items-center gap-2"
              >
                {downloading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin text-violet-600" />
                    <span>Downloading ({downloadPercent}%)…</span>
                  </>
                ) : (
                  <>
                    <Download size={16} className="text-violet-600" />
                    <span>Download APK (4.9 MB)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm backdrop-blur-sm border border-white/10 active:scale-95 transition flex items-center gap-2"
              >
                {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
                <span>{copied ? "Link Copied!" : "Share Link"}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" /> Version 1.0.0 Stable
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-violet-400" /> Safe & Verified APK
              </span>
              <span>•</span>
              <span>Android 8.0+ Required</span>
            </div>
          </div>

          {/* QR Code Download Card */}
          <div className="w-full md:w-auto flex flex-col items-center justify-center p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl shrink-0">
            <div className="bg-white p-2.5 rounded-xl shadow-inner mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Stockly APK Download QR"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-lg"
                />
              ) : (
                <div className="w-36 h-36 sm:w-40 sm:h-40 grid place-items-center bg-zinc-100 text-zinc-400">
                  <QrCode size={32} />
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                <Smartphone size={13} className="text-violet-300" />
                Scan to Download
              </div>
              <div className="text-[10px] text-zinc-300 mt-0.5">Point Android Camera at QR</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SPECIFICATIONS & SYSTEM BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
            <HardDrive size={16} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Package Size</div>
            <div className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white">4.9 MB (Ultra Light)</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
            <Cpu size={16} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Architecture</div>
            <div className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white">Universal ARM/x86</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Security</div>
            <div className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white">SSL Encrypted</div>
          </div>
        </div>

        <div className="card p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
            <Smartphone size={16} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-zinc-400">Target OS</div>
            <div className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white">Android 8.0 to 15+</div>
          </div>
        </div>
      </div>

      {/* 3. KEY FEATURES GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Native Mobile Capabilities
          </h2>
          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
            Engineered for Warehouse Operations
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="card p-4 sm:p-5 flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 ${feat.color}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. APPLICATION UPDATES & NOTIFICATIONS SETTINGS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Updates & Push Notification Engine
          </h2>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Real-Time Warehouse Sync
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Update Card */}
          <div className="card p-4 sm:p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
                <ArrowUpCircle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    Over-The-Air App Update
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[9px] font-extrabold">
                    v{APP_CURRENT_VERSION}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Query the release server for updated APK builds and new warehouse features.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoUpdate}
                  aria-label="Toggle auto update"
                  className={`relative w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 ${
                    autoUpdateEnabled ? "bg-violet-600" : "bg-zinc-200 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    className={`block w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${
                      autoUpdateEnabled ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  {autoUpdateEnabled ? "Auto-Check: On" : "Auto-Check: Off"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw size={12} className={checkingUpdate ? "animate-spin" : ""} />
                <span>{checkingUpdate ? "Checking…" : "Check Update"}</span>
              </button>
            </div>
          </div>

          {/* Notification Card */}
          <div className="card p-4 sm:p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <BellRing size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white">
                    Android Local Notifications
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-extrabold">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  Real-time device alerts for inventory stock shortages, transaction confirmations, and updates.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-400">Hardware vibration & banners</span>
              <button
                type="button"
                onClick={handleTestNotification}
                className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-xs text-zinc-700 dark:text-zinc-200 active:scale-95 transition flex items-center gap-1.5"
              >
                <Bell size={12} />
                <span>Send Test Alert</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. STEP-BY-STEP APK INSTALLATION GUIDE */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center font-bold">
            <Info size={16} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
              How to Install Stockly APK on Android
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Quick 30-second direct sideload instructions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {steps.map((st) => (
            <div
              key={st.step}
              className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 space-y-2"
            >
              <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 grid place-items-center text-xs font-black">
                {st.step}
              </div>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white">{st.title}</h4>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. QUICK LINKS FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <AppLogo size="xs" />
          <span>Stockly Android Edition • com.stockly.app</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            className="text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1"
          >
            Manage Device Sessions <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* App Update Modal */}
      <AppUpdateModal
        open={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />
    </div>
  );
}
