# Stockly mobile app frontend

The mobile app owns its screens, touch navigation, mobile styling, native
Capacitor integration, offline cache, and barcode/device-linking workflows.
The independent inventory website lives in `../website/`. UI modules stay
inside each frontend. Shared account, API, and inventory state code lives in
the neutral `../shared/` domain layer; mobile imports it through local
re-export modules in `src/shared/`.

```sh
npm --prefix server run dev  # shared API on :5000
npm --prefix mobile-app run dev # browser app on :3001
npm run build:mobile         # Capacitor bundle at mobile-app/dist
npm run cap:sync             # sync into mobile-app/android
npm run android:build        # app build + Android sync
```

Set `VITE_API_BASE_URL` in `mobile-app/.env` to the public backend origin
before building Android. Web development can leave it empty and use the Vite
`/api` proxy. Never put private credentials in frontend environment.
