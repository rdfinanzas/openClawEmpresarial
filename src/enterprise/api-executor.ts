import type { DynamicAPIConfig, HttpMethod, APIAuthConfig } from './types.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'api-executor' });

/**
 * Resultado de una llamada a API.
 */
export interface APICallResult<T = unknown> {
  /** Si la llamada fue exitosa */
  success: boolean;
  /** Datos de respuesta (si success es true) */
  data?: T;
  /** Error (si success es false) */
  error?: string;
  /** Código de estado HTTP */
  statusCode?: number;
  /** Headers de respuesta */
  headers?: Record<string, string>;
  /** Tiempo de respuesta (ms) */
  responseTime?: number;
}

/**
 * Configuración para ejecutar una llamada a API.
 */
export interface APIExecutionConfig {
  /** Número máximo de reintentos */
  maxRetries?: number;
  /** Delay entre reintentos (ms) */
  retryDelayMs?: number;
  /** Timeout para la llamada (ms) */
  timeoutMs?: number;
}

/**
 * Ejecuta llamadas a APIs externas con manejo de errores y retry logic.
 * 
 * Características:
 * - Soporte para múltiples tipos de autenticación
 * - Retry automático para errores transitorios
 * - Timeout configurable
 * - Logging de llamadas
 * - Manejo de diferentes métodos HTTP
 */
export class APIExecutor {
  private readonly defaultConfig: Required<APIExecutionConfig> = {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000,
  };

  /**
   * Construye los headers de autenticación según el tipo.
   */
  private buildAuthHeaders(auth: APIAuthConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (auth.type) {
      case 'bearer':
        if (auth.bearerToken) {
          headers['Authorization'] = `Bearer ${auth.bearerToken}`;
        }
        break;

      case 'api_key':
        if (auth.apiKey) {
          const headerName = auth.apiKeyHeader || 'X-API-Key';
          headers[headerName] = auth.apiKey;
        }
        break;

      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'oauth2':
        if (auth.oauth2?.accessToken) {
          headers['Authorization'] = `Bearer ${auth.oauth2.accessToken}`;
        }
        break;

      case 'none':
        // No auth headers
        break;
    }

    return headers;
  }

  /**
   * Construye la URL completa con parámetros.
   */
  private buildURL(baseUrl: string, path: string, params?: Record<string, unknown>): string {
    const url = new URL(path, baseUrl);

    if (params && Object.keys(params).length > 0) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Determina si un error es transitorio y debe reintentarse.
   */
  private isTransientError(statusCode?: number): boolean {
    if (!statusCode) return true; // Network errors

    // 429 Too Many Requests, 500-599 Server Errors
    return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
  }

  /**
   * Espera un delay antes de reintentar.
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ejecuta una llamada HTTP con timeout.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Ejecuta una llamada a una API externa.
   * 
   * @param api Configuración de la API
   * @param endpointPath Path del endpoint
   * @param method Método HTTP
   * @param params Parámetros de la llamada
   * @param config Configuración de ejecución
   * @returns Resultado de la llamada
   */
  async executeAPICall<T = unknown>(
    api: DynamicAPIConfig,
    endpointPath: string,
    method: HttpMethod,
    params: Record<string, unknown> = {},
    config: APIExecutionConfig = {}
  ): Promise<APICallResult<T>> {
    const execConfig = { ...this.defaultConfig, ...config };
    const timeout = api.timeoutMs || execConfig.timeoutMs;
    
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= execConfig.maxRetries) {
      const startTime = Date.now();

      try {
        // Construir headers
        const authHeaders = this.buildAuthHeaders(api.auth);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...api.globalHeaders,
          ...authHeaders,
        };

        // Construir URL y body
        let url: string;
        let body: string | undefined;

        if (method === 'GET') {
          url = this.buildURL(api.baseUrl, endpointPath, params);
        } else {
          url = this.buildURL(api.baseUrl, endpointPath);
          body = JSON.stringify(params);
        }

        logger.debug(`API call: ${method} ${url} (attempt ${attempt + 1}/${execConfig.maxRetries + 1})`);

        // Ejecutar llamada
        const response = await this.fetchWithTimeout(
          url,
          {
            method,
            headers,
            body,
          },
          timeout
        );

        const responseTime = Date.now() - startTime;

        // Parsear respuesta
        let data: T | undefined;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          data = await response.json() as T;
        } else {
          data = await response.text() as unknown as T;
        }

        // Verificar si fue exitosa
        if (response.ok) {
          logger.info(`API call successful: ${method} ${url} (${responseTime}ms)`);
          return {
            success: true,
            data,
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            responseTime,
          };
        }

        // Error HTTP
        logger.warn(`API call failed: ${method} ${url} - ${response.status} ${response.statusText}`);

        // Verificar si debe reintentar
        if (this.isTransientError(response.status) && attempt < execConfig.maxRetries) {
          await this.delay(execConfig.retryDelayMs * (attempt + 1)); // Exponential backoff
          attempt++;
          continue;
        }

        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
          responseTime,
        };

      } catch (error) {
        lastError = error as Error;
        const responseTime = Date.now() - startTime;

        logger.error(`API call error: ${method} ${endpointPath}`, error);

        // Verificar si debe reintentar
        if (attempt < execConfig.maxRetries) {
          await this.delay(execConfig.retryDelayMs * (attempt + 1));
          attempt++;
          continue;
        }

        return {
          success: false,
          error: lastError.message,
          responseTime,
        };
      }
    }

    // No debería llegar aquí, pero por seguridad
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
    };
  }

  /**
   * Ejecuta una llamada a API por nombre de endpoint.
   * 
   * @param api Configuración de la API
   * @param endpointName Nombre del endpoint
   * @param params Parámetros de la llamada
   * @param config Configuración de ejecución
   * @returns Resultado de la llamada
   */
  async executeByEndpointName<T = unknown>(
    api: DynamicAPIConfig,
    endpointName: string,
    params: Record<string, unknown> = {},
    config: APIExecutionConfig = {}
  ): Promise<APICallResult<T>> {
    const endpoint = api.endpoints.find(e => e.name === endpointName);

    if (!endpoint) {
      return {
        success: false,
        error: `Endpoint "${endpointName}" not found in API "${api.id}"`,
      };
    }

    return this.executeAPICall<T>(
      api,
      endpoint.path,
      endpoint.method,
      params,
      config
    );
  }
}

/**
 * Instancia singleton del ejecutor de APIs.
 */
export const apiExecutor = new APIExecutor();
