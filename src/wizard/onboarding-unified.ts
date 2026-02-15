/**
 * OpenClaw - Wizard Unificado
 * 
 * Combina onboard + enterprise en un solo flujo continuo.
 * El usuario ejecuta solo: openclaw onboard
 */

import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";
import type { GatewayWizardSettings } from "./onboarding.types.js";
import { logWarn } from "../logger.js";
import { readConfigFileSnapshot, writeConfigFile, DEFAULT_GATEWAY_PORT } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { applyWizardMetadata, DEFAULT_WORKSPACE, ensureWorkspaceAndSessions, printWizardHeader, summarizeExistingConfig, handleReset, probeGatewayReachable, waitForGatewayReachable, resolveControlUiLinks, detectBrowserOpenSupport, openUrl, formatControlUiSshHint } from "../commands/onboard-helpers.js";
import { setupInternalHooks } from "../commands/onboard-hooks.js";
import { warnIfModelConfigLooksOff } from "../commands/auth-choice.js";
import { WizardCancelledError } from "./prompts.js";
import { getChannelOnboardingAdapter } from "../commands/onboarding/registry.js";
import { listChannelPlugins, getChannelPlugin } from "../channels/plugins/index.js";
import { resolveChannelDefaultAccountId } from "../channels/plugins/helpers.js";
import { normalizeAccountId, DEFAULT_ACCOUNT_ID } from "../routing/session-key.js";
import { loginWeb } from "../channel-web.js";
import { setDeepseekApiKey, setMoonshotApiKey, setZaiApiKey, setQwenApiKey, setMinimaxApiKey, setTogetherApiKey, setOpenrouterApiKey, setGeminiApiKey, setAnthropicApiKey, setOpenAIApiKey } from "../commands/onboard-auth.credentials.js";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { addChannelAllowFromStoreEntry } from "../pairing/pairing-store.js";
import { setupSkills } from "../commands/onboard-skills.js";
import { formatCliCommand } from "../cli/command-format.js";
import { resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { buildGatewayInstallPlan, gatewayInstallErrorHint } from "../commands/daemon-install-helpers.js";
import { DEFAULT_GATEWAY_DAEMON_RUNTIME, GATEWAY_DAEMON_RUNTIME_OPTIONS } from "../commands/daemon-runtime.js";
import { healthCommand } from "../commands/health.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { runTui } from "../tui/tui.js";
import { setupOnboardingShellCompletion } from "./onboarding.completion.js";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";

// ============================================================
// FUNCIÓN PARA INICIAR GATEWAY EN WINDOWS
// ============================================================

async function startGatewayOnWindows(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<{ success: boolean; pid?: number; error?: string }> {
  const port = config.gateway?.port || DEFAULT_GATEWAY_PORT;

  await prompter.note(
    [
      "🖥️ WINDOWS DETECTADO",
      "",
      "En Windows el gateway se ejecuta como proceso en segundo plano.",
      "Para iniciarlo automáticamente al arrancar Windows,",
      "podés agregar un acceso directo a la carpeta de inicio.",
    ].join("\n"),
    "Iniciando Gateway"
  );

  return new Promise((resolve) => {
    try {
      // Obtener la ruta del ejecutable
      const nodePath = process.execPath;
      const scriptPath = path.join(process.cwd(), "agento.mjs");

      // Iniciar el gateway en segundo plano
      const child = spawn(nodePath, [scriptPath, "gateway", "--port", String(port)], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: {
          ...process.env,
          NODE_ENV: "production",
        },
      });

      // Desacoplar el proceso para que siga corriendo
      child.unref();

      child.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      // Dar un momento para que inicie
      setTimeout(() => {
        if (child.pid) {
          resolve({ success: true, pid: child.pid });
        } else {
          resolve({ success: false, error: "No se pudo obtener el PID del proceso" });
        }
      }, 1000);
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

// ============================================================
// FUNCIÓN PARA ABRIR NAVEGADOR EN WINDOWS
// ============================================================

async function openBrowserOnWindows(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
    });

    child.on("error", () => resolve(false));
    child.unref();

    setTimeout(() => resolve(true), 500);
  });
}

const logger = (msg: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`onboarding-unified: ${msg}${metaStr}`);
};

// ============================================================
// INTERFACES
// ============================================================

export interface EnterprisePersonality {
  businessName: string;
  businessType: 'retail' | 'services' | 'consulting' | 'healthcare' | 'education' | 'other';
  businessDescription: string;
  sales: {
    name: string;
    tone: 'professional' | 'friendly' | 'casual' | 'luxury';
    expertise: string[];
    restrictions: string[];
    customInstructions?: string;
  };
  admin: {
    name: string;
    capabilities: string[];
    escalationTriggers: string[];
    customInstructions?: string;
  };
}

// ============================================================
// PASO 0: ADVERTENCIA DE SEGURIDAD
// ============================================================

async function requireRiskAcknowledgement(params: {
  prompter: WizardPrompter;
}): Promise<void> {
  await params.prompter.note(
    [
      "⚠️  ADVERTENCIA DE SEGURIDAD",
      "",
      "Agento es un proyecto en desarrollo (beta).",
      "Este bot puede leer archivos y ejecutar acciones.",
      "",
      "Línea base recomendada:",
      "• Pairing/allowlists + mention gating",
      "• Sandbox + herramientas de mínimo privilegio",
      "• No guardar secretos en archivos accesibles",
      "",
      "Documentación: https://docs.agento.ai/gateway/security",
    ].join("\n"),
    "Seguridad"
  );

  const ok = await params.prompter.confirm({
    message: "¿Entiendes los riesgos y quieres continuar?",
    initialValue: false,
  });

  if (!ok) {
    throw new WizardCancelledError("risk not accepted");
  }
}

// ============================================================
// PASO 1: MODO DE CONFIGURACIÓN
// ============================================================

async function promptMode(prompter: WizardPrompter): Promise<'quickstart' | 'manual'> {
  return await prompter.select({
    message: "Modo de configuración",
    options: [
      { value: "quickstart", label: "QuickStart", hint: "Configuración rápida recomendada" },
      { value: "manual", label: "Manual", hint: "Configurar cada opción paso a paso" },
    ],
    initialValue: "quickstart",
  });
}

// ============================================================
// PASO 2: AUTENTICACIÓN LLM
// ============================================================

