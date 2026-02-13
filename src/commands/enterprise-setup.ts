/**
 * Comandos para OpenClaw Empresarial
 * 
 * Sistema de dual-personality:
 * - Configuración de personalidad para ventas (público)
 * - Configuración de personalidad para admin (Telegram)
 * - Sistema de escalada integrado
 */

import type { OpenClawConfig } from "../config/config.js";
import { readConfigFileSnapshot, writeConfigFile } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import {
  runEnterpriseWizard,
  reconfigurePersonalities,
  showEnterpriseConfig,
  addEnterpriseApi,
  removeEnterpriseApi,
} from "../wizard/onboarding-enterprise.js";
import { createClackPrompter } from "../wizard/clack-prompter.js";

/**
 * Configura el modo empresarial completo
 * Comando: openclaw enterprise setup
 */
export async function runEnterpriseSetup(): Promise<void> {
  const runtime = defaultRuntime;
  const prompter = createClackPrompter();

  runtime.log("🏪 OpenClaw Empresarial - Configuración");
  runtime.log("");

  // Leer configuración actual
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  // Ejecutar wizard empresarial completo
  const newConfig = await runEnterpriseWizard(config, prompter);

  // Guardar configuración
  await writeConfigFile(newConfig);

  runtime.log("");
  runtime.log("✅ Configuración guardada exitosamente");
  runtime.log("");
  runtime.log("Tu asistente empresarial está listo:");
  runtime.log("  • Personalidad VENTAS: Atiende clientes por WhatsApp");
  runtime.log("  • Personalidad ADMIN: Control total por Telegram");
  runtime.log("  • Sistema de escalada: Ventas → Admin automático");
  runtime.log("  • Protección anti-fraude: Detecta ingeniería social");
  runtime.log("");
  runtime.log("Para ver la configuración:");
  runtime.log("  openclaw enterprise status");
}

/**
 * Muestra el estado de la configuración empresarial
 * Comando: openclaw enterprise status
 */
export async function runEnterpriseStatus(): Promise<void> {
  const runtime = defaultRuntime;
  const prompter = createClackPrompter();

  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  await showEnterpriseConfig(config, prompter);
}

/**
 * Reconfigura las personalidades
 * Comando: openclaw enterprise reconfigure
 */
export async function runEnterpriseReconfigure(): Promise<void> {
  const runtime = defaultRuntime;
  const prompter = createClackPrompter();

  runtime.log("🔄 Reconfigurar OpenClaw Empresarial");
  runtime.log("");

  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  const newConfig = await reconfigurePersonalities(config, prompter);
  await writeConfigFile(newConfig);

  runtime.log("");
  runtime.log("✅ Configuración actualizada");
}

/**
 * Simula una interacción de ventas (para testing)
 * Comando: openclaw enterprise test-sales
 */
export async function runEnterpriseTestSales(): Promise<void> {
  const runtime = defaultRuntime;
  
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;
  
  const personality = config.enterprise?.personality;
  const salesPrompt = config.enterprise?.salesSystemPrompt;
  
  if (!personality || !salesPrompt) {
    runtime.error("❌ No hay configuración empresarial. Ejecuta 'openclaw enterprise setup' primero.");
    return;
  }

  runtime.log("🧪 Test de Personalidad VENTAS");
  runtime.log("");
  runtime.log(`Asistente: ${personality.sales.name}`);
  runtime.log(`Tono: ${personality.sales.tone}`);
  runtime.log("");
  runtime.log("System Prompt que se enviará al agente:");
  runtime.log("━".repeat(60));
  runtime.log(salesPrompt.substring(0, 2000));
  if (salesPrompt.length > 2000) {
    runtime.log(`... (${salesPrompt.length - 2000} caracteres más)`);
  }
  runtime.log("━".repeat(60));
}

/**
 * Simula una interacción de admin (para testing)
 * Comando: openclaw enterprise test-admin
 */
