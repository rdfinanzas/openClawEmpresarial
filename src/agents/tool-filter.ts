import type { ChannelRole } from '../channels/channel-roles.js';

/**
 * Filtro de acceso a herramientas basado en el rol del canal.
 * 
 * Para el rol 'public', se usa una whitelist estricta.
 * Para el rol 'superadmin', se permite acceso a todas las herramientas.
 */
export class ToolAccessFilter {
  /**
   * Herramientas PROHIBIDAS explícitamente para el rol público.
   * Estas son operaciones peligrosas que nunca deben estar disponibles para usuarios públicos.
   */
  private readonly publicForbiddenTools: string[] = [
    'bash',
    'run_command',
    'file_delete',
    'file_write',
    'write_to_file',
    'replace_file_content',
    'multi_replace_file_content',
    'browser',
    'browser_subagent',
    'system_*',
    'config_*',
    'command_*',
  ];

  /**
   * Herramientas PERMITIDAS para el rol público (whitelist).
   * Solo estas herramientas estarán disponibles para usuarios públicos.
   * 
   * NOTA: Para entornos empresariales, solo APIs configuradas.
   * NO se permite búsqueda web general.
   */
  private readonly publicAllowedTools: string[] = [
    // APIs empresariales configuradas (stock, pedidos, citas, etc.)
    'enterprise_*',
    'api_*',
    // Herramientas de solo lectura específicas
    'view_catalog',
    'view_inventory',
    'check_stock',
    'get_price',
    'create_order',
    'check_order_status',
    'view_appointment',
  ];

  /**
   * Verifica si un nombre de herramienta coincide con un patrón.
   * Soporta wildcards con asterisco (*).
   * 
   * @param toolName Nombre de la herramienta a verificar
   * @param pattern Patrón a comparar (puede contener *)
   * @returns true si coincide, false en caso contrario
   */
  private matchPattern(toolName: string, pattern: string): boolean {
    // Si no hay wildcard, comparación exacta
    if (!pattern.includes('*')) {
      return toolName === pattern;
    }

    // Convertir patrón con wildcard a regex
    // Escapar caracteres especiales de regex excepto *
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(toolName);
  }

  /**
   * Herramientas adicionales para rol de SOPORTE (support).
   * Puede crear tickets, consultar FAQs, escalar casos.
   */
  private readonly supportAllowedTools: string[] = [
    ...this.publicAllowedTools,
    'create_ticket',
    'update_ticket',
    'view_ticket',
    'search_faq',
    'escalate_to_dev',
    'log_bug_report',
  ];

  /**
   * Herramientas adicionales para rol de COMPRAS (purchasing).
   * Puede gestionar proveedores y órdenes de compra.
   */
  private readonly purchasingAllowedTools: string[] = [
    ...this.publicAllowedTools,
    'supplier_*',
    'create_purchase_order',
    'check_supplier_status',
    'contact_supplier',
    'update_inventory',
  ];

  /**
   * Verifica si una herramienta puede ser usada por un rol específico.
   * 
   * @param role Rol del canal ('superadmin', 'public', 'support', 'purchasing')
   * @param toolName Nombre de la herramienta
   * @returns true si la herramienta está permitida, false si está prohibida
   */
  canUseTool(role: ChannelRole, toolName: string): boolean {
    // Superadmin tiene acceso completo a todas las herramientas
    if (role === 'superadmin') {
      return true;
    }

    // Seleccionar lista de herramientas permitidas según rol
    let allowedTools: string[];
    switch (role) {
      case 'support':
        allowedTools = this.supportAllowedTools;
        break;
      case 'purchasing':
        allowedTools = this.purchasingAllowedTools;
        break;
      case 'public':
      default:
        allowedTools = this.publicAllowedTools;
        break;
    }

    // Primero verificar contra la blacklist (aplica a todos los roles públicos)
    const isForbidden = this.publicForbiddenTools.some(pattern =>
      this.matchPattern(toolName, pattern)
    );
    
    if (isForbidden) {
      return false;
    }

    // Luego verificar contra la whitelist del rol específico
    const isAllowed = allowedTools.some(pattern =>
      this.matchPattern(toolName, pattern)
    );

    return isAllowed;
  }

  /**
   * Filtra una lista de herramientas según el rol del canal.
   * 
   * @param role Rol del canal
   * @param availableTools Lista de herramientas disponibles
   * @returns Lista filtrada de herramientas permitidas para el rol
   */
  filterToolsForRole<T extends { name: string }>(
    role: ChannelRole,
    availableTools: T[]
  ): T[] {
    // Superadmin obtiene todas las herramientas sin filtrar
    if (role === 'superadmin') {
      return availableTools;
    }

    // Filtrar herramientas para público
    return availableTools.filter(tool =>
      this.canUseTool(role, tool.name)
    );
  }

  /**
   * Obtiene la lista de herramientas permitidas para un rol.
   * Útil para debugging y logging.
   * 
   * @param role Rol del canal
   * @returns Array de patrones de herramientas permitidas
   */
  getAllowedToolPatterns(role: ChannelRole): string[] {
    if (role === 'superadmin') {
      return ['*']; // Todas las herramientas
    }
    return [...this.publicAllowedTools];
  }

  /**
   * Obtiene la lista de herramientas prohibidas para un rol.
   * Útil para debugging y logging.
   * 
   * @param role Rol del canal
   * @returns Array de patrones de herramientas prohibidas
   */
  getForbiddenToolPatterns(role: ChannelRole): string[] {
    if (role === 'superadmin') {
      return []; // Ninguna herramienta prohibida
    }
    return [...this.publicForbiddenTools];
  }
}

/**
 * Instancia singleton del filtro de herramientas.
 * Puede ser usada en toda la aplicación.
 */
export const toolAccessFilter = new ToolAccessFilter();
