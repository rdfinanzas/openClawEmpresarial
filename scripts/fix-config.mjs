#!/usr/bin/env node
/**
 * Script para arreglar/migrar config.json de OpenClaw Empresarial
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

const configPath = join(homedir(), ".openclaw", "config.json");

if (!existsSync(configPath)) {
  console.error("❌ No se encontró config.json");
  process.exit(1);
}

console.log("📁 Arreglando config...\n");

let config = JSON.parse(readFileSync(configPath, "utf-8"));

// 1. Migrar agent: a agents.defaults:
if (config.agent) {
  console.log("🔄 Migrando agent: → agents.defaults:");
  config.agents = {
    defaults: {
      ...config.agent,
      ...config.agents?.defaults
    }
  };
  delete config.agent;
}

// Asegurar estructura base
config.agents = config.agents || {};
config.agents.defaults = config.agents.defaults || {};
config.channels = config.channels || {};

// 2. Agregar Telegram si falta
if (!config.channels.telegram?.botToken) {
  console.log("\n📱 CONFIGURACIÓN DE TELEGRAM");
  console.log("────────────────────────────");
  console.log("1. Abre Telegram y busca @BotFather");
  console.log("2. Envía /newbot y sigue las instrucciones");
  console.log("3. Copia el token que te da\n");
  
  const token = await ask("Token del bot: ");
  
  if (token && token.includes(":")) {
    const userId = await ask("Tu ID de usuario (opcional, @userinfobot): ");
    
    config.channels.telegram = {
      enabled: true,
      botToken: token,
      dmPolicy: "allowlist",
      ...(userId ? { allowFrom: [userId] } : {})
    };
    console.log("✅ Telegram configurado\n");
  } else {
    console.log("⚠️  Token inválido, saltando Telegram\n");
  }
}

// 3. Agregar WhatsApp si falta
if (!config.channels.whatsapp?.enabled) {
  console.log("\n💬 WHATSAPP");
  console.log("────────────");
  const phone = await ask("Número de WhatsApp Ventas (con +, ej: +54911...): ");
  
  if (phone && phone.startsWith("+")) {
    config.channels.whatsapp = {
      enabled: true,
      accounts: {
        ventas: {
          phoneNumber: phone,
          role: "public",
          purpose: "Atención al público"
        }
      }
    };
    console.log("✅ WhatsApp configurado");
    console.log("⚠️  Para vincular, ejecuta: openclaw channels login --account ventas\n");
  } else {
    console.log("⚠️  Número inválido, saltando WhatsApp\n");
  }
}

// 4. Agregar modelo si falta
if (!config.agents.defaults.model) {
  console.log("\n🤖 MODELO LLM");
  console.log("─────────────");
  const models = [
    { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet (Anthropic)" },
    { id: "gpt-4o", name: "GPT-4o (OpenAI)" },
    { id: "deepseek-chat", name: "DeepSeek Chat" },
  ];
  
  models.forEach((m, i) => console.log(`${i + 1}. ${m.name}`));
  
  const choice = await ask("\nElige modelo (número): ");
  const model = models[parseInt(choice) - 1];
  
  if (model) {
    config.agents.defaults.model = model.id;
    
    const apiKey = await ask("API Key: ");
    if (apiKey) {
      const provider = model.id.includes("claude") ? "anthropic" :
                       model.id.includes("gpt") ? "openai" : "deepseek";
      config.models = config.models || {};
      config.models[provider] = { apiKey };
    }
    console.log("✅ Modelo configurado\n");
  }
}

// 5. Guardar
writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log("\n✅ Configuración guardada en:", configPath);
console.log("\n📊 Resumen:");
console.log("  - Gateway:", config.gateway?.port || "no");
console.log("  - Telegram:", config.channels?.telegram?.enabled ? "✅" : "❌");
console.log("  - WhatsApp:", config.channels?.whatsapp?.enabled ? "✅" : "❌");
console.log("  - Modelo:", config.agents?.defaults?.model || "no");

console.log("\n🚀 Para iniciar:");
console.log("   openclaw gateway --port 18789");

rl.close();
