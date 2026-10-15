# mobile-app/src/shared/ — customer API clients

Public clients for the user frontend: `api.ts`, `auth.ts`,
`connection.ts`, `devices.ts`, response helpers (`api-response.ts`),
inventory store (`store.tsx`), account helpers (`users.ts`), release
metadata (`releases.ts`), app constants and env config (`config.ts`),
domain types (`types.ts`).

The owner `admin-api.ts` client lives ONLY in admin/src/shared/ — the
user app never imports admin APIs directly.

Rule: shared modules must not import UI files from `../app/`;
frontend UI consumes this data and API layer.
