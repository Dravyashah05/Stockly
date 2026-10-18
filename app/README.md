# `@stockly/app` — user website + Android app

Email/password sign-in, Google Sheet connection + verification, inventory
dashboard, products, categories, suppliers view, stock in/out, transaction
history, Stockly device linking, Capacitor Android config.

## Source

`src/app/**` (screens, components) + `src/shared/**` (public API clients).
The owner console is **not** embedded here — Settings → Administration
links out to the separate admin frontend (`VITE_ADMIN_URL`).

## Env (public only)

See `.env.example`. `VITE_API_BASE_URL` points at the **same shared
backend** as the admin app (dev default `http://localhost:5000`; Android
builds need the deployed origin). No secrets, no spreadsheet credentials.

## Run

```sh
npm run dev      # inside app/ → http://localhost:3001 (proxies /api/* to :5000)
npm run build    # web bundle → dist/
npm run android:build  # build + cap sync android (native project in ../mobile)
```

Backend must be running (`npm run dev` inside `server/`) for sign-in,
sheet verification, inventory, and device APIs.
