import express from "express";

const router = express.Router();

// Current released version metadata
// NOTE: releaseDate is static — using `new Date()` here made every restart
// look like a fresh release and broke client-side "what's new" caching.
const APP_VERSION_INFO = {
  version: "1.1.0",
  versionCode: 2,
  releaseDate: "2026-09-20T00:00:00.000Z",
  minSupportedVersion: "1.0.0",
  apkPath: "/stockly.apk",
  apkSize: "36 MB",
  mandatory: false,
  releaseNotes: [
    "Native Android push & local notifications for low stock alerts",
    "Over-the-air App Update & Auto-Update system",
    "Enhanced Stock In & Stock Out quick triggers in dashboard",
    "Rebuilt real-time notification center with tabs and sidebar badges",
    "General stability improvements and performance optimizations"
  ]
};

// Build an absolute APK URL for the caller. Relative "/stockly.apk" breaks
// Capacitor native downloads because `window.location.origin` on-device is
// `capacitor://localhost` / `https://localhost`, not the remote host serving
// the file. An absolute URL also survives API-vs-web origin splits.
function getAbsoluteApkUrl(req) {
  if (process.env.APP_APK_URL) return process.env.APP_APK_URL;
  const proto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim() || req.protocol || "https";
  const host = req.headers["x-forwarded-host"]?.split(",")[0]?.trim() || req.get("host");
  if (!host) return APP_VERSION_INFO.apkPath;
  return `${proto}://${host}${APP_VERSION_INFO.apkPath}`;
}

function getVersionPayload(req) {
  return {
    ...APP_VERSION_INFO,
    apkUrl: getAbsoluteApkUrl(req),
    downloadUrl: getAbsoluteApkUrl(req),
  };
}

// Check for updates endpoint
router.get("/version", (req, res) => {
  res.json({
    success: true,
    data: getVersionPayload(req)
  });
});

router.get("/check-update", (req, res) => {
  const clientVersion = req.query.version || "1.0.0";
  const rawCode = Array.isArray(req.query.versionCode)
    ? req.query.versionCode[0]
    : req.query.versionCode;
  const parsed = parseInt(rawCode ?? "1", 10);
  const clientVersionCode = Number.isFinite(parsed) ? parsed : 0;

  // Version-code comparison is authoritative. String comparison alone caused
  // false "update available" states (e.g. "1.1" vs "1.1.0" with equal codes).
  const hasUpdate = clientVersionCode < APP_VERSION_INFO.versionCode;

  res.json({
    success: true,
    hasUpdate,
    currentVersion: clientVersion,
    currentVersionCode: clientVersionCode,
    latestVersion: APP_VERSION_INFO.version,
    latestVersionCode: APP_VERSION_INFO.versionCode,
    minSupportedVersion: APP_VERSION_INFO.minSupportedVersion,
    mandatory: APP_VERSION_INFO.mandatory,
    releaseNotes: APP_VERSION_INFO.releaseNotes,
    apkUrl: getAbsoluteApkUrl(req),
    downloadUrl: getAbsoluteApkUrl(req),
    apkSize: APP_VERSION_INFO.apkSize,
    releaseDate: APP_VERSION_INFO.releaseDate
  });
});

// Convenience endpoint so clients can link to /api/app/download (and /app/download)
// without hardcoding the APK path. Redirects to the absolute APK URL.
router.get("/download", (req, res) => {
  res.redirect(302, getAbsoluteApkUrl(req));
});

export default router;
