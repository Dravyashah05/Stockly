import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  sendAppUpdateNotification,
  sendUpdateProgressNotification,
  sendDownloadedFileNotification,
  sendUpdateReadyNotification,
} from "./notifications";

// Register AppInstaller plugin
const AppInstaller = registerPlugin("AppInstaller");

// Remote API origin — the host that actually serves /stockly.apk.
// On a Capacitor device `window.location.origin` is `capacitor://localhost`
// (or `https://localhost`), which does NOT host the APK, so relative URLs
// must be resolved against the API origin instead.
const DEFAULT_REMOTE_API = "https://stocklybydns.vercel.app/api";

function getApiOrigin() {
  const base =
    import.meta.env?.VITE_API_URL || DEFAULT_REMOTE_API;
  try {
    const u = new URL(base, typeof window !== "undefined" ? window.location.href : "https://stocklybydns.vercel.app");
    return u.origin;
  } catch {
    return "https://stocklybydns.vercel.app";
  }
}

export function isNativePlatform() {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor.isNativePlatform?.()) return true;
  } catch {}
  if (typeof window !== "undefined") {
    if (window.location.protocol === "capacitor:") return true;
    try {
      if (window.Capacitor?.isNativePlatform?.()) return true;
    } catch {}
  }
  return false;
}

/**
 * Resolve an APK URL to an absolute https URL.
 * - Absolute http(s) URLs pass through untouched.
 * - On native, relative "/stockly.apk" resolves against the remote API
 *   origin (NOT capacitor://localhost).
 * - On web, relative URLs resolve against window.location.origin.
 */
export function resolveApkUrl(url = "/stockly.apk") {
  if (!url) return `${getApiOrigin()}/stockly.apk`;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) {
    if (isNativePlatform()) return `${getApiOrigin()}${url}`;
    if (typeof window !== "undefined") return window.location.origin + url;
    return `${getApiOrigin()}${url}`;
  }
  return url;
}

/**
 * Check if the app can install packages (Android 8+)
 */
export async function canInstallPackages() {
  if (!isNativePlatform()) return true;
  try {
    const res = await AppInstaller.canInstall();
    return res?.canInstall ?? true;
  } catch (err) {
    console.warn("canInstall check error:", err);
    return true;
  }
}

/**
 * Open Android Settings to grant unknown app install permissions
 */
export async function openInstallSettings() {
  if (!isNativePlatform()) return;
  try {
    await AppInstaller.openInstallPermissionSettings();
  } catch (err) {
    console.warn("Failed to open install settings:", err);
  }
}

/**
 * Best-effort semver compare: -1 | 0 | 1.
 */
function compareVersions(a, b) {
  const pa = String(a || "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return "0 B";
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/**
 * Read the actually-installed native build (version + versionCode).
 */
export async function getInstalledAppVersion() {
  let version = null;
  let versionCode = null;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor?.isNativePlatform?.()) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (info?.version) version = info.version;
      const build = parseInt(info?.build, 10);
      if (Number.isFinite(build) && build > 0) versionCode = build;
    }
  } catch {}
  return { version, versionCode };
}

/**
 * Verify a downloaded APK on disk via the native plugin.
 */
export async function verifyDownloadedFile({ path, version } = {}) {
  if (!isNativePlatform()) return { exists: false, reason: "non-native" };
  try {
    const res = await AppInstaller.getDownloadedFileInfo({ path, version });
    return {
      exists: !!res?.exists,
      valid: !!res?.validApk,
      path: res?.path || path || "",
      name: res?.name || "",
      sizeBytes: Number(res?.sizeBytes) || 0,
    };
  } catch (err) {
    return { exists: false, valid: false, error: err?.message };
  }
}

/**
 * Automatically download and launch the native Android APK package installer
 * @param {Object} options
 * @param {string} options.url - Direct APK URL (relative or absolute)
 * @param {string} options.version - Target version string
 * @param {function} options.onProgress - Progress callback (0-100)
 * @param {function} options.onStage - Stage callback (available|downloading|downloaded|verifying|ready|up-to-date)
 *
 * Flow: update notification → progress notifications → downloaded-file
 * notification → on-disk verify → installed-version check → installer.
 */
