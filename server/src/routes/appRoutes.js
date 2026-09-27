import express from "express";

const router = express.Router();

// Current released version metadata
const APP_VERSION_INFO = {
  version: "1.1.0",
  versionCode: 2,
  releaseDate: new Date().toISOString(),
  minSupportedVersion: "1.0.0",
  apkUrl: "/stockly.apk",
  apkSize: "4.9 MB",
  mandatory: false,
  releaseNotes: [
    "Native Android push & local notifications for low stock alerts",
    "Over-the-air App Update & Auto-Update system",
    "Enhanced Stock In & Stock Out quick triggers in dashboard",
    "Rebuilt real-time notification center with tabs and sidebar badges",
    "General stability improvements and performance optimizations"
  ]
};

// Check for updates endpoint
router.get("/version", (_req, res) => {
  res.json({
    success: true,
    data: APP_VERSION_INFO
  });
});

router.get("/check-update", (req, res) => {
  const clientVersion = req.query.version || "1.0.0";
  const clientVersionCode = parseInt(req.query.versionCode || "1", 10);

  const hasUpdate = clientVersionCode < APP_VERSION_INFO.versionCode || clientVersion !== APP_VERSION_INFO.version;

  res.json({
    success: true,
    hasUpdate,
    currentVersion: clientVersion,
    latestVersion: APP_VERSION_INFO.version,
    latestVersionCode: APP_VERSION_INFO.versionCode,
    mandatory: APP_VERSION_INFO.mandatory,
    releaseNotes: APP_VERSION_INFO.releaseNotes,
    apkUrl: APP_VERSION_INFO.apkUrl,
    apkSize: APP_VERSION_INFO.apkSize,
    releaseDate: APP_VERSION_INFO.releaseDate
  });
});

export default router;
