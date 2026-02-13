
/**
 * Roles disponibles para los diferentes canales de comunicación.
 * 
 * - 'superadmin': Acceso total (Telegram del dueño).
 * - 'public': Acceso básico restringido (ventas, atención general).
 * - 'support': Acceso para soporte técnico (tickets, FAQs, escalación).
 * - 'purchasing': Acceso para compras (proveedores, órdenes, stock).
 * - 'internal': Acceso interno para empleados (más permisos que público).
 */
export type ChannelRole = 'superadmin' | 'public' | 'support' | 'purchasing' | 'internal';

/**
 * Constantes para configuración de roles por defecto
 */
export const DEFAULT_CHANNEL_ROLES: Record<string, ChannelRole> = {
  'telegram': 'superadmin',
  'whatsapp': 'public',
  'discord': 'public',
  'slack': 'internal',
  'signal': 'public',
  'web': 'public',
};

/**
 * Operaciones sensibles que pueden ser restringidas por rol
 */
export const SENSITIVE_OPERATIONS = {
  FILE_DELETE: 'file_delete',
  FILE_WRITE: 'file_write',
  SYSTEM_EXEC: 'system_exec',
  CONFIG_WRITE: 'config_write',
  USER_DATA_ACCESS: 'user_data_access',
  ROOT_ACCESS: 'root_access',
} as const;

export type SensitiveOperation = typeof SENSITIVE_OPERATIONS[keyof typeof SENSITIVE_OPERATIONS];