export async function downloadAndAutoInstall({
  url = "/stockly.apk",
  version = "1.2.0",
  onProgress = () => {},
  onStage = () => {},
}) {
  const fullUrl = resolveApkUrl(url);

  // 1. Native Android Execution via AppInstaller Plugin
  if (isNativePlatform()) {
    let progressListener = null;
    let lastMilestone = -1;

    const emitProgress = (p) => {
      const pct = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
      onProgress(pct);
      // Milestone notifications (0/25/50/75/100) — same id updates in place.
      const milestone = pct >= 100 ? 100 : Math.floor(pct / 25) * 25;
      if (milestone !== lastMilestone) {
        lastMilestone = milestone;
        sendUpdateProgressNotification(version, pct).catch(() => {});
      }
    };

    // Verification failures must surface (not fall into the web demo flow).
    let verificationError = null;

    try {
      onStage("available");
      sendAppUpdateNotification(version).catch(() => {});

      // Register progress listener
      progressListener = await AppInstaller.addListener("downloadProgress", (info) => {
        if (info && typeof info.progress === "number" && info.progress >= 0) {
          emitProgress(info.progress);
        }
      });

      onStage("downloading");
      emitProgress(0);

      // Download only — the installer is shown after verify + version check.
      const result = await AppInstaller.downloadAndInstall({
        url: fullUrl,
        version,
        autoInstall: false,
      });

      emitProgress(100);
      onProgress(100);

      // 2. Show the downloaded file (verify it exists on disk first).
      onStage("downloaded");
      const file = await verifyDownloadedFile({ path: result?.path, version });
      const sizeBytes = file.sizeBytes || Number(result?.sizeBytes) || 0;
      const fileInfo = {
        path: file.path || result?.path || "",
        name: file.name || result?.name || `stockly-v${version}.apk`,
        sizeBytes,
        sizeLabel: formatBytes(sizeBytes),
        valid: file.valid ?? sizeBytes >= 1_000_000,
      };
      sendDownloadedFileNotification({
        version,
        name: fileInfo.name,
        sizeLabel: fileInfo.sizeLabel,
      }).catch(() => {});

      if (!fileInfo.valid) {
        verificationError = new Error(
          `Downloaded file failed verification (${fileInfo.sizeLabel}). Please retry.`
        );
        throw verificationError;
      }

      // 3. Check the installed app version before showing the update.
      onStage("verifying");
      const installed = await getInstalledAppVersion();
      const upToDate =
        installed.version != null && compareVersions(installed.version, version) >= 0;

      if (upToDate) {
        onStage("up-to-date");
        return { success: true, native: true, upToDate: true, file: fileInfo, installed };
      }

      // 4. Downloaded build is newer — show the update (system installer).
      onStage("ready");
      sendUpdateReadyNotification(version).catch(() => {});
      try {
        await AppInstaller.installExistingApk({ path: fileInfo.path, version });
      } catch (installErr) {
        console.warn("installExistingApk failed:", installErr);
      }
      return { success: true, native: true, upToDate: false, file: fileInfo, installed };
    } catch (nativeErr) {
      if (verificationError) throw verificationError;
      console.warn("Native install error, attempting fallback:", nativeErr);
      // If native fails, try fallback
    } finally {
      try {
        progressListener?.remove?.();
      } catch {}
    }
  }

  // 2. Web Fallback (Progress simulation & direct browser APK download)
  return new Promise((resolve) => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 15;
      if (currentProgress >= 100) {
        clearInterval(interval);
        onProgress(100);

        // Trigger browser download
        const a = document.createElement("a");
        a.href = fullUrl;
        a.download = `stockly-v${version}.apk`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        resolve({ success: true, native: false });
      } else {
        onProgress(currentProgress);
      }
    }, 120);
  });
}
