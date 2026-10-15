# Stockly private-admin setup (owner only)

The private admin spreadsheet is NEVER accessed by the frontend. Only the
bound Apps Script project (`apps-script/Admin.gs`) touches it, called
server-to-server by the Vercel API routes with a shared token. Credentials
live in Vercel environment variables and Apps Script Properties (never
`VITE_*`, never committed files).

## 1. Create the private admin spreadsheet + script

1. Create a NEW Google spreadsheet (it can be completely **empty**).
2. Open Extensions → Apps Script, paste `apps-script/Admin.gs`, Save.
3. In the editor, run once:
   `setAdminScriptToken("a-long-random-secret-also-saved-as-ADMIN_SCRIPT_TOKEN")`
   (stored in Script Properties — never in code, never in the frontend).
4. Deploy → New deployment → Web app → Execute as: Me, Who has access:
   Anyone → Deploy → copy the `/exec` URL.
5. On the first API call, `setupSchema` creates every tab below
   automatically with exact headers; existing tabs and rows are never
   modified. The table is the contract reference (see `api/schema.ts`):

| Tab | Headers |
| --- | ------- |
| `AdminUsers` | `adminId` `email` `role` `status` `createdAt` `updatedAt` |
| `UserRegistry` | `userId` `name` `email` `accountStatus` `registeredAt` `lastLoginAt` `updatedAt` |
| `AdminLogs` | `logId` `adminId` `action` `targetUserId` `previousValue` `newValue` `timestamp` |
| `AppSettings` | `key` `value` `updatedAt` |
| `DeviceLinks` | `linkId` `userId` `tokenHash` `method` `status` `expiresAt` `attempts` `claimant` `createdAt` `updatedAt` |
| `Devices` | `deviceId` `userId` `name` `platform` `appInfo` `status` `linkedAt` `lastActiveAt` |
| `UserAuth` | `userId` `email` `name` `passwordHash` `providers` `createdAt` `updatedAt` |
| `UserSheets` | `userId` `spreadsheetId` `execUrl` `status` `verifiedAt` `updatedAt` |

3. Leave all rows empty. The API creates tabs and rows itself.
4. Do NOT store passwords, session tokens, or API keys in any tab.

## 2. Vercel environment variables

Vercel → Project → Settings → Environment Variables (Production + Preview),
then **Redeploy** (env changes need a new deployment):

| Variable | Value |
| --- | --- |
| `ADMIN_SCRIPT_URL` | `/exec` URL of the deployed Admin.gs web app |
| `ADMIN_SCRIPT_TOKEN` | same secret passed to `setAdminScriptToken` |
| `ADMIN_SETUP_KEY` | long random string (owner bootstrap + admin login factor) |
| `ADMIN_SESSION_SECRET` | long random string (HMAC for admin session tokens) |
| `ADMIN_MIRROR_SECRET` | long random string (signed status envelopes; optional but recommended) |
| `DEVICE_SESSION_SECRET` | long random string (HMAC for linked-device sessions; required for device linking) |
| `AUTH_SESSION_SECRET` | long random string (HMAC for account sessions; required) |
| `ADMIN_SESSION_TTL_HOURS` | e.g. `12` (optional) |

No Google Cloud service account is needed — the bound script runs with
your own Google authorization. Hiding the script URL is NOT security —
the server token plus your deployment's access control are.

## 3. User sheet (existing app database)

1. Open the existing user/inventory Google Sheet → Extensions → Apps Script.
2. Replace the code with the updated `apps-script/Code.gs` from this repo.
3. Run `setupDatabase` once (creates the new `Users` tab alongside the
   existing inventory tabs — existing data is untouched).
4. Deploy → New deployment → Web app → Execute as: Me, access: Anyone.
5. Optional status-mirror hardening:
   - Generate the `ADMIN_MIRROR_SECRET` value (same string as Vercel env above).
   - In Apps Script run `setSyncSecret("<same-string>")` once. It is stored in
     Script Properties (server-side of Google), never in code or the frontend.

## 4. First owner setup (one-time, secure)

1. Open Stockly → Settings → Administration.
2. Choose **First setup**, enter the owner email + the `ADMIN_SETUP_KEY`, submit.
3. The API creates the `owner` row + audit entry and returns a session token.
4. Bootstrap is then permanently disabled while any admin exists
   (`The owner is already set up`).
5. The first registered app user is NEVER made owner automatically.

## 5. Syncing existing users (no blind overwrites)

- New registrations sync automatically (upsert by stable `userId`; existing
  `accountStatus` is never overwritten by sync).
- For users registered before this update: sign in as owner → Users tab shows
  synced rows; use the `backfill` API action (or re-login on each device,
  which re-syncs) to enroll them. Re-running backfill never resets statuses.

## 6. Authoritative split

- User spreadsheet `Users` tab → authoritative for PROFILE (name, email).
- Admin spreadsheet → authoritative for STATUS, ROLES, SETTINGS.
- Suspension is enforced in the Apps Script backend (`requireActiveUser_`)
  on every write carrying a `userId`, not just hidden in the UI.
