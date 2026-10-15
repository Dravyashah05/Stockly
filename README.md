# Stockly — Mobile Stock Management

A premium, mobile-first inventory app for small business: products, Stock In/Out,
low-stock alerts, transaction history, categories, and a dashboard —
with **Google Sheets as the cloud database** (via Google Apps Script) so stock
syncs across multiple devices.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Capacitor 8
(Android) + Lucide icons + Google Apps Script + Google Sheets.

---

## 1. Run the app in a browser

```bash
npm install
npm run dev        # → http://localhost:5173 (use mobile viewport / device toolbar)
```

Without a backend URL the app shows an "not connected" banner. Everything else
(cached data, themes, navigation) works.

When running under Vite, Apps Script requests pass through a local server proxy
because Apps Script `ContentService` responses redirect to a Google content
host without browser CORS headers. This proxy is development-only; a deployed
web app or Android build needs a server-side proxy with a stable URL if its
runtime cannot read Apps Script responses directly.

Useful scripts:

| Command        | What it does                              |
| -------------- | ----------------------------------------- |
| `npm run dev`  | Vite dev server                           |
| `npm run build`| Type-check (`tsc -b`) + production build |
| `npm run lint` | oxlint                                    |
| `npm run preview` | Preview the production build           |

## 2. Connect the Google Sheets database (required for real data)

The Google Sheets backend is [`apps-script/Code.gs`](apps-script/Code.gs).
Deploy the Apps Script Web App as **Execute as: Me** and **Who has access:
Anyone**, then paste its `/exec` URL into Settings. The app stores that URL on
the device and uses it for inventory reads and writes.

1. Create a Google Sheet and open **Extensions → Apps Script**.
2. Paste the full contents of `apps-script/Code.gs` and save.
3. Run `setupDatabase` once. It creates missing inventory tabs and validates
   headers without clearing existing data. `setupDemoData` is optional.
4. Deploy as a Web App and copy the URL ending in `/exec`.
5. In Stockly Settings, paste the URL and save.

Stockly does not provide user accounts, administrator management, or device
pairing. The Apps Script endpoint is public; anyone who obtains its URL can
access the connected Sheet through the inventory API. Use a Sheet and deployment
only for data you are comfortable making accessible to holders of that URL.

> **Updating the backend later:** edit `Code.gs`, then choose **Deploy → Manage
deployments → Edit → New version**. `setupDatabase` is safe to rerun; it does
not clear existing data.

### How syncing works

- Stock In/Out run inside `LockService.getScriptLock()`: the product row update
  and transaction row are written in one atomic operation.
- Each stock request carries an `idempotencyKey`; retries do not double-add.
- Stock Out is rejected when quantity exceeds available stock.
- On-device `localStorage` stores a cache, the backend URL, and theme preference.
## 3. Generate the Android APK

Prerequisites: Android Studio + SDK installed (this machine already has the SDK
at `%LOCALAPPDATA%\Android\Sdk`, incl. platform `android-36`).

```bash
npm run build          # web assets → dist/
npx cap sync android   # copy web assets + plugins into android/
```

Then either open in Android Studio:

```bash
npx cap open android   # → Build → Build APK(s)
```

or build from the command line (needs `android/local.properties` with
`sdk.dir=<path-to-your-SDK>` — already created on this machine):

```bash
cd android
.\gradlew.bat assembleDebug     # → app\build\outputs\apk\debug\app-debug.apk
.\gradlew.bat assembleRelease   # release APK (configure signing first)
```

Install `app-debug.apk` on a phone (enable *Install unknown apps*) or
`adb install -r app-debug.apk`.

> A signed release build (upload to Play / share outside the device) additionally
> needs a keystore wired into `android/app/build.gradle`. Debug APKs are signed
> with a debug key automatically.

## 4. Project layout

```
src/
  main.tsx / App.tsx        shell, bottom tabs, back-button, splash hide
  index.css                 Tailwind v4 + safe-area helpers + animations
  lib/
    config.ts               THE single API config (backend URL, currency, formats)
    api.ts                  reusable GET/POST service, timeouts, de-duplication
    types.ts                Product / Category / Transaction / Stats
    store.tsx               global state, sync, mutations, toasts, theme, offline
  components/
    ui.tsx                  Header, BottomNav, Sheet, inputs, EmptyState, Toasts
    ProductForm.tsx         add/edit product sheet with validation
  screens/
    HomeScreen.tsx          dashboard stats, value card, quick actions, alerts
    ProductsScreen.tsx      search, sort, category/status filters, CRUD
    StockSheet.tsx          Stock In / Stock Out transaction form
    HistoryScreen.tsx       transaction list + filters
    SettingsScreen.tsx      backend URL, theme, categories, sync, app settings
apps-script/
  Code.gs                   complete backend: doGet/doPost/setupDatabase/
                            setupDemoData/CRUD/stockIn/stockOut/dashboard
android/                    Capacitor native project (appId com.stockly.inventory)
capacitor.config.ts         app name/ID, splash, status bar, keyboard
```

## 5. App ID / names

- App name: **Stockly** · Android package: **`com.stockly.inventory`**
- Inventory value = Σ (current stock × cost price), computed from live data.

## 6. Remaining configuration for you

1. **Deploy `apps-script/Code.gs`** (section 2) and paste the `/exec` URL into
   Settings — the app has no data until this is done.
2. **App icon:** the launcher currently uses Capacitor's default icon. Replace
   `android/app/src/main/res/mipmap-*` + `assets/icon.png` (or run
   `npx capacitor-assets`) with your Stockly artwork.
3. **Release signing:** create a keystore and add the four `ANDROID_*` secrets
   listed in section 7 (until then releases are debug-signed).
4. **Play listing** (if publishing): privacy policy, screenshots, data-safety
   form (the app sends inventory data to *your own* Google Sheet).

## 7. Releasing Stockly (automated)

Pushing to `main` runs `.github/workflows/release.yml`: lint → type-check →
tests → website build → (only for a **new** version) Android APK → GitHub
Release. Normal pushes stay green without publishing anything.

**To cut a release**, bump the version in **both** places and push:

| File | Field | Example |
| ---- | ----- | ------- |
| `package.json` | `version` | `1.1.0` |
| `android/app/build.gradle` | `versionName` | `"1.1.0"` |
| `android/app/build.gradle` | `versionCode` | `2` (always increase, never reset) |

The workflow fails fast if the names differ or the tag already exists. Each
release publishes `stockly-<version>.apk` + `SHA256SUMS.txt` + `release.json`
(machine-readable metadata: version, code, size, checksum, notes, commit) and
links them from the release notes.

**Where releases surface (no committed APKs):**
- Website store section (`index.html#store`) and dedicated App Store page
  (`/app-store`) read a static `public/release.json` first (refreshed by the
  release workflow on every publish), falling back to the live GitHub
  Releases API.
- Settings → App update in the installed app uses the same source.
- The website itself deploys automatically through the existing Vercel Git
  integration — no tokens or extra steps needed.

**Release signing secrets** (repo Settings → Secrets and variables → Actions;
values are never printed in logs — without them the APK is debug-signed and
labeled as such, which is fine for sideloading but uses a different
certificate than a future store key, so keep using one keystore forever):
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`.

Verify a release locally any time with `node scripts/release-info.mjs check`.