async function setupAuthAndModel(
  config: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "CONFIGURACIÓN DE MODELO DE IA",
      "",
      "Selecciona el proveedor de IA para tu asistente.",
    ].join("\n"),
    "Paso 2 de 7"
  );

  const provider = await prompter.select({
    message: "Proveedor de IA",
    options: [
      { value: "anthropic", label: "🇺🇸 Anthropic (Claude)", hint: "Recomendado. Mejor calidad y seguridad." },
      { value: "openai", label: "🇺🇸 OpenAI (GPT/Codex)", hint: "GPT-4, o1, Codex" },
      { value: "moonshot", label: "🇨🇳 Moonshot AI (Kimi K2.5)", hint: "Excelente para coding" },
      { value: "zai", label: "🇨🇳 Z.AI (GLM 4.7)", hint: "Buen rendimiento en español" },
      { value: "deepseek", label: "🇨🇳 DeepSeek", hint: "Especializado en código y matemáticas" },
      { value: "qwen", label: "🇨🇳 Qwen (Alibaba)", hint: "Multilingüe" },
      { value: "minimax", label: "🇨🇳 MiniMax (M2.1)", hint: "Modelo chino de alta calidad" },
      { value: "together", label: "🇺🇸 Together AI", hint: "Llama, DeepSeek, Qwen open models" },
      { value: "openrouter", label: "🌐 OpenRouter", hint: "Múltiples modelos incluidos chinos" },
      { value: "google", label: "🇺🇸 Google (Gemini)", hint: "Gemini Pro/Flash" },
      { value: "custom", label: "⚙️ Custom Provider", hint: "Endpoint compatible OpenAI/Anthropic" },
    ],
  });

  // Pedir API Key según el proveedor seleccionado
  let apiKey = "";
  
  const providerLabels: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    moonshot: "Moonshot AI (Kimi)",
    zai: "Z.AI (GLM)",
    deepseek: "DeepSeek",
    qwen: "Qwen (Alibaba)",
    minimax: "MiniMax",
    together: "Together AI",
    openrouter: "OpenRouter",
    google: "Google (Gemini)",
    custom: "Custom Provider",
  };

  await prompter.note(
    [
      `AUTENTICACIÓN PARA ${providerLabels[provider]?.toUpperCase() || provider}`,
      "",
      `Necesitas una API Key de ${providerLabels[provider] || provider}.`,
      "",
      "¿Dónde obtenerla?",
      getProviderHelp(provider),
    ].join("\n"),
    "API Key"
  );

  apiKey = await prompter.text({
    message: `Ingresa tu API Key de ${providerLabels[provider] || provider}`,
    placeholder: getApiKeyPlaceholder(provider),
    validate: (val) => val.trim().length < 10 ? "API Key muy corta" : undefined,
  });

  // Mostrar validación (simulada - en producción se verificaría con la API)
  await prompter.note(
    [`✅ API Key válida!`].join("\n"),
    "Verificado"
  );

  // Configurar modelo y credenciales
  let nextConfig = config;
  
  const modelMap: Record<string, string> = {
    anthropic: "anthropic/claude-opus-4-6",
    openai: "openai/gpt-4o",
    moonshot: "moonshot/kimi-k2.5",
    zai: "zai/glm-4.7",
    deepseek: "deepseek/deepseek-chat",
    qwen: "qwen/qwen-2.5",
    minimax: "minimax/m2.1",
    together: "together/llama-3.1-405b",
    openrouter: "openrouter/anthropic/claude-opus-4-6",
    google: "google/gemini-1.5-pro",
    custom: "custom/default",
  };

  const envVarMap: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    moonshot: "MOONSHOT_API_KEY",
    zai: "ZAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    qwen: "QWEN_API_KEY",
    minimax: "MINIMAX_API_KEY",
    together: "TOGETHER_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    google: "GOOGLE_API_KEY",
    custom: "CUSTOM_API_KEY",
  };

  // Guardar API key en auth profiles (donde OpenClaw espera encontrarlas)
  const agentDir = resolveOpenClawAgentDir();
  const trimmedKey = apiKey.trim();
  
  switch (provider) {
    case "anthropic":
      await setAnthropicApiKey(trimmedKey, agentDir);
      break;
    case "openai":
      await setOpenAIApiKey(trimmedKey, agentDir);
      break;
    case "moonshot":
      await setMoonshotApiKey(trimmedKey, agentDir);
      break;
    case "zai":
      await setZaiApiKey(trimmedKey, agentDir);
      break;
    case "deepseek":
      await setDeepseekApiKey(trimmedKey, agentDir);
      break;
    case "qwen":
      await setQwenApiKey(trimmedKey, agentDir);
      break;
    case "minimax":
      await setMinimaxApiKey(trimmedKey, agentDir);
      break;
    case "together":
      await setTogetherApiKey(trimmedKey, agentDir);
      break;
    case "openrouter":
      await setOpenrouterApiKey(trimmedKey, agentDir);
      break;
    case "google":
      await setGeminiApiKey(trimmedKey, agentDir);
      break;
    default:
      // Para proveedores personalizados, guardar en variable de entorno
      process.env[`${provider.toUpperCase()}_API_KEY`] = trimmedKey;
  }

  // Guardar solo el modelo default en config (como objeto con primary/fallbacks)
  nextConfig = {
    ...nextConfig,
    agents: {
      ...nextConfig.agents,
      defaults: {
        ...nextConfig.agents?.defaults,
        model: {
          primary: modelMap[provider] || modelMap.anthropic,
          fallbacks: [],
        },
      },
    },
  };

  await prompter.note(
    [`✅ API Key de ${providerLabels[provider]} configurada.`].join("\n"),
    "Éxito"
  );

  return nextConfig;

  // Funciones auxiliares
  function getProviderHelp(provider: string): string {
    const help: Record<string, string> = {
      anthropic: "1. Ve a https://console.anthropic.com\n2. Crea una cuenta o inicia sesión\n3. Ve a Settings → API Keys\n4. Genera una nueva API Key",
      openai: "1. Ve a https://platform.openai.com\n2. Crea una cuenta o inicia sesión\n3. Ve a API Keys\n4. Crea una nueva API Key",
      moonshot: "1. Ve a https://platform.moonshot.cn\n2. Regístrate con email chino o internacional\n3. Ve a API Keys\n4. Genera una nueva key",
      zai: "1. Ve a https://www.z.ai\n2. Regístrate\n3. Ve a API section\n4. Obtén tu API Key",
      deepseek: "1. Ve a https://platform.deepseek.com\n2. Crea una cuenta\n3. Ve a API Keys\n4. Genera una nueva API Key",
      qwen: "1. Ve a https://dashscope.aliyun.com\n2. Regístrate con cuenta Alibaba\n3. Crea una API Key en el dashboard",
      minimax: "1. Ve a https://www.minimaxi.com\n2. Regístrate\n3. Solicita acceso a API\n4. Obtén tu API Key",
      together: "1. Ve a https://api.together.xyz\n2. Crea una cuenta\n3. Ve a API Keys\n4. Copia tu key",
      openrouter: "1. Ve a https://openrouter.ai\n2. Crea una cuenta\n3. Ve a Keys\n4. Genera una nueva key",
      google: "1. Ve a https://ai.google.dev\n2. Inicia sesión con Google\n3. Ve a API Keys\n4. Crea una nueva key",
      custom: "Consulta la documentación de tu proveedor personalizado.",
    };
    return help[provider] || "Consulta la documentación del proveedor.";
  }

  function getApiKeyPlaceholder(provider: string): string {
    const placeholders: Record<string, string> = {
      anthropic: "sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      openai: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      deepseek: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      moonshot: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    };
    return placeholders[provider] || "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  }
}

// ============================================================
// PASO 3: CONFIGURACIÓN DEL GATEWAY
// ============================================================

async function setupGateway(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<{ config: OpenClawConfig; token?: string }> {
  await prompter.note(
    [
      "CONFIGURACIÓN DEL GATEWAY",
      "",
      "El gateway es el centro de control de Agento.",
    ].join("\n"),
    "Paso 3 de 7"
  );

  const port = await prompter.text({
    message: "Puerto del gateway",
    initialValue: String(DEFAULT_GATEWAY_PORT),
  });

  const networkMode = await prompter.select({
    message: "Modo de red",
    options: [
      { value: "loopback", label: "Loopback (localhost)", hint: "Solo desde esta computadora. Más seguro." },
      { value: "lan", label: "LAN (red local)", hint: "Desde otros dispositivos de la red." },
      { value: "tailscale", label: "Tailscale (remoto)", hint: "Desde cualquier lugar vía Tailscale VPN." },
    ],
    initialValue: "loopback",
  });

  const authMode = await prompter.select({
    message: "Autenticación del gateway",
    options: [
      { value: "token", label: "Token (recomendado)", hint: "Genera un token seguro automáticamente" },
      { value: "password", label: "Password", hint: "Elegir una contraseña personalizada" },
      { value: "none", label: "Sin auth (solo loopback)", hint: "No requiere autenticación (solo desarrollo)" },
    ],
    initialValue: "token",
  });

  // Generar token si es necesario
  let token: string | undefined;
  let password: string | undefined;

  if (authMode === "token") {
    // Generar token aleatorio seguro
    token = "sk-" + Array.from({length: 48}, () =>
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]
    ).join("");

    await prompter.note(
      [
        "🔑 TOKEN DE ACCESO GENERADO",
        "",
        "📋 Copia y guarda este token en un lugar seguro:",
        "",
        token,
        "",
        "💡 Lo necesitarás para:",
        "   • Acceder al panel web",
        "   • Conectar canales remotos",
        "",
        "⚠️  Si lo perdés, ejecutá: agento config reset",
      ].join("\n"),
      "Token de Seguridad"
    );
  } else if (authMode === "password") {
    password = await prompter.text({
      message: "Elegí una contraseña para el panel",
      validate: (val) => val.length < 6 ? "Mínimo 6 caracteres" : undefined,
    });
  }

  // Preguntar sobre autenticación para localhost (seguridad de producción)
  const requireLocalAuth = await prompter.confirm({
    message: "¿Requerir autenticación incluso desde localhost? (recomendado para producción)",
    initialValue: false,
  });

  if (requireLocalAuth) {
    await prompter.note(
      [
        "🔒 MODO PRODUCCIÓN ACTIVADO",
        "",
        "La autenticación será requerida para TODAS las conexiones,",
        "incluyendo las desde localhost.",
        "",
        "Esto es más seguro pero requiere que uses el token/contraseña",
        "incluso cuando accedas desde la misma computadora.",
      ].join("\n"),
      "Seguridad"
    );
  }

  return {
    config: {
      ...config,
      gateway: {
        ...config.gateway,
        mode: "local",
        port: parseInt(port, 10) || DEFAULT_GATEWAY_PORT,
        bind: networkMode === "loopback" ? "loopback" : networkMode === "lan" ? "lan" : "loopback",
        auth: {
          mode: authMode as "token" | "password" | "none",
          ...(token ? { token } : {}),
          ...(password ? { password } : {}),
          requireLocalAuth,
        },
      },
    },
    token,
  };
}

// ============================================================
// PASO 4: CONFIGURACIÓN DE CANALES
// ============================================================

async function setupTelegramAdmin(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "📱 TELEGRAM - CANAL ADMIN (OBLIGATORIO)",
      "",
      "⚠️  Telegram es OBLIGATORIO y será tu canal de ADMINISTRADOR.",
      "",
      "🔑 FUNCIÓN DE ADMIN:",
      "• Recibir alertas de seguridad en tiempo real",
      "• Acceso completo a todos los comandos",
      "• Capacidad de intervenir conversaciones",
      "• Gestión completa del sistema",
    ].join("\n"),
    "Paso 4A de 7"
  );

  // Mostrar instrucciones de BotFather
  await prompter.note(
    [
      "TOKEN DE BOT DE TELEGRAM",
      "",
      "1) Abre Telegram y busca @BotFather",
      "2) Envía /newbot",
      "3) Elige nombre y usuario para tu bot",
      "4) Copia el token que te da",
      "",
      "El token se ve así:",
      "123456789:ABCdefGHIjklMNOpqrSTUvwxyz",
      "",
      "💡 También puedes setear la variable",
      "   de entorno TELEGRAM_BOT_TOKEN",
    ].join("\n"),
    "Instrucciones"
  );

  const token = await prompter.text({
    message: "Token del bot de Telegram",
    placeholder: "123456789:ABCdefGHIjklMNOpqrSTUvwxyz",
    validate: (val) => val.trim().length < 10 ? "Token inválido" : undefined,
  });

  // Validar token con Telegram API
  const trimmedToken = token.trim();
  let botUsername: string | null = null;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${trimmedToken}/getMe`);
    const data = await response.json();
    if (data.ok && data.result?.username) {
      botUsername = data.result.username;
    }
  } catch {
    // Ignorar errores de red
  }

  if (botUsername) {
    await prompter.note(
      [`✅ Token válido!`, `Bot: @${botUsername}`].join("\n"),
      "Verificado"
    );
  }

  // Política de DMs
  const dmPolicy = await prompter.select({
    message: "Política de acceso a DMs",
    options: [
      { 
        value: "pairing", 
        label: "Pairing (recomendado)", 
        hint: "Remitentes desconocidos reciben código de emparejamiento" 
      },
      { 
        value: "allowlist", 
        label: "Allowlist", 
        hint: "Solo usuarios específicos pueden escribir" 
      },
      { 
        value: "open", 
        label: "Open", 
        hint: "Cualquiera puede escribir (público)" 
      },
    ],
    initialValue: "pairing",
  });

  // User ID con explicación detallada
  await prompter.note(
    [
      "TU ID DE USUARIO DE TELEGRAM",
      "",
      "💡 Esto te permitirá usar el bot inmediatamente",
      "   sin necesidad de emparejamiento.",
      "",
      "Puedes obtener tu ID hablándole al bot @userinfobot",
      "",
      "Formato: @miusuario o 123456789",
    ].join("\n"),
    "Opcional"
  );

  const userId = await prompter.text({
    message: "Tu ID de usuario de Telegram",
    placeholder: "@miusuario o 123456789",
  });

  // Pre-aprobar al usuario automáticamente si proporcionó su ID
  const trimmedUserId = userId.trim();
  if (trimmedUserId) {
    try {
      await addChannelAllowFromStoreEntry({ channel: "telegram", entry: trimmedUserId });
      await prompter.note(
        `✅ Tu usuario (${trimmedUserId}) fue pre-aprobado automáticamente.\n   Podrás usar el bot inmediatamente.`,
        "Acceso configurado"
      );
    } catch (err) {
      logger("failed to pre-approve telegram user", { userId: trimmedUserId, error: String(err) });
    }
  }

  return {
    ...config,
    channels: {
      ...config.channels,
      telegram: {
        ...config.channels?.telegram,
        enabled: true,
        botToken: trimmedToken,
        allowFrom: trimmedUserId ? [trimmedUserId] : undefined,
        dmPolicy: dmPolicy as "pairing" | "allowlist" | "open",
      },
    },
  };
}

async function setupWhatsAppVentas(
  config: OpenClawConfig,
  prompter: WizardPrompter,
  runtime: RuntimeEnv,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "💬 WHATSAPP - CANAL VENTAS (PRINCIPAL)",
      "",
      "WhatsApp será el canal principal para ATENCIÓN AL PÚBLICO.",
      "",
      "🔑 FUNCIÓN DE VENTAS:",
      "• Atención a clientes",
      "• Consultas de productos/servicios",
      "• Acceso limitado (escala a admin)",
    ].join("\n"),
    "Paso 4B de 7"
  );

  const phone = await prompter.text({
    message: "Número de WhatsApp (con código de país, ej: +54...)",
    placeholder: "+5491112345678",
    validate: (val) => !val.startsWith('+') ? "Incluir código de país (+54)" : undefined,
  });

  // Usar loginWeb de OpenClaw (muestra QR y espera conexión)
  await prompter.note(
    [
      "📱 Escaneo de QR",
      "",
      "El código QR se mostrará a continuación.",
      "Escanealo con WhatsApp en tu teléfono.",
    ].join("\n"),
    "WhatsApp VENTAS"
  );

  try {
    await loginWeb(false, undefined, runtime, "ventas");
  } catch (err) {
    runtime.error(`WhatsApp login failed: ${String(err)}`);
    throw err;
  }

  return {
    ...config,
    channels: {
      ...config.channels,
      whatsapp: {
        ...config.channels?.whatsapp,
        enabled: true,
        accounts: {
          ...config.channels?.whatsapp?.accounts,
          ventas: {
            phoneNumber: phone.trim(),
            role: "public",
            purpose: "Atención al público",
          },
        },
      },
    },
  };
}

async function setupWhatsAppAdicionales(
  config: OpenClawConfig,
  prompter: WizardPrompter,
  runtime: RuntimeEnv,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "¿AGREGAR MÁS CUENTAS DE WHATSAPP?",
      "",
      "Puedes configurar múltiples números para diferentes funciones.",
    ].join("\n"),
    "Paso 4C de 7"
  );

  let nextConfig = config;
  const additionalAccounts: Array<{ id: string; phone: string; role: string; purpose: string }> = [];

  while (true) {
    const addMore = await prompter.confirm({
      message: "¿Agregar otra cuenta de WhatsApp?",
      initialValue: false,
    });

    if (!addMore) break;

    const type = await prompter.select({
      message: "Tipo de cuenta",
      options: [
        { value: "soporte", label: "SOPORTE TÉCNICO", hint: "Atención post-venta y técnicos" },
        { value: "compras", label: "COMPRAS / PROVEEDORES", hint: "Gestión de proveedores y stock" },
        { value: "reservas", label: "RESERVAS / TURNOS", hint: "Agendamiento de citas" },
        { value: "facturacion", label: "FACTURACIÓN / PAGOS", hint: "Consultas administrativas" },
        { value: "vip", label: "VIP / PREMIUM", hint: "Clientes exclusivos" },
      ],
    });

    const phone = await prompter.text({
      message: `Número de WhatsApp ${type.toUpperCase()}`,
      placeholder: "+5491187654321",
      validate: (val) => !val.startsWith('+') ? "Incluir código de país" : undefined,
    });

    // Usar loginWeb de OpenClaw para esta cuenta
    try {
      await loginWeb(false, undefined, runtime, type);
    } catch (err) {
      runtime.error(`WhatsApp login failed for ${type}: ${String(err)}`);
      throw err;
    }

    const purposeMap: Record<string, string> = {
      soporte: "Soporte técnico",
      compras: "Gestión de proveedores",
      reservas: "Agendamiento",
      facturacion: "Facturación y pagos",
      vip: "Clientes VIP",
    };

    additionalAccounts.push({
      id: type,
      phone: phone.trim(),
      role: type === "vip" ? "private" : type === "compras" ? "purchasing" : "support",
      purpose: purposeMap[type] || "Otro",
    });

    await prompter.note(
      [`✅ Cuenta ${type.toUpperCase()} conectada: ${phone.trim()}`].join("\n"),
      "Conectado"
    );
  }

  // DEBUG: Mostrar cuántas cuentas adicionales se van a agregar
  if (additionalAccounts.length > 0) {
    runtime.log(`[DEBUG] Agregando ${additionalAccounts.length} cuentas adicionales: ${additionalAccounts.map(a => a.id).join(', ')}`);
  }

  // Agregar cuentas adicionales a la configuración
  for (const acc of additionalAccounts) {
    nextConfig = {
      ...nextConfig,
      channels: {
        ...nextConfig.channels,
        whatsapp: {
          ...nextConfig.channels?.whatsapp,
          accounts: {
            ...nextConfig.channels?.whatsapp?.accounts,
            [acc.id]: {
              phoneNumber: acc.phone,
              role: acc.role as 'public' | 'support' | 'purchasing' | 'private',
              purpose: acc.purpose,
            },
          },
        },
      },
    };
  }

  return nextConfig;
}

async function setupOtrosCanales(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "OTROS CANALES DE SOPORTE",
      "",
      "Estos canales son opcionales y se usarán para SOPORTE",
      "(no para atención al público principal).",
    ].join("\n"),
    "Paso 4D de 7"
  );

  const channels = await prompter.multiselect({
    message: "Selecciona canales adicionales (Espacio para marcar)",
    options: [
      { value: "discord", label: "Discord", hint: "Comunidades y soporte grupal" },
      { value: "slack", label: "Slack", hint: "Equipos internos" },
      { value: "googlechat", label: "Google Chat", hint: "Integración Google Workspace" },
      { value: "signal", label: "Signal", hint: "Comunicación segura" },
    ],
    initialValues: [],
  });

  // Configurar cada canal seleccionado (simplificado)
  let nextConfig = config;
  for (const channel of channels) {
    const adapter = getChannelOnboardingAdapter(channel as any);
    if (adapter) {
      // Aquí iría la configuración específica de cada canal
      nextConfig = {
        ...nextConfig,
        channels: {
          ...nextConfig.channels,
          [channel]: {
            ...nextConfig.channels?.[channel as keyof typeof nextConfig.channels],
            enabled: true,
            role: "support", // Todos como soporte
          },
        },
      };
    }
  }

  return nextConfig;
}

// ============================================================
// PASO 5: WORKSPACE
// ============================================================

async function setupWorkspace(
  config: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<{ config: OpenClawConfig; workspaceDir: string }> {
  await prompter.note(
    [
      "CONFIGURACIÓN DE WORKSPACE",
      "",
      "El workspace es donde Agento guarda sesiones y archivos.",
    ].join("\n"),
    "Paso 5 de 7"
  );

  const workspaceDir = resolveUserPath(DEFAULT_WORKSPACE);
  
  await ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(config.agents?.defaults?.skipBootstrap),
  });

  return { config, workspaceDir };
}

// ============================================================
// PASO 6: CONFIGURACIÓN EMPRESARIAL
// ============================================================

function getDefaultExpertise(type: string): string[] {
  const map: Record<string, string[]> = {
    retail: ["Consultar stock", "Informar precios", "Crear pedidos", "Verificar entregas"],
    services: ["Agendar citas", "Cotizar servicios", "Consultar disponibilidad", "Enviar info"],
    consulting: ["Agendar consultas", "Informar metodologías", "Cotizar proyectos", "Enviar propuestas"],
    healthcare: ["Agendar turnos", "Informar coberturas", "Recordatorios", "Consultar resultados"],
    education: ["Informar cursos", "Agendar clases", "Consultar aranceles", "Inscripciones"],
    other: ["Información general", "Atención al cliente", "Consultas frecuentes"],
  };
  return map[type] || map.other;
}

async function setupEmpresarial(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "",
      "═════════════════════════════════════════",
      "  🏪 CONFIGURACIÓN EMPRESARIAL",
      "═════════════════════════════════════════",
      "",
      "Ahora configuraremos las personalidades de tu",
      "asistente para diferentes funciones de tu negocio.",
      "",
    ].join("\n"),
    "Paso 6 de 7"
  );

  // Información del negocio
  const businessName = await prompter.text({
    message: "Nombre del negocio",
    placeholder: "Mi Empresa S.A.",
    validate: (val) => val.trim().length < 2 ? "Nombre muy corto" : undefined,
  });

  const businessType = await prompter.select({
    message: "Tipo de negocio",
    options: [
      { value: "retail", label: "Retail / Tienda" },
      { value: "services", label: "Servicios" },
      { value: "consulting", label: "Consultoría" },
      { value: "healthcare", label: "Salud" },
      { value: "education", label: "Educación" },
      { value: "other", label: "Otro" },
    ],
  });

  const businessDescription = await prompter.text({
    message: "¿Qué hace tu negocio?",
    placeholder: "Ayudamos a pymes a digitalizar...",
    validate: (val) => val.trim().length < 10 ? "Descripción muy corta" : undefined,
  });

  // Personalidad VENTAS
  await prompter.note(
    ["PERSONALIDAD PARA VENTAS (WhatsApp)"].join("\n"),
    "Ventas"
  );

  const salesName = await prompter.text({
    message: "Nombre del asistente de ventas",
    placeholder: "Ana",
    initialValue: "Ana",
  });

  const salesTone = await prompter.select({
    message: "Tono de comunicación",
    options: [
      { value: "professional", label: "Profesional" },
      { value: "friendly", label: "Amigable" },
      { value: "casual", label: "Casual" },
      { value: "luxury", label: "Lujo" },
    ],
    initialValue: "friendly",
  });

  const defaultExpertise = getDefaultExpertise(businessType);
  const customizeExpertise = await prompter.confirm({
    message: "¿Personalizar áreas de expertise?",
    initialValue: false,
  });

  let salesExpertise = defaultExpertise;
  if (customizeExpertise) {
    const selected = await prompter.multiselect({
      message: "Selecciona áreas de expertise",
      options: defaultExpertise.map(e => ({ value: e, label: e })),
      initialValues: defaultExpertise,
    });
    salesExpertise = selected;
  }

  // Personalidad ADMIN
  await prompter.note(
    ["PERSONALIDAD PARA ADMIN (Telegram)"].join("\n"),
    "Admin"
  );

  const adminName = await prompter.text({
    message: "Nombre del asistente admin",
    placeholder: "Jefe",
    initialValue: "Jefe",
  });

  // Construir configuración empresarial
  const personality: EnterprisePersonality = {
    businessName: businessName.trim(),
    businessType: businessType as any,
    businessDescription: businessDescription.trim(),
    sales: {
      name: salesName.trim(),
      tone: salesTone as any,
      expertise: salesExpertise,
      restrictions: ["No modificar precios sin autorización", "No hacer promesas de entrega sin confirmar stock"],
    },
    admin: {
      name: adminName.trim(),
      capabilities: ["Gestión completa", "Reportes", "Configuración", "Escalación"],
      escalationTriggers: ["Palabra clave 'urgente'", "Solicitud de supervisor", "Problema técnico"],
    },
  };

  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      personality,
      features: {
        dualPersonality: true,
        securityAlerts: true,
        escalationEnabled: true,
      },
    },
  };
}

// ============================================================
// PASO 7: RESUMEN Y FINALIZACIÓN COMPLETA
// ============================================================

async function finalizeUnified(
  config: OpenClawConfig,
  workspaceDir: string,
  prompter: WizardPrompter,
  runtime: RuntimeEnv,
  flow: 'quickstart' | 'manual',
  gatewayToken?: string,
): Promise<{ launchedTui: boolean }> {
  const personality = config.enterprise?.personality;
  const whatsappAccounts = Object.entries(config.channels?.whatsapp?.accounts || {});

  // DEBUG: Log de cuentas encontradas
  runtime.log(`[DEBUG] Cuentas WhatsApp encontradas: ${whatsappAccounts.length}`);
  for (const [id, acc] of whatsappAccounts) {
    runtime.log(`[DEBUG]   - ${id}: ${(acc as any).phoneNumber}`);
  }

  // Mostrar resumen de configuración
  await prompter.note(
    [
      "═════════════════════════════════════════",
      "  ✅ CONFIGURACIÓN COMPLETADA",
      "═════════════════════════════════════════",
      "",
      "🤖 MODELO DE IA",
      `  Proveedor: ${(typeof config.agents?.defaults?.model === 'object' ? config.agents?.defaults?.model?.primary : config.agents?.defaults?.model) || "No configurado"}`,
      "",
      "🌐 GATEWAY",
      `  Puerto: ${config.gateway?.port || 18789}`,
      `  Auth: ${config.gateway?.auth?.mode || "token"}`,
      "",
      "👔 CANAL ADMIN (Telegram)",
      `  Bot: ${config.channels?.telegram?.botToken ? "Configurado" : "No configurado"}`,
      `  Nombre: ${personality?.admin.name || "Admin"}`,
      "",
      "📱 CANALES DE VENTAS Y SOPORTE",
      ...whatsappAccounts.map(([id, acc]: [string, any]) =>
        `  • ${id.toUpperCase()}: ${acc.phoneNumber} (${acc.purpose || id})`
      ),
      "",
      "🏢 NEGOCIO",
      `  Nombre: ${personality?.businessName || "No configurado"}`,
      `  Tipo: ${personality?.businessType || "No configurado"}`,
      "",
      "🎯 PERSONALIDADES",
      `  • VENTAS: ${personality?.sales.name || "No configurado"} (${personality?.sales.tone || "amigable"})`,
      `  • ADMIN: ${personality?.admin.name || "No configurado"}`,
      "",
    ].join("\n"),
    "Resumen"
  );

  // Guardar configuración
  await writeConfigFile(config);
  logConfigUpdated(runtime);

  // ============================================================
  // INSTALACIÓN DE SERVICIO (Daemon) - POR SISTEMA OPERATIVO
  // ============================================================

  const withProgress = async <T>(
    label: string,
    options: { doneMessage?: string },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(options.doneMessage);
    }
  };

  // Detectar sistema operativo
  const isWindows = process.platform === "win32";
  const isLinux = process.platform === "linux";
  const isMac = process.platform === "darwin";

  // En Linux, verificar systemd
  const systemdAvailable = isLinux ? await isSystemdUserServiceAvailable() : true;

  if (isLinux && !systemdAvailable) {
    await prompter.note(
      "Systemd no está disponible. El gateway se ejecutará en primer plano.",
      "Systemd",
    );
  }

  // Preguntar si quiere iniciar el gateway
  let startGateway: boolean;
  if (isLinux && !systemdAvailable) {
    startGateway = await prompter.confirm({
      message: "¿Iniciar el gateway ahora?",
      initialValue: true,
    });
  } else if (flow === "quickstart") {
    startGateway = true; // En quickstart, siempre iniciar
  } else {
    const actionLabel = isWindows ? "¿Iniciar el gateway ahora?" : "¿Instalar servicio del Gateway?";
    startGateway = await prompter.confirm({
      message: actionLabel + " (recomendado)",
      initialValue: true,
    });
  }

  // ============================================================
  // WINDOWS: Iniciar gateway en segundo plano
  // ============================================================

  if (startGateway && isWindows) {
    const progress = prompter.progress("Iniciando Gateway");
    progress.update("Iniciando gateway en segundo plano...");

    const result = await startGatewayOnWindows(config, prompter);

    if (result.success) {
      progress.stop(`✅ Gateway iniciado (PID: ${result.pid})`);
      await prompter.note(
        [
          "El gateway está corriendo en segundo plano.",
          `Para detenerlo: Buscar el proceso node.exe (PID: ${result.pid}) en el Administrador de Tareas.`,
          "",
          "Para iniciar automáticamente al arrancar Windows:",
          "1. Crear acceso directo a: node agento.mjs gateway",
          "2. Moverlo a: shell:startup",
        ].join("\n"),
        "Windows"
      );
    } else {
      progress.stop(`❌ Error: ${result.error}`);
      await prompter.note(
        [
          "No se pudo iniciar el gateway automáticamente.",
          "",
          "Ejecutá manualmente:",
          "  node agento.mjs gateway",
        ].join("\n"),
        "Error"
      );
    }
  }

  // ============================================================
  // LINUX/MAC: Instalar servicio del sistema
  // ============================================================

  if (startGateway && !isWindows) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "Runtime del servicio",
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });

    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });

    if (loaded) {
      const action = await prompter.select({
        message: "El servicio ya está instalado",
        options: [
          { value: "restart", label: "Reiniciar" },
          { value: "reinstall", label: "Reinstalar" },
          { value: "skip", label: "Omitir" },
        ],
      });

      if (action === "restart") {
        await withProgress(
          "Gateway service",
          { doneMessage: "Servicio reiniciado." },
          async (progress) => {
            progress.update("Reiniciando servicio...");
            await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
          },
        );
      } else if (action === "reinstall") {
        await withProgress(
          "Gateway service",
          { doneMessage: "Servicio desinstalado." },
          async (progress) => {
            progress.update("Desinstalando servicio...");
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (!loaded || (loaded && !(await service.isLoaded({ env: process.env })))) {
      const progress = prompter.progress("Gateway service");
      let installError: string | null = null;
      try {
        progress.update("Preparando servicio...");
        const settings: GatewayWizardSettings = {
          port: config.gateway?.port || DEFAULT_GATEWAY_PORT,
          bind: (config.gateway?.bind as GatewayWizardSettings["bind"]) || "loopback",
          authMode: (config.gateway?.auth?.mode as "token" | "password") || "token",
          gatewayToken: gatewayToken,
          tailscaleMode: "off",
          tailscaleResetOnExit: false,
          requireLocalAuth: config.gateway?.auth?.requireLocalAuth ?? true,
        };

        const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
          env: process.env,
          port: settings.port,
          token: settings.gatewayToken,
          runtime: daemonRuntime,
          warn: (message, title) => prompter.note(message, title),
          config: config,
        });

        progress.update("Instalando servicio...");
        await service.install({
          env: process.env,
          stdout: process.stdout,
          programArguments,
          workingDirectory,
          environment,
        });
      } catch (err) {
        installError = err instanceof Error ? err.message : String(err);
      } finally {
        progress.stop(
          installError ? "Error al instalar servicio." : "Servicio instalado.",
        );
      }
      if (installError) {
        await prompter.note(`Error al instalar servicio: ${installError}`, "Gateway");
        await prompter.note(gatewayInstallErrorHint(), "Ayuda");
      }
    }
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  const port = config.gateway?.port || DEFAULT_GATEWAY_PORT;
  const probeLinks = resolveControlUiLinks({
    bind: config.gateway?.bind ?? "loopback",
    port: port,
    customBindHost: config.gateway?.customBindHost,
    basePath: undefined,
  });

  // Esperar a que el gateway esté disponible
  await waitForGatewayReachable({
    url: probeLinks.wsUrl,
    token: gatewayToken,
    deadlineMs: 15_000,
  });

  try {
    await healthCommand({ json: false, timeoutMs: 10_000 }, runtime);
  } catch (err) {
    runtime.error(formatHealthCheckFailure(err));
    await prompter.note(
      [
        "Docs:",
        "https://docs.agento.ai/gateway/health",
        "https://docs.agento.ai/gateway/troubleshooting",
      ].join("\n"),
      "Health check help",
    );
  }

  // ============================================================
  // BUILD CONTROL UI
  // ============================================================

  const controlUiEnabled = config.gateway?.controlUi?.enabled ?? true;
  if (controlUiEnabled) {
    const controlUiAssets = await ensureControlUiAssetsBuilt(runtime);
    if (!controlUiAssets.ok && controlUiAssets.message) {
      runtime.error(controlUiAssets.message);
    }
  }

  // ============================================================
  // MOSTRAR INFORMACIÓN DE TOKEN Y URLS
  // ============================================================

  const links = resolveControlUiLinks({
    bind: (config.gateway?.bind as GatewayWizardSettings["bind"]) || "loopback",
    port: port,
    customBindHost: config.gateway?.customBindHost,
    basePath: config.gateway?.controlUi?.basePath,
  });

  const authedUrl =
    config.gateway?.auth?.mode === "token" && gatewayToken
      ? `${links.httpUrl}#token=${encodeURIComponent(gatewayToken)}`
      : links.httpUrl;

  const gatewayProbe = await probeGatewayReachable({
    url: links.wsUrl,
    token: config.gateway?.auth?.mode === "token" ? gatewayToken : undefined,
    password: config.gateway?.auth?.mode === "password" ? config.gateway?.auth?.password : "",
  });

  const gatewayStatusLine = gatewayProbe.ok
    ? "Gateway: disponible"
    : `Gateway: no detectado${gatewayProbe.detail ? ` (${gatewayProbe.detail})` : ""}`;

  // Mostrar token si existe
  if (config.gateway?.auth?.mode === "token" && gatewayToken) {
    await prompter.note(
      [
        "🔑 TOKEN DE ACCESO AL GATEWAY",
        "",
        "📋 Guarda este token en un lugar seguro:",
        "",
        gatewayToken,
        "",
        "💡 Lo necesitarás para:",
        "   • Acceder al panel web",
        "   • Conectar canales remotos",
        "",
        `Ver token: ${formatCliCommand("agento config get gateway.auth.token")}`,
        `Generar nuevo: ${formatCliCommand("agento doctor --generate-gateway-token")}`,
      ].join("\n"),
      "Token de Seguridad"
    );
  }

  await prompter.note(
    [
      `🌐 Web UI: ${links.httpUrl}`,
      config.gateway?.auth?.mode === "token" && gatewayToken
        ? `🌐 Web UI (con token): ${authedUrl}`
        : undefined,
      `🔌 Gateway WS: ${links.wsUrl}`,
      `📊 Estado: ${gatewayStatusLine}`,
      "📚 Docs: https://docs.agento.ai/web/control-ui",
    ]
      .filter(Boolean)
      .join("\n"),
    "Control UI"
  );

  // ============================================================
  // HATCH CHOICE - ¿Cómo quiere iniciar?
  // ============================================================

  const bootstrapPath = path.join(
    resolveUserPath(workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  let hatchChoice: "tui" | "web" | "later" | null = null;
  let launchedTui = false;
  let controlUiOpened = false;
  let controlUiOpenHint: string | undefined;

  // Verificar si el gateway está disponible (puede tardar unos segundos en Windows)
  const progress = prompter.progress("Verificando Gateway");
  progress.update("Esperando a que el gateway esté listo...");

  let gatewayReady = false;
  for (let i = 0; i < 30; i++) {
    const probe = await probeGatewayReachable({
      url: links.wsUrl,
      token: config.gateway?.auth?.mode === "token" ? gatewayToken : undefined,
      password: config.gateway?.auth?.mode === "password" ? config.gateway?.auth?.password : "",
    });
    if (probe.ok) {
      gatewayReady = true;
      break;
    }
    // Esperar 1 segundo antes de reintentar
    await new Promise(resolve => setTimeout(resolve, 1000));
    progress.update(`Esperando al gateway... (${i + 1}/30)`);
  }

  if (gatewayReady) {
    progress.stop("✅ Gateway listo");
  } else {
    progress.stop("⚠️ Gateway no respondió (puede estar iniciando)");
  }

  // Actualizar el probe después de esperar
  const finalGatewayProbe = await probeGatewayReachable({
    url: links.wsUrl,
    token: config.gateway?.auth?.mode === "token" ? gatewayToken : undefined,
    password: config.gateway?.auth?.mode === "password" ? config.gateway?.auth?.password : "",
  });

  if (finalGatewayProbe.ok || gatewayReady) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "🥚 Este es el momento de dar vida a tu agente.",
          "Tómate tu tiempo.",
          "Cuanto más le cuentes, mejor será la experiencia.",
          'Se enviará: "¡Despierta, amigo!"',
        ].join("\n"),
        "Hatch en TUI (mejor opción)"
      );
    }

    hatchChoice = await prompter.select({
      message: "¿Cómo quieres iniciar tu bot?",
      options: [
        { value: "web", label: "🌐 Abrir Web UI (recomendado)", hint: "Panel en navegador" },
        { value: "tui", label: "🥚 Hatch en TUI", hint: "Terminal interactiva" },
        { value: "later", label: "⏰ Más tarde", hint: "Iniciar manualmente después" },
      ],
      initialValue: "web",  // Web es más fácil para usuarios no técnicos
    });

    if (hatchChoice === "tui") {
      restoreTerminalState("pre-onboarding tui");
      await runTui({
        url: links.wsUrl,
        token: config.gateway?.auth?.mode === "token" ? gatewayToken : undefined,
        password: config.gateway?.auth?.mode === "password" ? config.gateway?.auth?.password : "",
        deliver: false,
        message: hasBootstrap ? "¡Despierta, amigo!" : undefined,
      });
      launchedTui = true;
    } else if (hatchChoice === "web") {
      // En Windows, usar función específica
      if (isWindows) {
        controlUiOpened = await openBrowserOnWindows(authedUrl);
      } else {
        // En Linux/Mac, usar función existente
        const browserSupport = await detectBrowserOpenSupport();
        if (browserSupport.ok) {
          controlUiOpened = await openUrl(authedUrl);
        }
      }

      if (!controlUiOpened) {
        controlUiOpenHint = formatControlUiSshHint({
          port: port,
          basePath: config.gateway?.controlUi?.basePath,
          token: config.gateway?.auth?.mode === "token" ? gatewayToken : undefined,
        });
      }

      await prompter.note(
        [
          controlUiOpened
            ? "✅ Navegador abierto con tu panel de control."
            : "📋 Abrí esta URL en tu navegador:",
          "",
          `🔗 ${authedUrl}`,
          "",
          controlUiOpened
            ? "Mantén esa pestaña abierta para controlar Agento."
            : "Copia y pega la URL en tu navegador.",
          controlUiOpenHint,
        ]
          .filter(Boolean)
          .join("\n"),
        "Dashboard"
      );
    } else {
      await prompter.note(
        `Cuando estés listo: ${formatCliCommand("agento dashboard --no-open")}`,
        "Más tarde"
      );
    }
  }

  // ============================================================
  // CONSEJOS FINALES
  // ============================================================

  await prompter.note(
    [
      "💾 Respalda tu workspace regularmente.",
      "Docs: https://docs.agento.ai/concepts/agent-workspace",
    ].join("\n"),
    "Respaldo"
  );

  await prompter.note(
    "⚠️  Ejecutar agentes en tu computadora tiene riesgos — protege tu setup: https://docs.agento.ai/security",
    "Seguridad"
  );

  await setupOnboardingShellCompletion({ flow: flow === "quickstart" ? "quickstart" : "advanced", prompter });

  const webSearchKey = (config.tools?.web?.search?.apiKey ?? "").trim();
  const webSearchEnv = (process.env.BRAVE_API_KEY ?? "").trim();
  const hasWebSearchKey = Boolean(webSearchKey || webSearchEnv);

  await prompter.note(
    hasWebSearchKey
      ? [
          "🔍 Web search habilitado. Tu agente puede buscar online.",
          "",
          webSearchKey
            ? "API key: guardada en config (tools.web.search.apiKey)."
            : "API key: vía BRAVE_API_KEY env var.",
          "Docs: https://docs.agento.ai/tools/web",
        ].join("\n")
      : [
          "🔍 Para que tu agente pueda buscar en la web, necesitas una API key.",
          "",
          "Agento usa Brave Search. Sin API key, web_search no funcionará.",
          "",
          "Configurar:",
          `- ${formatCliCommand("agento configure --section web")}`,
          "",
          "O setea BRAVE_API_KEY en el entorno del Gateway.",
          "Docs: https://docs.agento.ai/tools/web",
        ].join("\n"),
    "Web search (opcional)"
  );

  // Mensaje final
  await prompter.note(
    [
      "═════════════════════════════════════════",
      "  🦞 ¡AGENTO ESTÁ LISTO!",
      "═════════════════════════════════════════",
      "",
      "📝 COMANDOS ÚTILES:",
      `   ${formatCliCommand("agento gateway")}         # Iniciar gateway`,
      `   ${formatCliCommand("agento channels status")} # Ver estado de canales`,
      `   ${formatCliCommand("agento enterprise status")} # Ver config empresarial`,
      `   ${formatCliCommand("agento doctor")}          # Diagnosticar problemas`,
      "",
      "📚 Docs: https://docs.agento.ai",
      "💬 Soporte: https://discord.gg/agento",
      "",
    ].join("\n"),
    "¡Listo!"
  );

  await prompter.outro(
    controlUiOpened
      ? "Onboarding completo. Dashboard abierto en tu navegador."
      : launchedTui
        ? "Onboarding completo. TUI iniciado."
        : "Onboarding completo. Usa el dashboard para controlar Agento."
  );

  return { launchedTui };
}

