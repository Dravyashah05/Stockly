# Stockly architecture

Stockly has three independently built frontends and one backend implementation.
The customer mobile app and website share API clients, domain types, and the
inventory synchronization layer, but have separate entry points, navigation,
components, styling, and build outputs. The website does not import mobile UI.

```text
Stockly/
├── shared/                 # ONE implementation of the shared domain layer
│   ├── api*.ts, auth.ts,   #   API clients, response helpers, device linking,
│   │   connection.ts,      #   account/users, releases, env config, types
│   │   devices.ts, users.ts
│   ├── store.tsx           #   inventory synchronization store (React)
│   └── brand.css           #   shared brand/platform design tokens
├── mobile-app/             # customer mobile app UI; Vite + Capacitor frontend
│   ├── src/app/             # mobile shell, screens, components
│   ├── src/shared/          # thin re-exports of ../../../shared/* (no copies)
│   ├── capacitor.config.ts  # points to android/
│   └── android/             # Capacitor native project and Gradle source
├── website/                # separate responsive inventory website
│   ├── src/website.tsx      # website-only shell, pages and forms
│   ├── src/website.css      # website-only styling
│   ├── src/shared/          # thin re-exports of ../../../shared/*
│   └── vite.config.ts       # dev :3003; proxies /api to :5000
├── admin/                  # separate owner/admin console
│   └── src/shared/          # thin re-exports of ../../../shared/*
├── server/                 # one Express transport adapter, default :5000
├── api/                    # canonical auth, inventory, device and admin handlers
├── apps-script/            # existing Google Sheets integration
├── tests/                  # backend logic and compatibility tests
├── docs/                   # setup and architecture documentation
└── src/ + root HTML/Vite   # retained legacy marketing/store build during migration
```

Root `shared/` is the **single source of truth** for the domain layer. Every
frontend reaches it through its own `src/shared/*` re-export modules, which
contain no implementation — so a change to a shared client, type, or the
inventory store takes effect in the app, the website, and the console at once.
Do not copy shared files into a frontend: edit `shared/` instead.

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
them until release/deployment references are migrated. The shared domain layer
was moved out of that legacy tree to the repository root (`shared/`) so it can
no longer be mistaken for legacy code; every frontend now re-exports it.
Generated `dist/`, `mobile-app/dist/`, build outputs, local env files, Android
`local.properties`, and dependency folders are ignored by Git.
