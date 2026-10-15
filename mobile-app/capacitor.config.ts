import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockly.inventory',
  appName: 'Stockly',
  // Mobile frontend bundle built by this package's `build` script (outDir `dist`).
  // The native project lives in ../mobile (shared with the repo root).
  webDir: 'dist',
  backgroundColor: '#f7f7f2',
  android: {
    path: '../mobile/android',
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
