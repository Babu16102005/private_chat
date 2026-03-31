@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo Starting CoupleChat Application...
echo ===================================================
echo.
echo Note: Backend is handled by Supabase - no local backend needed.
echo.

set "DEVICE_ID="
for /f "tokens=1,2" %%A in ('adb devices') do (
    if "%%B"=="device" (
        if not defined DEVICE_ID (
            set "DEVICE_ID=%%A"
        )
    )
)

if defined DEVICE_ID (
    echo Connected Android device found: !DEVICE_ID!
    echo [1/1] Starting Expo for the connected phone...
    echo Project is pinned to Expo SDK 54 for Expo Go 54 compatibility.
    echo Auto-answering "No" if Expo suggests updating Expo Go.
    echo.
    cd /d "%~dp0frontend"
    set "ADB_SERIAL=!DEVICE_ID!"
    echo n| npx expo start --android
) else (
    echo No connected Android phone detected with adb.
    echo Make sure USB debugging is enabled and run ^`adb devices^` to verify.
    echo.
    echo Falling back to Expo web preview...
    start cmd /k "cd /d "%~dp0frontend" && title Frontend - Expo Web && npx expo start --web"
)

echo.
pause
