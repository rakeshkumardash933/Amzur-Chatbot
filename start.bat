@echo off
REM Quick start script for Amzur Chatbot (Windows)
REM Starts both frontend and backend servers

echo Starting Amzur Chatbot...

REM Start backend
echo.
echo [1/2] Starting backend...
cd backend

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -q -r requirements.txt

if not exist ".env" (
    echo Creating .env from template...
    copy .env.example .env
    echo Created .env - please edit it with your API key!
)

echo Backend dependencies installed
start "Backend Server" python main.py

cd ..

REM Start frontend
echo.
echo [2/2] Starting frontend...
cd frontend
call npm install -q

if not exist ".env" (
    echo Creating .env from template...
    copy .env.example .env
)

start "Frontend Server" npm run dev

cd ..

echo.
echo Servers starting...
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo.
echo Press Ctrl+C in each window to stop
pause
