import { Capacitor, registerPlugin } from "@capacitor/core";

const isNative = Capacitor.isNativePlatform();
const StocklyWidget = registerPlugin("StocklyWidget");

/**
 * Synchronize inventory statistics to the Android Home Screen Widget
 */
export async function syncInventoryToWidget({
  totalProducts = 0,
  lowStockCount = 0,
  todayIn = 0,
  todayOut = 0,
  totalValue = "",
} = {}) {
  if (!isNative) return { success: false, reason: "non-native" };

  try {
    const res = await StocklyWidget.updateWidgetData({
      totalProducts: Number(totalProducts) || 0,
      lowStockCount: Number(lowStockCount) || 0,
      todayIn: Number(todayIn) || 0,
      todayOut: Number(todayOut) || 0,
      totalValue: String(totalValue || ""),
    });
    return res;
  } catch (err) {
    console.warn("Widget sync error:", err);
    return { success: false, error: err.message };
  }
}
