/**
 * OpenClaw Empresarial - Wizard de Configuración
 *
 * Configura:
 * - ADMIN (Telegram) → Control total, dmPolicy: allowlist
 * - MANAGERS (Telegram) → Supervisan, sin permisos de config
 * - VENTAS (WhatsApp) → Atienden clientes, dmPolicy: open
 * - OTROS ROLES (WhatsApp) → Compras, Soporte, etc.
 * - CANALES SOPORTE (Discord, Slack) → Notificaciones
 *
 * POLÍTICAS DE CANAL:
 * - WhatsApp: dmPolicy="open" para que clientes escriban LIBREMENTE
 * - Telegram: dmPolicy="allowlist" para controlar acceso
 */

import type { OpenClawConfig } from "../config/config.js";
import type { EnterprisePersonality, EnterpriseConfig } from "../config/types.enterprise.js";
import type { WhatsAppAccountConfig } from "../config/types.whatsapp.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "./prompts.js";
import { logWarn } from "../logger.js";
import { formatCliCommand } from "../cli/command-format.js";
import { loginWeb } from "../channel-web.js";
import { resolveWhatsAppAuthDir } from "../web/accounts.js";
import { normalizeAccountId } from "../routing/session-key.js";
import path from "node:path";
import { pathExists } from "../utils.js";

const logger = (msg: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`onboarding-enterprise: ${msg}${metaStr}`);
};

/**
 * Resuelve un username o ID de Telegram a ID numérico
 * Soporta: @username, username, o ID numérico directamente
 */
async function resolveTelegramUserId(
  input: string,
  botToken: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Vacío" };
  }

  // Si ya es numérico, devolverlo directo
  if (/^\d+$/.test(trimmed)) {
    return { ok: true, id: trimmed };
  }

  // Es un username, intentar resolverlo via API
  const username = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  const url = `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(username)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, error: `Error HTTP ${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      result?: { id?: number | string };
    } | null;

    if (!data?.ok || !data.result?.id) {
      return { ok: false, error: "Usuario no encontrado" };
    }

    return { ok: true, id: String(data.result.id) };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: errorMsg };
  }
}

/**
 * Expertise por defecto según tipo de negocio
 */
function getDefaultExpertise(type: EnterprisePersonality['businessType']): string[] {
  const map: Record<typeof type, string[]> = {
    retail: ['Consultar disponibilidad', 'Informar precios y promociones', 'Gestionar pedidos', 'Estado de entregas'],
    services: ['Agendar citas', 'Cotizar servicios', 'Consultar disponibilidad', 'Enviar información'],
    consulting: ['Agendar consultas', 'Informar metodologías', 'Cotizar proyectos', 'Enviar propuestas'],
    healthcare: ['Agendar turnos', 'Informar coberturas', 'Recordatorios', 'Consultar resultados'],
    education: ['Informar cursos', 'Agendar clases de prueba', 'Consultar aranceles', 'Inscripciones'],
    other: ['Información general', 'Atención al cliente', 'Consultas frecuentes'],
  };
  return map[type] || map.other;
}

/**
 * Detecta si una cuenta de WhatsApp ya está linkeada
 */
async function detectWhatsAppLinked(cfg: OpenClawConfig, accountId: string): Promise<boolean> {
  const { authDir } = resolveWhatsAppAuthDir({ cfg, accountId });
  const credsPath = path.join(authDir, "creds.json");
  return await pathExists(credsPath);
}

