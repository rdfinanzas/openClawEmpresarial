#!/usr/bin/env node
/**
 * Script de reparación automática de config.json
 * Arregla: agents.default → agents.defaults, canales deshabilitados, etc.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const configPath = join(homedir(), ".openclaw", "config.json");
const backupPath = join(homedir(), ".openclaw", "config.json.backup");

if (!existsSync(configPath)) {
  console.error("❌ No se encontró config.json");
  process.exit(1);
}

// Backup
console.log("💾 Creando backup...");
copyFileSync(configPath, backupPath);

let config = JSON.parse(readFileSync(configPath, "utf-8"));

// 1. Arreglar agents.default → agents.defaults
if (config.agents?.default && !config.agents?.defaults) {
  console.log("🔄 Arreglando agents.default → agents.defaults");
  config.agents.defaults = config.agents.default;
  delete config.agents.default;
}

// 2. Asegurar estructura mínima
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.channels = config.channels || {};

// 3. Habilitar canales si tienen token/están configurados
if (config.channels.telegram?.botToken && config.channels.telegram.botToken !== "TOKEN_AQUI") {
  config.channels.telegram.enabled = true;
  console.log("✅ Telegram habilitado");
}

if (config.channels.whatsapp?.accounts || config.channels.whatsapp?.allowFrom) {
  config.channels.whatsapp.enabled = true;
  console.log("✅ WhatsApp habilitado");
}

// 4. Guardar
writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log("\n✅ Config reparado");
console.log("\n📊 Estado actual:");
console.log("  - Estructura agents:", config.agents?.defaults ? "✅ correcta" : "❌");
console.log("  - Telegram:", config.channels?.telegram?.enabled ? "✅ habilitado" : "❌ deshabilitado");
console.log("  - WhatsApp:", config.channels?.whatsapp?.enabled ? "✅ habilitado" : "❌ deshabilitado");
console.log("  - Modelo:", config.agents?.defaults?.model || config.agents?.defaults?.model || "no");

console.log("\n⚠️  IMPORTANTE:");
if (!config.channels?.telegram?.enabled) {
  console.log("  - Telegram tiene token placeholder. Edita el archivo y pon tu token real.");
}
console.log("\n🚀 Para iniciar: openclaw gateway --port 18789");
console.log("📄 Backup guardado en:", backupPath);
