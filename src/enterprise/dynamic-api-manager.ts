import type { DynamicAPIConfig, ValidationResult } from './types.js';

/**
 * Gestiona el registro y almacenamiento de APIs dinámicas.
 * 
 * Características:
 * - Registro de APIs con validación
 * - Storage en memoria (puede extenderse a DB)
 * - Búsqueda y filtrado de APIs
 * - Validación de configuración
 */
export class DynamicAPIManager {
  private apis = new Map<string, DynamicAPIConfig>();

  /**
   * Valida la configuración de una API.
   * 
   * @param config Configuración de la API
   * @returns Resultado de validación
   */
  validateConfig(config: DynamicAPIConfig): ValidationResult {
    const errors: string[] = [];

    // Validar campos obligatorios
    if (!config.id || config.id.trim() === '') {
      errors.push('API ID is required');
    }

    if (!config.name || config.name.trim() === '') {
      errors.push('API name is required');
    }

    if (!config.baseUrl || config.baseUrl.trim() === '') {
      errors.push('Base URL is required');
    }

    // Validar formato de URL
    if (config.baseUrl) {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push('Base URL must be a valid URL');
      }
    }

    // Validar autenticación
    if (!config.auth) {
      errors.push('Authentication config is required');
    } else {
      const authErrors = this.validateAuth(config.auth);
      errors.push(...authErrors);
    }

    // Validar endpoints
    if (!config.endpoints || config.endpoints.length === 0) {
      errors.push('At least one endpoint is required');
    } else {
      config.endpoints.forEach((endpoint, index) => {
        const endpointErrors = this.validateEndpoint(endpoint, index);
        errors.push(...endpointErrors);
      });
    }

    // Validar timeout
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== 'number' || config.timeoutMs <= 0) {
        errors.push('Timeout must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida la configuración de autenticación.
   */
  private validateAuth(auth: DynamicAPIConfig['auth']): string[] {
    const errors: string[] = [];

    if (!auth.type) {
      errors.push('Auth type is required');
      return errors;
    }

    switch (auth.type) {
      case 'bearer':
        if (!auth.bearerToken) {
          errors.push('Bearer token is required for bearer auth');
        }
        break;
      case 'api_key':
        if (!auth.apiKey) {
          errors.push('API key is required for api_key auth');
        }
        break;
      case 'basic':
        if (!auth.username || !auth.password) {
          errors.push('Username and password are required for basic auth');
        }
        break;
      case 'oauth2':
        if (!auth.oauth2) {
          errors.push('OAuth2 config is required for oauth2 auth');
        } else {
          if (!auth.oauth2.clientId) {
            errors.push('OAuth2 client ID is required');
          }
          if (!auth.oauth2.clientSecret) {
            errors.push('OAuth2 client secret is required');
          }
          if (!auth.oauth2.tokenUrl) {
            errors.push('OAuth2 token URL is required');
          }
        }
        break;
      case 'none':
        // No validation needed
        break;
      default:
        errors.push(`Unknown auth type: ${auth.type}`);
    }

    return errors;
  }

  /**
   * Valida un endpoint.
   */
  private validateEndpoint(endpoint: DynamicAPIConfig['endpoints'][0], index: number): string[] {
    const errors: string[] = [];
    const prefix = `Endpoint ${index + 1}`;

    if (!endpoint.name || endpoint.name.trim() === '') {
      errors.push(`${prefix}: name is required`);
    }

    if (!endpoint.path || endpoint.path.trim() === '') {
      errors.push(`${prefix}: path is required`);
    }

    if (!endpoint.method) {
      errors.push(`${prefix}: method is required`);
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      if (!validMethods.includes(endpoint.method)) {
        errors.push(`${prefix}: invalid method ${endpoint.method}`);
      }
    }

    // Validar parámetros
    if (endpoint.parameters) {
      endpoint.parameters.forEach((param, paramIndex) => {
        if (!param.name || param.name.trim() === '') {
          errors.push(`${prefix}, parameter ${paramIndex + 1}: name is required`);
        }
        if (!param.type) {
          errors.push(`${prefix}, parameter ${paramIndex + 1}: type is required`);
        }
      });
    }

    return errors;
  }

  /**
   * Registra una nueva API.
   * 
   * @param config Configuración de la API
   * @returns true si se registró exitosamente
   * @throws Error si la configuración es inválida o el ID ya existe
   */
  registerAPI(config: DynamicAPIConfig): boolean {
    // Validar configuración
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid API config: ${validation.errors.join(', ')}`);
    }

    // Verificar que no exista el ID
    if (this.apis.has(config.id)) {
      throw new Error(`API with ID ${config.id} already exists`);
    }

    // Establecer valores por defecto
    const apiWithDefaults: DynamicAPIConfig = {
      ...config,
      enabled: config.enabled ?? true,
      timeoutMs: config.timeoutMs ?? 30000,
      tags: config.tags ?? [],
    };

    this.apis.set(config.id, apiWithDefaults);
    return true;
  }

  /**
   * Obtiene una API por su ID.
   * 
   * @param id ID de la API
   * @returns La API o undefined si no existe
   */
  getAPI(id: string): DynamicAPIConfig | undefined {
    return this.apis.get(id);
  }

  /**
   * Obtiene todas las APIs registradas.
   * 
   * @param onlyEnabled Si solo retornar APIs habilitadas
   * @returns Array de APIs
   */
  getAllAPIs(onlyEnabled = false): DynamicAPIConfig[] {
    const apis = Array.from(this.apis.values());
    if (onlyEnabled) {
      return apis.filter(api => api.enabled !== false);
    }
    return apis;
  }

  /**
   * Busca APIs por tags.
   * 
   * @param tags Tags a buscar
   * @returns Array de APIs que tienen al menos uno de los tags
   */
  findByTags(tags: string[]): DynamicAPIConfig[] {
    return Array.from(this.apis.values()).filter(api => {
      if (!api.tags || api.tags.length === 0) {
        return false;
      }
      return tags.some(tag => api.tags!.includes(tag));
    });
  }

  /**
   * Actualiza una API existente.
   * 
   * @param id ID de la API
   * @param config Nueva configuración
   * @returns true si se actualizó exitosamente
   * @throws Error si la configuración es inválida o la API no existe
   */
  updateAPI(id: string, config: Partial<DynamicAPIConfig>): boolean {
    const existing = this.apis.get(id);
    if (!existing) {
      throw new Error(`API with ID ${id} not found`);
    }

    const updated = { ...existing, ...config, id }; // Mantener el ID original
    const validation = this.validateConfig(updated);
    if (!validation.valid) {
      throw new Error(`Invalid API config: ${validation.errors.join(', ')}`);
    }

    this.apis.set(id, updated);
    return true;
  }

  /**
   * Elimina una API.
   * 
   * @param id ID de la API
   * @returns true si se eliminó, false si no existía
   */
  deleteAPI(id: string): boolean {
    return this.apis.delete(id);
  }

  /**
   * Habilita o deshabilita una API.
   * 
   * @param id ID de la API
   * @param enabled Nuevo estado
   * @returns true si se actualizó exitosamente
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const api = this.apis.get(id);
    if (!api) {
      return false;
    }

    api.enabled = enabled;
    this.apis.set(id, api);
    return true;
  }

  /**
   * Limpia todas las APIs registradas.
   * Útil para testing.
   */
  clear(): void {
    this.apis.clear();
  }
}

/**
 * Instancia singleton del manager de APIs dinámicas.
 */
export const dynamicAPIManager = new DynamicAPIManager();
