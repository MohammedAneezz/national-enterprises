# NATIONAL ENTERPRISES

A local-first weekly EMI collections app. FastAPI stores customers, sales, dues, payments, and reports in SQLite. Expo provides the mobile workspace for A-Line, B-Line, and C-Line.

For an Android client release with a hosted database and monthly backups, see [PRODUCTION-ANDROID.md](PRODUCTION-ANDROID.md).

## Run

Use two terminals in `C:\Users\moham\enterprise-collections`.

```powershell
cd backend
python -m pip install -r requirements.txt
python -m pytest -q
python run.py
```

The API runs at http://127.0.0.1:8000 and its interactive docs are at http://127.0.0.1:8000/docs. To use authenticated endpoints in the docs, call `POST /api/v1/auth/login`, copy `access_token`, select **Authorize**, and paste the token.

```powershell
cd mobile
npm install --legacy-peer-deps
npx expo start
```

Open the displayed QR code in a compatible Expo Go or development build. The app fills the Server URL from `EXPO_PUBLIC_API_URL` when set; otherwise it derives the computer's LAN IP from the Expo host. The field can be changed on the login screen. The phone and computer must be on the same Wi-Fi network for a LAN URL.

Initial credentials: **admin / admin123**. Set `ADMIN_PASSWORD` before the first backend start to use another initial password. The seed is created only when the database has no admin user. Set a persistent, randomly generated `SECRET_KEY` in `backend/.env` if sessions should survive backend restarts; without it, each process uses a new key. The database is `backend/national.db` and is excluded from Git.

## Workspaces

Select A-Line, B-Line, or C-Line after login. The top-right dashboard button opens today's overview; the line menu switches workspaces. Each line has its own customers, sales, dues, payments, and reports. The product catalog and stock counts are shared.

- **Customers:** Filter by area or search name/phone. Add a customer with name and optional area/phone. Open a customer for their ledger, new EMI sale, weekly schedule, and payment history.
- **New EMI sale:** Choose a product in stock, enter quantity, total EMI, down payment, weekly amount, tenure, and purchase date. The financed balance equals total EMI less down payment. The final week's due may be smaller so dues sum to the exact balance.
- **Collect:** Enter or select a Sale ID. The +100, +200, and +500 buttons add to the amount; the amount remains editable. Only Cash and UPI are accepted, and UPI requires a reference. Collections apply to that sale's oldest unpaid dues first. A payment larger than the sale's balance is rejected.
- **Stock:** Enter a product name and quantity. Existing names restock the existing product. Add prices and an optional SKU when creating a product. Available stock is came minus sold.
- **Reports:** See purchase-date sales, daily Cash and UPI collections, today's unpaid dues, and earlier unpaid dues. Business days use `Asia/Kolkata` by default; set `BUSINESS_TIMEZONE` to change it. Daily reports show current due status for the selected date.

Customer records contain only name, phone, area, notes, outstanding balance, and line ID. The API docs at `/docs` show all endpoints.

## Verification

`python -m pytest -q` in `backend` runs the API tests. `npm run check` in `mobile` validates installed Expo versions, and `npx expo export --platform android --platform web` checks bundle compilation. `npm run test:e2e` runs a 375px browser flow against an isolated temporary database; it requires Microsoft Edge.

The repository includes an Android project. For a new native configuration run `npx expo prebuild --platform android`, then `cd android; .\gradlew assembleDebug`. The HTTP LAN configuration is in `mobile/plugins/withLanHttp.js`.

Expo SDK 52 is kept as requested. An installed Expo Go must support SDK 52; if it does not, use a matching client or an Android development build. Run `npm audit --omit=dev` to inspect the current advisories in this older SDK's dependency tree.
