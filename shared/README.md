# Shared (`shared/`, used by Android and the companion admin console)

Single home for everything the bundles share: API clients (`api.ts`,
`auth.ts`, `connection.ts`, `devices.ts`, `admin-api.ts`), response
helpers (`api-response.ts`), inventory store (`store.tsx`), account
helpers (`users.ts`), release metadata (`releases.ts`), app constants
and env config (`config.ts`), domain types (`types.ts`), and the brand
design tokens (`brand.css`).

The Android app and retained admin console import this layer through their
own `src/shared/*` re-export modules; those contain no implementation. Edit
files here, not in a frontend.

Rule: files here must not import from a UI directory (keep the dependency
arrow one-way: frontend → shared).
