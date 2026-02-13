/**
 * Sistema de APIs Empresariales Configurables
 * 
 * Permite registrar APIs personalizadas que el agente puede usar
 * para atención al cliente (stock, pedidos, citas, etc.)
 * 
 * Las APIs registradas aquí están disponibles SOLO para canales públicos
 * y solo las que el admin configure explícitamente.
 */

import { logWarn } from '../logger.js';

const logger = (msg: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  logWarn(`api-manager: ${msg}${metaStr}`);
};

/**
 * Definición de una API empresarial
 */
export interface EnterpriseApi {
  /** ID único de la API */
  id: string;
  /** Nombre descriptivo */
  name: string;
  /** Descripción para el agente */
  description: string;
  /** Endpoint HTTP */
  endpoint: string;
  /** Método HTTP */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Headers adicionales */
  headers?: Record<string, string>;
  /** Schema de parámetros */
  parameters?: ApiParameter[];
  /** Ejemplo de uso para el agente */
  example?: string;
}

/**
 * Definición de un parámetro de API
 */
export interface ApiParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
  example?: string;
}

/**
 * Resultado de ejecución de API
 */
export interface ApiResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Manager de APIs Empresariales
 */
export class EnterpriseApiManager {
  private apis = new Map<string, EnterpriseApi>();

