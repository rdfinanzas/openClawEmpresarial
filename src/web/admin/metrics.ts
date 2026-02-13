/**
 * Recolección de métricas para el panel de administración.
 *
 * Etapa 19: Dashboard Principal - Backend (métricas)
 *
 * Proporciona métricas de:
 * - Mensajes procesados
 * - Usuarios activos
 * - Canales conectados
 * - Uso de tokens/costos
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { DashboardMetrics, ChannelHealth } from "./types.js";
import { logWarn } from "../../logger.js";

const logger = (msg: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`admin-metrics: ${msg}${metaStr}`);
};

// Directorios de datos
const SESSIONS_DIR = join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".openclaw",
  "sessions"
);

// Cache de métricas
let metricsCache: DashboardMetrics | null = null;
let lastMetricsUpdate = 0;
const METRICS_CACHE_TTL_MS = 30000; // 30 segundos

/**
 * Obtiene métricas del dashboard.
 *
 * Nota: Algunas métricas son aproximaciones basadas en datos disponibles.
 * En una implementación completa, se usaría una base de datos o metrics server.
 */
export async function collectDashboardMetrics(): Promise<DashboardMetrics> {
  const now = Date.now();

  // Usar cache si es válido
  if (metricsCache && now - lastMetricsUpdate < METRICS_CACHE_TTL_MS) {
    return metricsCache;
  }

  try {
    const [messages, users, channels, tokens] = await Promise.all([
      collectMessageMetrics(),
      collectUserMetrics(),
      collectChannelMetrics(),
      collectTokenMetrics(),
    ]);

    metricsCache = {
      messages,
      users,
      tokens,
      channels,
    };

    lastMetricsUpdate = now;
    return metricsCache;
  } catch (error) {
    logger("Error collecting metrics", { error: String(error) });

    // Retornar métricas vacías en caso de error
    return {
      messages: { total: 0, perChannel: {}, lastHour: 0, last24Hours: 0 },
      users: { total: 0, active: 0, perChannel: {} },
      tokens: { consumed: 0, estimatedCost: 0 },
      channels: [],
    };
  }
}

/**
 * Colecciona métricas de mensajes
 */
async function collectMessageMetrics(): Promise<DashboardMetrics["messages"]> {
  const perChannel: Record<string, number> = {};
  let total = 0;
  let lastHour = 0;
  let last24Hours = 0;

  try {
    if (existsSync(SESSIONS_DIR)) {
      const sessionFiles = await readdir(SESSIONS_DIR);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const file of sessionFiles) {
        if (!file.endsWith(".jsonl")) continue;

        try {
          const content = await readFile(join(SESSIONS_DIR, file), "utf-8");
          const lines = content.split("\n").filter(Boolean);

          // Inferir canal desde nombre de archivo o contenido
          const channelId = inferChannelFromFilename(file);

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.role === "user") {
                total++;
                perChannel[channelId] = (perChannel[channelId] || 0) + 1;

                const timestamp = entry.timestamp || entry.ts;
                if (timestamp) {
                  const ts =
                    typeof timestamp === "string"
                      ? new Date(timestamp).getTime()
                      : timestamp;
                  if (ts > oneHourAgo) lastHour++;
                  if (ts > oneDayAgo) last24Hours++;
                }
              }
            } catch {
              // Ignorar líneas inválidas
            }
          }
        } catch {
          // Ignorar archivos que no se pueden leer
        }
      }
    }
  } catch {
    // Directorio no existe o no es accesible
  }

  return { total, perChannel, lastHour, last24Hours };
}

/**
 * Colecciona métricas de usuarios
 */
