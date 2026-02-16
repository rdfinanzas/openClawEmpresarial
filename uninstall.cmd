@echo off
echo ========================================
echo  Desinstalador de Agento
echo ========================================
echo.

:: Eliminar comandos CLI
echo Eliminando comandos CLI...
del /f "C:\Windows\agento.cmd" 2>nul
del /f "C:\Windows\openclaw.cmd" 2>nul
del /f "%LOCALAPPDATA%\Programs\agento\agento.cmd" 2>nul
del /f "%LOCALAPPDATA%\Programs\agento\openclaw.cmd" 2>nul
del /f "%USERPROFILE%\.local\bin\agento.cmd" 2>nul
del /f "%USERPROFILE%\.local\bin\openclaw.cmd" 2>nul
echo [OK] Comandos eliminados

:: Eliminar configuración
echo.
set /p REMOVE_CONFIG="Eliminar configuracion (~/.openclaw)? (s/n): "
if /i "%REMOVE_CONFIG%"=="s" (
    rmdir /s /q "%USERPROFILE%\.openclaw" 2>nul
    echo [OK] Configuracion eliminada
) else (
    echo [SKIP] Configuracion conservada
)

:: Eliminar node_modules
echo.
set /p REMOVE_MODULES="Eliminar node_modules? (s/n): "
if /i "%REMOVE_MODULES%"=="s" (
    if exist "%~dp0node_modules" (
        rmdir /s /q "%~dp0node_modules" 2>nul
        echo [OK] node_modules eliminado
    )
) else (
    echo [SKIP] node_modules conservado
)

echo.
echo ========================================
echo  Desinstalacion completada
echo ========================================
echo.
echo Para reinstalar:
echo   pnpm install
echo.
pause
