import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = Capacitor.isNativePlatform();

/**
 * Check if notifications are supported on current platform
 */
export function isNotificationSupported() {
  if (isNative) return true;
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Request notification permissions from user (Android 13+ & Web)
 */
export async function requestNotificationPermission() {
  try {
    if (isNative) {
      const status = await LocalNotifications.requestPermissions();
      return status.display === "granted";
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  } catch (err) {
    console.warn("Notification permission error:", err);
    return false;
  }
}

/**
 * Check current notification permission status
 */
export async function checkNotificationPermission() {
  try {
    if (isNative) {
      const status = await LocalNotifications.checkPermissions();
      return status.display === "granted";
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted";
    }

    return false;
  } catch (err) {
    return false;
  }
}

/**
 * Create default notification channels for Android
 */
async function ensureAndroidChannels() {
  if (!isNative) return;
  try {
    await LocalNotifications.createChannel({
      id: "stockly_inventory_alerts",
      name: "Stockly Inventory Alerts",
      description: "Low stock, out of stock, and warehouse updates",
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: "beep.wav"
    });
  } catch (e) {
    // Channel creation may already exist or fail gracefully
  }
}

/**
 * Send an immediate native Android or Web notification
 */
export async function sendLocalNotification({
  id = Date.now() % 100000,
  title = "Stockly Alert",
  body = "",
  extra = {},
  scheduleInSeconds = 0,
  largeIcon = undefined,
  smallIcon = "ic_launcher_round"
} = {}) {
  try {
    // Trigger haptic feedback
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}

    if (isNative) {
      await ensureAndroidChannels();

      const notifOptions = {
        notifications: [
          {
            id: Number(id) || Math.floor(Math.random() * 100000),
            title,
            body,
            largeBody: body,
            channelId: "stockly_inventory_alerts",
            extra,
            schedule: scheduleInSeconds > 0 ? { at: new Date(Date.now() + scheduleInSeconds * 1000) } : undefined,
            smallIcon: "ic_launcher",
            iconColor: "#4f46e5"
          }
        ]
      };

      await LocalNotifications.schedule(notifOptions);
      return { success: true, platform: "android" };
    }

    // Web Fallback
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico"
        });
        return { success: true, platform: "web" };
      } else if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          new Notification(title, { body, icon: "/favicon.ico" });
          return { success: true, platform: "web" };
        }
      }
    }

    return { success: false, message: "Permission not granted" };
  } catch (err) {
    console.error("Failed to send notification:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Low Stock inventory alert
 */
export async function sendLowStockNotification(productName, quantity, minStock) {
  return sendLocalNotification({
    id: Math.floor(Math.random() * 100000),
    title: `⚠️ Low Stock Warning: ${productName}`,
    body: `Only ${quantity} units left on hand (minimum threshold is ${minStock}). Tap to reorder.`,
    extra: { type: "LOW_STOCK", productName }
  });
}

/**
 * Send Out of Stock critical alert
 */
export async function sendOutOfStockNotification(productName) {
  return sendLocalNotification({
    id: Math.floor(Math.random() * 100000),
    title: `🚨 Out of Stock: ${productName}`,
    body: `Inventory count is 0! Restock immediately to prevent warehouse fulfillment delays.`,
    extra: { type: "OUT_OF_STOCK", productName }
  });
}

/**
 * Send App Update alert notification
 */
export async function sendAppUpdateNotification(latestVersion) {
  return sendLocalNotification({
    id: 99991,
    title: `🚀 Stockly Update v${latestVersion} Available`,
    body: `A new version of Stockly is ready. Tap to download and install the update.`,
    extra: { type: "APP_UPDATE", version: latestVersion }
  });
}

// Fixed ids so each stage updates its own notification slot.
export const UPDATE_NOTIF_IDS = {
  available: 99991,
  progress: 99993,
  downloaded: 99994,
  ready: 99995,
};

/**
 * Download progress notification (same id → updates in place).
 */
export async function sendUpdateProgressNotification(version, progress) {
  return sendLocalNotification({
    id: UPDATE_NOTIF_IDS.progress,
    title: `⬇️ Downloading Stockly v${version} — ${progress}%`,
    body: progress >= 100 ? "Download finishing…" : "Update package is downloading. Keep the app open.",
    extra: { type: "APP_UPDATE_PROGRESS", version, progress }
  });
}

/**
 * Downloaded-file notification after the APK is verified on disk.
 */
export async function sendDownloadedFileNotification({ version, name, sizeLabel }) {
  return sendLocalNotification({
    id: UPDATE_NOTIF_IDS.downloaded,
    title: `📦 Stockly v${version} downloaded`,
    body: `${name || "stockly.apk"} (${sizeLabel || "unknown size"}) verified on device. Checking app version…`,
    extra: { type: "APP_UPDATE_DOWNLOADED", version, name }
  });
}

/**
 * Final update-ready notification once the version check confirms the
 * downloaded build is newer than the installed app.
 */
export async function sendUpdateReadyNotification(version) {
  return sendLocalNotification({
    id: UPDATE_NOTIF_IDS.ready,
    title: `✅ Install Stockly v${version}`,
    body: `Version check passed — tap the installer prompt to apply the update.`,
    extra: { type: "APP_UPDATE_READY", version }
  });
}
