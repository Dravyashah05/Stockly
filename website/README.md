# Stockly website

Independent responsive inventory website. It owns its UI, navigation,
forms, browser routes, API client facade, and build output. Shared account,
API, and inventory state code lives in the neutral `../shared/` domain
layer; the website imports no files from `mobile-app/`. Both frontends call
the same `/api/*` backend routes.

```sh
npm install                 # from the repository root for local development
npm --prefix server run dev # shared API on :5000
npm --prefix website run dev # website on :3003, proxies /api to :5000
npm --prefix website run build
```

Set `VITE_API_BASE_URL` to the public shared backend origin when website and
backend are hosted separately. Leave it empty when the website host proxies
`/api/*`. Set the same public origin in `mobile-app/.env` before building
Android. The variable is public and must never contain credentials.
