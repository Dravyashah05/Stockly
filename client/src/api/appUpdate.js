import api from "./client";
import { resolveApkUrl } from "../utils/nativeUpdater";

export const APP_CURRENT_VERSION = "1.0.0";
export const APP_CURRENT_VERSION_CODE = 1;

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

export async function checkAppUpdate() {
  try {
    const res = await api.get(`/app/check-update?version=${APP_CURRENT_VERSION}&versionCode=${APP_CURRENT_VERSION_CODE}`);
    return normalizeUpdatePayload(res);
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
