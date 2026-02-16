@echo off
echo ========================================
echo   Docker Container Manager - Startup
echo ========================================
echo.

REM Check if Docker is running
echo [1/3] Checking Docker...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)
echo [OK] Docker is running

REM Check if dependencies are installed
echo.
echo [2/3] Checking dependencies...
if not exist "go.sum" (
    echo Installing Go dependencies...
    go mod download
    if errorlevel 1 (
        echo [ERROR] Failed to download dependencies
        pause
        exit /b 1
    )
)
echo [OK] Dependencies ready

REM Start the application
echo.
echo [3/3] Starting Docker Manager...
echo.
echo ========================================
echo   Server starting on http://localhost:8080
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

go run main.go

pause
