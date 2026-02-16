#!/usr/bin/env node
/**
 * Postinstall script para Windows
 * Instala CLI y ejecuta el wizard en nueva ventana
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Solo ejecutar en Windows
if (process.platform !== "win32") {
  process.exit(0);
}

const agentoPath = resolve(projectRoot, "agento.mjs");
const openclawDir = resolve(process.env.USERPROFILE || ".", ".openclaw");
const configPath = resolve(openclawDir, "config.json");

const cmdContent = '@node "' + agentoPath + '" %*\n';

function tryCreateCmd(dir, name) {
  const filePath = resolve(dir, name + ".cmd");
  try {
    writeFileSync(filePath, cmdContent, "ascii");
    return true;
  } catch {
    return false;
  }
}

// Instalar comandos CLI silenciosamente
let cliInstalled = false;

const windowsDir = "C:\\Windows";
if (tryCreateCmd(windowsDir, "agento") && tryCreateCmd(windowsDir, "openclaw")) {
  cliInstalled = true;
}

if (!cliInstalled) {
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const binDir = resolve(localAppData, "Programs", "agento");
    try {
      if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
      if (tryCreateCmd(binDir, "agento") && tryCreateCmd(binDir, "openclaw")) {
        cliInstalled = true;
      }
    } catch {}
  }
}

if (!cliInstalled) {
  const userBin = resolve(process.env.USERPROFILE || ".", ".local", "bin");
  try {
    if (!existsSync(userBin)) mkdirSync(userBin, { recursive: true });
    if (tryCreateCmd(userBin, "agento") && tryCreateCmd(userBin, "openclaw")) {
      cliInstalled = true;
    }
  } catch {}
}

// Si ya existe config, salir silenciosamente
if (existsSync(configPath)) {
  process.exit(0);
}

// Crear script que ejecuta wizard y luego inicia gateway
const tempScript = resolve(projectRoot, "run-wizard.cmd");
const scriptContent = `@echo off
title Agento Setup
cd /d "${projectRoot}"
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
    echo [ERROR] El wizard fallo. Presiona una tecla para cerrar.
    pause >nul
    exit /b 1
)
if not exist "${configPath}" (
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
`;

try {
  writeFileSync(tempScript, scriptContent.trim(), "ascii");
} catch {}

// Abrir wizard en nueva ventana
spawn("cmd", ["/c", "start", "cmd", "/k", tempScript], {
  stdio: "ignore",
  detached: true
});

// Salir silenciosamente (no cerrar ventana de pnpm)
process.exit(0);