export async function runEnterpriseTestAdmin(): Promise<void> {
  const runtime = defaultRuntime;
  
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;
  
  const personality = config.enterprise?.personality;
  const adminPrompt = config.enterprise?.adminSystemPrompt;
  
  if (!personality || !adminPrompt) {
    runtime.error("❌ No hay configuración empresarial. Ejecuta 'openclaw enterprise setup' primero.");
    return;
  }

  runtime.log("🧪 Test de Personalidad ADMIN");
  runtime.log("");
  runtime.log(`Asistente: ${personality.admin.name}`);
  runtime.log("");
  runtime.log("System Prompt que se enviará al agente:");
  runtime.log("━".repeat(60));
  runtime.log(adminPrompt.substring(0, 2000));
  if (adminPrompt.length > 2000) {
    runtime.log(`... (${adminPrompt.length - 2000} caracteres más)`);
  }
  runtime.log("━".repeat(60));
}

/**
 * Prueba la conexión a una API empresarial
 * Comando: openclaw enterprise test-api <api-id>
 */
export async function runEnterpriseTestApi(apiId: string): Promise<void> {
  const runtime = defaultRuntime;
  
  runtime.log(`🧪 Probando API: ${apiId}`);
  
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;
  
  const api = config.enterprise?.apis?.[apiId];
  
  if (!api) {
    runtime.error(`❌ API ${apiId} no encontrada`);
    runtime.log("");
    runtime.log("APIs disponibles:");
    const apis = config.enterprise?.apis || {};
    for (const id of Object.keys(apis)) {
      runtime.log(`  • ${id}`);
    }
    return;
  }

  runtime.log(`URL: ${api.endpoint}`);
  runtime.log("Conectando...");
  
  try {
    const response = await fetch(api.endpoint, {
      method: api.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...api.headers,
      },
    });
    
    if (response.ok) {
      runtime.log("✅ Conexión exitosa");
      runtime.log(`Status: ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        runtime.log("Respuesta:");
        runtime.log(JSON.stringify(data, null, 2));
      }
    } else {
      runtime.log(`⚠️  Error HTTP: ${response.status}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    runtime.log(`❌ Error de conexión: ${errorMsg}`);
  }
}

/**
 * Muestra las APIs configuradas
 * Comando: openclaw enterprise apis
 */
export async function runEnterpriseApis(): Promise<void> {
  const runtime = defaultRuntime;
  
  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;
  
  const apis = config.enterprise?.apis;
  
  if (!apis || Object.keys(apis).length === 0) {
    runtime.log("⚠️  No hay APIs empresariales configuradas");
    runtime.log("");
    runtime.log("Para configurar APIs:");
    runtime.log("  openclaw enterprise setup");
    return;
  }

  runtime.log("📦 APIs Empresariales Configuradas");
  runtime.log("");
  
  for (const [id, api] of Object.entries(apis)) {
    runtime.log(`  📌 ${id}`);
    runtime.log(`     Endpoint: ${api.endpoint}`);
    runtime.log(`     Método: ${api.method || "GET"}`);
    runtime.log(`     Auth: ${api.auth || "none"}`);
    runtime.log("");
  }
}

/**
 * Agrega una nueva API empresarial
 * Comando: openclaw enterprise apis add
 */
export async function runEnterpriseAddApi(): Promise<void> {
  const runtime = defaultRuntime;
  const prompter = createClackPrompter();

  runtime.log("➕ Agregar API Empresarial");
  runtime.log("");

  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  const newConfig = await addEnterpriseApi(config, prompter);
  await writeConfigFile(newConfig);

  runtime.log("");
  runtime.log("✅ API agregada exitosamente");
}

/**
 * Elimina una API empresarial
 * Comando: openclaw enterprise apis remove <api-id>
 */
export async function runEnterpriseRemoveApi(apiId: string): Promise<void> {
  const runtime = defaultRuntime;

  runtime.log(`🗑️  Eliminando API: ${apiId}`);

  const snapshot = await readConfigFileSnapshot();
  const config = snapshot.config;

  const newConfig = await removeEnterpriseApi(config, apiId);
  
  if (newConfig === config) {
    runtime.log(`⚠️  API ${apiId} no encontrada`);
    return;
  }

  await writeConfigFile(newConfig);
  runtime.log("✅ API eliminada exitosamente");
}