// ============================================================
// WIZARD EMPRESARIAL COMPLETO
// ============================================================
export async function runEnterpriseWizard(
  config: OpenClawConfig,
  prompter: WizardPrompter,
  runtime?: RuntimeEnv,
): Promise<OpenClawConfig> {
  await prompter.intro("🏪 Configuración Empresarial");

  // Detectar configuración existente
  const existingPersonality = config.enterprise?.personality;
  const hasExistingBusiness = Boolean(existingPersonality?.businessName);

  // ============================================================
  // PASO 1: DATOS DE LA EMPRESA
  // ============================================================
  let businessName: string;
  let businessType: EnterprisePersonality['businessType'];
  let businessDescription: string;

  if (hasExistingBusiness) {
    await prompter.note(
      [
        "═══════════════════════════════════════════════════════════",
        "  📋 PASO 1: DATOS DE LA EMPRESA",
        "═══════════════════════════════════════════════════════════",
        "",
        `Empresa existente: ${existingPersonality!.businessName}`,
        `Tipo: ${existingPersonality!.businessType}`,
        `Descripción: ${existingPersonality!.businessDescription}`,
      ].join("\n"),
      "Empresa"
    );

    const keepBusiness = await prompter.confirm({
      message: "¿Mantener datos de la empresa?",
      initialValue: true,
    });

    if (keepBusiness) {
      businessName = existingPersonality!.businessName;
      businessType = existingPersonality!.businessType;
      businessDescription = existingPersonality!.businessDescription;
    } else {
      businessName = await prompter.text({
        message: "Nombre de la empresa",
        placeholder: "Mi Empresa S.A.",
        initialValue: existingPersonality!.businessName,
        validate: (val) => val.trim().length < 2 ? "Nombre muy corto" : undefined,
      });

      businessType = await prompter.select<EnterprisePersonality['businessType']>({
        message: "Tipo de negocio",
        options: [
          { value: 'retail', label: 'Retail / Tienda', hint: 'Venta de productos' },
          { value: 'services', label: 'Servicios', hint: 'Servicios profesionales' },
          { value: 'consulting', label: 'Consultoría', hint: 'Asesoramiento' },
          { value: 'healthcare', label: 'Salud', hint: 'Médico/Clínica' },
          { value: 'education', label: 'Educación', hint: 'Cursos/Capacitación' },
          { value: 'other', label: 'Otro', hint: 'Otro tipo' },
        ],
        initialValue: existingPersonality!.businessType,
      });

      businessDescription = await prompter.text({
        message: "¿Qué hace tu negocio? (breve)",
        placeholder: "Vendemos productos tecnológicos",
        initialValue: existingPersonality!.businessDescription,
        validate: (val) => val.trim().length < 5 ? "Descripción muy corta" : undefined,
      });
    }
  } else {
    await prompter.note(
      [
        "═══════════════════════════════════════════════════════════",
        "  📋 PASO 1: DATOS DE LA EMPRESA",
        "═══════════════════════════════════════════════════════════",
      ].join("\n"),
      "Empresa"
    );

    businessName = await prompter.text({
      message: "Nombre de la empresa",
      placeholder: "Mi Empresa S.A.",
      validate: (val) => val.trim().length < 2 ? "Nombre muy corto" : undefined,
    });

    businessType = await prompter.select<EnterprisePersonality['businessType']>({
      message: "Tipo de negocio",
      options: [
        { value: 'retail', label: 'Retail / Tienda', hint: 'Venta de productos' },
        { value: 'services', label: 'Servicios', hint: 'Servicios profesionales' },
        { value: 'consulting', label: 'Consultoría', hint: 'Asesoramiento' },
        { value: 'healthcare', label: 'Salud', hint: 'Médico/Clínica' },
        { value: 'education', label: 'Educación', hint: 'Cursos/Capacitación' },
        { value: 'other', label: 'Otro', hint: 'Otro tipo' },
      ],
    });

    businessDescription = await prompter.text({
      message: "¿Qué hace tu negocio? (breve)",
      placeholder: "Vendemos productos tecnológicos",
      validate: (val) => val.trim().length < 5 ? "Descripción muy corta" : undefined,
    });
  }

  // ============================================================
  // PASO 2: ADMIN (Telegram) - SUPER ADMINISTRADOR
  // ============================================================
  await prompter.note(
    [
      "═══════════════════════════════════════════════════════════",
      "  🔴 PASO 2: ADMINISTRADOR PRINCIPAL (Telegram)",
      "═══════════════════════════════════════════════════════════",
      "",
      "El ADMIN tiene CONTROL TOTAL del agente:",
      "  ✅ Configurar canales y modelo",
      "  ✅ Instalar/desinstalar skills",
      "  ✅ Ver métricas y logs",
      "  ✅ Reiniciar el sistema",
      "",
      "Se configura por Telegram con dmPolicy: allowlist",
      "(Solo el admin puede acceder)",
    ].join("\n"),
    "Admin"
  );

  // Verificar si ya hay Telegram configurado
  const existingTelegram = config.channels?.telegram;
  let adminTelegramId: string;
  let telegramBotToken: string | undefined = existingTelegram?.botToken;

  if (existingTelegram?.botToken && existingTelegram?.allowFrom?.length) {
    const keepTelegram = await prompter.confirm({
      message: "Telegram ya configurado. ¿Usar configuración existente?",
      initialValue: true,
    });

    if (keepTelegram) {
      adminTelegramId = String(existingTelegram.allowFrom[0]);
      telegramBotToken = existingTelegram.botToken;
    } else {
      telegramBotToken = await prompter.text({
        message: "Token del bot de Telegram (de @BotFather)",
        placeholder: "123456:ABC...",
        validate: (val) => val.includes(":") ? undefined : "Token inválido",
      });

      // Pedir username o ID - permitimos ambos
      const userInput = await prompter.text({
        message: "Tu usuario de Telegram (@username o ID numérico)",
        placeholder: "@tu_username o 123456789",
        validate: (val) => val.trim().length > 0 ? undefined : "Requerido",
      });

      // Resolver username a ID numérico
      const resolved = await resolveTelegramUserId(userInput, telegramBotToken);
      if (resolved.ok) {
        adminTelegramId = resolved.id;
        await prompter.note(`✅ ID resuelto: ${resolved.id}`, "Telegram");
      } else {
        await prompter.note(
          [
            `⚠️ No se pudo resolver "${userInput}": ${resolved.error}`,
            "",
            "Opciones:",
            "1. Enviale un mensaje a tu bot primero, luego mirá los logs:",
            `   ${formatCliCommand("openclaw logs --follow")}`,
            "2. O usá @userinfobot en Telegram para obtener tu ID",
          ].join("\n"),
          "Error"
        );
        // Pedir ID numérico manualmente
        adminTelegramId = await prompter.text({
          message: "Ingresá tu ID numérico de Telegram",
          placeholder: "123456789",
          validate: (val) => /^\d+$/.test(val.trim()) ? undefined : "Debe ser numérico",
        });
      }
    }
  } else {
    await prompter.note(
      [
        "Para configurar Telegram:",
        "1. Creá un bot con @BotFather en Telegram",
        "2. Copiá el token que te da",
        "3. Tu username o ID de Telegram",
        "",
        "El bot resolverá automáticamente tu @username a ID.",
      ].join("\n"),
      "Ayuda Telegram"
    );

    telegramBotToken = await prompter.text({
      message: "Token del bot de Telegram",
      placeholder: "123456:ABC...",
      validate: (val) => val.includes(":") ? undefined : "Token inválido",
    });

    // Pedir username o ID - permitimos ambos
    const userInput = await prompter.text({
      message: "Tu usuario de Telegram (@username o ID numérico)",
      placeholder: "@tu_username o 123456789",
      validate: (val) => val.trim().length > 0 ? undefined : "Requerido",
    });

    // Resolver username a ID numérico
    const resolved = await resolveTelegramUserId(userInput, telegramBotToken);
    if (resolved.ok) {
      adminTelegramId = resolved.id;
      await prompter.note(`✅ ID resuelto: ${resolved.id}`, "Telegram");
    } else {
      await prompter.note(
        [
          `⚠️ No se pudo resolver "${userInput}": ${resolved.error}`,
          "",
          "Asegurate de haber iniciado una conversación con el bot primero.",
          "Podés usar @userinfobot en Telegram para obtener tu ID.",
        ].join("\n"),
        "Aviso"
      );
      // Pedir ID numérico manualmente
      adminTelegramId = await prompter.text({
        message: "Ingresá tu ID numérico de Telegram",
        placeholder: "123456789",
        validate: (val) => /^\d+$/.test(val.trim()) ? undefined : "Debe ser numérico",
      });
    }
  }

  // ============================================================
  // PASO 3: MANAGERS (Telegram) - SUPERVISORES
  // ============================================================
  await prompter.note(
    [
      "═══════════════════════════════════════════════════════════",
      "  🟡 PASO 3: MANAGERS / SUPERVISORES (Telegram)",
      "═══════════════════════════════════════════════════════════",
      "",
      "Los MANAGERS pueden:",
      "  ✅ Ver métricas del negocio",
      "  ✅ Supervisar conversaciones",
      "  ✅ Dar instrucciones al agente",
      "",
      "Los MANAGERS NO pueden:",
      "  ❌ Cambiar configuración",
      "  ❌ Instalar/desinstalar",
      "  ❌ Modificar el entorno",
    ].join("\n"),
    "Managers"
  );

  const managers: Array<{ name: string; telegramId: string }> = [];
  let addManager = await prompter.confirm({
    message: "¿Agregar managers/supervisores?",
    initialValue: false,
  });

  while (addManager) {
    const managerName = await prompter.text({
      message: "Nombre del manager",
      placeholder: "Juan Pérez",
    });

    // Permitir username o ID numérico
    const managerInput = await prompter.text({
      message: `Usuario de Telegram de ${managerName} (@username o ID)`,
      placeholder: "@juan_perez o 123456789",
      validate: (val) => val.trim().length > 0 ? undefined : "Requerido",
    });

    // Resolver username a ID numérico
    const resolved = await resolveTelegramUserId(managerInput, telegramBotToken!);
    let managerTelegramId: string;

    if (resolved.ok) {
      managerTelegramId = resolved.id;
      await prompter.note(`✅ ID de ${managerName}: ${resolved.id}`, "Telegram");
    } else {
      await prompter.note(
        `⚠️ No se pudo resolver "${managerInput}". Ingresá el ID numérico.`,
        "Aviso"
      );
      managerTelegramId = await prompter.text({
        message: `ID numérico de ${managerName}`,
        placeholder: "123456789",
        validate: (val) => /^\d+$/.test(val.trim()) ? undefined : "Debe ser numérico",
      });
    }

    managers.push({ name: managerName, telegramId: managerTelegramId.trim() });

    addManager = await prompter.confirm({
      message: "¿Agregar otro manager?",
      initialValue: false,
    });
  }

  // ============================================================
  // PASO 4: VENTAS (WhatsApp) - ATENCIÓN AL PÚBLICO
  // ============================================================
  await prompter.note(
    [
      "═══════════════════════════════════════════════════════════",
      "  🟢 PASO 4: EQUIPO DE VENTAS (WhatsApp)",
      "═══════════════════════════════════════════════════════════",
      "",
      "Cada vendedor tendrá su WhatsApp vinculado.",
      "Los clientes pueden escribir LIBREMENTE (dmPolicy: open).",
      "",
      "El agente atenderá con personalidad de ventas.",
    ].join("\n"),
    "Ventas"
  );

  const ventasEmployees: Array<{ name: string; phoneNumber: string }> = [];

  const ventasCount = await prompter.select({
    message: "¿Cuántos vendedores van a usar WhatsApp?",
    options: [
      { value: 1, label: "1 vendedor" },
      { value: 2, label: "2 vendedores" },
      { value: 3, label: "3 vendedores" },
      { value: 4, label: "4 o más" },
    ],
    initialValue: 1,
  });

  for (let i = 0; i < Math.min(ventasCount, 4); i++) {
    const employeeName = await prompter.text({
      message: `Nombre del vendedor ${i + 1}`,
      placeholder: "María García",
    });

    const phone = await prompter.text({
      message: `WhatsApp de ${employeeName} (con +)`,
      placeholder: "+5493764279895",
      validate: (val) => val.startsWith("+") ? undefined : "Incluir código de país (+)",
    });

    ventasEmployees.push({
      name: employeeName.trim(),
      phoneNumber: phone.trim(),
    });

    // Si seleccionó "4 o más", preguntar si hay más después del 4to
    if (i === 3 && ventasCount === 4) {
      let addMore = await prompter.confirm({
        message: "¿Agregar otro vendedor?",
        initialValue: false,
      });

      while (addMore) {
        const extraName = await prompter.text({
          message: `Nombre del vendedor ${ventasEmployees.length + 1}`,
          placeholder: "Pedro López",
        });

        const extraPhone = await prompter.text({
          message: `WhatsApp de ${extraName}`,
          placeholder: "+5493764279895",
          validate: (val) => val.startsWith("+") ? undefined : "Incluir +",
        });

        ventasEmployees.push({ name: extraName.trim(), phoneNumber: extraPhone.trim() });

        addMore = await prompter.confirm({
          message: "¿Agregar otro?",
          initialValue: false,
        });
      }
    }
  }

  // ============================================================
  // PASO 5: OTROS ROLES (WhatsApp) - COMPRAS, SOPORTE, ETC.
  // ============================================================
  await prompter.note(
    [
      "═══════════════════════════════════════════════════════════",
      "  🔵 PASO 5: OTROS ROLES (WhatsApp)",
      "═══════════════════════════════════════════════════════════",
      "",
      "Podés agregar otros roles con WhatsApp:",
      "  • Compras - Proveedores",
      "  • Soporte Técnico - Post-venta",
      "  • Logística - Entregas",
      "  • Otros...",
    ].join("\n"),
    "Otros Roles"
  );

  const otherRoles: Array<{ role: string; name: string; phoneNumber: string }> = [];
  let addRole = await prompter.confirm({
    message: "¿Agregar otros roles?",
    initialValue: false,
  });

  while (addRole) {
    const roleType = await prompter.select({
      message: "Tipo de rol",
      options: [
        { value: 'compras', label: 'Compras', hint: 'Gestión de proveedores' },
        { value: 'soporte', label: 'Soporte Técnico', hint: 'Post-venta' },
        { value: 'logistica', label: 'Logística', hint: 'Entregas' },
        { value: 'otro', label: 'Otro', hint: 'Personalizado' },
      ],
    });

    const roleName = await prompter.text({
      message: "Nombre de la persona",
      placeholder: "Carlos Gómez",
    });

    const rolePhone = await prompter.text({
      message: `WhatsApp de ${roleName}`,
      placeholder: "+5493764279895",
      validate: (val) => val.startsWith("+") ? undefined : "Incluir +",
    });

    otherRoles.push({
      role: roleType,
      name: roleName.trim(),
      phoneNumber: rolePhone.trim(),
    });

    addRole = await prompter.confirm({
      message: "¿Agregar otro rol?",
      initialValue: false,
    });
  }

  // ============================================================
  // RESUMEN Y CONFIRMACIÓN
  // ============================================================
  const summaryLines = [
    "═══════════════════════════════════════════════════════════",
    "  📋 RESUMEN DE CONFIGURACIÓN",
    "═══════════════════════════════════════════════════════════",
    "",
    `🏢 ${businessName.trim()} (${businessType})`,
    `   ${businessDescription.trim()}`,
    "",
    "🔴 ADMIN (Telegram):",
    `   ID: ${adminTelegramId}`,
    "",
  ];

  if (managers.length > 0) {
    summaryLines.push("🟡 MANAGERS (Telegram):");
    managers.forEach(m => summaryLines.push(`   • ${m.name}: ${m.telegramId}`));
    summaryLines.push("");
  }

  summaryLines.push("🟢 VENTAS (WhatsApp - dmPolicy: open):");
  ventasEmployees.forEach(e => summaryLines.push(`   • ${e.name}: ${e.phoneNumber}`));

  if (otherRoles.length > 0) {
    summaryLines.push("");
    summaryLines.push("🔵 OTROS ROLES (WhatsApp):");
    otherRoles.forEach(r => summaryLines.push(`   • ${r.role}: ${r.name} - ${r.phoneNumber}`));
  }

  await prompter.note(summaryLines.join("\n"), "Confirmar");

  const confirm = await prompter.confirm({
    message: "¿Todo correcto? ¿Aplicar configuración?",
    initialValue: true,
  });

  if (!confirm) {
    await prompter.outro("Configuración cancelada.");
    return config;
  }

  // ============================================================
  // APLICAR CONFIGURACIÓN
  // ============================================================
  const personality: EnterprisePersonality = {
    businessName: businessName.trim(),
    businessType,
    businessDescription: businessDescription.trim(),
    sales: {
      name: "Vendedor",
      tone: "professional",
      expertise: getDefaultExpertise(businessType),
      restrictions: [
        'No proporcionar información de costos internos',
        'No acceder a datos de otros clientes',
        'Escalar al admin ante consultas sensibles',
      ],
    },
    admin: {
      name: "Admin",
      capabilities: ['Control total', 'Configuración', 'Métricas'],
      escalationTriggers: ['Hablar con encargado', 'Reclamo', 'Descuentos especiales'],
    },
  };

  // Construir cuentas WhatsApp
  const whatsappAccountsConfig: Record<string, WhatsAppAccountConfig> = {};

  // VENTAS
  ventasEmployees.forEach((emp, idx) => {
    const accountId = `ventas_${idx + 1}`;
    whatsappAccountsConfig[accountId] = {
      name: emp.name,
      phoneNumber: emp.phoneNumber,
      role: 'public',
      purpose: 'Atención al público - Ventas',
      enabled: true,
      dmPolicy: 'open', // IMPORTANTE: clientes pueden escribir libremente
      allowFrom: ['*'], // Aceptar cualquier número
    };
  });

  // OTROS ROLES
  otherRoles.forEach((r, idx) => {
    const accountId = `${r.role}_${idx + 1}`;
    whatsappAccountsConfig[accountId] = {
      name: r.name,
      phoneNumber: r.phoneNumber,
      role: r.role === 'compras' ? 'purchasing' : r.role === 'soporte' ? 'support' : 'public',
      purpose: r.role === 'compras' ? 'Gestión de proveedores' :
               r.role === 'soporte' ? 'Soporte técnico' :
               r.role === 'logistica' ? 'Logística y entregas' : 'Otro',
      enabled: true,
      dmPolicy: 'open',
      allowFrom: ['*'],
    };
  });

  // Construir allowFrom para Telegram (admin + managers)
  const telegramAllowFrom = [adminTelegramId.trim(), ...managers.map(m => m.telegramId)];

  const enterpriseConfig: EnterpriseConfig = {
    ...config.enterprise,
    personality,
    features: {
      dualPersonality: true,
      securityAlerts: true,
      escalationEnabled: true,
    },
  };

  const newConfig: OpenClawConfig = {
    ...config,
    // TELEGRAM - Admin y Managers (dmPolicy: allowlist)
    channels: {
      ...config.channels,
      telegram: {
        ...config.channels?.telegram,
        enabled: true,
        botToken: telegramBotToken,
        dmPolicy: 'allowlist', // Solo usuarios en allowFrom
        allowFrom: telegramAllowFrom,
        groupPolicy: 'disabled', // No grupos por defecto
      },
      // WHATSAPP - Ventas y otros (dmPolicy: open)
      whatsapp: {
        ...config.channels?.whatsapp,
        enabled: true,
        dmPolicy: 'open', // Clientes pueden escribir libremente
        allowFrom: ['*'], // Aceptar cualquier número
        accounts: whatsappAccountsConfig,
      },
    },
    // Habilitar plugins WhatsApp y Telegram
    plugins: {
      ...config.plugins,
      entries: {
        ...config.plugins?.entries,
        whatsapp: {
          ...config.plugins?.entries?.whatsapp,
          enabled: true,
        },
        telegram: {
          ...config.plugins?.entries?.telegram,
          enabled: true,
        },
      },
    },
    enterprise: enterpriseConfig,
  };

  // ============================================================
  // LOGIN WHATSAPP - VINCULAR CUENTAS
  // ============================================================
  if (runtime && Object.keys(whatsappAccountsConfig).length > 0) {
    await prompter.note(
      [
        "═══════════════════════════════════════════════════════════",
        "  📱 VINCULAR CUENTAS DE WHATSAPP",
        "═══════════════════════════════════════════════════════════",
        "",
        "Ahora necesitás escanear el código QR con cada WhatsApp.",
        "Esto vincula el número al agente.",
      ].join("\n"),
      "Vincular WhatsApp"
    );

    for (const [accountId, account] of Object.entries(whatsappAccountsConfig)) {
      const normalizedId = normalizeAccountId(accountId);
      const alreadyLinked = await detectWhatsAppLinked(newConfig, normalizedId);

      if (alreadyLinked) {
        await prompter.note(`✅ ${account.name} ya está vinculado.`, "WhatsApp");
        continue;
      }

      const wantsLogin = await prompter.confirm({
        message: `¿Vincular ${account.name} (${account.phoneNumber}) ahora?`,
        initialValue: true,
      });

      if (wantsLogin) {
        await prompter.note(
          [
            `Escaneá el QR con WhatsApp para ${account.name}:`,
            "",
            "1. Abrí WhatsApp en tu teléfono",
            "2. Configuración > Dispositivos vinculados",
            "3. 'Vincular un dispositivo'",
            "4. Escaneá el código que aparecerá",
          ].join("\n"),
          `QR - ${account.name}`
        );

        try {
          await loginWeb(false, undefined, runtime, normalizedId);
          await prompter.note(`✅ ${account.name} vinculado correctamente.`, "WhatsApp");
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          await prompter.note(
            [
              `⚠️ Error al vincular ${account.name}: ${errorMsg}`,
              "",
              `Vinculá manualmente con:`,
              `  ${formatCliCommand(`openclaw channels login whatsapp --account ${accountId}`)}`,
            ].join("\n"),
            "Error"
          );
        }
      } else {
        await prompter.note(
          `Para vincular después: ${formatCliCommand(`openclaw channels login whatsapp --account ${accountId}`)}`,
          "Recordatorio"
        );
      }
    }
  }

  await prompter.outro(
    [
      "✅ Configuración empresarial completada",
      "",
      "📱 CANALES CONFIGURADOS:",
      `   • Telegram: ${managers.length + 1} usuario(s)`,
      `   • WhatsApp: ${Object.keys(whatsappAccountsConfig).length} cuenta(s)`,
      "",
      "🚀 PRÓXIMOS PASOS:",
      "   1. Iniciar gateway: openclaw gateway",
      "   2. Panel admin: http://localhost:18789/admin",
    ].join("\n")
  );

  return newConfig;
}

