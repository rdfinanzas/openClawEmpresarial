@echo off
echo ========================================
echo  Instalando comandos agento y openclaw
echo ========================================
echo.

:: Crear archivos .cmd en C:\Windows (requiere Admin)
echo Creando comandos en C:\Windows...

echo @node "%~dp0agento.mjs" %%* > "%TEMP%\agento.cmd"
echo @node "%~dp0agento.mjs" %%* > "%TEMP%\openclaw.cmd"

:: Intentar copiar a Windows (necesita Admin)
copy /Y "%TEMP%\agento.cmd" "C:\Windows\agento.cmd" >nul 2>&1
copy /Y "%TEMP%\openclaw.cmd" "C:\Windows\openclaw.cmd" >nul 2>&1

if exist "C:\Windows\agento.cmd" (
    echo [OK] Comandos instalados en C:\Windows
    echo.
    echo Probando...
    call agento --version
    echo.
    echo ========================================
    echo  Listo! Ya podes usar:
    echo   - agento [comando]
    echo   - openclaw [comando]
    echo ========================================
) else (
    echo [ERROR] No se pudo copiar a C:\Windows
    echo.
    echo Ejecuta este script como ADMINISTRADOR:
    echo   Click derecho ^> Ejecutar como administrador
    echo.
    echo O agrega esto al PATH manualmente:
    echo   %~dp0
    pause
    exit /b 1
)

:: Limpiar archivos temporales
del "%TEMP%\agento.cmd" >nul 2>&1
del "%TEMP%\openclaw.cmd" >nul 2>&1

pause
