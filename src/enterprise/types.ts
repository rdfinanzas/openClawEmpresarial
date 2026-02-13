/**
 * Método HTTP soportado para endpoints de API.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Tipo de autenticación soportado.
 */
export type AuthType = 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2';

/**
 * Configuración de autenticación para una API.
 */
export interface APIAuthConfig {
  /** Tipo de autenticación */
  type: AuthType;
  /** Token Bearer (si type es 'bearer') */
  bearerToken?: string;
  /** API Key (si type es 'api_key') */
  apiKey?: string;
  /** Nombre del header para API Key (default: 'X-API-Key') */
  apiKeyHeader?: string;
  /** Usuario para Basic Auth (si type es 'basic') */
  username?: string;
  /** Contraseña para Basic Auth (si type es 'basic') */
  password?: string;
  /** Config OAuth2 (si type es 'oauth2') */
  oauth2?: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    accessToken?: string;
    refreshToken?: string;
  };
}

/**
 * Definición de un parámetro de endpoint.
 */
export interface EndpointParameter {
  /** Nombre del parámetro */
  name: string;
  /** Tipo de dato */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Si el parámetro es obligatorio */
  required: boolean;
  /** Descripción del parámetro */
  description?: string;
  /** Valor por defecto */
  defaultValue?: unknown;
}

/**
 * Definición de un endpoint de API.
 */
export interface DynamicEndpoint {
  /** Nombre del endpoint (para identificación) */
  name: string;
  /** Path del endpoint (relativo a baseUrl) */
  path: string;
  /** Método HTTP */
  method: HttpMethod;
  /** Descripción del endpoint */
  description?: string;
  /** Parámetros del endpoint */
  parameters?: EndpointParameter[];
  /** Headers adicionales específicos del endpoint */
  headers?: Record<string, string>;
}

/**
 * Configuración completa de una API dinámica.
 */
export interface DynamicAPIConfig {
  /** ID único de la API */
  id: string;
  /** Nombre descriptivo de la API */
  name: string;
  /** URL base de la API */
  baseUrl: string;
  /** Descripción de la API */
  description?: string;
  /** Configuración de autenticación */
  auth: APIAuthConfig;
  /** Endpoints disponibles */
  endpoints: DynamicEndpoint[];
  /** Headers globales para todos los endpoints */
  globalHeaders?: Record<string, string>;
  /** Timeout para requests (ms). Default: 30000 */
  timeoutMs?: number;
  /** Si la API está habilitada */
  enabled?: boolean;
  /** Tags para categorización */
  tags?: string[];
}

/**
 * Resultado de validación de configuración de API.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
