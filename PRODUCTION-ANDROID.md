# Android app with a database on the phone

The Android app stores all records in its own SQLite database. Render, AWS, Google Play, and Expo's cloud build service are not needed. It starts with an empty phone database; the earlier backend database is separate.

This workspace already has a signed `NATIONAL-ENTERPRISES-OFFLINE-v2.0.0.apk` in the repository folder. APKs and signing credentials are excluded from GitHub, so a fresh checkout needs the build steps below. The signing key has already been created on this computer; keep it for future updates.

## Build a signed APK on this Windows computer

Install Android Studio with the Android SDK and JDK, plus Node.js. From the repository:

```powershell
cd C:\Users\moham\enterprise-collections\mobile
npm ci --legacy-peer-deps
npm test
npx expo prebuild --platform android --no-install
```

On the **first** release only, generate the signing key:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-release-key.ps1
```

The script creates `android/app/national-release.keystore` and `android/keystore.properties`. Both are excluded from Git. Save both in a private, separate place. Every later APK must use the **same key** and package name, or Android will refuse to install it as an update.

Build locally:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
cd android
.\gradlew.bat assembleRelease '-PreactNativeArchitectures=armeabi-v7a,arm64-v8a'
```

The installable file is `mobile/android/app/build/outputs/apk/release/app-release.apk`. This build includes ARM libraries for physical Android phones. The Gradle release build is configured to require the local signing key; never distribute a debug APK.

## Install by USB cable

Connect the phone by USB and choose **File transfer** on the phone. Copy `app-release.apk` to Downloads, open it on the phone, and allow installation from the Files app when Android asks. Alternatively, with USB debugging enabled:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install .\app\build\outputs\apk\release\app-release.apk
```

On first launch, create the phone's 6–12 digit PIN and choose A-Line, B-Line, or C-Line. The old development APK uses a different signing key. If it is installed, remove it before this first release; the new phone database starts empty as requested.

## Update without losing data

Before each update, export a backup. Keep `com.nationalenterprises.app` and the release signing key unchanged. Increase `android.versionCode` in `mobile/app.json`, run `npx expo prebuild --platform android --no-install`, then rebuild `assembleRelease`. Copy the new APK by cable and install it over the existing app, or use `adb install -r`. **Do not uninstall the signed app or clear its storage** during normal updates. The SQLite database remains in the app's private storage.

When changing the database schema, add a numbered migration in `mobile/src/local/store.js`. The app checks the schema version on startup. Never replace the database file as part of an app update.

## Monthly backup and restore

On the **Lines** screen, open **Back up this phone**. After the first records are entered, it changes to **Monthly backup due** in any month without a saved export. Tap **Choose folder & save backup**, select a folder such as `Documents/National Backups`, and confirm. The app writes a timestamped JSON file containing all lines, stock, sales, dues, and payments.

Connect the phone to a computer with the USB cable and copy that JSON file to a private backup location. Keep at least several dated copies. The export is readable JSON and contains personal and financial records; protect it like the phone itself. The reminder appears on the Lines screen, and the export requires a tap. Android does not make a guaranteed off-phone copy in the background.

To restore on a new phone, first install the signed APK and create a new PIN. Copy a saved backup JSON file onto the phone, open **Backup & restore → Choose backup file**, review its record counts, and confirm **Restore selected backup**. Restore replaces the records currently on that phone. A malformed backup leaves the current database unchanged.

Uninstalling the app, clearing its storage, or losing the phone removes records added since the last backup. This version is for one phone at a time; it does not synchronize two phones.
