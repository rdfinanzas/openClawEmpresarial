import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'tool-error-messages' });

/**
 * Mensajes de error amigables para herramientas prohibidas.
 */
export class ToolErrorMessages {
  /**
   * Genera un mensaje de error amigable cuando una herramienta es prohibida.
   * 
   * @param toolName Nombre de la herramienta prohibida
   * @param role Rol del usuario ('public' o 'superadmin')
   * @returns Mensaje de error formateado
   */
  static getProhibitedToolMessage(toolName: string, role: string): string {
    const baseMessage = `❌ **Herramienta no disponible**: \`${toolName}\``;
    
    if (role === 'public') {
      return `${baseMessage}\n\n` +
        `Esta herramienta está restringida para usuarios públicos por razones de seguridad.\n\n` +
        `**Herramientas disponibles para tu rol:**\n` +
        `• Búsqueda web y lectura de contenido\n` +
        `• Consulta de información\n` +
        `• Análisis de datos públicos\n\n` +
        `Si necesitas acceso a funcionalidades avanzadas, contacta al administrador.`;
    }
    
    return `${baseMessage}\n\nEsta herramienta no está disponible en tu configuración actual.`;
  }

  /**
   * Genera un mensaje específico para operaciones de archivos prohibidas.
   */
  static getFileOperationDeniedMessage(operation: string): string {
    return `🔒 **Operación de archivo bloqueada**: \`${operation}\`\n\n` +
      `Las operaciones de modificación de archivos están restringidas para usuarios públicos.\n\n` +
      `**Operaciones permitidas:**\n` +
      `• Lectura de archivos públicos\n` +
      `• Búsqueda de información\n` +
      `• Consultas de solo lectura\n\n` +
      `Para operaciones de escritura o eliminación, se requiere autorización del administrador.`;
  }

  /**
   * Genera un mensaje para operaciones de configuración prohibidas.
   */
  static getConfigOperationDeniedMessage(): string {
    return `⚙️ **Operación de configuración bloqueada**\n\n` +
      `La modificación de configuración del sistema está restringida.\n\n` +
      `Solo el administrador puede realizar cambios en la configuración del sistema.\n\n` +
      `Si necesitas ajustar alguna configuración, contacta al administrador.`;
  }

  /**
   * Genera un mensaje para operaciones de sistema prohibidas.
   */
  static getSystemOperationDeniedMessage(operation: string): string {
    return `🛑 **Operación de sistema bloqueada**: \`${operation}\`\n\n` +
      `Las operaciones de sistema (reinicio, apagado, etc.) están restringidas.\n\n` +
      `Solo el administrador puede ejecutar operaciones críticas del sistema.\n\n` +
      `**Razones de seguridad:**\n` +
      `• Prevención de interrupciones no autorizadas\n` +
      `• Protección de la estabilidad del sistema\n` +
      `• Control de acceso a recursos críticos`;
  }

  /**
   * Genera un mensaje genérico con sugerencias de herramientas alternativas.
   */
  static getToolDeniedWithAlternatives(
    toolName: string,
    alternatives: string[]
  ): string {
    const altList = alternatives.map(alt => `• \`${alt}\``).join('\n');
    
    return `❌ **Herramienta no disponible**: \`${toolName}\`\n\n` +
      `**Herramientas alternativas que puedes usar:**\n${altList}\n\n` +
      `Estas herramientas ofrecen funcionalidad similar dentro de tu nivel de acceso.`;
  }

  /**
   * Registra un intento de uso de herramienta prohibida.
   */
  static logProhibitedAttempt(
    toolName: string,
    role: string,
    userId?: string
  ): void {
    logger.warn(`Prohibited tool attempt: ${toolName}`, {
      tool: toolName,
      role,
      userId: userId || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Mapeo de herramientas prohibidas a mensajes específicos.
 */
export const TOOL_ERROR_MESSAGES: Record<string, (role: string) => string> = {
  'file_delete': () => ToolErrorMessages.getFileOperationDeniedMessage('eliminación de archivos'),
  'file_write': () => ToolErrorMessages.getFileOperationDeniedMessage('escritura de archivos'),
  'config_modify': () => ToolErrorMessages.getConfigOperationDeniedMessage(),
  'system_restart': () => ToolErrorMessages.getSystemOperationDeniedMessage('reinicio del sistema'),
  'system_shutdown': () => ToolErrorMessages.getSystemOperationDeniedMessage('apagado del sistema'),
  'database_drop': () => ToolErrorMessages.getSystemOperationDeniedMessage('eliminación de base de datos'),
};

/**
 * Obtiene un mensaje de error apropiado para una herramienta prohibida.
 * 
 * @param toolName Nombre de la herramienta
 * @param role Rol del usuario
 * @returns Mensaje de error formateado
 */
export function getToolErrorMessage(toolName: string, role: string): string {
  const specificMessage = TOOL_ERROR_MESSAGES[toolName];
  
  if (specificMessage) {
    return specificMessage(role);
  }
  
  return ToolErrorMessages.getProhibitedToolMessage(toolName, role);
}
