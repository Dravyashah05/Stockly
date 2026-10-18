# Stockly — Production Inventory Management Platform

A modern, production-grade inventory management platform featuring an **iOS 26 Liquid Glass** design aesthetic, built for high-performance multi-platform deployment:
- **Dedicated Android Mobile App** (`apps/mobile` packaged with Capacitor 8)
- **Dedicated Responsive Website & Web Application** (`apps/website` with desktop/tablet/mobile layouts)
- **Unified Shared Backend Service** (`server/` Express process + `api/` canonical routes)
- **Single Root `.env` Configuration** (the sole source of local development settings with strict server/client boundary)
- **Google Sheets Cloud Database** (atomic transactions, script locks, idempotency, and private administrative registry)
- **Shared Modular Packages** (`packages/shared-types`, `packages/shared-validation`, `packages/shared-client`, `packages/ui`)

---

## Table of Contents

1. [Architecture & Clean Directory Structure](#1-architecture--clean-directory-structure)
2. [Mandatory Single Root `.env` Configuration](#2-mandatory-single-root-env-configuration)
3. [Developer Quick Start & Run Commands](#3-developer-quick-start--run-commands)
4. [Android Mobile Application & APK Build](#4-android-mobile-application--apk-build)
5. [Responsive Website & Web Inventory Application](#5-responsive-website--web-inventory-application)
6. [Shared Backend & API Specifications](#6-shared-backend--api-specifications)
7. [Authentication & Session Security](#7-authentication--session-security)
8. [Google Sheets Cloud Database Setup (`Code.gs`)](#8-google-sheets-cloud-database-setup-codegs)
9. [Owner / Administrator Console & Private Registry (`Admin.gs`)](#9-owner--administrator-console--private-registry-adimgs)
10. [Device Linking (Stockly-to-Stockly Pairing)](#10-device-linking-stockly-to-stockly-pairing)
11. [iOS 26 Liquid Glass UI Component Library (`@stockly/ui`)](#11-ios-26-liquid-glass-ui-component-library-stocklyui)
12. [Testing & Quality Assurance](#12-testing--quality-assurance)

---

## 1. Architecture & Clean Directory Structure

Stockly is organized as a clean, modular TypeScript monorepo with strict separation of concerns:

```text
Stockly/
├── .env                                # The sole authoritative local configuration file
├── .env.example                        # Template for required environment variables
├── package.json                        # Root npm workspace definitions and orchestration scripts
├── package-lock.json                   # Deterministic lockfile across all workspaces
├── tsconfig.json                       # Monorepo TypeScript project references
├── tsconfig.base.json                  # Strict shared compiler settings
├── tsconfig.node.json                  # Node tooling compiler configuration
├── vercel.json                         # Vercel deployment routing and headers
├── capacitor.config.json               # Native Capacitor metadata for Android builds
│
├── apps/
│   ├── mobile/                         # Mobile application (Vite + Capacitor 8 + React 19)
│   │   ├── android/                    # Android Studio Gradle project (appId: com.stockly.inventory)
│   │   ├── src/
│   │   │   ├── screens/                # Mobile views (HomeScreen, ProductsScreen, HistoryScreen,
│   │   │   │                           # SettingsScreen, AuthScreen, ScannerScreen, LinkedDevicesScreen)
│   │   │   └── components/             # Mobile controls, tactile sheets, and safe-area wrappers
│   │   ├── index.html                  # Mobile web shell entry point
│   │   ├── vite.config.ts              # Mobile Vite configuration (port 3001)
│   │   └── package.json
│   │
│   └── website/                        # Responsive Website & Desktop Web Application
│       ├── src/
│       │   ├── web/                    # Desktop/tablet inventory management suite
│       │   │   ├── WebApp.tsx          # Top-level shell with persistent navigation & shortcuts
│       │   │   ├── WebDashboard.tsx    # 5 KPI cards, replenishment alerts, activity feed
│       │   │   ├── WebProducts.tsx     # Full data table with sorting, category filter, and search
│       │   │   ├── WebProductModal.tsx # Product create/edit modal with validation
│       │   │   ├── WebStockModal.tsx   # Instant Stock In / Stock Out calculation modal
│       │   │   ├── WebHistory.tsx      # Audit trail ledger with CSV export
│       │   │   ├── WebDevices.tsx      # Linked device pairing & QR code modal
│       │   │   ├── WebSettings.tsx     # Connection diagnostics, themes, & sync settings
│       │   │   ├── WebAuth.tsx         # Desktop-native authentication view
│       │   │   └── WebSheetSetup.tsx   # Desktop-native Google Sheet connection gate
│       │   ├── site/                   # High-conversion marketing showcase
│       │   └── admin/                  # Super-admin console
│       ├── index.html                  # Website entry point
│       ├── app.html                    # Deep-link redirect to /#/app
│       ├── store.html                  # Dedicated App Store APK download page
│       ├── vite.config.ts              # Website Vite configuration (port 5173)
│       └── package.json
│
├── server/                             # Unified Node.js / Express Backend (Port 5000)
│   ├── src/
│   │   ├── env.ts                      # Strict environment schema validator (anchored to root .env)
│   │   └── index.ts                    # Express server entry point with CORS & rate-limiting
│   ├── tsconfig.json
│   └── package.json
│
├── api/                                # Canonical API implementation (shared by Express and Vercel)
│   ├── auth.ts                         # /api/auth (+ alias /api/users)
│   ├── auth-logic.ts                   # Scrypt password hashing & session token logic
│   ├── sheets.ts                       # /api/sheets (+ alias /api/inventory)
│   ├── devices.ts                      # /api/devices (linking, sessions, revocation)
│   ├── device-logic.ts                 # Pairing token hashes, rate-limiting, and claims
│   ├── admin.ts                        # /api/admin (owner-only, server-enforced)
│   ├── admin-logic.ts                  # Admin session verification and user registry
│   ├── stockly.ts                      # Legacy Apps Script proxy
│   ├── schema.ts                       # Admin spreadsheet auto-provisioning
│   └── apps-script-client.ts           # Private Admin.gs bridge (server-side only)
│
├── packages/
│   ├── shared-types/                   # Domain models (Product, Transaction, User, Device)
│   ├── shared-validation/              # Form & API schemas with user-friendly error messages
│   ├── shared-client/                  # Client-side store, offline caching, and network hooks
│   └── ui/                             # iOS 26 Liquid Glass component library & design tokens
│
├── apps-script/
│   ├── Code.gs                         # Atomic user inventory Google Sheet backend
│   └── Admin.gs                        # Dedicated administrative registry & audit logger
│
├── scripts/
│   ├── build-apk.mjs                   # Cross-platform Android Gradle builder
│   ├── release-info.mjs                # APK badging and release metadata extractor
│   └── vite.stockly-proxy.ts           # Development proxy for Google Apps Script redirects
│
└── tests/                              # Node test runner backend test suite (82 passing tests)
    ├── auth.test.ts
    ├── admin-auth.test.ts
    ├── device-link.test.ts
    ├── api-response.test.ts
    ├── releases.test.ts
    └── user-registry.test.ts
```

---

## 2. Mandatory Single Root `.env` Configuration

All local development configuration resides exclusively in the root `.env` file. Subdirectories do not contain detached `.env` files.

### Configuration Template (`.env.example`)

```ini
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:3002

# Server-Only Secrets (NEVER leaked to clients or bundled into Vite builds)
AUTH_SESSION_SECRET=dev_session_secret_change_in_production_min_32_chars!
ADMIN_SESSION_SECRET=dev_admin_secret_change_in_production_min_32_chars!
ADMIN_SETUP_KEY=dev_setup_key_replace_with_strong_secret
DEVICE_SESSION_SECRET=dev_device_session_secret_min_32_chars!
ADMIN_SCRIPT_URL=https://script.google.com/macros/s/.../exec
ADMIN_SCRIPT_TOKEN=your-admin-script-secret-token
ADMIN_MIRROR_SECRET=optional-signed-status-secret
ADMIN_SESSION_TTL_HOURS=12

# Google Sheets & Apps Script Integration
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec

# Client Public Flags (Safe to expose via VITE_*)
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_NAME=Stockly
VITE_ENABLE_ADMIN=true
```

### Security Boundary Enforcement
- The root `.env` is loaded server-side by `server/src/env.ts`, which validates required variables at startup and rejects unknown formats.
- Vite configurations (`apps/website/vite.config.ts` and `apps/mobile/vite.config.ts`) inspect public environment variables at build time. If any variable containing `SECRET`, `KEY`, `TOKEN`, or `PASSWORD` is prefixed with `VITE_`, the build terminates immediately to prevent secret leakage.

---

## 3. Developer Quick Start & Run Commands

### Prerequisites
- **Node.js**: v20.0.0 or later (Node 22+ recommended)
- **npm**: v10.0.0 or later
- **Java JDK**: 17 or 21 (required for Android APK compilation)
- **Android SDK**: Build-Tools & Platform `android-36` (located at `%LOCALAPPDATA%\Android\Sdk` on Windows)

### 1. Install Dependencies
```bash
npm install
```

### 2. Development Execution
Run all applications and services simultaneously, or launch specific targets:

```bash
# Run everything concurrently (backend + website + mobile shell)
npm run dev

# Or run individual services:
npm run dev:server      # Shared Express backend at http://localhost:5000
npm run dev:website     # Responsive Website & App at http://localhost:5173
npm run dev:mobile      # Mobile shell preview at http://localhost:3001
```

### Access Points
| Interface | URL | Description |
| :--- | :--- | :--- |
| **Marketing Landing Page** | `http://localhost:5173/#/` | Features overview, live stats, APK download CTAs |
| **Web Inventory Application** | `http://localhost:5173/#/app` | Desktop-optimized inventory workspace |
| **Owner Admin Console** | `http://localhost:5173/#/admin` | User accounts, device audit logs, platform settings |
| **APK App Store Page** | `http://localhost:5173/store.html`| Release download and installation instructions |
| **Mobile Web Shell** | `http://localhost:3001/` | Mobile viewport simulator for mobile screens |
| **Backend Health Check** | `http://localhost:5000/api/health`| Server liveness probe |

---

## 4. Android Mobile Application & APK Build

The Android application is packaged using **Capacitor 8** targeting Android 16 (API level 36) with full edge-to-edge rendering, safe-area inset protection, and hardware back button stack management.

### Build the Debug APK

```bash
npm run android:build
```

This single command executes the complete production pipeline:
1. Compiles the mobile web bundle (`apps/mobile/dist`).
2. Synchronizes web assets and native Capacitor plugins into `apps/mobile/android/`.
3. Invokes Gradle (`gradlew.bat assembleDebug` or `./gradlew assembleDebug`).

**Output APK:**
```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### Install onto an Emulator or Device

```bash
# Install the APK via Android Debug Bridge
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

# Launch the Stockly MainActivity
adb shell am start -n com.stockly.inventory/.MainActivity
```

### Safe-Area & Hardware Integration
- **Status Bar & Cutout Padding**: Screens declare `calc(env(safe-area-inset-top, 0px) + 1.5rem)` ensuring no header overlap with status bar clocks or camera holes.
- **Hardware Back Button**: `useDismissable` registers stacked modal overlays with Capacitor's native `backButton` listener, dismissing dialogs sequentially before exiting the application.

---

## 5. Responsive Website & Web Inventory Application

Located in [`apps/website/`](file:///c:/Users/dravy_qci9mn7/OneDrive/Desktop/Stockly/apps/website), the website serves as both the public marketing showcase and a desktop-first inventory workspace.

### Key Web Features
- **Persistent Sidebar Navigation**: Fast switching between Overview, Products, Stock In/Out, History, Devices, and Settings.
- **5 KPI Overview Cards**: Real-time counts for Total Products, Total Units in Stock, Low Stock Alerts, Out of Stock Items, and Total Valuation.
- **Dense Product Data Grid**: Search filter, category dropdown, stock status filters, sorting, and inline edit actions.
- **Product Modal**: Add and edit products with instant validation powered by `@stockly/shared-validation`.
- **Stock Stepper Modal**: Instant before-and-after calculations preventing negative stock issues.
- **CSV Audit Export**: Export full transaction history directly to CSV for spreadsheet reporting.
- **Desktop Keyboard Shortcuts**:
  - `N`: Open Create Product modal
  - `I`: Open Stock In modal
  - `O`: Open Stock Out modal
  - `/`: Focus search input
  - `Esc`: Dismiss active modal or overlay

---

## 6. Shared Backend & API Specifications

The shared backend is powered by Node.js and Express in [`server/`](file:///c:/Users/dravy_qci9mn7/OneDrive/Desktop/Stockly/server) on port `5000`. It delegates directly to canonical handlers in [`api/`](file:///c:/Users/dravy_qci9mn7/OneDrive/Desktop/Stockly/api), allowing identical handlers to be deployed serverless (e.g., on Vercel) or inside persistent containerized environments (Render, Fly.io, VPS).

### Route Inventory

| Method | Endpoint | Handler | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth` | `api/auth.ts` | Register, login, logout, me, linkAdopt |
| `ALL` | `/api/users` | `api/auth.ts` | Alias for `/api/auth` |
| `POST` | `/api/sheets` | `api/sheets.ts` | Google Sheets connection verification and inventory proxy |
| `ALL` | `/api/inventory` | `api/sheets.ts` | Alias for `/api/sheets` |
| `ALL` | `/api/devices` | `api/devices.ts` | Device linking, approval, session validation, revocation |
| `ALL` | `/api/admin` | `api/admin.ts` | Owner bootstrap, user registry list, suspension, audit log |
| `POST` | `/api/stockly` | `api/stockly.ts` | Legacy proxy for Apps Script deployments |
| `GET` | `/api/health` | `server/src/index.ts`| Liveness check (`{ status: "ok", timestamp }`) |

---

## 7. Authentication & Session Security

- **Scrypt Password Hashing**: Passwords are hashed server-side using Node crypto `scrypt` ($N=16384, r=8, p=1$). Passwords and cleartext tokens are never stored in databases.
- **Timing-Safe Verification**: Comparisons utilize `crypto.timingSafeEqual` to eliminate timing side-channel attacks.
- **HMAC Session Tokens**: Client authentication sessions are signed with `AUTH_SESSION_SECRET` with 30-day expirations.
- **Suspension Enforcement**: Suspended users are barred at the gateway level (`requireActiveUser_`), rejecting inventory reads and writes even if the client retains an active session token.

---

## 8. Google Sheets Cloud Database Setup (`Code.gs`)

Stockly uses Google Sheets via Google Apps Script as the primary cloud database, allowing real-time multi-device sync without running an external SQL database.

### Installation Steps
1. Create a new Google Spreadsheet.
2. In Google Sheets, click **Extensions → Apps Script**.
3. Replace all editor contents with [`apps-script/Code.gs`](apps-script/Code.gs) and click **Save**.
4. In the Apps Script toolbar, select `setupDatabase` and click **Run**. This provisions all required tabs with exact schema headers:
   - `Products`: `id`, `name`, `sku`, `category`, `currentStock`, `minStock`, `costPrice`, `retailPrice`, `unit`, `updatedAt`
   - `Transactions`: `id`, `productId`, `productName`, `type`, `quantity`, `balanceBefore`, `balanceAfter`, `reason`, `reference`, `createdAt`, `userId`, `deviceId`
   - `Categories`: `name`
   - `Metadata`: Key-value application state
5. Click **Deploy → New deployment**:
   - **Type**: Web app
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
6. Copy the `/exec` URL and paste it into Stockly's **Connect Your Google Sheet** screen.

### Atomic Concurrency & Idempotency
- **Atomic Locks**: Stock In and Stock Out movements acquire `LockService.getScriptLock()` with a 30-second timeout, ensuring product stock and transaction audit logs are written atomically.
- **Idempotency Keys**: Requests carry a unique `idempotencyKey` preventing duplicate balance changes during network retries.
- **Under-Stock Prevention**: Stock Out operations verify current stock prior to decrements, safely aborting if quantity exceeds available inventory.

---

## 9. Owner / Administrator Console & Private Registry (`Admin.gs`)

The administrative database is maintained in a dedicated, private Google Sheet accessible solely by the backend.

### Setup Instructions
1. Create a second, empty Google Spreadsheet for administrative data.
2. Open **Extensions → Apps Script**, paste [`apps-script/Admin.gs`](apps-script/Admin.gs), and click **Save**.
3. In the Apps Script editor, run:
   ```javascript
   setAdminScriptToken("your-long-random-secret-admin-token");
   ```
4. Click **Deploy → New deployment → Web app** (Execute as: `Me`, Who has access: `Anyone`). Copy the `/exec` URL.
5. In your root `.env`, set:
   - `ADMIN_SCRIPT_URL`: Deployed `/exec` URL
   - `ADMIN_SCRIPT_TOKEN`: The secret token configured above
   - `ADMIN_SETUP_KEY`: A strong administrative key
   - `ADMIN_SESSION_SECRET`: HMAC signing secret for owner sessions
6. Open `http://localhost:5173/#/admin` (or Settings → Administration in the mobile app) and select **First setup**. Provide your email and `ADMIN_SETUP_KEY` to bootstrap the initial owner account.

### Schema Auto-Provisioning
On first contact, the server automatically provisions the following tabs in the private admin spreadsheet:
- `AdminUsers`: Administrative accounts and roles
- `UserRegistry`: Global registered users, verification status, and account statuses (`active`, `suspended`, `deactivated`)
- `AdminLogs`: Immutable audit logs of all administrative actions
- `AppSettings`: System-wide settings and toggles
- `DeviceLinks`: Active and historical pairing attempts
- `Devices`: Enrolled hardware devices and platform fingerprints
- `UserAuth`: Scrypt credential hashes and authentication providers
- `UserSheets`: User-to-spreadsheet bindings and verification timestamps

---

## 10. Device Linking (Stockly-to-Stockly Pairing)

Link additional phones or tablets to an existing account with zero credential sharing (inspired by the WhatsApp Web pairing flow).

### Pairing Workflow
1. **Primary Device** (signed in): Navigate to **Settings → Linked Devices → Link a Device**. Choose **QR code** (5-minute expiration) or **Linking Code** (10-minute 6-character code).
2. **Secondary Device**: Open Stockly and select **Link Existing Account**. Scan the QR code with the camera or input the 6-character code.
3. **Primary Approval**: The primary device displays the incoming pairing request with device name, platform, and timestamp. The primary user clicks **Approve**.
4. **Adoption**: The backend securely issues a signed `deviceSession` (`DEVICE_SESSION_SECRET`) to the second device, linking it to the account.
5. **Revocation**: Any device can be individually revoked or all other devices signed out at any time from the Linked Devices screen.

---

## 11. iOS 26 Liquid Glass UI Component Library (`@stockly/ui`)

The UI system in [`packages/ui/`](file:///c:/Users/dravy_qci9mn7/OneDrive/Desktop/Stockly/packages/ui) provides a unified design token architecture:
- **`GlassSurface` & `GlassCard`**: Multi-layer specular highlights with dynamic CSS backdrop filters and hardware-accelerated fallback rules.
- **`FloatingTabBar`**: Floating dock navigation with active tab animations and touch target scaling.
- **`GlassButton` & `IconButton`**: Spring press physics, keyboard focus rings (`var(--ring)`), and contrast-safe typography.
- **`GlassTextField` & `GlassSearch`**: Text inputs with clear triggers, icon slots, and inline error badges.
- **`Segmented`**: Sliding pill segmented controls for mode toggles.
- **`Toaster` & `toast()`**: Lightweight toast notifications supporting `success`, `error`, and `info` variants.

---

## 12. Testing & Quality Assurance

Stockly enforces strict validation across tests, compiler types, and code style:

```bash
# 1. Run all unit test suites (82/82 passing)
npm test

# 2. Strict TypeScript typechecking across all workspaces (0 errors)
npm run typecheck

# 3. Code linting across packages
npm run lint

# 4. Production web builds
npm run build

# 5. Production Android APK assembly
npm run android:build
```

### Verified Test Suite Breakdown (`tests/`)
- `auth.test.ts`: Scrypt hashing, password validation, user isolation, session verification.
- `admin-auth.test.ts`: Admin session tokens, role checks, replay protection, audit log redaction.
- `device-link.test.ts`: Token randomness, QR roundtrip, 6-character code normalization, lockout enforcement, revocation.
- `api-response.test.ts`: Apps Script redirect handling, CORS preflights, error categorization.
- `releases.test.ts`: Android APK badging parser, checksum validation, version consistency.
- `user-registry.test.ts`: Profile syncing, idempotency, suspension state preservation.
