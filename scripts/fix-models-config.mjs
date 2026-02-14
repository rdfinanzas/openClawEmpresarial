#!/usr/bin/env node
/**
 * Arregla la estructura de models en config.json
 * Convierte: models.{provider} → models.providers.{provider}
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const configPath = join(homedir(), ".openclaw", "config.json");
const backupPath = join(homedir(), ".openclaw", "config.json.backup." + Date.now());

if (!existsSync(configPath)) {
  console.error("❌ No se encontró config.json");
  process.exit(1);
}

// Backup
copyFileSync(configPath, backupPath);
console.log("💾 Backup creado:", backupPath);

let config = JSON.parse(readFileSync(configPath, "utf-8"));

// Detectar y arreglar estructura incorrecta
const providers = [
  "anthropic", "openai", "deepseek", "moonshot", "zai", 
  "qwen", "minimax", "together", "openrouter", "google", "custom"
];

let fixed = false;

if (config.models) {
  // Si hay providers, migrar de raíz a providers
  for (const provider of providers) {
    if (config.models[provider] && !config.models.providers?.[provider]) {
      console.log(`🔄 Migrando models.${provider} → models.providers.${provider}`);
      
      config.models.providers = config.models.providers || {};
      config.models.providers[provider] = config.models[provider];
      delete config.models[provider];
      fixed = true;
    }
  }
  
  // Eliminar keys vacías que puedan quedar
  for (const key of Object.keys(config.models)) {
    if (key !== "providers" && key !== "mode" && key !== "bedrockDiscovery") {
      if (typeof config.models[key] === "object" && Object.keys(config.models[key]).length === 0) {
        delete config.models[key];
      }
    }
  }
}

if (fixed) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Config arreglado y guardado");
} else {
  console.log("✅ No se encontraron problemas en models");
}

// Verificar estructura final
console.log("\n📊 Estructura de models:");
console.log(JSON.stringify(config.models, null, 2));
