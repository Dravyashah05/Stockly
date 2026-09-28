import { Capacitor, registerPlugin } from "@capacitor/core";
import { sendAppUpdateNotification } from "./notifications";

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
 * Automatically download and launch the native Android APK package installer
 * @param {Object} options
 * @param {string} options.url - Direct APK URL (relative or absolute)
 * @param {string} options.version - Target version string
 * @param {function} options.onProgress - Progress callback (0-100)
 */
export async function downloadAndAutoInstall({
  url = "/stockly.apk",
  version = "1.1.0",
  onProgress = () => {},
}) {
  const fullUrl = resolveApkUrl(url);

  // 1. Native Android Execution via AppInstaller Plugin
  if (isNativePlatform()) {
    let progressListener = null;
    let completeListener = null;
    let errorListener = null;

    try {
      sendAppUpdateNotification(version).catch(() => {});

      // Register progress listener
      progressListener = await AppInstaller.addListener("downloadProgress", (info) => {
        if (info && typeof info.progress === "number") {
          onProgress(info.progress);
        }
      });

      // Execute native download and install
      const result = await AppInstaller.downloadAndInstall({
        url: fullUrl,
        version,
      });

      onProgress(100);
      return { success: true, native: true, ...result };
    } catch (nativeErr) {
      console.warn("Native install error, attempting fallback:", nativeErr);
      // If native fails, try fallback
    } finally {
      try {
        progressListener?.remove?.();
        completeListener?.remove?.();
        errorListener?.remove?.();
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
