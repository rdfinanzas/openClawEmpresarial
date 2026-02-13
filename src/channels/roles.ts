import { ChannelRole, SENSITIVE_OPERATIONS, SensitiveOperation } from './channel-roles.js';

/**
 * Obtiene el rol asignado a un canal específico.
 * 
 * Por defecto:
 * - 'telegram' -> 'superadmin'
 * - Otros -> 'public'
 * 
 * @param channelId Identificador del canal (ej: 'telegram', 'whatsapp')
 * @returns El rol asignado al canal
 */
export function getChannelRole(channelId: string): ChannelRole {
  // Normalizar channelId a minúsculas para comparación segura
  const id = channelId.toLowerCase();
  
  if (id === 'telegram') {
    return 'superadmin';
  }
  
  return 'public';
}

/**
 * Lista de operaciones prohibidas explícitamente para el rol público.
 * El resto de operaciones se asumen permitidas o neutrales, a menos que requieran
 * permisos específicos manejados en otra capa.
 */
const PUBLIC_FORBIDDEN_OPERATIONS: Set<SensitiveOperation> = new Set([
  SENSITIVE_OPERATIONS.FILE_DELETE,
  SENSITIVE_OPERATIONS.FILE_WRITE,
  SENSITIVE_OPERATIONS.SYSTEM_EXEC,
  SENSITIVE_OPERATIONS.CONFIG_WRITE,
  SENSITIVE_OPERATIONS.USER_DATA_ACCESS,
  SENSITIVE_OPERATIONS.ROOT_ACCESS,
]);

/**
 * Verifica si una operación sensible está permitida para un rol dado.
 * 
 * - 'superadmin': Tiene permiso total (siempre true).
 * - 'public': Tiene permiso denegado para operaciones en la lista negra.
 * 
 * @param role El rol del canal/usuario
 * @param operation La operación sensible a validar
 * @returns true si la operación está permitida, false si está prohibida
 */
export function isOperationAllowed(role: ChannelRole, operation: SensitiveOperation | string): boolean {
  if (role === 'superadmin') {
    return true; // Superadmin puede hacer todo
  }

  // Si es un rol público, verificar contra la lista negra
  if (PUBLIC_FORBIDDEN_OPERATIONS.has(operation as SensitiveOperation)) {
    return false;
  }

  return true;
}
