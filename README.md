# Stockly — Mobile Stock Management

A premium, mobile-first inventory app for small business: products, Stock In/Out,
low-stock alerts, transaction history, categories, suppliers, and a dashboard —
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

The backend is **one file**: [`apps-script/Code.gs`](apps-script/Code.gs).
No API keys or secrets live in the app — the Web-App URL is public-by-design
(access is enforced inside the script + your Sheet's sharing settings).

1. **Create a Google Sheet** (any name, e.g. `Stockly DB`).
2. Open **Extensions → Apps Script**, delete the default code, paste the full
   contents of `apps-script/Code.gs`, and **Save**.
3. In the Apps Script toolbar, run **`setupDatabase`** once
   (authorise with your Google account when asked). This creates the tabs:
   `Products`, `Categories`, `Suppliers`, `StockTransactions`, `Settings`.
4. Optionally run **`setupDemoData`** to insert sample categories, suppliers
   and products.
5. **Deploy → New deployment → type: Web app** with:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Click **Deploy** and copy the Web-App URL (`https://script.google.com/macros/s/…/exec`).
6. Open **Stockly → Settings → Cloud database**, paste the URL, tap
   **Save & sync**. Repeat step 6 on every device — all phones share the same Sheet.

The URL is stored in the current app/browser’s `localStorage` key
`stockly.apiUrl`; Vercel domains and local development origins have separate
settings. Use the deployed Web App URL ending in `/exec`, not an Apps Script
editor URL or `/dev` test URL.

> **Updating the backend later:** edit `Code.gs`, then
> **Deploy → Manage deployments → Edit → New version**. The URL stays the same.
> (The app now fetches everything via a single `sync` call — redeploy to enable
> it; older deployments keep working through an automatic fallback.)
>
> **Backend troubleshooting:** if the Web App shows an error instead of data —
> 1. In Apps Script, run **`diagnose`** and check it names your spreadsheet.
> 2. If the script is standalone (not created inside the Sheet), run
>    **`configureSpreadsheet("PASTE_SHEET_ID_HERE")`** once, then redeploy.
> 3. Re-run **`setupDatabase`** — it only ever writes headers to empty tabs and
>    will refuse (with an explicit message) rather than touch tabs holding data.
> 4. In **Deploy → Manage deployments**, confirm the active version includes your
>    latest code and access is still **Anyone**.

### How syncing stays safe

- Every write is validated server-side; responses are always
  `{ success: true, data }` or `{ success: false, error }`.
- **Stock In/Out** run inside `LockService.getScriptLock()`: the product row
  update and the transaction row are written in **one atomic operation**, so two
  phones updating at once can't corrupt stock.
- Each stock request carries an **`idempotencyKey`** — retried requests return
  the original result instead of double-adding.
- Stock Out is rejected when quantity exceeds available stock; negative stock
  is impossible.
- On-device `localStorage` is **only a cache** (last synced snapshot) plus the
  backend URL and theme. The app never treats it as the source of truth and
  never shows a success message unless the server confirms.

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
    types.ts                Product / Category / Supplier / Transaction / Stats
    store.tsx               global state, sync, mutations, toasts, theme, offline
  components/
    ui.tsx                  Header, BottomNav, Sheet, inputs, EmptyState, Toasts
    ProductForm.tsx         add/edit product sheet with validation
  screens/
    HomeScreen.tsx          dashboard stats, value card, quick actions, alerts
    ProductsScreen.tsx      search, sort, category/status filters, CRUD
    StockScreen.tsx         Stock In / Stock Out forms
    HistoryScreen.tsx       transaction list + filters
    SettingsScreen.tsx      backend URL, theme, categories, suppliers, guide
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
3. **Release signing:** create a keystore + `signingConfigs` before publishing.
4. **Play listing** (if publishing): privacy policy, screenshots, data-safety
   form (the app sends inventory data to *your own* Google Sheet).
