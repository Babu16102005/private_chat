@echo off
echo ===================================================
echo Starting CoupleChat Application...
echo ===================================================

echo [1/1] Starting the Expo Frontend (React Native)...
echo Note: Backend is now handled by Supabase - no local backend needed!
start cmd /k "cd frontend && title Frontend - Expo && npm start"

echo.
echo Frontend Expo Metro Bundler is starting in a new window!
echo Make sure your Supabase project is properly configured.
echo.
pause
