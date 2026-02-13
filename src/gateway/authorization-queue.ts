/**
 * Estado de una solicitud de autorización.
 */
export type AuthorizationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Solicitud de autorización para una operación crítica.
 */
export interface AuthorizationRequest {
  /** ID único de la solicitud */
  id: string;
  /** Nombre de la operación que requiere autorización */
  operation: string;
  /** Parámetros de la operación (para mostrar al superadmin) */
  params: Record<string, unknown>;
  /** Timestamp de creación (ms) */
  timestamp: number;
  /** Estado actual de la solicitud */
  status: AuthorizationStatus;
  /** Timestamp de expiración (ms) */
  expiresAt: number;
  /** Razón del rechazo (si fue rechazada) */
  rejectionReason?: string;
}

/**
 * Configuración de la cola de autorizaciones.
 */
export interface AuthorizationQueueConfig {
  /** Timeout por defecto para solicitudes (ms). Default: 5 minutos */
  defaultTimeoutMs?: number;
  /** Intervalo de limpieza de solicitudes expiradas (ms). Default: 1 minuto */
  cleanupIntervalMs?: number;
}

/**
 * Gestiona una cola de solicitudes de autorización para operaciones críticas.
 * 
 * Características:
 * - Cola en memoria (puede extenderse a Redis para multi-instancia)
 * - Timeout configurable por solicitud
 * - Cleanup automático de solicitudes expiradas
 * - Promesas para esperar aprobación/rechazo
 */
export class AuthorizationQueue {
  private requests = new Map<string, AuthorizationRequest>();
  private pendingPromises = new Map<string, {
    resolve: (approved: boolean) => void;
    reject: (error: Error) => void;
  }>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly config: Required<AuthorizationQueueConfig>;

  constructor(config: AuthorizationQueueConfig = {}) {
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 5 * 60 * 1000, // 5 minutos
      cleanupIntervalMs: config.cleanupIntervalMs ?? 60 * 1000, // 1 minuto
    };

    // Iniciar cleanup automático
    this.startCleanup();
  }

  /**
   * Genera un ID único para una solicitud.
   */
  private generateId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Encola una nueva solicitud de autorización.
   * 
   * @param operation Nombre de la operación
   * @param params Parámetros de la operación
   * @param timeoutMs Timeout personalizado (opcional)
   * @returns Promise que se resuelve cuando la solicitud es aprobada/rechazada
   */
  async enqueue(
    operation: string,
    params: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<boolean> {
    const id = this.generateId();
    const now = Date.now();
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    const expiresAt = now + timeout;

    const request: AuthorizationRequest = {
      id,
      operation,
      params,
      timestamp: now,
      status: 'pending',
      expiresAt,
    };

    this.requests.set(id, request);

    // Crear promesa que se resolverá cuando se apruebe/rechace
    return new Promise<boolean>((resolve, reject) => {
      this.pendingPromises.set(id, { resolve, reject });

      // Auto-expirar después del timeout
      setTimeout(() => {
        const req = this.requests.get(id);
        if (req && req.status === 'pending') {
          req.status = 'expired';
          this.requests.set(id, req);
          
          const promise = this.pendingPromises.get(id);
          if (promise) {
            promise.reject(new Error(`Authorization request expired after ${timeout}ms`));
            this.pendingPromises.delete(id);
          }
        }
      }, timeout);
    });
  }

  /**
   * Aprueba una solicitud de autorización.
   * 
   * @param id ID de la solicitud
   * @returns true si se aprobó exitosamente, false si no existe o ya expiró
   */
  approve(id: string): boolean {
    const request = this.requests.get(id);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'approved';
    this.requests.set(id, request);

    const promise = this.pendingPromises.get(id);
    if (promise) {
      promise.resolve(true);
      this.pendingPromises.delete(id);
    }

    return true;
  }

  /**
   * Rechaza una solicitud de autorización.
   * 
   * @param id ID de la solicitud
   * @param reason Razón del rechazo (opcional)
   * @returns true si se rechazó exitosamente, false si no existe o ya expiró
   */
  reject(id: string, reason?: string): boolean {
    const request = this.requests.get(id);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';
    request.rejectionReason = reason;
    this.requests.set(id, request);

    const promise = this.pendingPromises.get(id);
    if (promise) {
      promise.resolve(false);
      this.pendingPromises.delete(id);
    }

    return true;
  }

  /**
   * Obtiene el estado de una solicitud.
   * 
   * @param id ID de la solicitud
   * @returns La solicitud o undefined si no existe
   */
  getStatus(id: string): AuthorizationRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Obtiene todas las solicitudes pendientes.
   * 
   * @returns Array de solicitudes pendientes
   */
  getPending(): AuthorizationRequest[] {
    return Array.from(this.requests.values())
      .filter(req => req.status === 'pending')
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Obtiene todas las solicitudes (cualquier estado).
   * 
   * @returns Array de todas las solicitudes
   */
  getAll(): AuthorizationRequest[] {
    return Array.from(this.requests.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Limpia solicitudes expiradas y completadas antiguas.
   */
  private cleanup(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [id, request] of this.requests.entries()) {
      // Eliminar solicitudes expiradas
      if (request.status === 'expired' && request.timestamp < oneHourAgo) {
        this.requests.delete(id);
        this.pendingPromises.delete(id);
        continue;
      }

      // Eliminar solicitudes completadas (aprobadas/rechazadas) de hace más de 1 hora
      if (
        (request.status === 'approved' || request.status === 'rejected') &&
        request.timestamp < oneHourAgo
      ) {
        this.requests.delete(id);
        continue;
      }

      // Marcar como expiradas las solicitudes pendientes que pasaron su tiempo
      if (request.status === 'pending' && now > request.expiresAt) {
        request.status = 'expired';
        this.requests.set(id, request);
        
        const promise = this.pendingPromises.get(id);
        if (promise) {
          promise.reject(new Error('Authorization request expired'));
          this.pendingPromises.delete(id);
        }
      }
    }
  }

  /**
   * Inicia el proceso de limpieza automática.
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Detiene el proceso de limpieza automática.
   * Útil para testing o shutdown.
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Limpia todas las solicitudes y detiene el cleanup.
   * Útil para testing.
   */
  clear(): void {
    this.requests.clear();
    this.pendingPromises.clear();
    this.stopCleanup();
  }
}

/**
 * Instancia singleton de la cola de autorizaciones.
 * Puede ser usada en toda la aplicación.
 */
export const authorizationQueue = new AuthorizationQueue();
