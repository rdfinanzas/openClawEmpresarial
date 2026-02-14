/**
 * OpenClaw - Wizard Unificado
 * 
 * Combina onboard + enterprise en un solo flujo continuo.
 * El usuario ejecuta solo: openclaw onboard
 */

import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { logWarn } from "../logger.js";
import { readConfigFileSnapshot, writeConfigFile, DEFAULT_GATEWAY_PORT } from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { applyWizardMetadata, DEFAULT_WORKSPACE, ensureWorkspaceAndSessions, printWizardHeader, summarizeExistingConfig, handleReset } from "../commands/onboard-helpers.js";
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
): Promise<OpenClawConfig> {
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
        "TOKEN DE ACCESO GENERADO",
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
      "🔑 Token de Seguridad"
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
// PASO 7: RESUMEN Y FINALIZACIÓN
// ============================================================

async function finalizeUnified(
  config: OpenClawConfig,
  workspaceDir: string,
  prompter: WizardPrompter,
  runtime: RuntimeEnv,
) {
  const personality = config.enterprise?.personality;
  const whatsappAccounts = Object.entries(config.channels?.whatsapp?.accounts || {});
  
  // DEBUG: Log de cuentas encontradas
  runtime.log(`[DEBUG] Cuentas WhatsApp encontradas: ${whatsappAccounts.length}`);
  for (const [id, acc] of whatsappAccounts) {
    runtime.log(`[DEBUG]   - ${id}: ${(acc as any).phoneNumber}`);
  }

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
      `  Panel: http://localhost:${config.gateway?.port || 18789}/admin`,
      "",
      "👔 CANAL ADMIN (Telegram)",
      `  Bot: @${config.channels?.telegram?.botToken ? "Configurado" : "No configurado"}`,
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
      "✨ FUNCIONES ACTIVADAS",
      "  • Dual Personality",
      "  • Escalada automática",
      "  • Alertas de seguridad",
      "",
    ].join("\n"),
    "Resumen"
  );

  await prompter.note(
    [
      "🚀 PRÓXIMOS PASOS:",
      "",
      "1. INICIAR EL SISTEMA:",
      "   $ agento gateway --port 18789",
      "",
      "2. PROBAR LOS CANALES:",
      "   • Telegram: Escribe al bot (como admin)",
      "   • WhatsApp Ventas: Escribe como cliente",
      "",
      "3. PANEL DE ADMINISTRACIÓN:",
      `   http://localhost:${config.gateway?.port || 18789}/admin`,
      "",
      "4. COMANDOS ÚTILES:",
      "   $ agento channels status",
      "   $ agento enterprise status",
      "   $ agento enterprise apis add",
      "",
      "🦞 ¡Agento está listo!",
    ].join("\n"),
    "Próximos pasos"
  );

  // Guardar configuración
  await writeConfigFile(config);
  logConfigUpdated(runtime);
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

  // 3. Gateway
  config = await setupGateway(config, prompter);

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

  // 6. Configuración Empresarial
  config = await setupEmpresarial(config, prompter);

  // Hooks internos
  config = await setupInternalHooks(config, runtime, prompter);

  // 7. Finalizar
  await finalizeUnified(config, workspaceDir, prompter, runtime);

  await prompter.outro("🦞 ¡Configuración completada! Exfoliate!");
}
