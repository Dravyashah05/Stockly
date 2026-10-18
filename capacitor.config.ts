import { existsSync, readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

/* Capacitor configuration for the Stockly Android app.
 *
 * webDir    — mobile-only bundle from `npm run build:mobile` (root script).
 * android   — native project at apps/mobile/android (root script `cap:sync`).
 *
 * STOCKLY_LOCAL_API=1 (dev only, from the root .env or the shell):
 *   allows http traffic + an http origin so an emulator build can reach a
 *   development backend on the host machine (http://10.0.2.2:PORT).
 *   Production builds must keep https and never set this switch.
 *   Only this single non-secret switch is read from .env here; no secrets
 *   are ever read or embedded in the native config. */
function localApiEnabled(): boolean {
  if (process.env.STOCKLY_LOCAL_API === '1') return true;
  try {
    const envPath = new URL('./.env', import.meta.url);
    if (!existsSync(envPath)) return false;
    const match = readFileSync(envPath, 'utf8').match(/^STOCKLY_LOCAL_API\s*=\s*(\S*)/m);
    return match?.[1] === '1';
  } catch {
    return false;
  }
}

const localApi = localApiEnabled();

const config: CapacitorConfig = {
  appId: 'com.stockly.inventory',
  appName: 'Stockly',
  webDir: 'apps/mobile/dist',
  backgroundColor: '#f7f7f2',
  android: {
    path: 'apps/mobile/android',
    allowMixedContent: localApi,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: localApi ? 'http' : 'https',
    cleartext: localApi,
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
