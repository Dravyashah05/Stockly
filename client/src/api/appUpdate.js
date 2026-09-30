import api from "./client";
import { resolveApkUrl } from "../utils/nativeUpdater";

// Must match the latest released build (server APP_VERSION_INFO + android
// versionCode/versionName). If these lag behind, the server keeps reporting
// hasUpdate=true even right after the user installed the latest APK.
export const APP_CURRENT_VERSION = "1.2.0";
export const APP_CURRENT_VERSION_CODE = 3;

const DISMISSED_KEY = "stockly_update_dismissed_version";

export function getDismissedUpdateVersion() {
  try {
    return localStorage.getItem(DISMISSED_KEY) || null;
  } catch {
    return null;
  }
}

export function dismissUpdateVersion(version) {
  if (!version) return;
  try {
    localStorage.setItem(DISMISSED_KEY, String(version));
  } catch {}
}

export function clearDismissedUpdateVersion() {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {}
}

// Best-effort semver compare: 1 -> -1, 0 -> equal, 1 -> greater.
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

// Prefer the real native build version when running inside Capacitor so the
// check reflects the actually-installed APK, not just the bundled JS.
async function getEffectiveAppVersion() {
  let version = APP_CURRENT_VERSION;
  let versionCode = APP_CURRENT_VERSION_CODE;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor?.isNativePlatform?.()) {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      if (info?.version) version = info.version;
      // App.getInfo().build is the Android versionCode as a string.
      const build = parseInt(info?.build, 10);
      if (Number.isFinite(build) && build > 0) versionCode = build;
    }
  } catch {
    // Web / plugin unavailable — fall back to bundled constants.
  }
  return { version, versionCode };
}

function normalizeUpdatePayload(res) {
  if (!res || typeof res !== "object") return res;
  // Older server payloads sent relative "/stockly.apk" — resolve to absolute
  // so Capacitor downloads hit the real host instead of capacitor://localhost.
  if (res.apkUrl) res.apkUrl = resolveApkUrl(res.apkUrl);
  if (res.downloadUrl) res.downloadUrl = resolveApkUrl(res.downloadUrl);
  if (res.data?.apkUrl) res.data.apkUrl = resolveApkUrl(res.data.apkUrl);
  if (res.data?.downloadUrl) res.data.downloadUrl = resolveApkUrl(res.data.downloadUrl);
  return res;
}

export async function checkAppUpdate(ignoreDismissal = false) {
  try {
    const { version, versionCode } = await getEffectiveAppVersion();
    const res = await api.get(`/app/check-update?version=${version}&versionCode=${versionCode}`);
    const payload = normalizeUpdatePayload(res);

    // Client-side safety net: never report an update when the installed
    // build is already >= the latest (protects against stale server data,
    // string-vs-code mismatches like "1.1" vs "1.1.0", etc.).
    if (payload && typeof payload === "object") {
      const latestCode = parseInt(payload.latestVersionCode, 10);
      if (Number.isFinite(latestCode) && versionCode >= latestCode) {
        payload.hasUpdate = false;
      } else if (!Number.isFinite(latestCode) && payload.latestVersion) {
        if (compareVersions(version, payload.latestVersion) >= 0) {
          payload.hasUpdate = false;
        }
      }
      // "Later" dismissal: auto-checks stay quiet for a dismissed release,
      // manual "Check for updates" (ignoreDismissal=true) still shows it.
      if (payload.hasUpdate && !ignoreDismissal && payload.latestVersion) {
        if (getDismissedUpdateVersion() === String(payload.latestVersion)) {
          payload.hasUpdate = false;
        }
      }
      // A new release invalidates an old dismissal automatically.
      if (payload.hasUpdate && payload.latestVersion) {
        const dismissed = getDismissedUpdateVersion();
        if (dismissed && dismissed !== String(payload.latestVersion)) {
          clearDismissedUpdateVersion();
        }
      }
      // Keep effective version on the payload for accurate modal display.
      if (payload.currentVersion == null) payload.currentVersion = version;
      if (payload.currentVersionCode == null) payload.currentVersionCode = versionCode;
    }

    return payload;
  } catch (err) {
    console.warn("checkAppUpdate failed, using offline fallback:", err?.message || err);
    // Fallback if backend route is unavailable
    return {
      success: true,
      hasUpdate: false,
      currentVersion: APP_CURRENT_VERSION,
      latestVersion: APP_CURRENT_VERSION,
      releaseNotes: ["System is up to date."]
    };
  }
}

export async function getAppVersionInfo() {
  try {
    const res = await api.get("/app/version");
    return normalizeUpdatePayload(res);
  } catch (err) {
    console.warn("getAppVersionInfo failed, using offline fallback:", err?.message || err);
    return {
      success: true,
      data: {
        version: APP_CURRENT_VERSION,
        versionCode: APP_CURRENT_VERSION_CODE,
        apkUrl: resolveApkUrl("/stockly.apk"),
        apkSize: "36 MB"
      }
    };
  }
}
