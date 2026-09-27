package com.stockly.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
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

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.stockly_app_widget);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
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

        // 3. New Product / Catalog PendingIntent
        Intent productIntent = new Intent(context, MainActivity.class);
        productIntent.setAction(Intent.ACTION_VIEW);
        productIntent.setData(Uri.parse("stockly://products"));
        productIntent.putExtra("shortcut_action", "ADD_PRODUCT");
        productIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent productPending = PendingIntent.getActivity(context, 103, productIntent, flags);
        views.setOnClickPendingIntent(R.id.btn_products, productPending);

        // 4. Header Click (Open App Home)
        Intent homeIntent = new Intent(context, MainActivity.class);
        homeIntent.setAction(Intent.ACTION_VIEW);
        homeIntent.setData(Uri.parse("stockly://home"));
        homeIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent homePending = PendingIntent.getActivity(context, 100, homeIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_header, homePending);

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
