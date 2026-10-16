# mobile-app/src/shared/ — re-exports of the shared domain layer

These modules contain **no implementation**. Each one re-exports the
canonical module from the repository-root `shared/` directory, so the
mobile app, the website, and the admin console always run the same API
clients, response helpers, inventory store (`store.tsx`), account
helpers (`users.ts`), release metadata (`releases.ts`), app constants
and env config (`config.ts`), and domain types (`types.ts`).

Edit the real code in `../../../shared/`, never here.

The owner `admin-api.ts` client lives in the root `shared/` directory; the
user app never imports admin APIs directly.

Rule: shared modules must not import UI files from `../app/`;
frontend UI consumes this data and API layer.
