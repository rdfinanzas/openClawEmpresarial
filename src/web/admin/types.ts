/**
 * Tipos compartidos para el panel de administración.
 *
 * El panel admin proporciona una interfaz web para configurar y monitorear
 * el bot de OpenClaw, con autenticación dual (password + Telegram).
 */

/**
 * Respuesta estándar de la API del panel admin
 */
export interface AdminApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Estado de salud del gateway
 */
export interface GatewayHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: { user: number; system: number };
    percentage: number;
  };
  websocket: {
    connected: boolean;
    clients: number;
  };
  timestamp: string;
}

/**
 * Estado de salud de un canal
 */
export interface ChannelHealth {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  latency?: number;
  lastError?: string;
  lastConnectedAt?: string;
}

/**
 * Métricas del dashboard
 */
export interface DashboardMetrics {
  messages: {
    total: number;
    perChannel: Record<string, number>;
    lastHour: number;
    last24Hours: number;
  };
  users: {
    total: number;
    active: number;
    perChannel: Record<string, number>;
  };
  tokens: {
    consumed: number;
    estimatedCost: number;
  };
  channels: ChannelHealth[];
}

/**
 * Información de sesión de admin
 */
export interface AdminSession {
  token: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  userAgent?: string;
}

/**
 * Payload de login
 */
export interface AdminLoginPayload {
  username: string;
  password: string;
}

/**
 * Payload de verificación 2FA
 */
export interface AdminVerifyPayload {
  tempToken: string;
  code: string;
}

/**
 * Configuración del panel admin
 */
export interface AdminPanelConfig {
  enabled: boolean;
  basePath: string;
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  rateLimit: {
    maxAttempts: number;
    windowMinutes: number;
  };
}

/**
 * Payload para enviar mensaje al agente
 */
export interface AdminChatSendPayload {
  message: string;
  conversationId?: string;
}

/**
 * Respuesta del envío de mensaje al agente
 */
export interface AdminChatSendResponse {
  response: string;
  conversationId: string;
}

/**
 * Payload para actualizar configuración
 */
export interface AdminConfigUpdatePayload {
  config: Record<string, unknown>;
}
