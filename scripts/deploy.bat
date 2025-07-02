@echo off
setlocal enabledelayedexpansion

REM BUC Tool Deployment Script for Windows
REM This script deploys the BUC Tool application using Docker Compose

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%.."

echo [INFO] BUC Tool Deployment Script for Windows
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose first.
    pause
    exit /b 1
)

echo [SUCCESS] Docker and Docker Compose are installed
echo.

REM Check if ports are available
netstat -an | find "3000" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port 3000 is already in use.
    set /p "continue=Do you want to continue anyway? (y/N): "
    if /i not "!continue!"=="y" exit /b 1
)

netstat -an | find "8000" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port 8000 is already in use.
    set /p "continue=Do you want to continue anyway? (y/N): "
    if /i not "!continue!"=="y" exit /b 1
)

netstat -an | find "3306" >nul 2>&1
if not errorlevel 1 (
    echo [WARNING] Port 3306 is already in use.
    set /p "continue=Do you want to continue anyway? (y/N): "
    if /i not "!continue!"=="y" exit /b 1
)

REM Parse command line arguments
set "command=%~1"
if "%command%"=="" set "command=deploy"

if /i "%command%"=="deploy" (
    echo [INFO] Starting deployment...
    
    echo [INFO] Stopping existing containers...
    docker-compose down --remove-orphans
    
    echo [INFO] Building and starting services...
    docker-compose build --no-cache
    
    echo [INFO] Starting services...
    docker-compose up -d
    
    echo [INFO] Waiting for services to be ready...
    timeout /t 30 /nobreak >nul
    
    echo [INFO] Checking service health...
    
    REM Check backend
    curl -f http://localhost:8000/docs >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Backend is not responding
    ) else (
        echo [SUCCESS] Backend is running at http://localhost:8000
    )
    
    REM Check frontend
    curl -f http://localhost:3000 >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Frontend is not responding
    ) else (
        echo [SUCCESS] Frontend is running at http://localhost:3000
    )
    
    echo.
    echo [INFO] Application Status:
    docker-compose ps
    echo.
    echo [INFO] Service URLs:
    echo   Frontend: http://localhost:3000
    echo   Backend API: http://localhost:8000
    echo   API Documentation: http://localhost:8000/docs
    echo.
    echo [INFO] Default Login Credentials:
    echo   Admin: admin / admin123
    echo   Manager: manager / manager123
    echo   User: user / user123
    echo.
    
) else if /i "%command%"=="status" (
    echo [INFO] Application Status:
    docker-compose ps
    echo.
    echo [INFO] Service URLs:
    echo   Frontend: http://localhost:3000
    echo   Backend API: http://localhost:8000
    echo   API Documentation: http://localhost:8000/docs
    
) else if /i "%command%"=="logs" (
    echo [INFO] Showing application logs...
    docker-compose logs -f
    
) else if /i "%command%"=="stop" (
    echo [INFO] Stopping application...
    docker-compose down
    echo [SUCCESS] Application stopped
    
) else if /i "%command%"=="restart" (
    echo [INFO] Restarting application...
    docker-compose restart
    echo [SUCCESS] Application restarted
    
) else if /i "%command%"=="update" (
    echo [INFO] Updating application...
    git pull origin main
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d
    echo [SUCCESS] Application updated
    
) else if /i "%command%"=="help" (
    echo BUC Tool Deployment Script for Windows
    echo.
    echo Usage: %0 [COMMAND]
    echo.
    echo Commands:
    echo   deploy   - Deploy the application (default)
    echo   status   - Show application status
    echo   logs     - Show application logs
    echo   stop     - Stop the application
    echo   restart  - Restart the application
    echo   update   - Update the application
    echo   help     - Show this help message
    
) else (
    echo [ERROR] Unknown command: %command%
    echo Use '%0 help' for usage information
    exit /b 1
)

echo.
pause 