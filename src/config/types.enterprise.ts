/**
 * OpenClaw Empresarial - Tipos de Configuración
 * 
 * Sistema de dual-personality para negocios:
 * - Personalidad VENTAS: Canales públicos (WhatsApp, Discord)
 * - Personalidad ADMIN: Canal privado (Telegram)
 */

/**
 * Configuración de personalidad para el asistente
 */
export interface EnterprisePersonality {
  /** Nombre del negocio */
  businessName: string;
  /** Tipo de negocio */
  businessType: 'retail' | 'services' | 'consulting' | 'healthcare' | 'education' | 'other';
  /** Descripción de lo que hace el negocio */
  businessDescription: string;
  /** Personalidad para VENTAS (canales públicos) */
  sales: {
    name: string;
    tone: 'professional' | 'friendly' | 'casual' | 'luxury';
    expertise: string[];
    restrictions: string[];
    customInstructions?: string;
  };
  /** Personalidad para ADMIN (Telegram) */
  admin: {
    name: string;
    capabilities: string[];
    escalationTriggers: string[];
    customInstructions?: string;
  };
}

/**
 * Configuración de una API empresarial individual
 */
export interface EnterpriseApiConfig {
  /** Endpoint HTTP de la API */
  endpoint: string;
  /** Método HTTP (GET, POST, etc.) */
  method?: string;
  /** Tipo de autenticación */
  auth?: "bearer_token" | "api_key" | "basic" | "none";
  /** Headers adicionales */
  headers?: Record<string, string>;
}

/**
 * Configuración del modo empresarial
 */
export interface EnterpriseConfig {
  /** URL base para todas las APIs (opcional) */
  apiBaseUrl?: string;
  /** APIs empresariales configuradas */
  apis?: Record<string, EnterpriseApiConfig>;
  /** 
   * Configuración de personalidad dual
   * Define comportamiento para ventas (público) vs admin (privado)
   */
  personality?: EnterprisePersonality;
  /** System prompt generado para el asistente de ventas */
  salesSystemPrompt?: string;
  /** System prompt generado para el asistente admin */
  adminSystemPrompt?: string;
  /** Features activadas */
  features?: {
    /** Habilitar dual personality (ventas vs admin) */
    dualPersonality?: boolean;
    /** Habilitar sistema de escalada automática */
    escalationEnabled?: boolean;
    /** Habilitar alertas de seguridad */
    securityAlerts?: boolean;
    /** Habilitar alertas de stock crítico */
    stockAlerts?: boolean;
    /** Habilitar reordenamiento automático */
    autoReorder?: boolean;
  };
  /** 
   * Configuración de escalada
   * Define cómo el agente de ventas contacta al admin
   */
  escalation?: {
    /** Session key del admin (generalmente Telegram) */
    adminSessionKey?: string;
    /** Timeout para esperar respuesta del admin (segundos) */
    timeoutSeconds?: number;
    /** Mensaje automático al cliente mientras espera */
    waitingMessage?: string;
  };
  /**
   * Configuración de seguridad
   */
  security?: {
    /** Palabras clave que activan alerta de seguridad */
    alertKeywords?: string[];
    /** Intentos de social engineering detectados */
    detectedAttempts?: Array<{
      timestamp: string;
      channel: string;
      userId: string;
      attempt: string;
      blocked: boolean;
    }>;
  };
  /**
   * Configuración de gestión de stock y compras
   */
  stockManagement?: {
    /** Umbral de stock crítico (ej: 10 unidades) */
    criticalThreshold?: number;
    /** Canal para enviar alertas (ej: "whatsapp:compras") */
    alertChannel?: string;
    /** Intervalo de verificación (ej: "1h", "30m") */
    checkInterval?: string;
    /** Proveedores configurados */
    suppliers?: Record<string, {
      /** Teléfono del proveedor */
      phone: string;
      /** Productos que suministra */
      products: string[];
      /** Cuenta de WhatsApp para contactar */
      whatsappAccount?: string;
      /** Contacto preferido (nombre) */
      contactName?: string;
      /** Email del proveedor (opcional) */
      email?: string;
    }>;
  };
}

/**
 * Estado de una escalada
 */
export interface EscalationState {
  /** ID único de la escalada */
  id: string;
  /** Session key del cliente */
  clientSessionKey: string;
  /** Session key del admin */
  adminSessionKey: string;
  /** Timestamp de inicio */
  startedAt: string;
  /** Estado actual */
  status: 'pending' | 'in_progress' | 'resolved' | 'timeout';
  /** Contexto del cliente */
  context: {
    channel: string;
    userId: string;
    userName?: string;
    lastMessages: string[];
    issue: string;
  };
  /** Respuesta del admin */
  adminResponse?: string;
  /** Timestamp de resolución */
  resolvedAt?: string;
}

/**
 * Alerta de seguridad
 */
export interface SecurityAlert {
  /** ID único de la alerta */
  id: string;
  /** Timestamp */
  timestamp: string;
  /** Tipo de alerta */
  type: 'social_engineering' | 'credential_request' | 'system_command' | 'unauthorized_access' | 'other';
  /** Canal donde ocurrió */
  channel: string;
  /** ID del usuario */
  userId: string;
  /** Nombre del usuario si está disponible */
  userName?: string;
  /** Mensaje sospechoso */
  suspiciousMessage: string;
  /** Acción tomada */
  action: 'blocked' | 'flagged' | 'escalated';
  /** Si fue resuelta */
  resolved: boolean;
  /** Notas del admin */
  adminNotes?: string;
}
