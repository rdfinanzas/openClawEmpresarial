/**
 * Utilidades criptográficas para el panel de administración
 * 
 * - Generación de códigos seguros
 * - Hashing de passwords con bcrypt
 * - Generación de tokens
 */

import { randomBytes } from "node:crypto";

/**
 * Genera un código numérico seguro para 2FA
 * @param length Longitud del código (default: 6)
 * @returns Código numérico como string
 */
export function generateSecureCode(length: number = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  
  for (let i = 0; i < length; i++) {
    // Usar solo dígitos 0-9
    code += (bytes[i] % 10).toString();
  }
  
  return code;
}

/**
 * Genera un token aleatorio seguro
 * @param bytes Número de bytes (default: 32)
 * @returns Token en formato hex
 */
export function generateSecureToken(bytes: number = 32): string {
  return randomBytes(bytes).toString("hex");
}

/**
 * Importa bcrypt dinámicamente si está disponible
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBcrypt(): Promise<any> {
  // @ts-ignore - bcrypt es opcional
  const bcrypt = await import("bcrypt").catch(() => null);
  if (!bcrypt) {
    throw new Error("bcrypt not available. Install with: npm install bcrypt");
  }
  return bcrypt;
}

/**
 * Hash de password usando bcrypt (si está disponible)
 * @param password Password en texto plano
 * @returns Hash del password
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await getBcrypt();
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verifica un password contra su hash
 * @param password Password en texto plano
 * @param hash Hash almacenado
 * @returns true si coincide
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await getBcrypt();
  return bcrypt.compare(password, hash);
}

/**
 * Genera un token temporal para el flujo de 2FA
 * @returns Token temporal de 64 caracteres hex
 */
export function generateTempToken(): string {
  return generateSecureToken(32);
}

/**
 * Genera un session token para el admin panel
 * @returns Session token
 */
export function generateSessionToken(): string {
  return `sess_${generateSecureToken(32)}`;
}