// Alias para compatibilidad
export const setupEnterpriseApis = runEnterpriseWizard;

// ============================================================
// FUNCIONES ADICIONALES PARA COMANDOS ENTERPRISE
// ============================================================

/**
 * Muestra la configuración empresarial actual
 */
export async function showEnterpriseConfig(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<void> {
  const enterprise = config.enterprise;

  if (!enterprise?.personality) {
    await prompter.note(
      "No hay configuración empresarial.\nEjecuta el wizard para configurar.",
      "Sin configuración"
    );
    return;
  }

  const lines = [
    "═══════════════════════════════════════════════════════════",
    "  📋 CONFIGURACIÓN EMPRESARIAL",
    "═══════════════════════════════════════════════════════════",
    "",
    `🏢 ${enterprise.personality.businessName} (${enterprise.personality.businessType})`,
    `   ${enterprise.personality.businessDescription}`,
    "",
    "🔴 ADMIN (Telegram):",
    `   ${enterprise.personality.admin.name}`,
    `   Capacidades: ${enterprise.personality.admin.capabilities.join(", ")}`,
    "",
    "🟢 VENTAS (WhatsApp):",
    `   ${enterprise.personality.sales.name}`,
    `   Tono: ${enterprise.personality.sales.tone}`,
    `   Expertise: ${enterprise.personality.sales.expertise.join(", ")}`,
    "",
  ];

  if (enterprise.features) {
    lines.push("⚙️ FEATURES:");
    lines.push(`   Dual Personality: ${enterprise.features.dualPersonality ? "✅" : "❌"}`);
    lines.push(`   Escalada: ${enterprise.features.escalationEnabled ? "✅" : "❌"}`);
    lines.push(`   Alertas de seguridad: ${enterprise.features.securityAlerts ? "✅" : "❌"}`);
  }

  // Mostrar canales configurados
  const channels = config.channels;
  if (channels?.telegram) {
    lines.push("");
    lines.push("📱 TELEGRAM:");
    lines.push(`   dmPolicy: ${channels.telegram.dmPolicy}`);
    lines.push(`   allowFrom: ${channels.telegram.allowFrom?.join(", ") || "ninguno"}`);
  }

  if (channels?.whatsapp) {
    lines.push("");
    lines.push("📱 WHATSAPP:");
    lines.push(`   dmPolicy: ${channels.whatsapp.dmPolicy}`);
    const accounts = channels.whatsapp.accounts;
    if (accounts) {
      Object.entries(accounts).forEach(([id, acc]) => {
        lines.push(`   • ${id}: ${acc.name} (${acc.phoneNumber})`);
      });
    }
  }

  await prompter.note(lines.join("\n"), "Estado Empresarial");
}

/**
 * Reconfigura las personalidades (ventas y admin)
 */
export async function reconfigurePersonalities(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.intro("🔄 Reconfigurar Personalidades");

  const currentPersonality = config.enterprise?.personality;

  if (!currentPersonality) {
    await prompter.note(
      "No hay personalidad configurada. Ejecuta el wizard completo.",
      "Error"
    );
    return config;
  }

  const section = await prompter.select({
    message: "¿Qué querés reconfigurar?",
    options: [
      { value: "sales", label: "Personalidad VENTAS" },
      { value: "admin", label: "Personalidad ADMIN" },
      { value: "both", label: "Ambas" },
      { value: "cancel", label: "Cancelar" },
    ],
  });

  if (section === "cancel") {
    return config;
  }

  let newPersonality = { ...currentPersonality };

  if (section === "sales" || section === "both") {
    await prompter.note("Configurando personalidad VENTAS...", "VENTAS");

    const tone = await prompter.select<'professional' | 'friendly' | 'casual' | 'luxury'>({
      message: "Tono de comunicación",
      options: [
        { value: "professional", label: "Profesional" },
        { value: "friendly", label: "Amigable" },
        { value: "casual", label: "Casual" },
        { value: "luxury", label: "Premium/Lujo" },
      ],
      initialValue: currentPersonality.sales.tone,
    });

    const expertiseInput = await prompter.text({
      message: "Expertise (separado por comas)",
      initialValue: currentPersonality.sales.expertise.join(", "),
    });

    const restrictionsInput = await prompter.text({
      message: "Restricciones (separado por comas)",
      initialValue: currentPersonality.sales.restrictions.join(", "),
    });

    newPersonality = {
      ...newPersonality,
      sales: {
        ...newPersonality.sales,
        tone,
        expertise: expertiseInput.split(",").map((e) => e.trim()),
        restrictions: restrictionsInput.split(",").map((r) => r.trim()),
      },
    };
  }

  if (section === "admin" || section === "both") {
    await prompter.note("Configurando personalidad ADMIN...", "ADMIN");

    const capabilitiesInput = await prompter.text({
      message: "Capacidades (separado por comas)",
      initialValue: currentPersonality.admin.capabilities.join(", "),
    });

    const triggersInput = await prompter.text({
      message: "Triggers de escalada (separado por comas)",
      initialValue: currentPersonality.admin.escalationTriggers.join(", "),
    });

    newPersonality = {
      ...newPersonality,
      admin: {
        ...newPersonality.admin,
        capabilities: capabilitiesInput.split(",").map((c) => c.trim()),
        escalationTriggers: triggersInput.split(",").map((t) => t.trim()),
      },
    };
  }

  await prompter.outro("Personalidades actualizadas.");

  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      personality: newPersonality,
    },
  };
}

