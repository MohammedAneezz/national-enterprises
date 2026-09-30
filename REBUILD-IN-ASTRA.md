# NATIONAL ENTERPRISES — Rebuild Spec (paste into any AI builder)

> Copy everything below the line into GPT Astra / any coding AI to rebuild this exact project.

---

Build a full-stack EMI collections app called **NATIONAL ENTERPRISES** for a company that
sells products on weekly EMI and collects cash door-to-door.

## Tech stack
- Backend: Python FastAPI + SQLAlchemy + SQLite (file `national.db`), JWT auth, pytest.
  Run: `cd backend; pip install -r requirements.txt; python run.py` → `http://127.0.0.1:8000` (docs at `/docs`).
- Mobile: Expo React Native (SDK 52, React 18.3, RN 0.76) + React Navigation (bottom tabs +
  native stack) + axios + NativeWind-style inline StyleSheet. Run: `cd mobile; npm install
  --legacy-peer-deps; npx expo start` → scan QR with Expo Go.
- Native Android (optional): `npx expo prebuild --platform android`, package
  `com.nationalenterprises.app`, build debug APK: `cd android; gradlew assembleDebug`.

## Core concept — Lines
After admin login show 3 workspaces: **A-Line, B-Line, C-Line**. Every line has the SAME
5 functions, but data is fully isolated per line: Dashboard, Customers, Collect, Stock, Reports.
All tables carry `line_id`. Product catalog is global; sales/payments/dues are per-line.

## Data models
- `Line(id, name)` — seed exactly `A-Line, B-Line, C-Line`.
- `User(id, username, hashed, role)` — seed `admin / admin123` (role admin).
- `Customer(id, line_id, name, phone, area, notes, outstanding)` — ONLY these fields.
  No address, no id-proof. `area` is plain text, used for filtering/grouping.
- `Product(id, name, sku, cost_price, emi_price, stock_in, stock_sold)` —
  `available = stock_in - stock_sold` ("came vs sold").
- `Sale(id, line_id, customer_id, product_id, qty, total_emi, down_payment, financed,
  weekly_amt, start_date, tenure_weeks, status)` — `financed = total_emi - down_payment`.
  Creating a sale: `stock_sold += qty`, `customer.outstanding += financed`, auto-generate
  `tenure_weeks` rows in Due.
- `Due(id, sale_id, line_id, due_date, due_amt, paid_amt, status)` — weekly schedule
  ANCHORED to purchase date: `due_date[i] = start_date + i*7 days` (same weekday).
  Status: PENDING | PARTIAL | PAID.
- `Payment(id, line_id, sale_id, amount, mode, upi_ref, collector, paid_at)` —
  mode ONLY `CASH` or `UPI`. UPI requires non-empty `upi_ref`. Apply FIFO to oldest
  unpaid dues of that sale; set due PARTIAL/PAID; if all dues PAID → sale CLOSED;
  `customer.outstanding = max(0, outstanding - amount)`.

## API (prefix `/api/v1`, JWT Bearer except login)
- `POST /auth/login {username,password}` → `{access_token, role}`
- `GET /lines` → 3 lines
- `POST /customers {line_id,name,phone,area,notes}` / `GET /customers?line_id&area&q`
- `GET /areas?line_id` → distinct area strings / `GET /customers/{id}` → customer + sales + payments
- `POST /products {name,sku,cost_price,emi_price,stock_in}` / `GET /products` → each with
  `{came, sold, available}` / `POST /products/{id}/stock-in {qty}`
- `POST /sales {line_id,customer_id,product_id,qty,total_emi,down_payment,weekly_amt,start_date,tenure_weeks}`
  → `{sale_id, financed, dues}` / `GET /sales/{id}/schedule`
- `POST /payments {line_id,sale_id,amount,mode,upi_ref}` → 400 if UPI without ref
- `GET /reports/daily?line_id&day` → `{day, sales_count, sales_amount, collected_count,
  collected_amount, cash, upi, due_today_count, left_out_count, left_outs[], overdue_count, overdue[]}`
  where left_outs = dues with `due_date == day AND status != PAID`,
  overdue = dues with `due_date < day AND status != PAID`.

## Mobile screens
1. **Login** — fields: Server URL (editable, default baked `EXPO_PUBLIC_API_URL` or LAN IP +
   `/api/v1`), username, password. Store token in memory.
2. **Lines** — 3 cards (A/B/C) → sets active line → tab navigator.
3. **Customers tab** — area chips (All + areas from API) + area text input, name + phone inputs,
   "+ Add Customer" button, list showing `name • area • phone • Bal ₹outstanding`.
4. **Collect tab** — Sale ID input, quick-add chips `[+100][+200][+500]` (each tap ADDS to
   total) + `[Clear]`, big total amount TextInput (fully editable manually after chips),
   `[Cash|UPI]` toggle, UPI Ref input shown only for UPI, "Save Collection" → POST /payments.
5. **Stock tab** — product name + qty came inputs, "+ Stock In", list `Came X • Sold Y • Left Z`.
6. **Reports tab** — today's card: sales ₹ + count, collected ₹ (Cash ₹ + UPI ₹),
   left-outs count + overdue count in red, list of left-out dues.

## Design system
Minimalism/Swiss: Primary `#0F172A`, Secondary `#1E3A8A`, CTA `#A16207`, BG `#F8FAFC`,
Card `#FFFFFF`, Text `#020617`, Muted `#475569`, Border `#E2E8F0`, Danger `#DC2626`.
Headings Lexend, body Source Sans 3. Lucide/SVG icons only (no emojis). Bottom tabs:
Customers | Collect | Stock | Reports. Mobile-first 375px.

## Must-pass tests (backend/pytest)
1. Lines seeded (A/B/C exist after login).
2. Customer create with only name+area works; response has no `address` field.
3. Sale with `start_date 2026-09-22, tenure 4` creates 4 dues, 2nd due `2026-09-29`;
   `financed = total - down`; cash payment accepted; UPI without ref → 400; UPI with ref → ok.
4. Daily report returns `left_outs, cash, upi` keys.

## Acceptance checklist
- [ ] admin/admin123 login works on mobile + `/docs`
- [ ] A/B/C lines isolate data (pay in A never shows in B report)
- [ ] Collect: tap 100+200+500 = 800, edit to 750 manually, save 750 Cash works
- [ ] UPI without ref blocked with clear error
- [ ] Daily report left-outs match unpaid dues of the day
