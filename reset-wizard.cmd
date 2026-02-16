@echo off
echo ========================================
echo  Reset de Agento - Solo configuracion
echo ========================================
echo.
echo Esto eliminara la configuracion para poder
echo ejecutar el wizard nuevamente.
echo.

set /p CONFIRM="Continuar? (s/n): "
if /i not "%CONFIRM%"=="s" (
    echo Cancelado.
    pause
    exit /b 0
)

:: Eliminar config
if exist "%USERPROFILE%\.openclaw" (
    rmdir /s /q "%USERPROFILE%\.openclaw" 2>nul
    echo [OK] Configuracion eliminada
) else (
    echo [INFO] No habia configuracion
)

echo.
echo ========================================
echo  Listo! Ejecuta ahora:
echo   pnpm install
echo ========================================
echo.
pause
