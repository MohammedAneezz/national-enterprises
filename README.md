# NATIONAL ENTERPRISES — EMI Collections App

Mobile + backend for weekly EMI collections. A-Line / B-Line / C-Line workspaces.
Customers (name + phone + area only), products (came vs sold), weekly dues anchored
to purchase date, manual collections with +100/+200/+500 quick-add (Cash/UPI only),
daily report with left-outs + overdue.

## Can anyone download from GitHub and use it?

Yes. This repo is self-contained:
- Backend: Python 3.10+ + FastAPI + SQLite (no external DB needed)
- Mobile: Node 18+ + Expo Go on iPhone/Android (no App Store build needed)
- Default login `admin` / `admin123` — change after first login (or via env/seed)

No paid services required for local use. For sharing outside your WiFi you need
a free tunnel (ngrok + `expo --tunnel`). See `SHARE-iOS.md`.

## Quick start (downloaded from GitHub)

```powershell
# 1. Backend
cd backend
copy .env.example .env   # optional, edit SECRET_KEY
python -m pip install -r requirements.txt
python -m pytest tests -q  # should be 4 passed
python run.py              # http://127.0.0.1:8000/docs

# 2. Mobile (new terminal)
cd mobile
npm install --legacy-peer-deps
npx expo start
# Expo Go on phone -> scan QR -> admin/admin123 -> pick A/B/C-Line
```

Phone on same WiFi: edit `mobile/App.js` `API` to your PC LAN IP
(`ipconfig` -> IPv4, e.g. `http://192.168.1.5:8000/api/v1`).
Outside WiFi: see `SHARE-iOS.md` (ngrok + `EXPO_PUBLIC_API_URL`).

## Tests
`cd backend; python -m pytest tests -v` — lines seed, area-only customers,
weekly anchor (+7 days), Cash/UPI validation, daily left-outs.

## Security notes before making public
- Change `SECRET_KEY` in `backend/.env` (never commit `.env`)
- Change default admin password after `init_db` seeds it
- `national.db` is git-ignored; each install gets a fresh DB with A/B/C lines
