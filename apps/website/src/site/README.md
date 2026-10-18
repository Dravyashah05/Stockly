# Website (`index.html`, `store.html` → `src/web/`)

Marketing landing page (`main.tsx` → `#site-root`) and the dedicated
App Store page (`store.tsx` → `#store-root`). Mounted by `index.html`
and `store.html` respectively.

- Shared UI bits: `visuals.tsx` · styles: `site.css`
- Release data + brand constants: `../shared/` (imported, never duplicated)

Rule: never import from `../app/`. The site builds alone via
`npm run build:web` (→ `dist-web`) and must stay free of Capacitor,
store, and inventory-screen code.
