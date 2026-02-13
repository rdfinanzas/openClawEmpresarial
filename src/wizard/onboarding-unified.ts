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
  };
  admin: {
    name: string;
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
      "OpenClaw es un proyecto en desarrollo (beta).",
      "Este bot puede leer archivos y ejecutar acciones.",
      "",
      "Línea base recomendada:",
      "• Pairing/allowlists + mention gating",
      "• Sandbox + herramientas de mínimo privilegio",
      "• No guardar secretos en archivos accesibles",
      "",
      "Documentación: https://docs.openclaw.ai/gateway/security",
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

  const { groups, skipOption } = promptAuthChoiceGrouped({
    store: { profiles: [] },
    includeSkip: false,
  });

  // Mostrar opciones agrupadas
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

  // Aquí iría la lógica de autenticación específica por proveedor
  // Por simplicidad, usamos el flujo existente
  let nextConfig = config;
  
  // Configurar modelo por defecto según proveedor
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

  nextConfig = {
    ...nextConfig,
    agent: {
      ...nextConfig.agent,
      model: modelMap[provider] || modelMap.anthropic,
    },
  };

  await warnIfModelConfigLooksOff(nextConfig, prompter);

  return nextConfig;
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
      "El gateway es el centro de control de OpenClaw.",
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
    message: "Autenticación para el panel de administración",
    options: [
      { value: "token", label: "Token seguro (generado automáticamente)", hint: "Para acceder al panel web" },
      { value: "password", label: "Password personalizada", hint: "Elegir tu propia contraseña" },
      { value: "none", label: "Sin auth (solo loopback)", hint: "Solo para desarrollo local" },
    ],
    initialValue: "token",
  });

  return {
    ...config,
    gateway: {
      ...config.gateway,
      port: parseInt(port, 10) || DEFAULT_GATEWAY_PORT,
      bind: networkMode === "loopback" ? "loopback" : networkMode === "lan" ? "0.0.0.0" : "loopback",
      auth: {
        mode: authMode as "token" | "password" | "none",
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
      "",
      "🔒 SEGURIDAD:",
      "• Canal PRIVADO (solo tú)",
      "• Acceso total al sistema",
      "",
      "⚠️  IMPORTANTE: Usa Telegram SOLO TÚ para administrar.",
    ].join("\n"),
    "Paso 4A de 7"
  );

  const hasToken = await prompter.confirm({
    message: "¿Ya tienes un bot de Telegram?",
    initialValue: false,
  });

  if (!hasToken) {
    await prompter.note(
      [
        "CREAR BOT DE TELEGRAM",
        "",
        "1. Abre Telegram",
        "2. Busca @BotFather",
        "3. Envía /newbot",
        "4. Elige nombre y username",
        "5. Copia el token",
        "",
        "El token tiene este formato:",
        "123456789:ABCdefGHIjklMNOpqrSTUvwxyz",
      ].join("\n"),
      "Instrucciones"
    );
  }

  const token = await prompter.text({
    message: "Token de tu bot de Telegram",
    placeholder: "123456789:ABCdefGHIjklMNOpqrSTUvwxyz",
    validate: (val) => val.trim().length < 10 ? "Token inválido" : undefined,
  });

  const userId = await prompter.text({
    message: "Tu ID de usuario de Telegram (opcional, obténlo con @userinfobot)",
    placeholder: "@miusuario o 123456789",
  });

  return {
    ...config,
    channels: {
      ...config.channels,
      telegram: {
        ...config.channels?.telegram,
        enabled: true,
        botToken: token.trim(),
        allowFrom: userId.trim() ? [userId.trim()] : undefined,
        dmPolicy: "allowlist",
      },
    },
  };
}

async function setupWhatsAppVentas(
  config: OpenClawConfig,
  prompter: WizardPrompter,
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

  await prompter.note(
    [
      "🔄 Escanea el código QR con WhatsApp:",
      "",
      "1. Abre WhatsApp en tu teléfono",
      "2. Ajustes → Dispositivos vinculados",
      "3. Escanear código QR",
      "",
      "[El QR se mostrará aquí en la implementación real]",
    ].join("\n"),
    "Escaneo QR"
  );

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
      [`✅ Cuenta ${type.toUpperCase()} agregada: ${phone.trim()}`].join("\n"),
      "Agregado"
    );
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
              role: acc.role,
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
      "El workspace es donde OpenClaw guarda sesiones y archivos.",
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
    },
    admin: {
      name: adminName.trim(),
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

  await prompter.note(
    [
      "═════════════════════════════════════════",
      "  ✅ CONFIGURACIÓN COMPLETADA",
      "═════════════════════════════════════════",
      "",
      "🤖 MODELO DE IA",
      `  Proveedor: ${config.agent?.model || "No configurado"}`,
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
      "   $ openclaw gateway --port 18789",
      "",
      "2. PROBAR LOS CANALES:",
      "   • Telegram: Escribe al bot (como admin)",
      "   • WhatsApp Ventas: Escribe como cliente",
      "",
      "3. PANEL DE ADMINISTRACIÓN:",
      `   http://localhost:${config.gateway?.port || 18789}/admin`,
      "",
      "4. COMANDOS ÚTILES:",
      "   $ openclaw channels status",
      "   $ openclaw enterprise status",
      "   $ openclaw enterprise apis add",
      "",
      "🦞 ¡OpenClaw está listo!",
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
  await prompter.intro("🚀 Configuración de OpenClaw");

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
    config = await setupWhatsAppVentas(config, prompter);
    config = await setupWhatsAppAdicionales(config, prompter);
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
