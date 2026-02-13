/**
 * Sistema de Alertas vía Telegram para el Administrador
 *
 * Etapa 23: Sistema de Alertas vía Telegram
 *
 * Envía notificaciones al superadmin cuando:
 * - Canales se desconectan
 * - Hay errores críticos
 * - Uso de recursos es alto
 * - Fallan operaciones importantes
 */

import type { Bot } from "grammy";
import { getChildLogger } from "../logging.js";
import { loadConfig } from "../config/config.js";
import type { ChannelHealth } from "../web/admin/types.js";

const logger = getChildLogger({ module: "admin-alerts" });

/**
 * Niveles de alerta
 */
export type AlertLevel = "info" | "warning" | "critical";

/**
 * Configuración del sistema de alertas
 */
export interface AlertConfig {
  /** Intervalo de monitoreo en ms (default: 60 segundos) */
  checkIntervalMs: number;
  /** Cooldown entre alertas del mismo tipo en ms (default: 5 minutos) */
  cooldownMs: number;
  /** Umbral de latencia para warning en ms (default: 5000) */
  latencyWarningThresholdMs: number;
  /** Umbral de latencia para critical en ms (default: 10000) */
  latencyCriticalThresholdMs: number;
  /** Habilitar/deshabilitar alertas */
  enabled: boolean;
}

/**
 * Estado de una alerta para tracking de cooldown
 */
interface AlertState {
  lastSentAt: number;
  count: number;
}

/**
 * Sistema de alertas para el administrador vía Telegram
 */
export class AdminAlertSystem {
  private bot: Bot | null = null;
  private config: AlertConfig;
  private alertStates = new Map<string, AlertState>();
  private checkInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 60 * 1000,
      cooldownMs: config.cooldownMs ?? 5 * 60 * 1000,
      latencyWarningThresholdMs: config.latencyWarningThresholdMs ?? 5000,
      latencyCriticalThresholdMs: config.latencyCriticalThresholdMs ?? 10000,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Inicializa el sistema de alertas con el bot de Telegram
   */
  initialize(bot: Bot): void {
    this.bot = bot;
    logger.info("Admin alert system initialized");
  }

  /**
   * Inicia el monitoreo periódico
   */
  start(): void {
    if (this.isRunning || !this.config.enabled) {
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkIntervalMs);

    logger.info("Admin alert monitoring started", {
      intervalMs: this.config.checkIntervalMs,
    });
  }

  /**
   * Detiene el monitoreo
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info("Admin alert monitoring stopped");
  }

  /**
   * Verifica si el sistema está corriendo
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Realiza una verificación de salud y envía alertas si es necesario
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      // Verificar canales
      await this.checkChannelsHealth();

      // Verificar recursos del sistema
      await this.checkSystemResources();
    } catch (error) {
      logger.error("Error during health check", { error: String(error) });
    }
  }

  /**
   * Verifica la salud de los canales
   */
  private async checkChannelsHealth(): Promise<void> {
    // Aquí se integraría con el sistema real de monitoreo de canales
    // Por ahora es un mock para demostrar la funcionalidad
    const mockChannels: ChannelHealth[] = [
      { id: "telegram", name: "Telegram", status: "connected" },
      { id: "whatsapp", name: "WhatsApp", status: "connected" },
    ];

    for (const channel of mockChannels) {
      if (channel.status === "disconnected") {
        await this.sendAlert(
          "critical",
          `📡 Canal Desconectado`,
          `El canal ${channel.name} se ha desconectado.`
        );
      } else if (channel.status === "error") {
        await this.sendAlert(
          "warning",
          `⚠️ Error en Canal`,
          `El canal ${channel.name} tiene errores.` +
            (channel.lastError ? `\nError: ${channel.lastError}` : "")
        );
      }

      // Verificar latencia
      if (channel.latency) {
        if (channel.latency > this.config.latencyCriticalThresholdMs) {
          await this.sendAlert(
            "critical",
            `🐌 Latencia Crítica`,
            `El canal ${channel.name} tiene una latencia de ${channel.latency}ms`
          );
        } else if (channel.latency > this.config.latencyWarningThresholdMs) {
          await this.sendAlert(
            "warning",
            `⚡ Latencia Alta`,
            `El canal ${channel.name} tiene una latencia de ${channel.latency}ms`
          );
        }
      }
    }
  }

