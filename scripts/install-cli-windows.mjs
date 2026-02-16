#!/usr/bin/env node
/**
 * Postinstall script para Windows
 * Crea comandos globales 'agento' y 'openclaw' automáticamente
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Solo ejecutar en Windows
if (process.platform !== "win32") {
  console.log("[install-cli] No es Windows, omitiendo...");
  process.exit(0);
}

const agentoPath = resolve(projectRoot, "agento.mjs");

// Contenido del archivo .cmd
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

console.log("[install-cli] Configurando comandos CLI para Windows...\n");

// Opción 1: C:\Windows (requiere admin)
const windowsDir = "C:\\Windows";
if (tryCreateCmd(windowsDir, "agento") && tryCreateCmd(windowsDir, "openclaw")) {
  console.log("✓ Comandos instalados en C:\\Windows\\");
  console.log("✓ Ya podes usar: agento [comando] y openclaw [comando]");
  console.log("\n  Si la terminal ya estaba abierta, abrí una nueva para que reconozca los comandos.\n");
  process.exit(0);
}

// Opción 2: %LOCALAPPDATA%\Programs\agento
const localAppData = process.env.LOCALAPPDATA;
if (localAppData) {
  const binDir = resolve(localAppData, "Programs", "agento");
  try {
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }
    if (tryCreateCmd(binDir, "agento") && tryCreateCmd(binDir, "openclaw")) {
      console.log("✓ Comandos instalados en " + binDir + "\\");
      console.log("\n  IMPORTANTE: Agregá este directorio a tu PATH:");
      console.log("  " + binDir);
      console.log('\n  O ejecuta esto en PowerShell como Admin:');
      console.log('  [Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";' + binDir + '", "User")\n');
      process.exit(0);
    }
  } catch {
    // Falló, continuar
  }
}

// Opción 3: Directorio del usuario
const userBin = resolve(process.env.USERPROFILE || ".", ".local", "bin");
try {
  if (!existsSync(userBin)) {
    mkdirSync(userBin, { recursive: true });
  }
  if (tryCreateCmd(userBin, "agento") && tryCreateCmd(userBin, "openclaw")) {
    console.log("✓ Comandos instalados en " + userBin + "\\");
    console.log("\n  IMPORTANTE: Agregá este directorio a tu PATH:");
    console.log("  " + userBin);
    console.log("\n  O ejecuta esto en PowerShell:");
    console.log('  $env:PATH += ";' + userBin + '"\n');
    process.exit(0);
  }
} catch {
  // Falló
}

console.log("⚠ No se pudieron instalar los comandos automáticamente.");
console.log("\n  Ejecuta manualmente como Administrador:");
console.log('  node "' + resolve(projectRoot, "scripts", "install-cli-windows.mjs") + '"\n');

process.exit(0);
