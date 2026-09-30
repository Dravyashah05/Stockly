package com.stockly.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int NAV_DELAY_MS = 250;
    private Runnable pendingNav;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppInstallerPlugin.class);
        super.onCreate(savedInstanceState);
        applyWindowUi();
        tuneWebView();
        handleIntent(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Flush any deep link that arrived before the bridge was ready.
        if (pendingNav != null && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(pendingNav);
            pendingNav = null;
        }
    }

    @Override
    protected void onDestroy() {
        cancelPendingNav();
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    /** Dark edge-to-edge chrome + no white flash behind the WebView. */
    private void applyWindowUi() {
        try {
            Window w = getWindow();
            if (w == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                w.setStatusBarColor(Color.parseColor("#09090B"));
                w.setNavigationBarColor(Color.parseColor("#09090B"));
            }
        } catch (Exception ignored) {}
    }

    /** Small WebView defaults that make first paint + scrolling smoother. */
    private void tuneWebView() {
        try {
            if (bridge == null || bridge.getWebView() == null) return;
            WebView webView = bridge.getWebView();
            webView.setBackgroundColor(Color.parseColor("#09090B"));
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
            WebSettings s = webView.getSettings();
            s.setDomStorageEnabled(true);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);
            s.setMediaPlaybackRequiresUserGesture(false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            }
        } catch (Exception ignored) {}
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String route = resolveRoute(intent);
        if (route == null) return;
        postNavigate(route);
    }

    private String resolveRoute(Intent intent) {
        String action = intent.getStringExtra("shortcut_action");
        if (action != null) {
            switch (action) {
                case "STOCK_IN": return "/stock?type=IN";
                case "STOCK_OUT": return "/stock?type=OUT";
                case "ADD_PRODUCT": return "/products?action=add";
                case "SCAN_BARCODE": return "/stock?action=scan";
                case "LOW_STOCK": return "/products?filter=low";
                case "HISTORY": return "/stock/history";
                default: return null;
            }
        }
        Uri data = intent.getData();
        if (data == null || !"stockly".equals(data.getScheme())) return null;
        String host = data.getHost() != null ? data.getHost() : "";
        String path = data.getPath() != null ? data.getPath() : "";
        String query = data.getQuery() != null ? "?" + data.getQuery() : "";
        switch (host) {
            case "scan": return "/stock?action=scan";
            case "add-product": return "/products?action=add";
            case "stock": return "/stock" + query;
            case "products": return "/products" + query;
            case "home": return "/home";
            default: return ("/" + host + path + query).replaceAll("^/+", "/");
        }
    }

    private void postNavigate(String route) {
        if (bridge == null || bridge.getWebView() == null) {
            // Bridge not ready yet — defer until onResume.
            pendingNav = () -> postNavigate(route);
            return;
        }
        cancelPendingNav();
        final String safeRoute = route.replace("'", "");
        final Runnable nav = () -> {
            try {
                String js = "try {"
                        + "if (window.__stocklyNavigate) { window.__stocklyNavigate('" + safeRoute + "'); }"
                        + "else { window.history.pushState({}, '', '" + safeRoute + "');"
                        + " window.dispatchEvent(new PopStateEvent('popstate')); } } catch(e) {}";
                bridge.getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {}
        };
        pendingNav = nav;
        try {
            bridge.getWebView().postDelayed(nav, NAV_DELAY_MS);
        } catch (Exception ignored) {}
    }

    private void cancelPendingNav() {
        try {
            if (pendingNav != null && bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().removeCallbacks(pendingNav);
            }
        } catch (Exception ignored) {}
        pendingNav = null;
    }
}
