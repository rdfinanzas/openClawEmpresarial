import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'gateway-health-monitor' });

/**
 * Estado de salud del gateway.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Métricas de salud del gateway.
 */
export interface GatewayHealthMetrics {
  /** Estado general de salud */
  status: HealthStatus;
  /** Timestamp de la última verificación */
  lastCheck: number;
  /** Tiempo de actividad (ms) */
  uptime: number;
  /** Uso de memoria (bytes) */
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  /** Uso de CPU (porcentaje) */
  cpuUsage?: number;
  /** Número de conexiones activas */
  activeConnections: number;
  /** Número de solicitudes procesadas */
  requestsProcessed: number;
  /** Número de errores recientes */
  recentErrors: number;
  /** Latencia promedio (ms) */
  averageLatency: number;
}

/**
 * Configuración del monitor de salud.
 */
export interface HealthMonitorConfig {
  /** Intervalo de verificación (ms). Default: 30000 (30s) */
  checkIntervalMs?: number;
  /** Umbral de memoria para estado degraded (porcentaje). Default: 80 */
  memoryThresholdPercent?: number;
  /** Umbral de errores para estado unhealthy. Default: 10 */
  errorThreshold?: number;
  /** Ventana de tiempo para contar errores (ms). Default: 60000 (1min) */
  errorWindowMs?: number;
}

/**
 * Monitor de salud del gateway.
 * 
 * Características:
 * - Verificación periódica de métricas
 * - Detección de degradación de servicio
 * - Alertas automáticas
 * - Historial de métricas
 */
export class GatewayHealthMonitor {
  private readonly config: Required<HealthMonitorConfig>;
  private metrics: GatewayHealthMetrics;
  private checkInterval: NodeJS.Timeout | null = null;
  private startTime: number;
  private errorTimestamps: number[] = [];
  private requestCount = 0;
  private latencies: number[] = [];

  constructor(config: HealthMonitorConfig = {}) {
    this.config = {
      checkIntervalMs: config.checkIntervalMs ?? 30000,
      memoryThresholdPercent: config.memoryThresholdPercent ?? 80,
      errorThreshold: config.errorThreshold ?? 10,
      errorWindowMs: config.errorWindowMs ?? 60000,
    };

    this.startTime = Date.now();
    this.metrics = this.collectMetrics();
  }

  /**
   * Recopila métricas actuales del sistema.
   */
  private collectMetrics(): GatewayHealthMetrics {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    
    // Limpiar errores antiguos
    this.errorTimestamps = this.errorTimestamps.filter(
      ts => now - ts < this.config.errorWindowMs
    );

    // Calcular latencia promedio
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;

    // Determinar estado de salud
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const recentErrors = this.errorTimestamps.length;

    let status: HealthStatus = 'healthy';
    if (recentErrors >= this.config.errorThreshold) {
      status = 'unhealthy';
    } else if (memoryPercent >= this.config.memoryThresholdPercent) {
      status = 'degraded';
    }

    return {
      status,
      lastCheck: now,
      uptime: now - this.startTime,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      activeConnections: 0, // TODO: Implementar tracking real
      requestsProcessed: this.requestCount,
      recentErrors,
      averageLatency: avgLatency,
    };
  }

  /**
   * Inicia el monitoreo periódico.
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    logger.info('Gateway health monitor started');

    this.checkInterval = setInterval(() => {
      this.metrics = this.collectMetrics();
      
      if (this.metrics.status !== 'healthy') {
        logger.warn(`Gateway health status: ${this.metrics.status}`, this.metrics);
      }
    }, this.config.checkIntervalMs);
  }

  /**
   * Detiene el monitoreo.
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Gateway health monitor stopped');
    }
  }

  /**
   * Obtiene las métricas actuales.
   */
  getMetrics(): GatewayHealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Registra una solicitud procesada.
   */
  recordRequest(latencyMs: number): void {
    this.requestCount++;
    this.latencies.push(latencyMs);
    
    // Mantener solo las últimas 100 latencias
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
  }

  /**
   * Registra un error.
   */
  recordError(): void {
    this.errorTimestamps.push(Date.now());
  }

  /**
   * Verifica si el gateway está saludable.
   */
  isHealthy(): boolean {
    return this.metrics.status === 'healthy';
  }

  /**
   * Obtiene un resumen de salud en texto.
   */
  getHealthSummary(): string {
    const m = this.metrics;
    const memPercent = ((m.memoryUsage.heapUsed / m.memoryUsage.heapTotal) * 100).toFixed(1);
    const uptimeHours = (m.uptime / (1000 * 60 * 60)).toFixed(2);

    return [
      `Status: ${m.status.toUpperCase()}`,
      `Uptime: ${uptimeHours}h`,
      `Memory: ${memPercent}%`,
      `Requests: ${m.requestsProcessed}`,
      `Errors (1min): ${m.recentErrors}`,
      `Avg Latency: ${m.averageLatency.toFixed(0)}ms`,
    ].join(' | ');
  }
}

/**
 * Instancia singleton del monitor de salud.
 */
export const gatewayHealthMonitor = new GatewayHealthMonitor();
