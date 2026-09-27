package com.stockly.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StocklyWidget")
public class StocklyWidgetPlugin extends Plugin {

    public static final String PREFS_NAME = "stockly_widget_prefs";
    public static final String KEY_TOTAL_PRODUCTS = "total_products";
    public static final String KEY_LOW_STOCK = "low_stock";
    public static final String KEY_TODAY_IN = "today_in";
    public static final String KEY_TODAY_OUT = "today_out";
    public static final String KEY_TOTAL_VALUE = "total_value";
    public static final String KEY_LAST_SYNC = "last_sync";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();

            if (call.hasOption("totalProducts")) {
                editor.putInt(KEY_TOTAL_PRODUCTS, call.getInt("totalProducts", 0));
            }
            if (call.hasOption("lowStockCount")) {
                editor.putInt(KEY_LOW_STOCK, call.getInt("lowStockCount", 0));
            }
            if (call.hasOption("todayIn")) {
                editor.putInt(KEY_TODAY_IN, call.getInt("todayIn", 0));
            }
            if (call.hasOption("todayOut")) {
                editor.putInt(KEY_TODAY_OUT, call.getInt("todayOut", 0));
            }
            if (call.hasOption("totalValue")) {
                editor.putString(KEY_TOTAL_VALUE, call.getString("totalValue", ""));
            }
            editor.putLong(KEY_LAST_SYNC, System.currentTimeMillis());
            editor.apply();

            // Notify Widget Manager to refresh all active Stockly widgets
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName thisWidget = new ComponentName(context, StocklyAppWidgetProvider.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);

            if (appWidgetIds != null && appWidgetIds.length > 0) {
                for (int widgetId : appWidgetIds) {
                    StocklyAppWidgetProvider.updateAppWidget(context, appWidgetManager, widgetId);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("widgetsUpdated", appWidgetIds != null ? appWidgetIds.length : 0);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Widget update failed: " + e.getMessage());
        }
    }
}
