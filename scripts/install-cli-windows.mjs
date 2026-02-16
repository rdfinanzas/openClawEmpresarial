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

// Crear script temporal que ejecuta wizard y luego inicia gateway
const tempScript = resolve(projectRoot, "run-wizard.cmd");
const scriptContent = `
@echo off
cd /d "${projectRoot}"
node agento.mjs onboard
if exist "${configPath}" (
    echo.
    echo Iniciando gateway...
    start /b node agento.mjs gateway
    timeout /t 3 /nobreak >nul
    for /f "tokens=*" %%i in ('type "${configPath}" ^| findstr /c:"port" ^| findstr /r "[0-9]"') do set PORT=%%i
    for /f "tokens=*" %%i in ('type "${configPath}" ^| findstr /c:"token"') do set TOKEN=%%i
    start http://localhost:18789/chat?token=
)
exit
`;

try {
  writeFileSync(tempScript, scriptContent.trim(), "ascii");
} catch {}

// Abrir wizard en nueva ventana
spawn("cmd", ["/c", "start", "cmd", "/k", tempScript], {
  stdio: "ignore",
  detached: true
});

// Cerrar esta ventana inmediatamente
process.exit(0);
