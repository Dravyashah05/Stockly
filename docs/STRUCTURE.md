# Stockly structure — two frontends, one shared backend

```
Stockly/
├── app/                    # USER frontend (website + Android app)
│   ├── src/app/            # screens, components (dashboard, products,
│   │                       # stock in/out, history, settings, device linking)
│   ├── src/shared/         # public user API clients (auth, sheets, devices…)
│   ├── index.html          # user entry
│   ├── vite.config.ts      # dev http://localhost:3001, /api/* → :5000
│   ├── capacitor.config.ts # Android (native project in ../mobile/android)
│   ├── .env.example        # PUBLIC only: VITE_API_BASE_URL, VITE_ADMIN_URL
│   └── package.json        # dev / build / android:build
├── admin/                  # OWNER frontend (administration website)
│   ├── src/admin/          # AdminScreen (users, devices, roles, settings, logs)
│   ├── src/shared/         # public admin clients (admin-api, devices, config)
│   ├── src/components/     # shared UI primitives (copy of user ui.tsx)
│   ├── index.html          # admin entry (noindex)
│   ├── vite.config.ts      # dev http://localhost:3002, /api/* → :5000
│   ├── .env.example        # PUBLIC only: VITE_API_BASE_URL (usually empty)
│   └── package.json        # dev / build
├── server/                 # THE single shared backend (Express, port 5000)
│   ├── src/index.ts        # transport adapter ONLY — delegates to api/*
│   ├── .env.example        # AUTHORITATIVE private vars (never VITE_*)
│   └── package.json        # dev (tsx watch) / start / typecheck
├── api/                    # canonical API implementation (Vercel functions
│                           # AND the modules server/ imports — one codebase)
│   ├── auth.ts             # /api/auth (+ alias /api/users)
│   ├── sheets.ts           # /api/sheets (+ alias /api/inventory)
│   ├── devices.ts          # /api/devices (linking, sessions, revocation)
│   ├── admin.ts            # /api/admin (owner-only, server-enforced)
│   ├── stockly.ts          # /api/stockly legacy Apps Script proxy
│   ├── *-logic.ts          # pure logic (covered by tests/)
│   ├── schema.ts           # admin-sheet auto-provisioning
│   └── apps-script-client.ts # private Admin.gs bridge (server-side only)
├── apps-script/            # Google Apps Script sources (Code.gs user,
│                           # Admin.gs private admin backend)
├── mobile/                 # Capacitor native Android project + dist-app
├── tests/                  # backend logic tests (run from repo root)
└── docs/                   # setup guides + this file
```

`src/` + `index.html`/`app.html`/`store.html` at the repo root are the
pre-split legacy layout and still build (`npm run build:app`,
`npm run build:web`). New work goes into `app/`, `admin/`, `server/`.

## One shared backend

There is exactly one API implementation: `api/*.ts`. It runs two ways:

1. **Vercel** — `api/*.ts` deploy directly as serverless functions
   (same paths the frontends call: `/api/auth`, `/api/admin`,
   `/api/devices`, `/api/sheets`).
2. **Long-lived Node** — `server/` (Express) imports the same handlers
   and serves them from one process, plus logical aliases `/api/users`
   (→ auth) and `/api/inventory` (→ sheets) and `GET /api/health`.

Owner authorization is enforced server-side on every admin endpoint
(`requireSession` in `api/admin.ts`, dual device/admin auth for the
owner device actions in `api/devices.ts`). Frontend gating is cosmetic.

Database schema and user data are untouched: storage still goes through
the bound Admin.gs project (private admin spreadsheet tabs) and each
user's own spreadsheet via the sheet gateway. No migration needed.

## Environment variables

| File | Visibility | Contents |
|---|---|---|
| `server/.env` (from `.env.example`) | **private** | `ADMIN_SCRIPT_URL`, `ADMIN_SCRIPT_TOKEN`, `ADMIN_SETUP_KEY`, `ADMIN_SESSION_SECRET`, `ADMIN_MIRROR_SECRET`, `DEVICE_SESSION_SECRET`, `AUTH_SESSION_SECRET`, `ADMIN_SESSION_TTL_HOURS`, `PORT` |
| `app/.env` | public | `VITE_API_BASE_URL` (Android builds; empty = same-origin/proxy), `VITE_ADMIN_URL` (link to owner console) |
| `admin/.env` | public | `VITE_API_BASE_URL` (usually empty; same-origin/proxy) |

Notes:
- There is no `ADMIN_SPREADSHEET_ID` / Google service-account credential
  in this codebase: the private admin spreadsheet is reached via the
  bound Apps Script web app (`ADMIN_SCRIPT_URL` + `ADMIN_SCRIPT_TOKEN`),
  and user sheets via verified per-user exec URLs resolved server-side.
  The authoritative private set is exactly the list above.
- Never put private values in `VITE_*` variables — Vite embeds them in
  the browser bundle.

## Run commands

```sh
# 1) shared backend (port 5000) — start first
cd server && npm install && npm run dev

# 2) user frontend (port 3001, proxies /api/* → :5000)
cd app && npm install && npm run dev

# 3) owner frontend (port 3002, proxies /api/* → :5000)
cd admin && npm install && npm run dev
```

From the repo root (after each package is installed):

```sh
npm run dev:server   # backend :5000
npm run dev:user     # user app  :3001
npm run dev:admin    # admin site :3002
npm run build:user   # user production bundle → app/dist
npm run build:admin  # admin production bundle → admin/dist
npm test             # backend logic tests
```

Verify both frontends hit the same backend: with only `server/` running,
`curl http://localhost:5000/api/health` must return
`{"success":true,…}`, and both `:3001/api/health` and `:3002/api/health`
(Vite-proxied) must return the identical response.

## Deployment

- **Frontends deploy separately** (any static host / Vercel projects):
  `app/dist` and `admin/dist`, each with `VITE_API_BASE_URL` set to the
  shared backend origin (same value for both).
- **Backend**:
  - Vercel → deploy this repo as-is; `api/*.ts` become serverless
    functions. Do NOT deploy `server/` to Vercel.
  - VPS / Render / Fly.io / any Node host → deploy `server/`
    (`npm install && npm start`, env from `server/.env.example`).
- **Vercel runtime verdict**: a persistent Express server cannot run
  unchanged inside Vercel serverless functions (no long-lived process,
  per-invocation isolation). That is why the implementation stays in
  `api/*.ts` (serverless-compatible) and `server/` is a thin transport
  adapter over the same modules — no duplicated business logic, no
  second backend.

## Auth note

The current implementation ships **email/password** sign-in (scrypt,
server-verified, `api/auth.ts`). The `providers` field reserves a
`'google'` value but no Google OAuth flow exists in this repo — Google
identity currently enters via the sheet/device-linking paths. Both
frontends preserve this behavior unchanged.
