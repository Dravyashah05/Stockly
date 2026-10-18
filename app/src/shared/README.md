# app/src/shared/ — user-app API clients

Public clients for the user frontend: `api.ts`, `auth.ts`,
`connection.ts`, `devices.ts`, response helpers (`api-response.ts`),
inventory store (`store.tsx`), account helpers (`users.ts`), release
metadata (`releases.ts`), app constants and env config (`config.ts`),
domain types (`types.ts`).

The owner `admin-api.ts` client lives ONLY in admin/src/shared/ — the
user app never imports admin APIs directly.

Rule: files here must not import from `../app/`
(keep the dependency arrow one-way: app → shared).
