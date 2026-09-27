import { Capacitor, registerPlugin } from "@capacitor/core";
import { sendAppUpdateNotification } from "./notifications";

const isNative = Capacitor.isNativePlatform();

// Register AppInstaller plugin
const AppInstaller = registerPlugin("AppInstaller");

/**
 * Check if the app can install packages (Android 8+)
 */
export async function canInstallPackages() {
  if (!isNative) return true;
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
  if (!isNative) return;
  try {
    await AppInstaller.openInstallPermissionSettings();
  } catch (err) {
    console.warn("Failed to open install settings:", err);
  }
}

/**
 * Automatically download and launch the native Android APK package installer
 * @param {Object} options
 * @param {string} options.url - Direct APK URL
 * @param {string} options.version - Target version string
 * @param {function} options.onProgress - Progress callback (0-100)
 */
export async function downloadAndAutoInstall({
  url = "/stockly.apk",
  version = "1.1.0",
  onProgress = () => {},
}) {
  // Resolve full absolute URL if relative
  let fullUrl = url;
  if (typeof window !== "undefined" && url.startsWith("/")) {
    fullUrl = window.location.origin + url;
  }

  // 1. Native Android Execution via AppInstaller Plugin
  if (isNative) {
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
