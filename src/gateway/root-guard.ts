import { authorizationQueue } from './authorization-queue.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'root-guard' });

/**
 * Operaciones que requieren autorización root.
 */
export const ROOT_OPERATIONS = {
  FILE_DELETE: 'file_delete',
  FILE_WRITE: 'file_write',
  CONFIG_MODIFY: 'config_modify',
  SYSTEM_RESTART: 'system_restart',
  SYSTEM_SHUTDOWN: 'system_shutdown',
  DATABASE_DROP: 'database_drop',
  USER_DELETE: 'user_delete',
  PERMISSION_GRANT: 'permission_grant',
} as const;

export type RootOperation = typeof ROOT_OPERATIONS[keyof typeof ROOT_OPERATIONS];

/**
 * Configuración del middleware de root guard.
 */
export interface RootGuardConfig {
  /** Si el root guard está habilitado */
  enabled?: boolean;
  /** Timeout por defecto para autorizaciones (ms) */
  defaultTimeoutMs?: number;
  /** Función para enviar solicitud de autorización (debe ser inyectada) */
  requestAuthorization?: (
    operation: string,
    params: Record<string, unknown>,
    timeoutMs?: number
  ) => Promise<boolean>;
}

/**
 * Middleware que intercepta operaciones críticas y requiere autorización root.
 * 
 * Uso:
 * ```typescript
 * const guard = new RootGuard({ enabled: true });
 * 
 * async function deleteFile(path: string) {
 *   await guard.requireAuthorization('file_delete', { path });
 *   // ... proceder con la eliminación
 * }
 * ```
 */
export class RootGuard {
  private readonly config: Required<RootGuardConfig>;

  constructor(config: RootGuardConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 5 * 60 * 1000,
      requestAuthorization: config.requestAuthorization ?? this.defaultRequestAuthorization.bind(this),
    };
  }

  /**
   * Implementación por defecto de requestAuthorization usando la cola.
   * Puede ser sobrescrita con una implementación que envíe a Telegram.
   */
  private async defaultRequestAuthorization(
    operation: string,
    params: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<boolean> {
    logger.info(`Authorization requested for operation: ${operation}`);
    return await authorizationQueue.enqueue(operation, params, timeoutMs);
  }

  /**
   * Requiere autorización para una operación crítica.
   * 
   * @param operation Nombre de la operación
   * @param params Parámetros de la operación
   * @param timeoutMs Timeout personalizado (opcional)
   * @throws Error si la autorización es rechazada o expira
   */
  async requireAuthorization(
    operation: string,
    params: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<void> {
    // Si el guard está deshabilitado, permitir todo
    if (!this.config.enabled) {
      logger.debug(`Root guard disabled, allowing operation: ${operation}`);
      return;
    }

    logger.info(`Requesting authorization for: ${operation}`, params);

    try {
      const approved = await this.config.requestAuthorization(
        operation,
        params,
        timeoutMs ?? this.config.defaultTimeoutMs
      );

      if (!approved) {
        const error = new Error(`Operation "${operation}" was rejected by superadmin`);
        (error as any).code = 'AUTHORIZATION_REJECTED';
        logger.warn(`Authorization rejected for: ${operation}`);
        throw error;
      }

      logger.info(`Authorization approved for: ${operation}`);
    } catch (error) {
      if ((error as any).code === 'AUTHORIZATION_REJECTED') {
        throw error;
      }

      // Timeout u otro error
      const timeoutError = new Error(
        `Authorization request for "${operation}" failed: ${(error as Error).message}`
      );
      (timeoutError as any).code = 'AUTHORIZATION_TIMEOUT';
      logger.error(`Authorization failed for: ${operation}`, error);
      throw timeoutError;
    }
  }

  /**
   * Verifica si una operación requiere autorización root.
   * 
   * @param operation Nombre de la operación
   * @returns true si requiere autorización
   */
  isRootOperation(operation: string): boolean {
    return Object.values(ROOT_OPERATIONS).includes(operation as RootOperation);
  }

  /**
   * Habilita o deshabilita el root guard.
   * 
   * @param enabled Nuevo estado
   */
  setEnabled(enabled: boolean): void {
    (this.config as any).enabled = enabled;
    logger.info(`Root guard ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Verifica si el root guard está habilitado.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Instancia singleton del root guard.
 * Puede ser configurada globalmente.
 */
export const rootGuard = new RootGuard();

/**
 * Decorator para marcar funciones que requieren autorización root.
 * 
 * Uso:
 * ```typescript
 * class FileManager {
 *   @requireRootAuthorization('file_delete')
 *   async deleteFile(path: string) {
 *     // ...
 *   }
 * }
 * ```
 */
export function requireRootAuthorization(operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Extraer parámetros para el log
      const params: Record<string, unknown> = {};
      if (args.length > 0) {
        args.forEach((arg, index) => {
          params[`arg${index}`] = arg;
        });
      }

      await rootGuard.requireAuthorization(operation, params);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
