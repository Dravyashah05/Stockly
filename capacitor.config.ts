import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: scheme/cleartext must match the backend protocol in
// mobile-app/.env (VITE_API_BASE_URL), otherwise Android blocks sync:
// - http:// backend (same-WiFi LAN testing) → 'http' + cleartext true (set below)
// - https:// backend (production)          → 'https' + cleartext false
// This file must stay import-free (only `import type`): the Capacitor CLI
// loads it through a CJS interop loader that breaks on runtime imports.
const config: CapacitorConfig = {
  appId: 'com.stockly.inventory',
  appName: 'Stockly',
  // The mobile frontend builds this app-only bundle in mobile-app/dist.
  webDir: 'mobile-app/dist',
  backgroundColor: '#f7f7f2',
  android: {
    // Custom native-project location (default would be ./android).
    path: 'mobile-app/android',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#F7F7F2',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#f7f7f2',
      overlapped: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
