# Stockly device linking (Stockly-to-Stockly, WhatsApp-Web-style)

Link additional phones/tablets to the same Stockly account. There is no
WhatsApp integration anywhere in this feature — “WhatsApp Web” is only the
UX inspiration (primary device shows a code, second device scans/enters it,
primary approves).

Do not present a code or QR as functional unless the backend below is
deployed: every code is verified server-side and every link needs primary
approval. Undeployed, the UI reports “device service not configured”
instead of faking success.

## How it works

1. **Primary device** (already signed in): Settings → Linked Devices →
   **Link a Device** → pick **QR code** (5-minute, single-use,
   full-strength token) or **linking code** (10-minute, single-use,
   8-symbol code). The screen shows live states: waiting → scanned →
   approve/reject → linked / expired / rejected.
2. **Second device**: open Stockly → **Link Existing Account** (available
   without an account) → scan the QR with the camera, upload a QR image,
   or type the code → the code is verified by the backend, then the
   second device waits for approval.
3. **Primary approves** (or rejects) the request. On approval the backend
   creates the device record and hands the second device its own session;
   the second device adopts the account (id, profile, session).
4. Manage everything in **Linked Devices**: name/platform, date linked,
   last active, current-device badge, per-device **revoke** (confirmed),
   **sign out all others**, and unlinking the current device.

Security properties (all enforced in `api/devices.ts`, never in the UI):

- Only random, unguessable, short-lived, single-use tokens; **only
  SHA-256 hashes are stored** (DeviceLinks tab). Plaintext exists only in
  the two API responses and is never logged.
- Atomic single-claim: `pending → claimed → approved`; duplicates,
  replays, and post-approval claims are rejected.
- Brute force: persistent per-link attempt counter (lockout after 5)
  **plus** per-IP rate limiting on claim/poll/create.
- Email claim alone can never link: first-device enrollment
  (`enrollPrimary`) requires a valid **auth session** and only for its own
  userId; direct enrollment is refused once an account has devices
  (`link-required`). Second devices join via the approved flow, and the
  approved link + token proof is exchanged server-side (`linkAdopt`) for a
  real auth session — never by email claim.
- Device sessions are stateless HMAC tokens (`DEVICE_SESSION_SECRET`).
  **Every** trusted-backend call re-validates the device row: revoked
  devices fail even with a once-valid token.
- Inventory writes carry `deviceId` + `deviceSession`; Apps Script
  verifies the HMAC locally and — when configured — checks revocation
  live against `/api/devices` (`validateDevice`, fail-closed).
- Sheets hold summaries + hashes only. No live tokens, linking secrets,
  or passwords anywhere. No secrets in Vite env or the client bundle.

## Google Sheets setup (private admin spreadsheet)

The `DeviceLinks` and `Devices` tabs are created automatically by
`setupSchema` on first API contact (see `docs/admin-setup.md`) — no manual
tab setup. Expected headers, for reference:

| Tab | Headers |
| --- | ------- |
| `DeviceLinks` | `linkId` `userId` `tokenHash` `method` `status` `expiresAt` `attempts` `claimant` `createdAt` `updatedAt` |
| `Devices` | `deviceId` `userId` `name` `platform` `appInfo` `status` `linkedAt` `lastActiveAt` |

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Purpose |
| --- | --- |
| `DEVICE_SESSION_SECRET` | HMAC secret for device sessions (**new, required**) |
| `AUTH_SESSION_SECRET` | HMAC secret for account sessions (required — enrollment is auth-bound) |
| `ADMIN_SCRIPT_URL`, `ADMIN_SCRIPT_TOKEN`, `ADMIN_SESSION_SECRET`, `ADMIN_SETUP_KEY` | Existing admin backend (shared by the device API) |

Redeploy after changing variables. Local `.env` files do not reach production.

## User-sheet Apps Script setup

1. Replace the code with the updated `apps-script/Code.gs` (v1.4.0+),
   run `setupDatabase` if needed (existing data untouched), redeploy.
2. Optional but recommended for revocation enforcement on inventory writes,
   run once in Apps Script:
   `setDeviceSecrets("<same-value-as-DEVICE_SESSION_SECRET>",
   "https://<your-app>.vercel.app/api/devices")`
   Secrets live in Script Properties (server-side of Google), never in the
   frontend. Without this step, writes carrying device fields get a local
   signature check only; writes without device fields keep working
   (legacy single-device setups).

## Manual verification steps

1. Deploy, open Stockly on device A, register/sign in (it auto-enrolls after auth).
   Connect a sheet when asked — linked devices share the account's verified
   sheet automatically.
2. Settings → Linked Devices → Link a Device → QR: confirm a code shows
   with a live expiry countdown; Cancel removes it.
3. On device B (fresh, no account): Link Existing Account → scan →
   “waiting for approval”; on A: Approve → B signs in as the account.
4. Negative cases: enter a wrong code 5× → locked; let a code expire →
   expired state; reuse an approved code → rejected; revoke B from A →
   B’s next protected call fails with “no longer linked”.
5. Owner: Administration → Devices → counts, per-user lookup, revoke —
   revoked device loses access (verify with step 4’s last check).

## Limitations (stated, not hidden)

- Rate limiting is per serverless instance (in-memory); the persistent
  per-link attempt counter + lockout is the hard brute-force guarantee.
- Concurrent double-claim of the same token is resolved read-check-write
  (narrow race documented; second writer loses on status).
- Inventory-path revocation is live only when `setDeviceSecrets` (with
  validate URL) was run; otherwise signature-only. Devices/API and admin
  paths always enforce revocation.