  /**
   * Valida que el endpoint use HTTPS en producción
   */
  private validateEndpoint(endpoint: string): { valid: boolean; error?: string } {
    try {
      const url = new URL(endpoint);
      
      // En producción, rechazar HTTP
      if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
        return { 
          valid: false, 
          error: 'HTTP endpoints are not allowed in production. Use HTTPS.' 
        };
      }
      
      // Advertir sobre HTTP en desarrollo
      if (url.protocol === 'http:' && process.env.NODE_ENV !== 'production') {
        logger('Warning: API uses HTTP', { endpoint });
      }
      
      return { valid: true };
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Registra una nueva API empresarial
   */
  registerApi(api: EnterpriseApi): { ok: true } | { ok: false; error: string } {
    // Validar endpoint
    const validation = this.validateEndpoint(api.endpoint);
    if (!validation.valid) {
      logger('API registration failed', { id: api.id, error: validation.error });
      return { ok: false, error: validation.error || 'Invalid endpoint' };
    }
    
    this.apis.set(api.id, api);
    logger('API registered', { id: api.id, name: api.name });
    return { ok: true };
  }

  /**
   * Obtiene una API por ID
   */
  getApi(id: string): EnterpriseApi | undefined {
    return this.apis.get(id);
  }

  /**
   * Lista todas las APIs registradas
   */
  listApis(): EnterpriseApi[] {
    return Array.from(this.apis.values());
  }

  /**
   * Elimina una API
   */
  unregisterApi(id: string): boolean {
    const deleted = this.apis.delete(id);
    if (deleted) {
      logger('API unregistered', { id });
    }
    return deleted;
  }

  /**
   * Ejecuta una API con los parámetros proporcionados
   */
  async executeApi(apiId: string, params: Record<string, unknown>): Promise<ApiResult> {
    const api = this.apis.get(apiId);
    if (!api) {
      return { success: false, error: `API ${apiId} not found` };
    }

    // Validar endpoint antes de ejecutar
    const validation = this.validateEndpoint(api.endpoint);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid endpoint' };
    }

    try {
      // Construir URL con parámetros para GET
      let url = api.endpoint;
      const body = api.method === 'GET' ? undefined : JSON.stringify(params);
      
      if (api.method === 'GET' && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          searchParams.append(key, String(value));
        }
        url += `?${searchParams.toString()}`;
      }

      const response = await fetch(url, {
        method: api.method,
        headers: {
          'Content-Type': 'application/json',
          ...api.headers,
        },
        body,
      });

      if (!response.ok) {
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }

      const data = await response.json();
      return { success: true, data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger('API execution failed', { apiId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Genera herramientas dinámicas para el agente basadas en las APIs registradas
   */
  generateTools(): Array<{
    name: string;
    description: string;
    parameters: unknown;
    execute: (params: Record<string, unknown>) => Promise<unknown>;
  }> {
    return this.listApis().map(api => ({
      name: `api_${api.id}`,
      description: `${api.description}\n\nEjemplo: ${api.example || 'N/A'}`,
      parameters: {
        type: 'object',
        properties: api.parameters?.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
          };
          return acc;
        }, {} as Record<string, unknown>) || {},
        required: api.parameters?.filter(p => p.required).map(p => p.name) || [],
      },
      execute: async (params: Record<string, unknown>) => {
        const result = await this.executeApi(api.id, params);
        if (!result.success) {
          throw new Error(result.error);
        }
        return result.data;
      },
    }));
  }
}

/**
 * Instancia singleton del manager de APIs
 */
export const apiManager = new EnterpriseApiManager();

/**
 * Registra APIs de ejemplo para un negocio retail
 */
export function registerRetailApis(): void {
  // API de consulta de stock
  apiManager.registerApi({
    id: 'check_stock',
    name: 'Consultar Stock',
    description: 'Verifica si un producto está disponible en stock y la cantidad',
    endpoint: 'https://api.tuempresa.com/v1/inventory/check',
    method: 'GET',
    parameters: [
      {
        name: 'producto',
        type: 'string',
        required: true,
        description: 'Nombre o código del producto a consultar',
        example: 'arroz',
      },
    ],
    example: 'Consultar stock de "arroz"',
  });

  // API de precios
  apiManager.registerApi({
    id: 'get_price',
    name: 'Consultar Precio',
    description: 'Obtiene el precio actual de un producto',
    endpoint: 'https://api.tuempresa.com/v1/products/price',
    method: 'GET',
    parameters: [
      {
        name: 'producto',
        type: 'string',
        required: true,
        description: 'Nombre o código del producto',
        example: 'arroz',
      },
    ],
    example: 'Consultar precio de "arroz"',
  });

  // API de crear pedido
  apiManager.registerApi({
    id: 'create_order',
    name: 'Crear Pedido',
    description: 'Crea un nuevo pedido para un cliente',
    endpoint: 'https://api.tuempresa.com/v1/orders',
    method: 'POST',
    parameters: [
      {
        name: 'cliente',
        type: 'string',
        required: true,
        description: 'Nombre o ID del cliente',
      },
      {
        name: 'productos',
        type: 'string',
        required: true,
        description: 'Lista de productos separados por coma',
        example: 'arroz:2, fideos:1',
      },
      {
        name: 'direccion',
        type: 'string',
        required: true,
        description: 'Dirección de entrega',
      },
    ],
    example: 'Crear pedido para cliente "Juan" con arroz:2, fideos:1',
  });

  // API de estado de pedido
  apiManager.registerApi({
    id: 'check_order_status',
    name: 'Estado de Pedido',
    description: 'Consulta el estado de un pedido existente',
    endpoint: 'https://api.tuempresa.com/v1/orders/status',
    method: 'GET',
    parameters: [
      {
        name: 'pedido_id',
        type: 'string',
        required: true,
        description: 'Número o ID del pedido',
        example: 'PED-12345',
      },
    ],
    example: 'Consultar estado del pedido PED-12345',
  });

  // API de catálogo
  apiManager.registerApi({
    id: 'view_catalog',
    name: 'Ver Catálogo',
    description: 'Obtiene la lista de productos disponibles, opcionalmente filtrada por categoría',
    endpoint: 'https://api.tuempresa.com/v1/products',
    method: 'GET',
    parameters: [
      {
        name: 'categoria',
        type: 'string',
        required: false,
        description: 'Categoría de productos (opcional)',
        example: 'alimentos',
      },
    ],
    example: 'Ver catálogo de productos (o filtrar por "alimentos")',
  });

  logger('Retail APIs registered');
}
