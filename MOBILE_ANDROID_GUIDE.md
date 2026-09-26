# 📱 Stockly Android Mobile Application Guide

Stockly includes a native Android mobile application powered by **Capacitor 7** and **React 19**, pre-configured with native status bar theming, hardware back button navigation, camera/barcode scanner permissions, haptics, and auto-connecting to your production backend at `https://stocklybydns.vercel.app/api`.

---

## ⚡ Quick Commands

| Action | Command |
|---|---|
| **Build Web Assets & Sync to Android** | `npm run mobile:build` |
| **Open Project in Android Studio** | `npm run mobile:open` |
| **Run Directly on Connected Device / Emulator** | `npm run mobile:run` |
| **Sync Config / Plugins Only** | `npm run mobile:sync` |

---

## 🛠️ Prerequisites

1. **Android Studio**: Install [Android Studio Ladybug / Hedgehog or newer](https://developer.android.com/studio).
2. **Java Development Kit**: JDK 17 or JDK 21 (installed).
3. **Android SDK & Build Tools**: Installed via Android Studio SDK Manager (API 34 or 35 recommended).

---

## 🚀 How to Build the APK / AAB in Android Studio

### Step 1: Open the Project in Android Studio
Run:
```bash
npm run mobile:open
```
*Or open Android Studio manually, select **Open**, and browse to `E:\Stockly\android`.*

### Step 2: Sync Gradle
Android Studio will automatically detect and sync Gradle dependencies. Wait for the initial indexing to finish.

### Step 3: Build Debug APK (For Testing on Physical Phone)
1. In Android Studio, go to the top menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. When the build finishes, click the popup link **"locate"**.
3. Your APK is located at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
4. Transfer this `.apk` file to your Android phone via USB, WhatsApp, Google Drive, or `adb install android/app/build/outputs/apk/debug/app-debug.apk`.

### Step 4: Build Signed Release APK / AAB (For Google Play Store)
1. In Android Studio, go to: **Build → Generate Signed Bundle / APK...**
2. Choose **Android App Bundle (.aab)** for Play Store or **APK** for direct distribution.
3. Select your Keystore (or click **Create new...**).
4. Select `release` build variant and click **Finish**.

---

## 📲 How to Run Directly on a Connected Android Device

1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone via USB.
3. Run:
   ```bash
   npm run mobile:run
   ```
   Select your connected device from the prompt. The app will compile, install, and launch automatically.

---

## ⚙️ Native Android Architecture Details

* **Package Name / Application ID**: `com.stockly.app`
* **Target SDK**: Android 14 / 15 (API 34+)
* **Minimum SDK**: Android 6.0 (API 23+)
* **Config File**: [`capacitor.config.json`](./capacitor.config.json)
* **Native Android Source**: [`android/`](./android)
* **API Routing**: Automatically connects to `https://stocklybydns.vercel.app/api` in native mode, with offline asset bundling.

---

## 🔌 Included Native Capabilities

- 📷 **Camera & Barcode Permissions**: Pre-configured in `AndroidManifest.xml` for scanning warehouse QR codes and capturing product pictures.
- 📳 **Haptic Feedback**: Vibration on barcode detection and button actions.
- 🎨 **Status Bar Integration**: Native dark mode status bar matching the Stockly theme (`#09090b`).
- 🔙 **Hardware Back Button Handling**: Intelligently goes back in navigation history and exits on the Home/Login screen.
