# Shared (`shared/`, imported by every frontend)

Single home for everything the bundles share: API clients (`api.ts`,
`auth.ts`, `connection.ts`, `devices.ts`, `admin-api.ts`), response
helpers (`api-response.ts`), inventory store (`store.tsx`), account
helpers (`users.ts`), release metadata (`releases.ts`), app constants
and env config (`config.ts`), domain types (`types.ts`), and the brand
design tokens (`brand.css`).

Each frontend imports this layer through its own `src/shared/*`
re-export modules; those contain no implementation. Edit files here, not
in a frontend.

Rule: files here must not import from `../app/` or `../web/`
(keep the dependency arrow one-way: app/website/admin → shared).
