/**
 * Widget support was removed from the Android app (smaller APK, no stale
 * home-screen state). Kept as a no-op so existing imports keep working.
 */
export async function syncInventoryToWidget() {
  return { success: false, reason: "widget-removed" };
}
