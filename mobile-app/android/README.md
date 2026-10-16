# Android project

The native Android project is in `mobile-app/android/`; web assets are generated
into `mobile-app/dist/` from the dedicated customer app frontend. Required
Gradle source and wrapper files are committed. Generated assets, Gradle
caches, build outputs, and `local.properties` are ignored.

From the repository root:

```sh
npm run build:mobile
npm run cap:sync
# or run both:
npm run android:build
npm run cap:open
```

Build a local debug APK from PowerShell with:

```powershell
Set-Location mobile-app/android
.\gradlew.bat assembleDebug
```

The Android app ID is `com.stockly.inventory`. Release builds require a
configured signing key; do not commit the keystore or passwords.
