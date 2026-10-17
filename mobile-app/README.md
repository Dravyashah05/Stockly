# Stockly Android frontend

This directory owns the React + TypeScript Android UI, Material 3 theme, Capacitor configuration, and native Android project. The React bundle runs only inside Capacitor for the shipped product. Shared clients and business logic are in `../shared/`.

From the repository root, build and sync the Android project with:

```sh
npm run android:build
```

The debug APK is generated at `mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`. Set `VITE_API_BASE_URL` in this directory's `.env` to the public HTTPS API origin before building a device APK. See the root README and `../docs/ANDROID_ONLY_AUDIT.md` for setup and dependency details.
