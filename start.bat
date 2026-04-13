@echo off
echo Starting DeepSeek Gomoku AI Integration...
echo.

echo [1/2] Starting Flask backend server...
cd server
start cmd /k "python app.py"
cd ..
echo Backend server starting at http://localhost:5000
echo.

echo [2/2] Starting frontend...
echo Please open index.html in your browser or use a static file server.
echo Example: python -m http.server 8000
echo.

echo Press any key to exit...
pause >nul