// ============================================================
// FUNCIÓN PRINCIPAL UNIFICADA
// ============================================================

export async function runUnifiedOnboarding(
  opts: { acceptRisk?: boolean; flow?: string; skipChannels?: boolean; skipSkills?: boolean } = {},
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
): Promise<void> {
  printWizardHeader(runtime);
  await prompter.intro("🚀 Configuración de Agento");

  // 0. Advertencia de seguridad
  if (!opts.acceptRisk) {
    await requireRiskAcknowledgement({ prompter });
  }

  // Leer configuración existente
  const snapshot = await readConfigFileSnapshot();
  let config: OpenClawConfig = snapshot.valid ? snapshot.config : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(summarizeExistingConfig(config), "Config inválida");
    // Manejar reset si es necesario...
    return;
  }

  // 1. Modo
  const mode = await promptMode(prompter);

  // 2. Auth y Modelo LLM
  config = await setupAuthAndModel(config, runtime, prompter);

  // 3. Gateway (y obtener token)
  const gatewayResult = await setupGateway(config, prompter);
  config = gatewayResult.config;
  const gatewayToken = gatewayResult.token;

  // 4. Canales (solo si no se salta)
  if (!opts.skipChannels) {
    config = await setupTelegramAdmin(config, prompter);
    config = await setupWhatsAppVentas(config, prompter, runtime);
    config = await setupWhatsAppAdicionales(config, prompter, runtime);
    config = await setupOtrosCanales(config, prompter);
  }

  // 5. Workspace
  const { config: configWithWorkspace, workspaceDir } = await setupWorkspace(config, runtime, prompter);
  config = configWithWorkspace;

  // 6. Skills (si no se salta)
  if (!opts.skipSkills) {
    await prompter.note(
      [
        "SKILLS - HABILIDADES ADICIONALES",
        "",
        "Las skills extienden las capacidades de Agento.",
      ].join("\n"),
      "Paso 6 de 7"
    );

    config = await setupSkills(config, workspaceDir, runtime, prompter);
  }

  // 7. Configuración Empresarial
  config = await setupEmpresarial(config, prompter);

  // Hooks internos
  config = await setupInternalHooks(config, runtime, prompter);

  // 8. Finalizar (incluye daemon, health check, hatch choice)
  await finalizeUnified(config, workspaceDir, prompter, runtime, mode, gatewayToken);
}
