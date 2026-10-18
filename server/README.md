# `@stockly/server` — the single shared backend

One Express process (default port **5000**) that reuses the canonical
handlers in `../api/*.ts` — the exact same modules the Vercel serverless
functions call. **No business logic is duplicated here.**

## Routes (one process)

| Route | Handler | Purpose |
|---|---|---|
| `ALL /api/auth` | `api/auth.ts` | register, login, logout, me, linkAdopt |
| `ALL /api/users` | `api/auth.ts` | alias of `/api/auth` (logical user-account route) |
| `ALL /api/sheets` | `api/sheets.ts` | sheet connect/verify + inventory proxy |
| `ALL /api/inventory` | `api/sheets.ts` | alias of `/api/sheets` (logical inventory route) |
| `ALL /api/devices` | `api/devices.ts` | linking, sessions, revocation (+ owner actions) |
| `ALL /api/admin` | `api/admin.ts` | owner-only APIs (server-enforced sessions) |
| `ALL /api/stockly` | `api/stockly.ts` | legacy Apps Script proxy |
| `GET /api/health` | — | liveness probe |

Owner authorization is enforced **server-side inside the handlers** on
every request (`requireSession` in `api/admin.ts`, dual device/admin auth
in `api/devices.ts`). Frontend gating is cosmetic.

## Env (authoritative private set)

Copy `server/.env.example` → `server/.env` (or reuse the repo-root `.env`;
both are loaded, `server/.env` wins). Required:

`ADMIN_SCRIPT_URL`, `ADMIN_SCRIPT_TOKEN`, `ADMIN_SETUP_KEY`,
`ADMIN_SESSION_SECRET`, `AUTH_SESSION_SECRET`, `DEVICE_SESSION_SECRET`,
optional `ADMIN_MIRROR_SECRET`, `ADMIN_SESSION_TTL_HOURS`, `PORT`.

Never expose these via `VITE_*` variables.

## Run

```sh
npm install          # inside server/
npm run dev          # tsx watch, http://localhost:5000
```

## Vercel compatibility

A persistent Express server **cannot** run unchanged as a Vercel
serverless function. On Vercel, deploy `api/*.ts` directly (same
implementation, no changes needed). Run this Express server on any
long-lived Node host (VPS / Render / Fly.io) or for local development
while both frontends proxy `/api/*` to it.
