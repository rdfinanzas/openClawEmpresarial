#!/usr/bin/env node
/**
 * Postinstall script para Windows
 * Instala CLI y ejecuta el wizard automáticamente si no hay config
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

// Instalar comandos CLI
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

// Ejecutar wizard automáticamente
const wizard = spawn("node", [agentoPath, "onboard"], {
  stdio: "inherit",
  cwd: projectRoot,
  shell: true
});

wizard.on("close", (code) => {
  if (code === 0 && existsSync(configPath)) {
    // Leer config para obtener puerto y token
    try {
      const configData = readFileSync(configPath, "utf-8");
      const config = JSON.parse(configData);
      const port = config.gateway?.port || 18789;
      const token = config.gateway?.auth?.token || "";

      // Iniciar gateway
      const gateway = spawn("node", [agentoPath, "gateway"], {
        stdio: "ignore",
        cwd: projectRoot,
        detached: true,
        shell: true
      });
      gateway.unref();

      // Abrir navegador después de 3 segundos
      setTimeout(() => {
        const loginUrl = token
          ? "http://localhost:" + port + "/chat?token=" + token
          : "http://localhost:" + port + "/admin/login";
        spawn("cmd", ["/c", "start", "", loginUrl], { stdio: "ignore", detached: true });
      }, 3000);
    } catch {}
  }
  process.exit(code || 0);
});

wizard.on("error", () => {
  process.exit(1);
});
