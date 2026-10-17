# Stockly for Android

Stockly is an Android inventory app built with React, TypeScript, Vite, and Capacitor 8. The Android interface uses a Google Pixel inspired Material 3 system. Inventory data, authentication, Google Sheets access, synchronization, and device linking use the existing shared backend and Apps Script integration.

## Requirements

- Node.js 22 or newer
- Java 21
- Android Studio and Android SDK platform/build tools 36
- A deployed Stockly API using the handlers in `api/`, plus its existing Apps Script and Google Sheet configuration

## Develop

Install the root and backend dependencies once:

```sh
npm ci
npm --prefix server ci
npm run dev:server
```

In another terminal, run the Android React UI in the browser for quick iteration:

```sh
npm run dev:mobile
```

For local API development, the mobile Vite server proxies `/api/*` to `http://localhost:5000`. This proxy is only for browser development. A physical Android build must use the public HTTPS backend origin in `mobile-app/.env`:

```dotenv
VITE_API_BASE_URL=https://your-stockly-api.example
```

Do not use `localhost` or put private credentials in `VITE_*` variables. Android release builds use HTTPS and do not allow cleartext traffic.

## Build and install a debug APK

From the repository root:

```sh
npm run android:build
```

This type-checks and builds the Android UI, syncs Capacitor plugins/assets, and runs Gradle `assembleDebug`. The APK is written to:

```text
mobile-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a connected device with Android Debug Bridge:

```sh
adb install -r mobile-app/android/app/build/outputs/apk/debug/app-debug.apk
```

To open the native project in Android Studio, run `npm run cap:open`.

## Validate

```sh
npm run build             # Android React production bundle + TypeScript check
npm run lint
npm test                  # shared API/auth/device/server compatibility tests
npm --prefix server run typecheck
```

## Backend and Google Sheets

`api/` contains the canonical API handlers, `server/` is the Express adapter, and `apps-script/` contains the existing Google Sheets integration. Keep API credentials and setup secrets on the backend. Setup and recovery instructions are in [`docs/auth-setup.md`](docs/auth-setup.md), [`docs/device-linking.md`](docs/device-linking.md), and [`docs/admin-setup.md`](docs/admin-setup.md). The owner administration tools are part of Android Settings and continue to use the server-authorized `/api/admin` and `/api/devices` endpoints.

The Vercel configuration keeps the `/__stockly_api` rewrite for the canonical `api/*.ts` handlers. No customer website deployment is required to build or run Android. Owner tools are available inside Android Settings; the duplicate standalone owner frontend and legacy root HTML/Vite entries remain pending explicit approval for destructive removal and are not part of the Android APK build.

See [`docs/STRUCTURE.md`](docs/STRUCTURE.md) and [`docs/ANDROID_ONLY_AUDIT.md`](docs/ANDROID_ONLY_AUDIT.md) for the dependency map and cleanup decisions.
