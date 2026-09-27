package com.stockly.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;

        String targetRoute = null;
        String action = intent.getStringExtra("shortcut_action");
        Uri data = intent.getData();

        if (action != null) {
            if ("STOCK_IN".equals(action)) {
                targetRoute = "/stock?type=IN";
            } else if ("STOCK_OUT".equals(action)) {
                targetRoute = "/stock?type=OUT";
            } else if ("ADD_PRODUCT".equals(action)) {
                targetRoute = "/products";
            }
        } else if (data != null && "stockly".equals(data.getScheme())) {
            String path = data.getPath() != null ? data.getPath() : "";
            String query = data.getQuery() != null ? "?" + data.getQuery() : "";
            targetRoute = path + query;
        }

        if (targetRoute != null && bridge != null && bridge.getWebView() != null) {
            final String route = targetRoute;
            bridge.getWebView().postDelayed(() -> {
                String js = "try { " +
                        "if (window.__stocklyNavigate) { window.__stocklyNavigate('" + route + "'); } " +
                        "else { window.location.hash = '" + route + "'; window.history.pushState({}, '', '" + route + "'); window.dispatchEvent(new PopStateEvent('popstate')); } " +
                        "} catch(e) {}";
                bridge.getWebView().evaluateJavascript(js, null);
            }, 600);
        }
    }
}