  /**
   * Verifica los recursos del sistema
   */
  private async checkSystemResources(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    if (usagePercent > 90) {
      await this.sendAlert(
        "critical",
        `🚨 Memoria Crítica`,
        `Uso de memoria: ${usagePercent}% (${heapUsedMB}MB / ${heapTotalMB}MB)`
      );
    } else if (usagePercent > 75) {
      await this.sendAlert(
        "warning",
        `⚠️ Memoria Alta`,
        `Uso de memoria: ${usagePercent}% (${heapUsedMB}MB / ${heapTotalMB}MB)`
      );
    }
  }

  /**
   * Envía una alerta al superadmin
   */
  async sendAlert(
    level: AlertLevel,
    title: string,
    message: string
  ): Promise<void> {
    if (!this.bot || !this.config.enabled) {
      return;
    }

    const alertKey = `${level}:${title}`;

    // Verificar cooldown
    if (!this.canSendAlert(alertKey)) {
      return;
    }

    const config = loadConfig();
    const superadminId = config.superadmin?.telegramUserId;

    if (!superadminId) {
      logger.warn("No superadmin configured for alerts");
      return;
    }

    const icons: Record<AlertLevel, string> = {
      info: "ℹ️",
      warning: "⚠️",
      critical: "🚨",
    };

    const formattedMessage = [
      `${icons[level]} <b>${title}</b>`,
      "",
      message,
      "",
      `⏰ ${new Date().toLocaleString()}`,
      `📊 Nivel: ${level.toUpperCase()}`,
    ].join("\n");

    try {
      await this.bot.api.sendMessage(superadminId, formattedMessage, {
        parse_mode: "HTML",
      });

      this.recordAlertSent(alertKey);
      logger.info(`Alert sent: ${title}`, { level });
    } catch (error) {
      logger.error("Failed to send alert", { error: String(error), title });
    }
  }

  /**
   * Verifica si se puede enviar una alerta (cooldown)
   */
  private canSendAlert(alertKey: string): boolean {
    const now = Date.now();
    const state = this.alertStates.get(alertKey);

    if (!state) {
      return true;
    }

    return now - state.lastSentAt > this.config.cooldownMs;
  }

  /**
   * Registra que una alerta fue enviada
   */
  private recordAlertSent(alertKey: string): void {
    const now = Date.now();
    const state = this.alertStates.get(alertKey);

    if (state) {
      state.lastSentAt = now;
      state.count++;
    } else {
      this.alertStates.set(alertKey, {
        lastSentAt: now,
        count: 1,
      });
    }
  }

  /**
   * Envía una alerta de canal caído
   */
  async sendChannelDownAlert(channelName: string, error?: string): Promise<void> {
    await this.sendAlert(
      "critical",
      "Canal Desconectado",
      `El canal <b>${channelName}</b> se ha desconectado.` +
        (error ? `\n\nError: ${error}` : "")
    );
  }

  /**
   * Envía una alerta de error en operación root
   */
  async sendRootOperationFailedAlert(
    operation: string,
    error: string
  ): Promise<void> {
    await this.sendAlert(
      "critical",
      "Operación Root Fallida",
      `La operación <b>${operation}</b> ha fallado.\n\nError: ${error}`
    );
  }

  /**
   * Envía una alerta de uso anómalo
   */
  async sendAnomalousUsageAlert(
    channel: string,
    messageCount: number,
    timeWindow: string
  ): Promise<void> {
    await this.sendAlert(
      "warning",
      "Uso Anómalo Detectado",
      `El canal <b>${channel}</b> ha enviado ${messageCount} mensajes en ${timeWindow}.` +
        `\n\nEsto puede indicar spam o abuso.`
    );
  }

  /**
   * Obtiene estadísticas de alertas enviadas
   */
  getAlertStats(): Array<{
    key: string;
    count: number;
    lastSent: Date;
  }> {
    return Array.from(this.alertStates.entries()).map(([key, state]) => ({
      key,
      count: state.count,
      lastSent: new Date(state.lastSentAt),
    }));
  }

  /**
   * Limpia el estado de alertas (útil para testing)
   */
  clearAlertStates(): void {
    this.alertStates.clear();
    logger.info("Alert states cleared");
  }
}

/**
 * Instancia singleton del sistema de alertas
 */
export const adminAlertSystem = new AdminAlertSystem();
