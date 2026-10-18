# Mobile (native Android shell)

Everything native lives in this folder — nothing web. The website
(`index.html`, `store.html`, `src/web/`, `dist-web/`) stays at the repo root.
The Capacitor config itself stays at the repo root too (the CLI must run
where `package.json` is) and points here via `webDir: 'mobile/dist-app'`
and `android: { path: 'mobile/android' }`.

- `android/` — native project (Gradle, manifest, icons, `local.properties`)
- `dist-app/` — app-only web bundle (built, gitignored; `cap sync` copies it
  into `android/app/src/main/assets/public`)

## Workflow (from the repo root)

```bash
npm run build:app   # vite → mobile/dist-app/index.html (app only, no site code)
npm run cap:sync    # cap sync android → copies bundle + plugins into mobile/android
npm run cap:open    # open mobile/android in Android Studio
# or everything at once:
npm run android:build
```

To build the APK: open `android/` in Android Studio, or
`cd android && ./gradlew assembleDebug` (needs `local.properties` with
`sdk.dir`, plus Java 21). Versioning: `versionName` must equal
`package.json` version and `versionCode` must keep increasing —
`node scripts/release-info.mjs check` verifies this from the repo root.
