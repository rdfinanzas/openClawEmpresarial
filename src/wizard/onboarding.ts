/**
 * OpenClaw - Wizard de Configuración Unificado
 *
 * Wizard completo que configura:
 * - Gateway (puerto, red, autenticación)
 * - Modelo LLM (Claude, OpenAI, Gemini, etc.)
 * - Configuración empresarial (admin, managers, ventas)
 * - Canales principales (WhatsApp, Telegram)
 * - Canales de soporte (Discord, Slack)
 *
 * USO:
 *   openclaw onboard           # Flujo interactivo completo
 *   openclaw onboard --flow quickstart  # Configuración rápida
 */

import type {
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { QuickstartGatewayDefaults, WizardFlow } from "./onboarding.types.js";
import { ensureAuthProfileStore } from "../agents/auth-profiles.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { formatCliCommand } from "../cli/command-format.js";
import { promptAuthChoiceGrouped } from "../commands/auth-choice-prompt.js";
import {
  applyAuthChoice,
  resolvePreferredProviderForAuthChoice,
  warnIfModelConfigLooksOff,
} from "../commands/auth-choice.js";
import { applyPrimaryModel, promptDefaultModel } from "../commands/model-picker.js";
import { setupChannels } from "../commands/onboard-channels.js";
import { promptCustomApiConfig } from "../commands/onboard-custom.js";
import {
  applyWizardMetadata,
  DEFAULT_WORKSPACE,
  ensureWorkspaceAndSessions,
  handleReset,
  printWizardHeader,
  probeGatewayReachable,
  summarizeExistingConfig,
} from "../commands/onboard-helpers.js";
import { setupInternalHooks } from "../commands/onboard-hooks.js";
import { promptRemoteGatewayConfig } from "../commands/onboard-remote.js";
import { setupSkills } from "../commands/onboard-skills.js";
import {
  DEFAULT_GATEWAY_PORT,
  readConfigFileSnapshot,
  resolveGatewayPort,
  writeConfigFile,
} from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { finalizeOnboardingWizard } from "./onboarding.finalize.js";
import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";

// ============================================================
// MENSAJE DE ADVERTENCIA DE SEGURIDAD
// ============================================================
async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
}) {
  if (params.opts.acceptRisk === true) {
    return;
  }

  await params.prompter.note(
    [
      "⚠️  ADVERTENCIA DE SEGURIDAD - Por favor leer.",
      "",
      "OpenClaw es un proyecto en desarrollo activo (beta).",
      "Este bot puede leer archivos y ejecutar acciones si las herramientas están habilitadas.",
      "Un prompt malicioso puede engañarlo para hacer cosas inseguras.",
      "",
      "Si no estás cómodo con conceptos básicos de seguridad y control de acceso,",
      "no ejecutes OpenClaw. Pide ayuda a alguien con experiencia antes de",
      "habilitar herramientas o exponerlo a internet.",
      "",
      "Configuración recomendada:",
      "- Listas de emparejamiento/permitidos + mención obligatoria.",
      "- Sandbox + herramientas con mínimos privilegios.",
      "- Mantén los secretos fuera del sistema de archivos accesible por el agente.",
      "- Usa el modelo más potente disponible para bots con herramientas o bandejas no confiables.",
      "",
      "Ejecutar regularmente:",
      `  ${formatCliCommand("openclaw security audit --deep")}`,
      `  ${formatCliCommand("openclaw security audit --fix")}`,
      "",
      "Lectura obligatoria: https://docs.openclaw.ai/gateway/security",
    ].join("\n"),
    "Seguridad",
  );

  const ok = await params.prompter.confirm({
    message: "Entiendo que esto es potente e inherentemente riesgoso. ¿Continuar?",
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError("riesgo no aceptado");
  }
}

// ============================================================
// HELPERS PARA DETECTAR CONFIGURACIÓN EXISTENTE
// ============================================================

function hasModelConfigured(cfg: OpenClawConfig): boolean {
  return Boolean(
    cfg.agents?.defaults?.model?.primary ||
    (cfg.auth?.profiles && Object.keys(cfg.auth.profiles).length > 0)
  );
}

function hasChannelsConfigured(cfg: OpenClawConfig): boolean {
  const channels = cfg.channels;
  if (!channels) return false;
  return Boolean(
    channels.telegram?.botToken ||
    channels.telegram?.enabled ||
    channels.whatsapp?.enabled ||
    channels.discord?.enabled ||
    channels.slack?.enabled
  );
}

function hasEnterpriseConfigured(cfg: OpenClawConfig): boolean {
  return Boolean(
    cfg.enterprise?.personality?.businessName ||
    cfg.enterprise?.features?.dualPersonality
  );
}

function hasGatewayConfigured(cfg: OpenClawConfig): boolean {
  return Boolean(
    typeof cfg.gateway?.port === "number" ||
    cfg.gateway?.auth?.token ||
    cfg.gateway?.auth?.password
  );
}

async function askKeepOrModify(
  prompter: WizardPrompter,
  sectionName: string,
  summary: string,
): Promise<boolean> {
  const action = await prompter.select({
    message: `${sectionName} - ¿Qué hacer?`,
    options: [
      { value: "keep", label: `Mantener (${summary})` },
      { value: "modify", label: "Modificar" },
    ],
    initialValue: "keep",
  });
  return action === "keep";
}

// ============================================================
// FUNCIÓN PRINCIPAL DEL WIZARD
// ============================================================
export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  // ═══════════════════════════════════════════════════════════════
  // FASE 0: ENCABEZADO Y SEGURIDAD
  // ═══════════════════════════════════════════════════════════════
  printWizardHeader(runtime);
  await prompter.intro("🏪 Agento - Configuración Inicial");
  await requireRiskAcknowledgement({ opts, prompter });

  // ═══════════════════════════════════════════════════════════════
  // FASE 1: DETECTAR CONFIGURACIÓN EXISTENTE
  // ═══════════════════════════════════════════════════════════════
  const snapshot = await readConfigFileSnapshot();
  let baseConfig: OpenClawConfig = snapshot.valid ? snapshot.config : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(summarizeExistingConfig(baseConfig), "Configuración inválida");
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "Documentación: https://docs.openclaw.ai/gateway/configuration",
        ].join("\n"),
        "Problemas de configuración",
      );
    }
    await prompter.outro(
      `Configuración inválida. Ejecuta \`${formatCliCommand("openclaw doctor")}\` para repararla.`,
    );
    runtime.exit(1);
    return;
  }

  // Preguntar qué hacer con config existente
  let keepExisting = false;
  if (snapshot.exists) {
    await prompter.note(summarizeExistingConfig(baseConfig), "Configuración existente detectada");

    const action = await prompter.select({
      message: "Manejo de configuración",
      options: [
        { value: "keep", label: "Usar valores existentes (completar lo que falte)" },
        { value: "modify", label: "Revisar y modificar cada sección" },
        { value: "reset", label: "Reiniciar todo" },
      ],
    });

    if (action === "reset") {
      const workspaceDefault = baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
      const resetScope = (await prompter.select({
        message: "Alcance del reinicio",
        options: [
          { value: "config", label: "Solo configuración" },
          { value: "config+creds+sessions", label: "Config + credenciales + sesiones" },
          { value: "full", label: "Reinicio completo" },
        ],
      })) as ResetScope;
      await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
    } else if (action === "keep") {
      keepExisting = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 2: SELECCIÓN DE MODO
  // ═══════════════════════════════════════════════════════════════
  const quickstartHint = `Configurar detalles después con ${formatCliCommand("openclaw configure")}.`;
  const manualHint = "Configurar cada opción manualmente.";

  let flow: WizardFlow = opts.flow === "advanced" || opts.flow === "manual"
    ? "advanced"
    : opts.flow === "quickstart"
      ? "quickstart"
      : await prompter.select({
          message: "Modo de configuración",
          options: [
            { value: "quickstart", label: "QuickStart (Recomendado)", hint: quickstartHint },
            { value: "advanced", label: "Manual / Avanzado", hint: manualHint },
          ],
          initialValue: "quickstart",
        });

  // ═══════════════════════════════════════════════════════════════
  // FASE 3: CONFIGURACIÓN DEL GATEWAY
  // ═══════════════════════════════════════════════════════════════
  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting = hasGatewayConfigured(baseConfig);
    const bindRaw = baseConfig.gateway?.bind;
    const bind = ["loopback", "lan", "auto", "custom", "tailnet"].includes(bindRaw as string)
      ? bindRaw as "loopback" | "lan" | "auto" | "custom" | "tailnet"
      : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (baseConfig.gateway?.auth?.mode === "password") authMode = "password";
    else if (baseConfig.gateway?.auth?.token) authMode = "token";
    else if (baseConfig.gateway?.auth?.password) authMode = "password";

    const tailscaleMode = ["off", "serve", "funnel"].includes(baseConfig.gateway?.tailscale?.mode as string)
      ? baseConfig.gateway?.tailscale?.mode as "off" | "serve" | "funnel"
      : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  // Mostrar config QuickStart
  if (flow === "quickstart") {
    const qsLines = quickstartGateway.hasExisting
      ? [
          "Manteniendo configuración del gateway:",
          `Puerto: ${quickstartGateway.port}`,
          `Autenticación: ${quickstartGateway.authMode === "token" ? "Token" : "Contraseña"}`,
        ]
      : [
          `Puerto: ${DEFAULT_GATEWAY_PORT}`,
          "Autenticación: Token",
        ];
    await prompter.note(qsLines.join("\n"), "QuickStart");
  }

  // Detectar gateway
  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  const localProbe = await probeGatewayReachable({
    url: localUrl,
    token: baseConfig.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN,
    password: baseConfig.gateway?.auth?.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD,
  });

  // Seleccionar modo local/remote
  const mode = opts.mode ?? (flow === "quickstart" ? "local" : await prompter.select({
    message: "¿Qué querés configurar?",
    options: [
      { value: "local", label: "Gateway local", hint: localProbe.ok ? "Detectado" : "No detectado" },
      { value: "remote", label: "Gateway remoto" },
    ],
  }) as OnboardMode);

  if (mode === "remote") {
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter);
    nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
    await writeConfigFile(nextConfig);
    await prompter.outro("Gateway remoto configurado.");
    return;
  }

  // Workspace
  const workspaceInput = opts.workspace ?? (flow === "quickstart"
    ? (baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE)
    : await prompter.text({
        message: "Directorio del workspace",
        initialValue: baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE,
      }));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || DEFAULT_WORKSPACE);

  let nextConfig: OpenClawConfig = {
    ...baseConfig,
    agents: { ...baseConfig.agents, defaults: { ...baseConfig.agents?.defaults, workspace: workspaceDir } },
    gateway: { ...baseConfig.gateway, mode: "local" },
  };

  // ═══════════════════════════════════════════════════════════════
  // FASE 4: MODELO IA
  // ═══════════════════════════════════════════════════════════════
  const modelConfigured = hasModelConfigured(baseConfig);

  // Verificar si hay API key configurada (no solo el modelo)
  const hasAuthProfile = Boolean(
    baseConfig.auth?.profiles && Object.keys(baseConfig.auth.profiles).length > 0
  );

  // Solo saltar si BOTH modelo Y auth están configurados
  let skipModel = false;
  if (keepExisting && modelConfigured && hasAuthProfile) {
    skipModel = await askKeepOrModify(prompter, "Modelo IA", baseConfig.agents?.defaults?.model?.primary || "configurado");
  } else if (keepExisting && modelConfigured && !hasAuthProfile) {
    // Modelo configurado pero SIN API key - mostrar aviso
    await prompter.note(
      [
        `Modelo: ${baseConfig.agents?.defaults?.model?.primary}`,
        "",
        "⚠️ No hay API key configurada.",
        "Necesitás configurar la autenticación para que funcione.",
      ].join("\n"),
      "Auth faltante"
    );
    skipModel = false;  // NO saltar, necesita configurar auth
  }

  if (!skipModel) {
    await prompter.note(
      ["🤖 CONFIGURACIÓN DEL MODELO IA", "", "Selecciona el proveedor de IA para tu asistente."].join("\n"),
      "Paso 1"
    );

    const authStore = ensureAuthProfileStore(undefined, { allowKeychainPrompt: false });
    const authChoice = opts.authChoice ?? await promptAuthChoiceGrouped({ prompter, store: authStore, includeSkip: true });

    if (authChoice === "custom-api-key") {
      const customResult = await promptCustomApiConfig({ prompter, runtime, config: nextConfig });
      nextConfig = customResult.config;
    } else if (authChoice !== "skip") {
      const authResult = await applyAuthChoice({
        authChoice,
        config: nextConfig,
        prompter,
        runtime,
        setDefaultModel: true,
        opts: { tokenProvider: opts.tokenProvider },
      });
      nextConfig = authResult.config;
    }

    // Siempre permitir seleccionar modelo (puede que el usuario quiera cambiar)
    if (authChoice !== "skip") {
      const modelSelection = await promptDefaultModel({
        config: nextConfig,
        prompter,
        allowKeep: true,
        ignoreAllowlist: true,
      });
      if (modelSelection.model) {
        nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
      }
    }

    await warnIfModelConfigLooksOff(nextConfig, prompter);
  } else {
    await prompter.note(`Manteniendo modelo: ${baseConfig.agents?.defaults?.model?.primary}`, "Modelo IA");
  }

  // Configurar gateway
  const gateway = await configureGatewayForOnboarding({
    flow, baseConfig, nextConfig, localPort, quickstartGateway, prompter, runtime,
  });
  nextConfig = gateway.nextConfig;
  const settings = gateway.settings;

  // ═══════════════════════════════════════════════════════════════
  // FASE 5: CONFIGURACIÓN EMPRESARIAL
  // ═══════════════════════════════════════════════════════════════
  await prompter.note(
    [
      "═════════════════════════════════════════",
      "  🏪 CONFIGURACIÓN EMPRESARIAL",
      "═════════════════════════════════════════",
      "",
      "Configuraremos tu asistente empresarial con:",
      "",
      "📱 CANALES PRINCIPALES (comunicación con clientes):",
      "  • WhatsApp → VENTAS, SOPORTE (dmPolicy: open)",
      "  • Telegram → ADMIN, MANAGERS (dmPolicy: allowlist)",
      "",
      "👥 ROLES:",
      "  • ADMIN: Control total (1 persona)",
      "  • MANAGERS: Supervisan, sin permisos de config",
      "  • VENTAS: Atienden clientes por WhatsApp",
      "",
      "🔧 CANALES DE SOPORTE (opcional):",
      "  • Discord, Slack → Notificaciones, logs",
    ].join("\n"),
    "Paso 2"
  );

  // Verificar si los CANALES están configurados (no solo la empresa)
  const hasTelegramConfig = Boolean(
    nextConfig.channels?.telegram?.botToken &&
    nextConfig.channels?.telegram?.allowFrom?.length
  );
  const hasWhatsAppConfig = Boolean(
    nextConfig.channels?.whatsapp?.enabled &&
    nextConfig.channels?.whatsapp?.accounts &&
    Object.keys(nextConfig.channels?.whatsapp?.accounts || {}).length > 0
  );
  const channelsFullyConfigured = hasTelegramConfig && hasWhatsAppConfig;

  const enterpriseConfigured = hasEnterpriseConfigured(baseConfig);
  let skipEnterprise = false;

  // Solo saltar si AMBOS empresa Y canales están configurados
  if (keepExisting && enterpriseConfigured && channelsFullyConfigured) {
    skipEnterprise = await askKeepOrModify(
      prompter,
      "Config. Empresarial",
      `${baseConfig.enterprise?.personality?.businessName || "configurado"} (canales listos)`
    );
  } else if (keepExisting && enterpriseConfigured) {
    // Empresa configurada pero canales incompletos - preguntar qué hacer
    await prompter.note(
      [
        `Empresa: ${baseConfig.enterprise?.personality?.businessName || "Configurada"}`,
        "",
        "Estado de canales:",
        `  Telegram: ${hasTelegramConfig ? "✅ Configurado" : "❌ Falta configurar"}`,
        `  WhatsApp: ${hasWhatsAppConfig ? "✅ Configurado" : "❌ Falta configurar"}`,
      ].join("\n"),
      "Canales incompletos"
    );
    // No saltar, ejecutar el wizard
    skipEnterprise = false;
  }

  if (!skipEnterprise) {
    const { runEnterpriseWizard } = await import("./onboarding-enterprise.js");
    nextConfig = await runEnterpriseWizard(nextConfig, prompter, runtime);
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 6: CANALES DE SOPORTE (Discord, Slack, etc.)
  // ═══════════════════════════════════════════════════════════════
  await prompter.note(
    [
      "═════════════════════════════════════════",
      "  🔧 CANALES DE SOPORTE/INTEGRACIÓN",
      "═════════════════════════════════════════",
      "",
      "Podés configurar canales adicionales para:",
      "  • Notificaciones del sistema",
      "  • Logs de actividad",
      "  • Alertas de seguridad",
      "  • Integración con el equipo",
    ].join("\n"),
    "Paso 3"
  );

  const wantsSupportChannels = await prompter.confirm({
    message: "¿Configurar canales de soporte? (Discord, Slack)",
    initialValue: false,
  });

  if (wantsSupportChannels && !(opts.skipChannels ?? opts.skipProviders)) {
    // Usar el setupChannels normal para configurar Discord/Slack
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      skipDmPolicyPrompt: true,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 7: GUARDAR Y SKILLS
  // ═══════════════════════════════════════════════════════════════
  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  await ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  // Skills recomendadas para empresas
  if (!opts.skipSkills) {
    await prompter.note(
      [
        "═════════════════════════════════════════",
        "  🔧 SKILLS RECOMENDADAS",
        "═════════════════════════════════════════",
        "",
        "Skills útiles para tu empresa:",
        "  ✅ wacli - Contactar clientes por WhatsApp",
        "  ✅ weather - Consulta de clima",
        "  ✅ summarize - Resumir documentos",
        "",
        "Opcionales:",
        "  • notion - CRM interno",
        "  • slack - Comunicación equipo",
        "  • github - Soporte técnico",
      ].join("\n"),
      "Paso 4"
    );

    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  // Hooks
  nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);

  // ═══════════════════════════════════════════════════════════════
  // FASE 8: FINALIZACIÓN
  // ═══════════════════════════════════════════════════════════════
  nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);

  const { launchedTui } = await finalizeOnboardingWizard({
    flow, opts, baseConfig, nextConfig, workspaceDir, settings, prompter, runtime,
  });

  if (launchedTui) return;
}
