# Stockly architecture

Stockly has three independently built frontends and one backend implementation.
The customer mobile app and website share API clients, domain types, and the
inventory synchronization layer, but have separate entry points, navigation,
components, styling, and build outputs. The website does not import mobile UI.

```text
Stockly/
├── mobile-app/             # customer mobile app UI; Vite + Capacitor frontend
│   ├── src/app/             # mobile shell, screens, components
│   ├── src/shared/          # customer API client, types, auth and sync layer
│   └── capacitor.config.ts  # points to ../mobile/android
├── website/                # separate responsive inventory website
│   ├── src/website.tsx      # website-only shell, pages and forms
│   ├── src/website.css      # website-only styling
│   └── vite.config.ts       # dev :3003; proxies /api to :5000
├── admin/                  # separate owner/admin console
├── server/                 # one Express transport adapter, default :5000
├── api/                    # canonical auth, inventory, device and admin handlers
├── apps-script/            # existing Google Sheets integration
├── mobile/android/         # Capacitor native project and Gradle source
├── tests/                  # backend logic and compatibility tests
├── docs/                   # setup and architecture documentation
└── src/ + root HTML/Vite   # retained legacy marketing/store build during migration
```

## One backend and data source

`api/*.ts` is the canonical endpoint implementation. The Express adapter in
`server/src/index.ts` invokes those handlers; Vercel can continue deploying
the same modules as serverless functions. `/api/users` and `/api/inventory`
remain aliases of `/api/auth` and `/api/sheets`. The Apps Script integration,
Google Sheets schema, existing user data, sessions, and device-linking flow
remain unchanged. Backend authorization remains enforced inside the handlers.

All frontends use the same public backend origin through
`VITE_API_BASE_URL`, or use same-origin `/api` paths when their host proxies
those paths. Vite development proxies forward to the one local server at
`http://localhost:5000`. Only public URLs belong in `VITE_*` variables.

## Run and build

From the repository root (install root dependencies once):

```sh
npm install
npm --prefix server ci   # server has its own package lock
npm run dev:server       # shared backend :5000
npm run dev:user         # mobile app browser build :3001
npm run dev:mobile       # alias for the independent mobile frontend
npm run dev:website      # website :3003
npm run dev:admin        # admin console :3002

npm run build:user       # mobile-app/dist
npm run build:mobile     # independent mobile app frontend build
npm run build:website    # website/dist
npm run build:admin      # admin/dist
npm run build:app        # alias for the mobile-app bundle
npm run cap:sync         # sync Android assets/plugins
npm run android:build    # build mobile bundle and sync Android
npm test                 # backend/integration unit tests
npm run lint             # repository lint
npm --prefix server run typecheck
```

Each frontend has its own package manifest and lockfile and can be installed
and built in isolation with `npm --prefix <frontend> ci` and
`npm --prefix <frontend> run build`. Set `STOCKLY_API_URL` to change the
development proxy target. For separately deployed frontends, set the same
`VITE_API_BASE_URL` backend origin in each frontend build.

## Compatibility and cleanup

Root `src/`, `index.html`, `app.html`, `store.html`, and root Vite configs are
kept while the independent website and app builds are validated. Do not remove
them until release/deployment references are migrated. Generated `dist/`,
`mobile-app/dist/`, build outputs, local env files, Android `local.properties`,
and dependency folders are ignored by Git.
