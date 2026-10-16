# Shared (`src/shared/`, imported by both app and web)

Single home for everything both bundles use: API clients (`api.ts`,
`auth.ts`, `connection.ts`, `devices.ts`, `admin-api.ts`), response
helpers (`api-response.ts`), inventory store (`store.tsx`), account
helpers (`users.ts`), release metadata (`releases.ts`), app constants
and env config (`config.ts`), domain types (`types.ts`).

Rule: files here must not import from `../app/` or `../web/`
(keep the dependency arrow one-way: app → shared ← web).
