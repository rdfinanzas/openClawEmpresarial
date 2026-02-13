/**
 * Definición de rutas para el panel de administración unificado.
 *
 * Todas las rutas UI (excepto login) requieren autenticación.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AdminApiResponse } from "./types.js";

// Prefijo base para todas las rutas del admin
export const ADMIN_BASE_PATH = "/admin";

// Rutas de la API
export const ADMIN_API_ROUTES = {
  // Auth
  LOGIN: "/api/auth/login",
  VERIFY: "/api/auth/verify",
  LOGOUT: "/api/auth/logout",
  SESSION: "/api/auth/session",

  // Dashboard
  METRICS: "/api/dashboard/metrics",
  HEALTH: "/api/dashboard/health",
  REFRESH_METRICS: "/api/dashboard/metrics/refresh",

  // Chat
  CHAT_HISTORY: "/api/chat/history",
  CHAT_SEND: "/api/chat/send",
  CHAT_ABORT: "/api/chat/abort",

  // Channels
  CHANNELS: "/api/channels",
  CHANNEL_HEALTH: "/api/channels/health",
  CHANNEL_CONFIG: "/api/channels/config",
  WHATSAPP_QR: "/api/channels/whatsapp/qr",
  WHATSAPP_STATUS: "/api/channels/whatsapp/status",

  // Config
  CONFIG_GET: "/api/config",
  CONFIG_UPDATE: "/api/config",
  CONFIG_SCHEMA: "/api/config/schema",
  CONFIG_VALIDATE: "/api/config/validate",

  // Agents
  AGENTS: "/api/agents",
  AGENT_DETAIL: "/api/agents/detail",
  AGENT_UPDATE: "/api/agents/update",
  AGENT_TOOLS: "/api/agents/tools",

  // Skills
  SKILLS: "/api/skills",
  SKILL_UPDATE: "/api/skills/update",
} as const;

// Rutas de páginas (UI) - TODAS requieren auth excepto LOGIN
export const ADMIN_UI_ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  CHAT: "/chat",
  CHANNELS: "/channels",
  CONFIG: "/config",
  AGENTS: "/agents",
  SKILLS: "/skills",
  MONITORING: "/monitoring",
} as const;

// Rutas que NO requieren autenticación
export const PUBLIC_UI_ROUTES: string[] = [ADMIN_UI_ROUTES.LOGIN];

// Verificar si una ruta UI requiere auth
export function requiresAuth(pathname: string): boolean {
  // Normalizar path
  const cleanPath = pathname.replace(ADMIN_BASE_PATH, "") || "/";

  // Login y assets públicos no requieren auth
  if (cleanPath === ADMIN_UI_ROUTES.LOGIN) return false;
  if (cleanPath.startsWith("/assets/")) return false;
  if (cleanPath.startsWith("/static/")) return false;

  // Todo lo demás requiere auth
  return true;
}

/**
 * Verifica si una URL corresponde a una ruta del panel admin
 */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_BASE_PATH || pathname.startsWith(`${ADMIN_BASE_PATH}/`);
}

/**
 * Verifica si una URL es una ruta de API del admin
 */
export function isAdminApiPath(pathname: string): boolean {
  return pathname.startsWith(`${ADMIN_BASE_PATH}/api/`);
}

/**
 * Obtiene la ruta de redirección post-login
 */
export function getDefaultRedirectPath(): string {
  return `${ADMIN_BASE_PATH}${ADMIN_UI_ROUTES.DASHBOARD}`;
}

/**
 * Envía una respuesta JSON estandarizada
 */
export function sendAdminJson<T>(
  res: ServerResponse,
  status: number,
  response: AdminApiResponse<T>,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(response));
}

/**
 * Envía una respuesta de error
 */
export function sendAdminError(res: ServerResponse, status: number, error: string): void {
  sendAdminJson(res, status, { ok: false, error });
}

/**
 * Envía una respuesta exitosa
 */
export function sendAdminSuccess<T>(res: ServerResponse, data: T, status = 200): void {
  sendAdminJson(res, status, { ok: true, data });
}

/**
 * Extrae el body JSON de una request
 */
export async function readAdminJsonBody<T>(
  req: IncomingMessage,
  maxBytes = 1024 * 1024, // 1MB default
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let body = "";
    let receivedBytes = 0;

    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        resolve({ ok: false, error: "payload too large" });
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body) as T;
        resolve({ ok: true, data });
      } catch {
        resolve({ ok: false, error: "invalid json" });
      }
    });

    req.on("error", () => {
      resolve({ ok: false, error: "read error" });
    });
  });
}
