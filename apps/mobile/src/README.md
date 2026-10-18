# Mobile app (`app.html` → `src/app/`)

Capacitor + React inventory app: dashboard, products, history, settings,
auth gate, product/stock sheets. Mounts `#root` (see `app.html`).

- Entry: `main.tsx` → `App.tsx`
- UI: `components/` · screens: `screens/`
- Backend + state: `../shared/` (imported, never duplicated here)

Rule: never import from `../web/`. Web-only code (marketing pages,
store page) must not leak into the mobile bundle — Capacitor ships
`mobile/dist-app` (`npm run build:app`).
