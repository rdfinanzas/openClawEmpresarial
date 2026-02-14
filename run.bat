@echo off
REM Script para ejecutar OpenClaw Empresarial (sin recompilar si ya está compilado)

IF EXIST "dist\entry.js" (
    echo [Agento] Ejecutando desde dist/ (ya compilado)...
    node agento.mjs %*
) ELSE (
    echo [OpenClaw] Primera ejecución - Compilando...
    npm run start:npm -- %*
)
