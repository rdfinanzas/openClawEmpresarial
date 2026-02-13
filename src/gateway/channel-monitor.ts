import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'channel-monitor' });

/**
 * Estado de un canal.
 */
export type ChannelStatus = 'online' | 'offline' | 'error' | 'degraded';

/**
 * Métricas de un canal.
 */
export interface ChannelMetrics {
  /** ID del canal */
  channelId: string;
  /** Nombre del canal */
  channelName: string;
  /** Estado actual */
  status: ChannelStatus;
  /** Última vez que estuvo online */
  lastOnline: number;
  /** Número de mensajes procesados */
  messagesProcessed: number;
  /** Número de errores recientes */
  recentErrors: number;
  /** Latencia promedio (ms) */
  averageLatency: number;
  /** Información adicional */
  metadata?: Record<string, unknown>;
}

/**
 * Monitor de estado de canales de comunicación.
 * 
 * Características:
 * - Tracking de estado de cada canal (Telegram, WhatsApp, etc.)
 * - Detección de caídas de servicio
 * - Métricas por canal
 * - Alertas de problemas
 */
export class ChannelMonitor {
  private channels = new Map<string, ChannelMetrics>();
  private errorTimestamps = new Map<string, number[]>();
  private latencies = new Map<string, number[]>();
  private readonly errorWindowMs = 60000; // 1 minuto
  private readonly errorThreshold = 5;

  /**
   * Registra un canal para monitoreo.
   */
  registerChannel(channelId: string, channelName: string): void {
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, {
        channelId,
        channelName,
        status: 'offline',
        lastOnline: 0,
        messagesProcessed: 0,
        recentErrors: 0,
        averageLatency: 0,
      });
      
      this.errorTimestamps.set(channelId, []);
      this.latencies.set(channelId, []);
      
      logger.info(`Channel registered: ${channelName} (${channelId})`);
    }
  }

  /**
   * Marca un canal como online.
   */
  markOnline(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.status = 'online';
      channel.lastOnline = Date.now();
      this.channels.set(channelId, channel);
      logger.debug(`Channel online: ${channelId}`);
    }
  }

  /**
   * Marca un canal como offline.
   */
  markOffline(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.status = 'offline';
      this.channels.set(channelId, channel);
      logger.warn(`Channel offline: ${channelId}`);
    }
  }

  /**
   * Registra un mensaje procesado.
   */
  recordMessage(channelId: string, latencyMs: number): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    channel.messagesProcessed++;
    channel.lastOnline = Date.now();
    
    // Actualizar latencias
    const latencies = this.latencies.get(channelId) || [];
    latencies.push(latencyMs);
    if (latencies.length > 100) {
      latencies.shift();
    }
    this.latencies.set(channelId, latencies);
    
    // Calcular promedio
    channel.averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    // Actualizar estado
    if (channel.status !== 'online' && channel.status !== 'degraded') {
      channel.status = 'online';
    }
    
    this.channels.set(channelId, channel);
  }

  /**
   * Registra un error en un canal.
   */
  recordError(channelId: string, error: Error): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    const now = Date.now();
    const errors = this.errorTimestamps.get(channelId) || [];
    
    // Agregar error
    errors.push(now);
    
    // Limpiar errores antiguos
    const recentErrors = errors.filter(ts => now - ts < this.errorWindowMs);
    this.errorTimestamps.set(channelId, recentErrors);
    
    channel.recentErrors = recentErrors.length;
    
    // Actualizar estado
    if (recentErrors.length >= this.errorThreshold) {
      channel.status = 'error';
    } else if (recentErrors.length > 0) {
      channel.status = 'degraded';
    }
    
    this.channels.set(channelId, channel);
    
    logger.error(`Channel error: ${channelId}`, { error: error.message });
  }

  /**
   * Obtiene métricas de un canal.
   */
  getChannelMetrics(channelId: string): ChannelMetrics | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Obtiene métricas de todos los canales.
   */
  getAllChannelMetrics(): ChannelMetrics[] {
    return Array.from(this.channels.values());
  }

  /**
   * Obtiene canales con problemas.
   */
  getProblematicChannels(): ChannelMetrics[] {
    return Array.from(this.channels.values()).filter(
      ch => ch.status === 'error' || ch.status === 'offline'
    );
  }

  /**
   * Verifica si todos los canales están saludables.
   */
  areAllChannelsHealthy(): boolean {
    return Array.from(this.channels.values()).every(
      ch => ch.status === 'online' || ch.status === 'degraded'
    );
  }

  /**
   * Obtiene un resumen de estado de canales.
   */
  getStatusSummary(): string {
    const channels = Array.from(this.channels.values());
    const online = channels.filter(ch => ch.status === 'online').length;
    const degraded = channels.filter(ch => ch.status === 'degraded').length;
    const offline = channels.filter(ch => ch.status === 'offline').length;
    const error = channels.filter(ch => ch.status === 'error').length;

    return `Channels: ${online} online, ${degraded} degraded, ${offline} offline, ${error} error`;
  }

  /**
   * Limpia las métricas de un canal.
   */
  clearChannelMetrics(channelId: string): void {
    this.errorTimestamps.delete(channelId);
    this.latencies.delete(channelId);
    this.channels.delete(channelId);
    logger.info(`Channel metrics cleared: ${channelId}`);
  }
}

/**
 * Instancia singleton del monitor de canales.
 */
export const channelMonitor = new ChannelMonitor();
