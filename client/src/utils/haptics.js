import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = Capacitor.isNativePlatform();

export function isHapticsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem("stockly_haptics_enabled") !== "false";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled) {
  try {
    localStorage.setItem("stockly_haptics_enabled", enabled ? "true" : "false");
  } catch {}
}

export async function hapticLight() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  } catch {}
}

export async function hapticMedium() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(25);
    }
  } catch {}
}

export async function hapticHeavy() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(40);
    }
  } catch {}
}

export async function hapticSuccess() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([15, 40, 25]);
    }
  } catch {}
}

export async function hapticWarning() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  } catch {}
}

export async function hapticError() {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Error });
    } else if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 60, 40, 60, 40]);
    }
  } catch {}
}
