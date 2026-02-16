#!/usr/bin/env node
/**
 * Postinstall script para Windows
 * Crea comandos globales 'agento' y 'openclaw' automáticamente
 * Detecta primera instalación y ofrece ejecutar el wizard
 */

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Solo ejecutar en Windows
if (process.platform !== "win32") {
  console.log("[install-cli] No es Windows, omitiendo...");
  process.exit(0);
}

const agentoPath = resolve(projectRoot, "agento.mjs");
const openclawDir = resolve(process.env.USERPROFILE || ".", ".openclaw");
const configPath = resolve(openclawDir, "config.json");

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

let cliInstalled = false;

// Opción 1: C:\Windows (requiere admin)
const windowsDir = "C:\\Windows";
if (tryCreateCmd(windowsDir, "agento") && tryCreateCmd(windowsDir, "openclaw")) {
  console.log("✓ Comandos instalados en C:\\Windows\\");
  console.log("✓ Ya podes usar: agento [comando] y openclaw [comando]");
  cliInstalled = true;
}

// Opción 2: %LOCALAPPDATA%\Programs\agento
if (!cliInstalled) {
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
        cliInstalled = true;
      }
    } catch {
      // Falló, continuar
    }
  }
}

// Opción 3: Directorio del usuario
if (!cliInstalled) {
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
      cliInstalled = true;
    }
  } catch {
    // Falló
  }
}

if (!cliInstalled) {
  console.log("⚠ No se pudieron instalar los comandos automáticamente.");
  console.log("\n  Ejecuta manualmente como Administrador:");
  console.log('  node "' + resolve(projectRoot, "scripts", "install-cli-windows.mjs") + '"\n');
}

// Detectar primera instalación y ejecutar wizard automáticamente
console.log("\n[install-cli] Verificando configuración existente...");

if (!existsSync(configPath)) {
  console.log("\n  ╔════════════════════════════════════════════════════════╗");
  console.log("  ║  🦞 Bienvenido a Agento!                               ║");
  console.log("  ║                                                        ║");
  console.log("  ║  Iniciando asistente de configuración...               ║");
  console.log("  ╚════════════════════════════════════════════════════════╝\n");

  // Ejecutar el wizard directamente
  const wizard = spawn("node", [agentoPath, "wizard"], {
    stdio: "inherit",
    cwd: projectRoot,
    shell: true
  });

  wizard.on("close", (code) => {
    if (code === 0) {
      console.log("\n✓ Configuración completada!");
      console.log("  Ejecuta 'agento gateway start' para iniciar el gateway.\n");
    }
    process.exit(code || 0);
  });

  wizard.on("error", (err) => {
    console.error("\nError al ejecutar wizard:", err.message);
    console.log("  Puedes ejecutarlo manualmente con: agento wizard\n");
    process.exit(1);
  });
} else {
  console.log("✓ Configuración existente encontrada en " + openclawDir);
  console.log("  Para reconfigurar, ejecuta: agento wizard\n");
  process.exit(0);
}
