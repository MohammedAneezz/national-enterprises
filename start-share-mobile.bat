@echo off
REM Double-click to start share mode. Edit NGROK_URL before sending.
set NGROK_URL=https://PASTE-YOUR-NGROK-URL-HERE/api/v1
set EXPO_PUBLIC_API_URL=%NGROK_URL%
cd /d "%~dp0mobile"
npx expo start --tunnel
