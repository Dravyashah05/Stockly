import type { CapacitorConfig } from '@capacitor/cli';

// NOTE: scheme/cleartext must match the backend protocol in .env
// (VITE_API_BASE_URL), otherwise Android blocks sync:
// - http:// backend (same-WiFi LAN testing) → 'http' + cleartext true (set below)
// - https:// backend (production)          → 'https' + cleartext false
// This file must stay import-free (only `import type`): the Capacitor CLI
// loads it through a CJS interop loader that breaks on runtime imports.
const config: CapacitorConfig = {
  appId: 'com.stockly.inventory',
  appName: 'Stockly',
  // Mobile frontend bundle built by this package's `build` script (outDir `dist`).
  // Keep the native Android project alongside this mobile app.
  webDir: 'dist',
  backgroundColor: '#f7f7f2',
  android: {
    path: 'android',
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
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
