# Android app (`index.html` → `src/app/`)

Capacitor + React inventory app: dashboard, products, history, settings,
owner tools, auth gate, product/stock sheets. Mounts `#root` from this package's
`index.html`.

- Entry: `main.tsx` → `App.tsx`
- UI: `components/` · screens: `screens/`
- Backend + state: `../shared/` (imported, never duplicated here)

Rule: app and native UI must use the shared domain re-exports rather than
duplicating data or API behavior. Capacitor ships `mobile-app/dist` via
`npm run android:build`.
