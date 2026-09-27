import api from "./client";

export const APP_CURRENT_VERSION = "1.0.0";
export const APP_CURRENT_VERSION_CODE = 1;

export async function checkAppUpdate() {
  try {
    const res = await api.get(`/app/check-update?version=${APP_CURRENT_VERSION}&versionCode=${APP_CURRENT_VERSION_CODE}`);
    return res;
  } catch (err) {
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
    return await api.get("/app/version");
  } catch (err) {
    return {
      success: true,
      data: {
        version: APP_CURRENT_VERSION,
        versionCode: APP_CURRENT_VERSION_CODE,
        apkUrl: "/stockly.apk",
        apkSize: "4.9 MB"
      }
    };
  }
}
