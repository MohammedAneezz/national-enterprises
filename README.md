# NATIONAL ENTERPRISES

An Android app for weekly EMI sales and door-to-door collections. The Android app keeps its own SQLite database on the phone. It needs no API server or internet connection for daily use.

Open [PRODUCTION-ANDROID.md](PRODUCTION-ANDROID.md) for local APK building, cable installation, monthly backup export, restore, and safe updates.

## Android app

- First launch creates a 6–12 digit PIN on the phone.
- A-Line, B-Line, and C-Line have separate customers, sales, dues, payments, and reports. Products and stock are shared.
- Customers contain name, phone, area, notes, and outstanding balance.
- A sale creates weekly dues from its purchase date. Cash and UPI collections apply to the oldest unpaid due first. UPI requires a reference.
- Reports show sales, Cash and UPI collections, left-outs, and overdue dues for the selected day.
- Backup & Restore exports the complete database to a folder chosen on the phone. A monthly reminder appears when records exist and no backup has been saved that month.

The phone database is a fresh database. Existing `backend/national.db` records are **not** imported. A backup JSON file contains customer and payment information, so keep exported files private.

## Develop

```powershell
cd mobile
npm ci --legacy-peer-deps
npm test
npm run check
npx expo export --platform android
```

The Android Studio project is in `mobile/android`. Expo SDK 52 is retained for the current build; upgrade it before a longer-term client rollout. Preserve the package name `com.nationalenterprises.app` and the release signing key so later APKs update the app without clearing its phone database.

The `backend` folder and `render.yaml` remain as the earlier hosted API implementation. The Android app no longer calls them.
