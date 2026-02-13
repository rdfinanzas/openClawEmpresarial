/**
 * Dashboard del panel de administración.
 *
 * Etapa 19: Dashboard Principal - Backend
 *
 * Endpoints:
 * - GET /admin/api/dashboard/metrics -> Métricas del sistema
 * - GET /admin/api/dashboard/health  -> Estado de salud
 * - GET /admin/api/channels          -> Lista de canales
 * - GET /admin/api/channels/health   -> Estado de canales
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { sendAdminError, sendAdminSuccess } from "./routes.js";
import {
  requireAdminAuth,
  getAuthContext,
  securityMiddleware,
  sendAuthError,
  sendAuthSuccess,
} from "./middleware.js";
import { collectDashboardMetrics, invalidateMetricsCache } from "./metrics.js";
import type { DashboardMetrics, GatewayHealthStatus, ChannelHealth } from "./types.js";

/**
 * Maneja requests al dashboard API.
 * Retorna true si el request fue manejado.
 */
export async function handleDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiPath: string,
  trustedProxies: string[]
): Promise<boolean> {
  // Aplicar middleware de seguridad (requiere HTTPS en producción)
  const requireHttps = process.env.NODE_ENV === "production";
  if (!securityMiddleware(req, res, trustedProxies, { requireHttps })) {
    return true;
  }

  // Health check no requiere auth
  if (apiPath === "/api/dashboard/health" && req.method === "GET") {
    return handleHealthCheck(req, res);
  }

  // El resto requiere autenticación
  const authResult = await requireAdminAuth(req, res, {
    trustedProxies,
    requireAuth: true,
    rateLimit: "standard",
  });

  if (!authResult.ok) {
    return true;
  }

  // Rutas protegidas
  switch (apiPath) {
    case "/api/dashboard/metrics":
      if (req.method === "GET") {
        return handleGetMetrics(req, res);
      }
      break;

    case "/api/dashboard/metrics/refresh":
      if (req.method === "POST") {
        return handleRefreshMetrics(req, res);
      }
      break;

    case "/api/channels":
      if (req.method === "GET") {
        return handleGetChannels(req, res);
      }
      break;

    case "/api/channels/health":
      if (req.method === "GET") {
        return handleGetChannelHealth(req, res);
      }
      break;
  }

  return false;
}

/**
 * GET /admin/api/dashboard/health
 *
 * Health check público (no requiere auth).
 * Útil para monitoreo externo.
 */
async function handleHealthCheck(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  try {
    const health: GatewayHealthStatus = {
      status: "healthy",
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        percentage: Math.round(
          (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        ),
      },
      cpu: {
        usage: process.cpuUsage(),
        percentage: 0, // TODO: Implementar cálculo real
      },
      websocket: {
        connected: true,
        clients: 0, // TODO: Obtener de runtime
      },
      timestamp: new Date().toISOString(),
    };

    // Determinar status basado en métricas
    if (health.memory.percentage > 90) {
      health.status = "degraded";
    }

    const statusCode = health.status === "healthy" ? 200 : 503;
    sendAuthSuccess(res, health, statusCode);
    return true;
  } catch (error) {
    sendAuthError(res, 500, "Failed to collect health metrics");
    return true;
  }
}

/**
 * GET /admin/api/dashboard/metrics
 *
 * Retorna métricas completas del dashboard.
 */
async function handleGetMetrics(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  try {
    const metrics = await collectDashboardMetrics();
    sendAuthSuccess(res, metrics);
    return true;
  } catch (error) {
    sendAuthError(res, 500, "Failed to collect metrics");
    return true;
  }
}

/**
 * POST /admin/api/dashboard/metrics/refresh
 *
 * Invalida cache y recolecta métricas frescas.
 */
async function handleRefreshMetrics(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  try {
    invalidateMetricsCache();
    const metrics = await collectDashboardMetrics();
    sendAuthSuccess(res, { ...metrics, refreshed: true });
    return true;
  } catch (error) {
    sendAuthError(res, 500, "Failed to refresh metrics");
    return true;
  }
}

/**
 * GET /admin/api/channels
 *
 * Lista los canales configurados.
 */
async function handleGetChannels(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // TODO: Obtener de configuración real
  const channels = [
    { id: "telegram", name: "Telegram", enabled: true },
    { id: "whatsapp", name: "WhatsApp", enabled: true },
    { id: "slack", name: "Slack", enabled: true },
    { id: "discord", name: "Discord", enabled: true },
    { id: "signal", name: "Signal", enabled: true },
    { id: "imessage", name: "iMessage", enabled: false },
  ];

  sendAuthSuccess(res, { channels });
  return true;
}

/**
 * GET /admin/api/channels/health
 *
 * Estado de salud de los canales.
 */
async function handleGetChannelHealth(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  try {
    const metrics = await collectDashboardMetrics();
    sendAuthSuccess(res, { channels: metrics.channels });
    return true;
  } catch (error) {
    sendAuthError(res, 500, "Failed to collect channel health");
    return true;
  }
}

// Exportar métricas para uso en otros módulos
export { collectDashboardMetrics, invalidateMetricsCache };
