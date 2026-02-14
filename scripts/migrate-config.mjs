#!/usr/bin/env node
/**
 * Script de migración de config.json
 * - Convierte agent: a agents.defaults:
 * - Agrega estructura de Telegram si falta
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const configPath = join(homedir(), ".openclaw", "config.json");

if (!existsSync(configPath)) {
  console.error("❌ No se encontró config.json en:", configPath);
  console.log("💡 Ejecuta 'openclaw onboard' primero");
  process.exit(1);
}

console.log("📁 Migrando:", configPath);

let config;
try {
  const content = readFileSync(configPath, "utf-8");
  config = JSON.parse(content);
} catch (err) {
  console.error("❌ Error leyendo config:", err.message);
  process.exit(1);
}

let modified = false;

// 1. Migrar agent: a agents.defaults:
if (config.agent) {
  console.log("🔄 Migrando 'agent:' a 'agents.defaults:'...");
  config.agents = {
    ...config.agents,
    defaults: {
      ...config.agents?.defaults,
      ...config.agent,
    },
  };
  delete config.agent;
  modified = true;
}

// 2. Verificar si falta Telegram
if (!config.channels?.telegram?.botToken) {
  console.log("⚠️  Falta configuración de Telegram");
  console.log("\n📝 Para agregar Telegram manualmente, edita el archivo y agrega:");
  console.log(`
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "TU_BOT_TOKEN_AQUI",
      "dmPolicy": "allowlist",
      "allowFrom": ["TU_USER_ID_AQUI"]
    },
    ...resto de canales...
  }
  `);
  console.log("\n🔑 Obtener token: Habla con @BotFather en Telegram");
  console.log("👤 Obtener tu ID: Habla con @userinfobot en Telegram\n");
}

// 3. Guardar cambios
if (modified) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Config migrado exitosamente");
} else {
  console.log("✅ Config ya está en el formato correcto");
}

// 4. Mostrar resumen
console.log("\n📊 Resumen de configuración:");
console.log("- Gateway port:", config.gateway?.port || "no configurado");
console.log("- Telegram:", config.channels?.telegram?.enabled ? "✅ activado" : "❌ no configurado");
console.log("- WhatsApp:", config.channels?.whatsapp?.enabled ? "✅ activado" : "❌ no configurado");
console.log("- Modelo:", config.agents?.defaults?.model || config.agent?.model || "no configurado");
