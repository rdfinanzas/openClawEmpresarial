/**
 * Sistema de Autorización Root para operaciones críticas
 * 
 * Etapa 21: Root Authorization
 * 
 * Requiere aprobación explícita del superadmin vía Telegram
 * para operaciones sensibles como:
 * - Eliminación de archivos
 * - Modificación de configuración
 * - Reinicio del sistema
 */

import { generateSecureCode, generateSecureToken } from "../web/admin/crypto.js";

/**
 * Estado de una solicitud de autorización root
 */
export interface RootAuthRequest {
  id: string;
  operation: string;
  description: string;
  requesterId: string;
  requesterChannel: string;
  status: "pending" | "approved" | "denied" | "expired";
  createdAt: number;
  expiresAt: number;
  approvedAt?: number;
  approvedBy?: string;
  verificationCode?: string;
}

// Store en memoria para solicitudes activas
const activeRequests = new Map<string, RootAuthRequest>();

/**
 * Configuración para root authorization
 */
interface RootAuthConfig {
  superadmin?: {
    rootAuth?: {
      enabled?: boolean;
      criticalOperations?: string[];
      requestExpiryMinutes?: number;
    };
    telegramUserId?: number;
  };
}

/**
 * Crea una nueva solicitud de autorización root
 */
export function createRootAuthRequest(
  operation: string,
  description: string,
  requesterId: string,
  requesterChannel: string,
  config: RootAuthConfig
): RootAuthRequest {
  const expiryMinutes = config.superadmin?.rootAuth?.requestExpiryMinutes ?? 10;
  const id = `root_${Date.now()}_${generateSecureToken(8)}`;
  
  const request: RootAuthRequest = {
    id,
    operation,
    description,
    requesterId,
    requesterChannel,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + expiryMinutes * 60 * 1000,
    verificationCode: generateSecureCode(6),
  };
  
  activeRequests.set(id, request);
  return request;
}

/**
 * Aprueba una solicitud de autorización root
 * 
 * @param requestId ID de la solicitud
 * @param config Configuración de root auth
 * @param approvedBy ID del aprobador (debe coincidir con telegramUserId configurado)
 * @param verificationCode Código de verificación (debe coincidir con el generado)
 * @returns true si se aprobó correctamente
 */
export function approveRootAuthRequest(
  requestId: string,
  config: RootAuthConfig,
  approvedBy: string,
  verificationCode?: string
): boolean {
  const request = activeRequests.get(requestId);
  if (!request) return false;
  if (request.status !== "pending") return false;
  if (Date.now() > request.expiresAt) {
    request.status = "expired";
    return false;
  }
  
  // Verificar que el aprobador sea el superadmin configurado
  const superadminUserId = config.superadmin?.telegramUserId?.toString();
  if (!superadminUserId) {
    return false;
  }
  
  if (approvedBy !== superadminUserId) {
    return false;
  }
  
  // Verificar código si se proporcionó
  if (verificationCode && request.verificationCode !== verificationCode) {
    return false;
  }
  
  request.status = "approved";
  request.approvedAt = Date.now();
  request.approvedBy = approvedBy;
  return true;
}

/**
 * Rechaza una solicitud de autorización root
 */
export function denyRootAuthRequest(requestId: string): boolean {
  const request = activeRequests.get(requestId);
  if (!request) return false;
  if (request.status !== "pending") return false;
  
  request.status = "denied";
  return true;
}

/**
 * Verifica si una operación requiere autorización root
 */
export function requiresRootAuth(
  operation: string,
  config: RootAuthConfig
): boolean {
  if (!config.superadmin?.rootAuth?.enabled) return false;
  
  const criticalOps = config.superadmin.rootAuth.criticalOperations ?? [];
  return criticalOps.includes(operation) || 
         criticalOps.some(op => operation.startsWith(op.replace('_*', '_')));
}

/**
 * Verifica si se puede realizar una operación
 */
export function canPerformOperation(
  operation: string,
  _requesterId: string,
  config: RootAuthConfig
): boolean {
  // Si no requiere root auth, permitir
  if (!requiresRootAuth(operation, config)) return true;
  
  // Si requiere root auth, verificar que haya una solicitud aprobada
  // (en implementación real, se verificaría el contexto de la solicitud)
  return false;
}

/**
 * Obtiene una solicitud por ID
 */
export function getRootAuthRequest(requestId: string): RootAuthRequest | undefined {
  return activeRequests.get(requestId);
}

/**
 * Limpia solicitudes expiradas
 */
export function cleanupExpiredRequests(): number {
  let count = 0;
  const now = Date.now();
  
  for (const [id, request] of activeRequests.entries()) {
    if (now > request.expiresAt && request.status === "pending") {
      request.status = "expired";
      count++;
    }
  }
  
  return count;
}

/**
 * Obtiene todas las solicitudes activas
 */
export function getActiveRequests(): RootAuthRequest[] {
  return Array.from(activeRequests.values()).filter(
    r => r.status === "pending" && Date.now() < r.expiresAt
  );
}
