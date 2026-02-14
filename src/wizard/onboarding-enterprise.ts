/**
 * Agento Empresarial - Wizard Complementario
 * 
 * ⚠️ EJECUTAR DESPUÉS DE: agento onboard
 * 
 * Este wizard configura:
 * - Personalidad VENTAS (WhatsApp/Discord público)
 * - Personalidad ADMIN (Telegram privado)
 * - Múltiples cuentas WhatsApp (ventas, compras, soporte)
 * - APIs empresariales
 * 
 * Pre-requisitos (configurados por 'agento onboard'):
 * - Modelo LLM configurado
 * - Token de Telegram (para admin)
 * - WhatsApp principal escaneado
 */

import type { OpenClawConfig } from "../config/config.js";
import type { WizardPrompter } from "./prompts.js";
import { logWarn } from "../logger.js";

const logger = (msg: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`onboarding-enterprise: ${msg}${metaStr}`);
};

/**
 * Configuración de personalidad empresarial
 */
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

/**
 * Genera expertise por defecto según tipo de negocio
 */
function getDefaultExpertise(type: EnterprisePersonality['businessType']): string[] {
  const map: Record<typeof type, string[]> = {
    retail: [
      'Consultar disponibilidad de productos',
      'Informar precios y promociones',
      'Crear y gestionar pedidos',
      'Verificar estado de entregas',
    ],
    services: [
      'Agendar citas y consultas',
      'Cotizar trabajos/proyectos',
      'Consultar disponibilidad',
      'Enviar información de servicios',
    ],
    consulting: [
      'Agendar consultas inicial',
      'Informar metodologías',
      'Cotizar proyectos',
      'Enviar propuestas',
    ],
    healthcare: [
      'Agendar turnos médicos',
      'Informar coberturas',
      'Recordatorios de consultas',
      'Consultar resultados',
    ],
    education: [
      'Informar cursos disponibles',
      'Agendar clases de prueba',
      'Consultar aranceles',
      'Inscripciones',
    ],
    other: [
      'Información general',
      'Atención al cliente',
      'Consultas frecuentes',
    ],
  };
  return map[type] || map.other;
}

/**
 * Wizard completo de configuración empresarial
 * 
 * PRE-REQUISITOS (ejecutar primero):
 *   openclaw onboard
 * 
 * USO:
 *   openclaw enterprise setup
 */
