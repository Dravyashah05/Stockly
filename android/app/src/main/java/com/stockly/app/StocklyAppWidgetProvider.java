package com.stockly.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

public class StocklyAppWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.stockly_app_widget);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Read Live Data from SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(StocklyWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE);
        int totalProducts = prefs.getInt(StocklyWidgetPlugin.KEY_TOTAL_PRODUCTS, -1);
        int lowStock = prefs.getInt(StocklyWidgetPlugin.KEY_LOW_STOCK, 0);
        int todayIn = prefs.getInt(StocklyWidgetPlugin.KEY_TODAY_IN, 0);
        int todayOut = prefs.getInt(StocklyWidgetPlugin.KEY_TODAY_OUT, 0);

        if (totalProducts >= 0) {
            views.setTextViewText(R.id.tv_stat_products_count, String.valueOf(totalProducts));
        } else {
            views.setTextViewText(R.id.tv_stat_products_count, "Catalog");
        }

        if (lowStock > 0) {
            views.setTextViewText(R.id.tv_stat_low_count, "⚠️ " + lowStock);
            views.setTextColor(R.id.tv_stat_low_count, 0xFFF43F5E);
        } else {
            views.setTextViewText(R.id.tv_stat_low_count, "0 Low");
            views.setTextColor(R.id.tv_stat_low_count, 0xFF10B981);
        }

        if (todayIn > 0 || todayOut > 0) {
            views.setTextViewText(R.id.tv_stat_moves_count, "+" + todayIn + "/-" + todayOut);
        } else {
            views.setTextViewText(R.id.tv_stat_moves_count, "Ledger");
        }

        // 1. Stock IN PendingIntent
        Intent stockInIntent = new Intent(context, MainActivity.class);
        stockInIntent.setAction(Intent.ACTION_VIEW);
        stockInIntent.setData(Uri.parse("stockly://stock?type=IN"));
        stockInIntent.putExtra("shortcut_action", "STOCK_IN");
        stockInIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent stockInPending = PendingIntent.getActivity(context, 101, stockInIntent, flags);
        views.setOnClickPendingIntent(R.id.btn_stock_in, stockInPending);

        // 2. Stock OUT PendingIntent
        Intent stockOutIntent = new Intent(context, MainActivity.class);
        stockOutIntent.setAction(Intent.ACTION_VIEW);
        stockOutIntent.setData(Uri.parse("stockly://stock?type=OUT"));
        stockOutIntent.putExtra("shortcut_action", "STOCK_OUT");
        stockOutIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent stockOutPending = PendingIntent.getActivity(context, 102, stockOutIntent, flags);
        views.setOnClickPendingIntent(R.id.btn_stock_out, stockOutPending);

        // 3. Barcode Scanner PendingIntent
        Intent scanIntent = new Intent(context, MainActivity.class);
        scanIntent.setAction(Intent.ACTION_VIEW);
        scanIntent.setData(Uri.parse("stockly://scan"));
        scanIntent.putExtra("shortcut_action", "SCAN_BARCODE");
        scanIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent scanPending = PendingIntent.getActivity(context, 104, scanIntent, flags);
        views.setOnClickPendingIntent(R.id.btn_widget_scan, scanPending);

        // 4. Add Product / SKU PendingIntent
        Intent addProductIntent = new Intent(context, MainActivity.class);
        addProductIntent.setAction(Intent.ACTION_VIEW);
        addProductIntent.setData(Uri.parse("stockly://add-product"));
        addProductIntent.putExtra("shortcut_action", "ADD_PRODUCT");
        addProductIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent addProductPending = PendingIntent.getActivity(context, 103, addProductIntent, flags);
        views.setOnClickPendingIntent(R.id.btn_add_product, addProductPending);

        // 5. Stat 1 Click (Products Catalog)
        Intent productsListIntent = new Intent(context, MainActivity.class);
        productsListIntent.setAction(Intent.ACTION_VIEW);
        productsListIntent.setData(Uri.parse("stockly://products"));
        productsListIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent productsListPending = PendingIntent.getActivity(context, 105, productsListIntent, flags);
        views.setOnClickPendingIntent(R.id.card_stat_products, productsListPending);

        // 6. Stat 2 Click (Low Stock List)
        Intent lowStockIntent = new Intent(context, MainActivity.class);
        lowStockIntent.setAction(Intent.ACTION_VIEW);
        lowStockIntent.setData(Uri.parse("stockly://products?filter=low"));
        lowStockIntent.putExtra("shortcut_action", "LOW_STOCK");
        lowStockIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent lowStockPending = PendingIntent.getActivity(context, 106, lowStockIntent, flags);
        views.setOnClickPendingIntent(R.id.card_stat_low, lowStockPending);

        // 7. Stat 3 Click (Stock History Ledger)
        Intent historyIntent = new Intent(context, MainActivity.class);
        historyIntent.setAction(Intent.ACTION_VIEW);
        historyIntent.setData(Uri.parse("stockly://stock/history"));
        historyIntent.putExtra("shortcut_action", "HISTORY");
        historyIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent historyPending = PendingIntent.getActivity(context, 107, historyIntent, flags);
        views.setOnClickPendingIntent(R.id.card_stat_moves, historyPending);

        // 8. Header / Sync Click (Open App Home)
        Intent homeIntent = new Intent(context, MainActivity.class);
        homeIntent.setAction(Intent.ACTION_VIEW);
        homeIntent.setData(Uri.parse("stockly://home"));
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent homePending = PendingIntent.getActivity(context, 100, homeIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_header, homePending);
        views.setOnClickPendingIntent(R.id.btn_widget_sync, homePending);

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