/**
 * Agrega una API empresarial
 */
export async function addEnterpriseApi(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.intro("➕ Agregar API Empresarial");

  const apiId = await prompter.text({
    message: "ID de la API (sin espacios)",
    placeholder: "mi_api",
    validate: (val) => /^\w+$/.test(val) ? undefined : "Solo letras, números y _",
  });

  const endpoint = await prompter.text({
    message: "URL del endpoint",
    placeholder: "https://api.ejemplo.com/v1/resource",
    validate: (val) => val.startsWith("http") ? undefined : "Debe ser una URL válida",
  });

  const method = await prompter.select({
    message: "Método HTTP",
    options: [
      { value: "GET", label: "GET" },
      { value: "POST", label: "POST" },
      { value: "PUT", label: "PUT" },
      { value: "DELETE", label: "DELETE" },
    ],
    initialValue: "GET",
  });

  const auth = await prompter.select<"bearer_token" | "api_key" | "basic" | "none">({
    message: "Tipo de autenticación",
    options: [
      { value: "none", label: "Sin autenticación" },
      { value: "bearer_token", label: "Bearer Token" },
      { value: "api_key", label: "API Key (header)" },
      { value: "basic", label: "Basic Auth" },
    ],
    initialValue: "none",
  });

  let headers: Record<string, string> = {};

  if (auth === "bearer_token") {
    const token = await prompter.text({
      message: "Bearer Token",
      placeholder: "tu_token_aqui",
    });
    headers["Authorization"] = `Bearer ${token}`;
  } else if (auth === "api_key") {
    const keyName = await prompter.text({
      message: "Nombre del header",
      placeholder: "X-API-Key",
    });
    const keyValue = await prompter.text({
      message: "Valor del API Key",
    });
    headers[keyName] = keyValue;
  } else if (auth === "basic") {
    const username = await prompter.text({ message: "Username" });
    const password = await prompter.text({ message: "Password" });
    const encoded = Buffer.from(`${username}:${password}`).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  await prompter.outro(`API ${apiId} configurada.`);

  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      apis: {
        ...config.enterprise?.apis,
        [apiId]: {
          endpoint,
          method,
          auth,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        },
      },
    },
  };
}

/**
 * Elimina una API empresarial
 */
export async function removeEnterpriseApi(
  config: OpenClawConfig,
  apiId: string,
): Promise<OpenClawConfig> {
  const apis = config.enterprise?.apis;

  if (!apis || !apis[apiId]) {
    return config; // No encontrado, retornar sin cambios
  }

  const { [apiId]: removed, ...remainingApis } = apis;

  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      apis: remainingApis,
    },
  };
}
