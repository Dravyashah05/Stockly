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
  backgroundColor: '#F7F7FB',
  android: {
    path: 'android',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: false,
      backgroundColor: '#F7F7FB',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F7F7FB',
    },
    Keyboard: {
      // Keep this import-free for Capacitor's config loader while satisfying
      // the plugin's string-enum TypeScript definition.
      resize: 'native' as import('@capacitor/keyboard').KeyboardResize,
      resizeOnFullScreen: true,
    },
  },
};

export default config;
