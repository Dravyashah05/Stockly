# Stockly

Stockly provides a dedicated mobile inventory app, responsive inventory
website, and owner console. They share one authenticated backend and the
existing Google Sheets data integration. Architecture details are in
[`docs/STRUCTURE.md`](docs/STRUCTURE.md); setup for auth, devices, and admin is
in [`docs/`](docs/).

## Requirements

- Node.js 22 or newer (Vite 8)
- Android Studio/SDK and Java 21 for native Android builds
- Existing Google Apps Script deployment and its Google Sheet for live data

## Install and develop

Install repository dependencies once, then run each service in its own shell:

```sh
npm install
npm --prefix server ci   # server has its own lockfile and private runtime deps
npm run dev:server       # shared backend, http://localhost:5000
npm run dev:user         # mobile app browser frontend, http://localhost:3001
npm run dev:website      # website frontend, http://localhost:3003
npm run dev:admin        # owner console, http://localhost:3002
npm run dev:all          # start the backend and all three frontends together
```

On Windows, double-click [`run-all.bat`](run-all.bat) to start the same four
services in one command window. Press Ctrl+C to stop them.

The app, website, and admin Vite servers proxy `/api/*` to the one backend.
Set `STOCKLY_API_URL` if the backend is not at `http://localhost:5000`.
For separate deployments, set public `VITE_API_BASE_URL` to the shared backend
origin in each frontend's build environment. Do not place credentials or
private tokens in any `VITE_*` variable.

## Build and validate

```sh
npm run build:user       # mobile-app/dist
npm run build:mobile     # independently build the mobile app browser frontend
npm run build:website    # website/dist
npm run build:admin      # admin/dist
npm run build:app        # alias for mobile-app/dist
npm run cap:sync         # sync Android project from mobile-app/dist
npm run android:build    # build the app bundle and sync Android
npm test                 # backend and compatibility tests
npm run lint             # repository lint
npm --prefix server run typecheck
```

Each frontend has its own package manifest and lockfile. Install and build one
in isolation with `npm --prefix mobile-app ci && npm --prefix mobile-app run build`, or the
same `ci`/`build` commands for `website` and `admin`.

For a native APK, open `mobile/android` in Android Studio or run from the
repository root:

```powershell
Set-Location mobile/android
.\gradlew.bat assembleDebug
```

The generated debug APK is under
`mobile/android/app/build/outputs/apk/debug/app-debug.apk`. A release APK
requires release signing configuration.

## Google Sheets and authentication

The backend and Google Apps Script sources remain in `api/`, `server/`, and
`apps-script/`. Copy `server/.env.example` to `server/.env` for local private
backend settings, then configure the existing Apps Script deployment and
linked sheet as described in [`docs/auth-setup.md`](docs/auth-setup.md),
[`docs/device-linking.md`](docs/device-linking.md), and
[`docs/admin-setup.md`](docs/admin-setup.md). Existing data and schema are
preserved; setup does not reset user sheets.

## Deployment

- Build and deploy `mobile-app/dist`, `website/dist`, and `admin/dist` as separate
  static frontends.
- Deploy `server/` to a long-running Node host using its private environment
  settings, or deploy the canonical `api/*.ts` handlers to Vercel as serverless
  functions. Do not run a second API implementation.
- Configure each frontend with the same public backend origin, or configure
  its host to proxy `/api/*` to the shared backend.
- Build and publish Android independently with Capacitor/Gradle.

Root `src/`, root HTML entries, and root Vite configurations are retained for
legacy landing/store compatibility during migration. See
[`docs/STRUCTURE.md`](docs/STRUCTURE.md) before changing or removing them.

## Releases

The GitHub Actions release workflow builds the website and, when a new app
version is tagged, the Android APK. Keep `package.json` and
`mobile/android/app/build.gradle` version values aligned. Signing secrets and
release steps are documented in `.github/workflows/release.yml` and the
repository Actions settings.
