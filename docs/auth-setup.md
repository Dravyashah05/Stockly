# Stockly authentication + user-sheet setup

Server-verified identity for every account. The browser never decides who
anyone is: passwords are checked with scrypt on the server, and sessions
are HMAC tokens the frontend cannot forge.

## Method: email + password

`POST /api/auth` `register`/`login`. Passwords hashed with scrypt
(N=16384, r=8, p=1); only hashes live in the private sheet (`UserAuth`
tab). Failures answer “Incorrect email or password” whether the account
is missing or the password is wrong (no enumeration oracle).
10 attempts/minute/IP. Registration validates name, email, and password
strength (≥8 chars, letters + numbers) with field-level errors.

Sessions: 30-day HMAC (`AUTH_SESSION_SECRET`), validated on every
protected call. Logout discards the token client-side (+ server audit).
Suspended accounts are rejected at login, at app entry, and on every
inventory call.

## Private admin spreadsheet: new tabs

Created automatically by `setupSchema` (see `docs/admin-setup.md`) —
headers below are the contract reference:

| Tab | Headers |
| --- | --- |
| `UserAuth` | `userId` `email` `name` `passwordHash` `providers` `createdAt` `updatedAt` |
| `UserSheets` | `userId` `spreadsheetId` `execUrl` `status` `verifiedAt` `updatedAt` |

`passwordHash` holds scrypt hashes only — never plaintext. `execUrl` is
written only by the server verify flow, never from a frontend variable.

## Vercel environment variables (additions)

| Variable | Purpose |
| --- | --- |
| `AUTH_SESSION_SECRET` | HMAC for auth sessions (**required**) |
| `DEVICE_SESSION_SECRET` | already required for device linking |

Redeploy after changes. Never put these in `VITE_*`, never commit values.

## User-sheet connection flow (mandatory setup page)

First sign-in with no verified connection lands on **Connect Your Google
Sheet** (title/description as specified). Flow, all server-side:

1. `getConnection` reports state (session + account validated first).
2. User pastes their Apps Script `/exec` URL → `connectSheet` validates
   the format, calls `health` + `describe` on the deployment, refuses the
   private admin spreadsheet id, initializes missing tabs via the
   idempotent `setupDatabase` (never deletes data), and stores
   `{userId, spreadsheetId, execUrl, verified}` — the spreadsheet id
   comes from the deployment itself, never from the client.
3. Only `verified` enters the app. Failures stay on the page with the
   concrete fix (wrong URL kind, deployment access, missing tabs).
4. `reverify` re-checks on demand; Settings → Cloud database → Change
   sheet swaps the association (cache cleared, audit-logged).

User isolation: inventory goes through `POST /api/sheets proxy`, which
resolves the exec URL from the session's own registry row; client
`userId`/`action` overrides are stripped server-side. Reading another
user's sheet via a modified request is impossible — the URL is never
client-supplied.

## Route guards (frontend mirror; backend always re-validates)

- No session → Login. New account, no verified sheet → Connect page.
  Failed/revoked connection → repair page. Suspended → restricted page
  (main app unreachable). Admin area still needs its own admin session;
  visitors without one see Access denied.
- Any 401/403 from a protected API re-runs the gate (`stockly:forbidden`).

## Android (Capacitor) backend wiring

Installed apps have no same-origin server, so every `/api/*` call uses
`VITE_API_BASE_URL` when set (web builds ignore it and stay same-origin):

1. Deploy the backend to Vercel first (env vars + redeploy, sheets +
   `UserAuth`/`UserSheets` tabs created).
2. Set `VITE_API_BASE_URL=https://your-app.vercel.app` in your build env.
3. `npm run android:build` (build + Capacitor sync), then build the APK
   from Android Studio. Without this variable the app shows a backend
   notice on the login screen instead of failing silently.
4. First launch shows the login screen (the native splash is hidden for
   every gate phase, not just the main app).

## Manual verification steps

1. Register with email+password (weak passwords rejected with reasons;
   duplicate email → “already exists”). Sign out, sign in (wrong password
   → uniform error). Session persists across reloads; clearing storage
   returns to Login.
2. New user → Connect page (app unreachable until verified). Bad URL,
   non-/exec URL, dead deployment, non-Stockly deployment, and the admin
   sheet id each fail with a specific fix. Missing tabs are initialized,
   existing data untouched.
3. Suspend the user as owner → open app: restricted page; API calls fail
   closed. Reactivate → app works again.
4. As a second user, confirm inventory differs (separate sheets) and no
   request can address the first user's sheet.
5. Device linking still works end-to-end (see `docs/device-linking.md`);
   linked devices share the account's verified sheet automatically.

## Limitations (stated, not hidden)

- Login rate limiting is per serverless instance; uniform error messages
  prevent account enumeration regardless.
- `POST /api/sheets proxy` adds one hop of latency vs direct Apps Script
  calls; the old `api/stockly.ts` open proxy + rewrite remain deployed so
  previously shipped clients keep working, but current clients never use
  them (verified by test).
