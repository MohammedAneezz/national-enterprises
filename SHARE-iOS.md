# Share NATIONAL ENTERPRISES on iPhone (no App Store, 5 min)

You (owner) do this once. Friend only installs Expo Go.

## You do (PC):

### 1. Start backend
```powershell
cd C:\Users\moham\enterprise-collections\backend
python run.py
```

### 2. Expose backend to internet (pick one)
```powershell
# easiest, free account at https://ngrok.com -> install, then:
ngrok http 8000
# copy the https URL, e.g. https://abcd1234.ngrok-free.app
```

### 3. Start app in share mode
```powershell
cd C:\Users\moham\enterprise-collections\mobile
$env:EXPO_PUBLIC_API_URL="https://abcd1234.ngrok-free.app/api/v1"
npx expo start --tunnel
# shows a QR code
```
Replace `abcd1234` with your real ngrok URL. `--tunnel` makes the QR work outside your WiFi.

## Friend does (iPhone):
1. Install **Expo Go** from App Store
2. Open Expo Go -> Scan QR you send (screenshot works)
3. Login: `admin` / `admin123` -> tap A-Line / B-Line / C-Line
4. Done. Collect screen: tap +100/+200/+500, total still editable, Cash|UPI only.

## Notes
- Both ngrok + `expo --tunnel` must stay running while friend uses it.
- If QR expires, press `r` in expo terminal to reload, send new QR.
- For permanent link (no PC running): deploy backend to Render + EAS Build to TestFlight. Needs Apple Developer $99/yr. Ask me when ready and I will set it up.
