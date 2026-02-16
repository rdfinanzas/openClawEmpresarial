@echo off
title Agento Setup
cd /d "%~dp0"
echo.
echo ========================================
echo  Agento - Configuracion inicial
echo ========================================
echo.
echo Ejecutando wizard de configuracion...
echo.
node agento.mjs onboard
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] El wizard fallo.
    pause
    exit /b 1
)
if not exist "%USERPROFILE%\.openclaw\config.json" (
    echo.
    echo [INFO] No se completo la configuracion.
    pause
    exit /b 0
)
echo.
echo ========================================
echo  Iniciando gateway...
echo ========================================
echo.
start "" node agento.mjs gateway
echo Esperando que inicie el gateway...
ping -n 4 127.0.0.1 >nul
echo.
echo Abriendo navegador...
start http://localhost:18789
echo.
echo ========================================
echo  Listo! El gateway esta corriendo.
echo  Podes cerrar esta ventana.
echo ========================================
echo.
pause