export async function runEnterpriseWizard(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.intro("🏪 Agento Empresarial");

  // Verificar pre-requisitos
  const hasTelegram = config.channels?.telegram?.enabled || config.channels?.telegram?.botToken;
  const hasWhatsApp = config.channels?.whatsapp?.enabled;
  
  if (!hasTelegram && !hasWhatsApp) {
    await prompter.note(
      [
        "⚠️  No se detectaron canales configurados.",
        "",
        "Este wizard es COMPLEMENTARIO. Primero debes ejecutar:",
        "",
        "  agento onboard",
        "",
        "Esto configurará:",
        "  • Modelo LLM (Claude/OpenAI)",
        "  • Token de Telegram (@BotFather)",
        "  • WhatsApp principal (escanear QR)",
        "",
        "Luego vuelve a ejecutar:",
        "  agento enterprise setup",
      ].join("\n"),
      "Pre-requisitos faltantes"
    );
    return config;
  }

  // ===== PASO 1: INFORMACIÓN DEL NEGOCIO =====
  await prompter.note(
    [
      "Configuración del negocio",
      "",
      "Esta información se usará para personalizar",
      "las respuestas del asistente.",
    ].join("\n"),
    "Paso 1 de 4"
  );

  const businessName = await prompter.text({
    message: "Nombre del negocio",
    placeholder: "Mi Empresa S.A.",
    validate: (val) => val.trim().length < 2 ? "Nombre muy corto" : undefined,
  });

  const businessType = await prompter.select<EnterprisePersonality['businessType']>({
    message: "Tipo de negocio",
    options: [
      { value: 'retail', label: 'Retail / Tienda', hint: 'Venta de productos' },
      { value: 'services', label: 'Servicios', hint: 'Servicios profesionales' },
      { value: 'consulting', label: 'Consultoría', hint: 'Asesoramiento' },
      { value: 'healthcare', label: 'Salud', hint: 'Médico/dental/etc' },
      { value: 'education', label: 'Educación', hint: 'Cursos/tutoriales' },
      { value: 'other', label: 'Otro', hint: 'Otro tipo de negocio' },
    ],
  });

  const businessDescription = await prompter.text({
    message: "¿Qué hace tu negocio? (breve descripción)",
    placeholder: "Vendemos productos tecnológicos al por mayor",
    validate: (val) => val.trim().length < 10 ? "Descripción muy corta" : undefined,
  });

  // ===== PASO 2: PERSONALIDAD VENTAS =====
  await prompter.note(
    [
      "Personalidad para VENTAS",
      "",
      "Esta personalidad atiende a clientes por WhatsApp.",
      "Tiene acceso limitado y escala al admin cuando es necesario.",
    ].join("\n"),
    "Paso 2 de 4"
  );

  const salesName = await prompter.text({
    message: "Nombre del asistente de ventas",
    placeholder: "Vendedor",
    initialValue: "Vendedor",
  });

  const salesTone = await prompter.select<EnterprisePersonality['sales']['tone']>({
    message: "Tono de comunicación",
    options: [
      { value: 'professional', label: 'Profesional', hint: 'Formal y corporativo' },
      { value: 'friendly', label: 'Amigable', hint: 'Cálido pero profesional' },
      { value: 'casual', label: 'Casual', hint: 'Relajado e informal' },
      { value: 'luxury', label: 'Lujo', hint: 'Exclusivo y sofisticado' },
    ],
    initialValue: 'friendly',
  });

  const defaultExpertise = getDefaultExpertise(businessType);
  const customizeExpertise = await prompter.confirm({
    message: "¿Personalizar áreas de expertise?",
    initialValue: false,
  });

  let salesExpertise = defaultExpertise;
  if (customizeExpertise) {
    const selected = await prompter.multiselect<string>({
      message: "Selecciona áreas de expertise",
      options: defaultExpertise.map(e => ({ value: e, label: e })),
      initialValues: defaultExpertise,
    });
    salesExpertise = selected;
  }

  // ===== PASO 3: PERSONALIDAD ADMIN =====
  await prompter.note(
    [
      "Personalidad para ADMIN",
      "",
      "Esta personalidad es para TI (por Telegram).",
      "Tiene acceso completo y recibe alertas de seguridad.",
    ].join("\n"),
    "Paso 3 de 4"
  );

  const adminName = await prompter.text({
    message: "Nombre del asistente admin",
    placeholder: "Admin",
    initialValue: "Admin",
  });

  // ===== PASO 4: CUENTAS WHATSAPP =====
  await prompter.note(
    [
      "Cuentas de WhatsApp",
      "",
      "Puedes configurar múltiples cuentas:",
      "  • VENTAS - Atención al público",
      "  • COMPRAS - Proveedores",
      "  • SOPORTE - Post-venta",
    ].join("\n"),
    "Paso 4 de 4"
  );

  const whatsappAccounts: Array<{
    id: string;
    phoneNumber: string;
    role: 'public' | 'purchasing' | 'support';
    purpose: string;
  }> = [];

  // VENTAS (obligatoria)
  const ventasPhone = await prompter.text({
    message: "Número WhatsApp VENTAS (con +)",
    placeholder: "+5491112345678",
    validate: (val) => {
      if (!val.startsWith('+')) return "Incluir código de país (+54)";
      if (val.length < 10) return "Número muy corto";
      return undefined;
    },
  });

  whatsappAccounts.push({
    id: 'ventas',
    phoneNumber: ventasPhone.trim(),
    role: 'public',
    purpose: 'Atención al público',
  });

  // Preguntar cuentas adicionales
  let adding = true;
  while (adding) {
    const addMore = await prompter.confirm({
      message: "¿Agregar otra cuenta de WhatsApp?",
      initialValue: false,
    });
    
    if (!addMore) break;

    const type = await prompter.select({
      message: "Tipo de cuenta",
      options: [
        { value: 'compras', label: 'COMPRAS', hint: 'Gestión de proveedores' },
        { value: 'soporte', label: 'SOPORTE', hint: 'Atención post-venta' },
      ],
    });

    const phone = await prompter.text({
      message: `Número WhatsApp ${type.toUpperCase()}`,
      placeholder: "+5491187654321",
      validate: (val) => !val.startsWith('+') ? "Incluir código de país" : undefined,
    });

    whatsappAccounts.push({
      id: type,
      phoneNumber: phone.trim(),
      role: type === 'compras' ? 'purchasing' : 'support',
      purpose: type === 'compras' ? 'Gestión de proveedores' : 'Soporte técnico',
    });
  }

  // ===== RESUMEN =====
  await prompter.note(
    [
      "Resumen de configuración:",
      "",
      `🏢 ${businessName.trim()}`,
      `📋 ${businessType}`,
      "",
      `👤 VENTAS: ${salesName.trim()} (${salesTone})`,
      `   ${salesExpertise.length} áreas de expertise`,
      "",
      `👔 ADMIN: ${adminName.trim()}`,
      "",
      "📱 WhatsApp:",
      ...whatsappAccounts.map(a => `   • ${a.id.toUpperCase()}: ${a.phoneNumber}`),
    ].join("\n"),
    "Confirmar"
  );

  const confirm = await prompter.confirm({
    message: "¿Todo correcto? ¿Aplicar configuración?",
    initialValue: true,
  });

  if (!confirm) {
    await prompter.outro("Configuración cancelada.");
    return config;
  }

  // ===== APLICAR CONFIGURACIÓN =====
  const personality: EnterprisePersonality = {
    businessName: businessName.trim(),
    businessType,
    businessDescription: businessDescription.trim(),
    sales: {
      name: salesName.trim(),
      tone: salesTone,
      expertise: salesExpertise,
    },
    admin: {
      name: adminName.trim(),
    },
  };

  const newConfig: OpenClawConfig = {
    ...config,
    channels: {
      ...config.channels,
      whatsapp: {
        ...config.channels?.whatsapp,
        enabled: true,
        accounts: whatsappAccounts.reduce((acc, account) => {
          acc[account.id] = {
            phoneNumber: account.phoneNumber,
            role: account.role,
            purpose: account.purpose,
          };
          return acc;
        }, {} as Record<string, unknown>),
      },
    },
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

  await prompter.outro(
    [
      "✅ Configuración empresarial completada",
      "",
      "📝 PRÓXIMOS PASOS:",
      "",
      ...(whatsappAccounts.length > 1 ? [
        "1. ESCANEAR QR DE CUENTAS ADICIONALES:",
        ...whatsappAccounts.slice(1).map(a => `   agento channels login whatsapp --account ${a.id}`),
        "",
      ] : []),
      "2. INICIAR GATEWAY:",
      "   agento gateway --port 18789",
      "",
      "3. PANEL ADMIN:",
      "   http://localhost:18789/admin",
    ].join("\n")
  );

  return newConfig;
}

// Alias para compatibilidad
export const setupEnterpriseApis = runEnterpriseWizard;

/**
 * Comando para reconfigurar personalidades
 */
export async function reconfigurePersonalities(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.intro("🔄 Reconfigurar Personalidades");
  return runEnterpriseWizard(config, prompter);
}

/**
 * Muestra la configuración actual
 */
export async function showEnterpriseConfig(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<void> {
  const personality = config.enterprise?.personality;
  
  if (!personality) {
    await prompter.note(
      "No hay configuración empresarial. Ejecuta 'agento enterprise setup'.",
      "Sin Configuración"
    );
    return;
  }

  await prompter.note(
    [
      `🏢 ${personality.businessName}`,
      `📋 ${personality.businessType}`,
      "",
      `👤 VENTAS: ${personality.sales.name}`,
      `   Tono: ${personality.sales.tone}`,
      `   Expertise: ${personality.sales.expertise.length} áreas`,
      "",
      `👔 ADMIN: ${personality.admin.name}`,
    ].join("\n"),
    "Configuración Actual"
  );
}

/**
 * Agrega una nueva API empresarial
 */
export async function addEnterpriseApi(
  config: OpenClawConfig,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  const apiId = await prompter.text({
    message: "ID unico de la API",
    placeholder: "mi_api",
    validate: (val) => val.trim().length < 2 ? "ID muy corto" : undefined,
  });

  const endpoint = await prompter.text({
    message: "Endpoint de la API",
    placeholder: "/v1/endpoint",
  });

  const method = await prompter.select({
    message: "Metodo HTTP",
    options: [
      { value: "GET", label: "GET" },
      { value: "POST", label: "POST" },
      { value: "PUT", label: "PUT" },
      { value: "DELETE", label: "DELETE" },
    ],
  });

  const existingApis = config.enterprise?.apis || {};
  
  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      apis: {
        ...existingApis,
        [apiId.trim()]: {
          endpoint: endpoint.trim(),
          method,
          auth: "none",
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
  if (!config.enterprise?.apis?.[apiId]) {
    return config;
  }

  const { [apiId]: _, ...remainingApis } = config.enterprise.apis;

  return {
    ...config,
    enterprise: {
      ...config.enterprise,
      apis: remainingApis,
    },
  };
}
