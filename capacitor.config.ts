import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.stockly.inventory',
  appName: 'Stockly',
  // App-only bundle built by `npm run build:app` (vite.config.app.ts).
  // The native project lives in mobile/ (see mobile/README.md).
  webDir: 'mobile/dist-app',
  backgroundColor: '#f7f7f2',
  android: {
    // Custom native-project location (default would be ./android).
    path: 'mobile/android',
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
      overlapped: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
