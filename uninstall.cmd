@echo off
echo ========================================
echo  Desinstalando Agento...
echo ========================================
echo.

:: Eliminar comandos CLI
del /f "C:\Windows\agento.cmd" 2>nul
del /f "C:\Windows\openclaw.cmd" 2>nul
del /f "%LOCALAPPDATA%\Programs\agento\agento.cmd" 2>nul
del /f "%LOCALAPPDATA%\Programs\agento\openclaw.cmd" 2>nul
del /f "%USERPROFILE%\.local\bin\agento.cmd" 2>nul
del /f "%USERPROFILE%\.local\bin\openclaw.cmd" 2>nul

:: Eliminar configuración
if exist "%USERPROFILE%\.openclaw" (
    rmdir /s /q "%USERPROFILE%\.openclaw" 2>nul
)

echo.
echo ========================================
echo  Desinstalacion exitosa
echo ========================================
echo.
