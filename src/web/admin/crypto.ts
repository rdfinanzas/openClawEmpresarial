/**
 * Funciones criptograficas para el panel de administracion
 */

import { randomBytes, pbkdf2 } from "node:crypto";

const BCRYPT_ROUNDS = 12;

/**
 * Simple password hashing using PBKDF2 (bcrypt replacement)
 * Format: $pbkdf2$rounds$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");

  const hash = await new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, 2 ** BCRYPT_ROUNDS, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return `$pbkdf2$${BCRYPT_ROUNDS}$${salt}$${hash.toString("base64url")}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith("$pbkdf2$")) {
    // Legacy format or invalid
    return false;
  }

  const parts = hash.split("$");
  if (parts.length !== 5) return false;

  const [, , roundsStr, salt, storedHash] = parts;
  if (!roundsStr || !salt || !storedHash) return false;

  const rounds = parseInt(roundsStr, 10);

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, 2 ** rounds, 64, "sha512", (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  const computedHash = derivedKey.toString("base64url");
  return computedHash === storedHash;
}

/**
 * Generate a secure numeric code of specified length
 */
export function generateSecureCode(length: number): string {
  const digits = "0123456789";
  let code = "";
  const bytes = randomBytes(length);

  for (let i = 0; i < length; i++) {
    code += digits[bytes[i]! % 10];
  }

  return code;
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number): string {
  return randomBytes(length).toString("base64url");
}