async function collectUserMetrics(): Promise<DashboardMetrics["users"]> {
  const perChannel: Record<string, number> = {};
  const uniqueUsers = new Set<string>();
  const activeUsers = new Set<string>(); // Actividad en últimas 24h

  try {
    if (existsSync(SESSIONS_DIR)) {
      const sessionFiles = await readdir(SESSIONS_DIR);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const file of sessionFiles) {
        if (!file.endsWith(".jsonl")) continue;

        try {
          const channelId = inferChannelFromFilename(file);
          const content = await readFile(join(SESSIONS_DIR, file), "utf-8");
          const lines = content.split("\n").filter(Boolean);

          // Contar usuarios únicos por archivo de sesión
          const sessionUsers = new Set<string>();

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.senderId || entry.from) {
                const userId = String(entry.senderId || entry.from);
                sessionUsers.add(userId);
                uniqueUsers.add(userId);

                const timestamp = entry.timestamp || entry.ts;
                if (timestamp) {
                  const ts =
                    typeof timestamp === "string"
                      ? new Date(timestamp).getTime()
                      : timestamp;
                  if (ts > oneDayAgo) {
                    activeUsers.add(userId);
                  }
                }
              }
            } catch {
              // Ignorar
            }
          }

          perChannel[channelId] = (perChannel[channelId] || 0) + sessionUsers.size;
        } catch {
          // Ignorar
        }
      }
    }
  } catch {
    // Ignorar errores
  }

  return {
    total: uniqueUsers.size,
    active: activeUsers.size,
    perChannel,
  };
}

/**
 * Colecciona métricas de canales
 *
 * Nota: Esta es una implementación básica. En producción, se debería
 * obtener el estado real de los canales desde el gateway.
 */
async function collectChannelMetrics(): Promise<ChannelHealth[]> {
  const channels: ChannelHealth[] = [
    { id: "telegram", name: "Telegram", status: "connected" },
    { id: "whatsapp", name: "WhatsApp", status: "connected" },
    { id: "slack", name: "Slack", status: "connected" },
    { id: "discord", name: "Discord", status: "connected" },
    { id: "signal", name: "Signal", status: "connected" },
  ];

  // TODO: Implementar verificación real de salud de canales
  // Esto requeriría acceso al estado del gateway

  return channels;
}

/**
 * Colecciona métricas de tokens/costos
 *
 * Nota: Implementación básica. En producción, se debería integrar
 * con el sistema de tracking de uso de la API.
 */
async function collectTokenMetrics(): Promise<DashboardMetrics["tokens"]> {
  let consumed = 0;

  try {
    if (existsSync(SESSIONS_DIR)) {
      const sessionFiles = await readdir(SESSIONS_DIR);

      for (const file of sessionFiles) {
        if (!file.endsWith(".jsonl")) continue;

        try {
          const content = await readFile(join(SESSIONS_DIR, file), "utf-8");
          const lines = content.split("\n").filter(Boolean);

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              // Intentar extraer tokens de metadata
              if (entry.usage?.total_tokens) {
                consumed += entry.usage.total_tokens;
              } else if (entry.tokens) {
                consumed += entry.tokens;
              }
            } catch {
              // Ignorar
            }
          }
        } catch {
          // Ignorar
        }
      }
    }
  } catch {
    // Ignorar
  }

  // Estimación de costo (precios aproximados)
  // Asumiendo ~$0.002 por 1K tokens (GPT-4 promedio)
  const estimatedCost = (consumed / 1000) * 0.002;

  return { consumed, estimatedCost };
}

/**
 * Infiere el canal desde el nombre del archivo de sesión
 */
function inferChannelFromFilename(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.includes("telegram")) return "telegram";
  if (lower.includes("whatsapp")) return "whatsapp";
  if (lower.includes("slack")) return "slack";
  if (lower.includes("discord")) return "discord";
  if (lower.includes("signal")) return "signal";
  if (lower.includes("imessage")) return "imessage";

  return "unknown";
}

/**
 * Invalida el cache de métricas
 */
export function invalidateMetricsCache(): void {
  metricsCache = null;
  lastMetricsUpdate = 0;
}
