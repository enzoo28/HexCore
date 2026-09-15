@echo off
echo ============================================
echo    MyAI - Installation Script
echo ============================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed!
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [1/4] Installing Python dependencies...
pip install -r backend\requirements.txt

echo.
echo [2/4] Checking for Ollama...
where ollama >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Ollama is not installed!
    echo.
    echo Please install Ollama from: https://ollama.ai/download
    echo After installing, run: ollama pull llama3.2
    echo.
    echo Press any key to continue anyway...
    pause >nul
) else (
    echo [OK] Ollama is installed
)

echo.
echo [3/4] Checking for AI models...
ollama list >nul 2>&1
if errorlevel 1 (
    echo [INFO] No models found. Pulling llama3.2...
    echo This may take a few minutes...
    ollama pull llama3.2
) else (
    echo [OK] Models available
    ollama list
)

echo.
echo [4/4] Starting MyAI...
echo.
echo ============================================
echo    MyAI is starting!
echo ============================================
echo.
echo    Open your browser and go to:
echo    http://localhost:5000
echo.
echo    Press Ctrl+C to stop the server
echo ============================================
echo.

python backend/server.py
