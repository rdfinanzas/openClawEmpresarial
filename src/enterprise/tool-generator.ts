import type { DynamicAPIConfig, DynamicEndpoint, EndpointParameter } from './types.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'tool-generator' });

/**
 * Definición de un tool generado dinámicamente.
 */
export interface GeneratedTool {
  /** Nombre único del tool */
  name: string;
  /** Descripción del tool */
  description: string;
  /** Esquema de parámetros (JSON Schema) */
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  /** Metadata adicional */
  metadata: {
    apiId: string;
    endpointName: string;
    method: string;
    path: string;
  };
}

/**
 * Genera tools dinámicos a partir de configuraciones de API.
 * 
 * Características:
 * - Convierte endpoints de API en tools para el agente
 * - Genera esquemas de parámetros automáticamente
 * - Crea nombres y descripciones descriptivos
 * - Mantiene metadata para ejecución posterior
 */
export class ToolGenerator {
  /**
   * Convierte un tipo de parámetro a JSON Schema type.
   */
  private parameterTypeToJsonSchema(type: EndpointParameter['type']): string {
    switch (type) {
      case 'string':
        return 'string';
      case 'number':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'object':
        return 'object';
      case 'array':
        return 'array';
      default:
        return 'string';
    }
  }

  /**
   * Genera un nombre de tool a partir del nombre de la API y el endpoint.
   */
  private generateToolName(apiId: string, endpointName: string): string {
    // Convertir a snake_case y agregar prefijo
    const apiPrefix = apiId.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const endpointSuffix = endpointName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    
    return `api_${apiPrefix}_${endpointSuffix}`;
  }

  /**
   * Genera una descripción del tool.
   */
  private generateToolDescription(
    api: DynamicAPIConfig,
    endpoint: DynamicEndpoint
  ): string {
    const parts: string[] = [];
    
    if (endpoint.description) {
      parts.push(endpoint.description);
    } else {
      parts.push(`${endpoint.method} ${endpoint.path}`);
    }
    
    if (api.description) {
      parts.push(`API: ${api.description}`);
    }
    
    return parts.join(' - ');
  }

  /**
   * Genera el esquema de parámetros para un endpoint.
   */
  private generateParametersSchema(endpoint: DynamicEndpoint): GeneratedTool['parameters'] {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        properties[param.name] = {
          type: this.parameterTypeToJsonSchema(param.type),
          description: param.description || `Parameter: ${param.name}`,
        };

        if (param.defaultValue !== undefined) {
          properties[param.name].default = param.defaultValue;
        }

        if (param.required) {
          required.push(param.name);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  /**
   * Genera un tool a partir de un endpoint de API.
   * 
   * @param api Configuración de la API
   * @param endpoint Endpoint a convertir en tool
   * @returns Tool generado
   */
  generateToolFromEndpoint(
    api: DynamicAPIConfig,
    endpoint: DynamicEndpoint
  ): GeneratedTool {
    const name = this.generateToolName(api.id, endpoint.name);
    const description = this.generateToolDescription(api, endpoint);
    const parameters = this.generateParametersSchema(endpoint);

    const tool: GeneratedTool = {
      name,
      description,
      parameters,
      metadata: {
        apiId: api.id,
        endpointName: endpoint.name,
        method: endpoint.method,
        path: endpoint.path,
      },
    };

    logger.debug(`Generated tool: ${name}`, { endpoint: endpoint.name });

    return tool;
  }

  /**
   * Genera todos los tools para una API.
   * 
   * @param api Configuración de la API
   * @returns Array de tools generados
   */
  generateToolsFromAPI(api: DynamicAPIConfig): GeneratedTool[] {
    if (!api.enabled) {
      logger.debug(`Skipping disabled API: ${api.id}`);
      return [];
    }

    const tools: GeneratedTool[] = [];

    for (const endpoint of api.endpoints) {
      try {
        const tool = this.generateToolFromEndpoint(api, endpoint);
        tools.push(tool);
      } catch (error) {
        logger.error(`Failed to generate tool for endpoint ${endpoint.name}:`, error);
      }
    }

    logger.info(`Generated ${tools.length} tools for API: ${api.id}`);

    return tools;
  }

  /**
   * Genera tools para múltiples APIs.
   * 
   * @param apis Array de configuraciones de API
   * @returns Array de todos los tools generados
   */
  generateToolsFromAPIs(apis: DynamicAPIConfig[]): GeneratedTool[] {
    const allTools: GeneratedTool[] = [];

    for (const api of apis) {
      const tools = this.generateToolsFromAPI(api);
      allTools.push(...tools);
    }

    logger.info(`Generated ${allTools.length} tools from ${apis.length} APIs`);

    return allTools;
  }

  /**
   * Valida que un tool generado no tenga conflictos de nombre.
   * 
   * @param tools Array de tools a validar
   * @returns Array de nombres duplicados (vacío si no hay conflictos)
   */
  validateToolNames(tools: GeneratedTool[]): string[] {
    const names = new Map<string, number>();
    const duplicates: string[] = [];

    for (const tool of tools) {
      const count = names.get(tool.name) || 0;
      names.set(tool.name, count + 1);

      if (count === 1) {
        duplicates.push(tool.name);
      }
    }

    if (duplicates.length > 0) {
      logger.warn(`Found duplicate tool names: ${duplicates.join(', ')}`);
    }

    return duplicates;
  }
}

/**
 * Instancia singleton del generador de tools.
 */
export const toolGenerator = new ToolGenerator();
