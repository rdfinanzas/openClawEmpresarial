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
echo.
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El wizard fallo.
    pause
    exit /b 1
)
if not exist "%USERPROFILE%\.openclaw\config.json" (
    echo [INFO] No se completo la configuracion.
    pause
    exit /b 0
)
echo ========================================
echo  Configuracion completada!
echo ========================================
echo.
echo Para iniciar el gateway ejecuta:
echo   agento gateway
echo.
echo O ejecuta directamente:
echo   node agento.mjs gateway
echo.
pause
