/**
 * Almacenamiento de credenciales y sesiones para el panel de administración.
 *
 * Este módulo maneja:
 * - Almacenamiento seguro de credenciales de admin
 * - Gestión de sesiones activas
 * - Tokens temporales para 2FA
 * - Persistencia en archivo JSON (cifrado para passwords)
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { hashPassword as hashPasswordBcrypt, verifyPassword as verifyPasswordBcrypt, generateSecureCode } from "./crypto.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AdminSession } from "./types.js";

// ============================================================================
// ENCRIPTACIÓN DE ARCHIVO DE CREDENCIALES
// ============================================================================

// Clave derivada del password del admin (se configura en runtime)
let encryptionKey: Buffer | null = null;
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

/**
 * Configura la clave de encriptación para el archivo de credenciales.
 * Debe llamarse antes de usar loadStorage/saveStorage.
 * @param password Password del admin para derivar la clave
 */
export function setEncryptionPassword(password: string): void {
  // Derivar clave de 32 bytes usando scrypt
  encryptionKey = scryptSync(password, "openclaw-salt-fixed", 32);
}

/**
 * Encripta datos usando AES-256-GCM
 */
function encryptData(data: string): string {
  if (!encryptionKey) {
    // Si no hay clave configurada, guardar sin encriptar (modo legacy)
    return data;
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  // Formato: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Desencripta datos usando AES-256-GCM
 */
function decryptData(encryptedData: string): string | null {
  if (!encryptionKey) {
    // Intentar parsear como JSON plano (modo legacy)
    try {
      JSON.parse(encryptedData);
      return encryptedData; // Es JSON plano, no encriptado
    } catch {
      return null; // No es JSON y no hay clave para desencriptar
    }
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    // Formato antiguo (JSON plano)
    try {
      JSON.parse(encryptedData);
      return encryptedData;
    } catch {
      return null;
    }
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  try {
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch {
    return null;
  }
}

// Directorio de datos del admin panel
const ADMIN_DATA_DIR = join(process.env.HOME || process.env.USERPROFILE || ".", ".openclaw", "admin");
const CREDENTIALS_FILE = join(ADMIN_DATA_DIR, "credentials.json");
const SESSIONS_FILE = join(ADMIN_DATA_DIR, "sessions.json");

// Tiempo de expiración de tokens temporales (5 minutos)
export const TEMP_TOKEN_TTL_MS = 5 * 60 * 1000;
// Tiempo de expiración de sesiones (24 horas)
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Estructura de credenciales almacenadas
 */
interface StoredCredentials {
  username: string;
  // Password hasheado con bcrypt (salt incluido en el hash)
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Estructura de token temporal (2FA)
 */
interface TempToken {
  token: string;
  code: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Estructura de datos persistentes
 */
interface AuthStorageData {
  credentials: StoredCredentials | null;
  tempTokens: TempToken[];
  sessions: AdminSession[];
}

// Cache en memoria
let storageCache: AuthStorageData | null = null;
let lastLoadTime = 0;
const CACHE_TTL_MS = 5000; // 5 segundos de cache

/**
 * Inicializa el directorio de datos si no existe
 */
async function ensureDataDir(): Promise<void> {
  if (!existsSync(ADMIN_DATA_DIR)) {
    await mkdir(ADMIN_DATA_DIR, { recursive: true });
  }
}

/**
 * Carga los datos de almacenamiento (con encriptación opcional)
 */
async function loadStorage(): Promise<AuthStorageData> {
  const now = Date.now();
  if (storageCache && now - lastLoadTime < CACHE_TTL_MS) {
    return storageCache;
  }

  await ensureDataDir();

  const defaultData: AuthStorageData = {
    credentials: null,
    tempTokens: [],
    sessions: [],
  };

  try {
    const fileData = await readFile(CREDENTIALS_FILE, "utf-8");
    const decrypted = decryptData(fileData);
    
    if (decrypted === null) {
      return defaultData;
    }
    
    storageCache = JSON.parse(decrypted) as AuthStorageData;
    lastLoadTime = now;
    return storageCache;
  } catch {
    return defaultData;
  }
}

/**
 * Guarda los datos de almacenamiento (con encriptación opcional)
 */
async function saveStorage(data: AuthStorageData): Promise<void> {
  await ensureDataDir();
  storageCache = data;
  lastLoadTime = Date.now();
  
  const jsonData = JSON.stringify(data, null, 2);
  const encrypted = encryptData(jsonData);
  
  await writeFile(CREDENTIALS_FILE, encrypted, "utf-8");
}



/**
 * Genera un token aleatorio seguro
 */
function generateSecureToken(length = 32): string {
  return randomBytes(length).toString("base64url");
}



/**
 * Verifica si existe una cuenta de administrador configurada
 */
export async function hasAdminAccount(): Promise<boolean> {
  const storage = await loadStorage();
  return storage.credentials !== null;
}

/**
 * Crea la cuenta de administrador inicial
 */
export async function createAdminAccount(
  username: string,
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!username || !password) {
    return { ok: false, error: "Username and password are required" };
  }

  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  // Configurar clave de encriptación antes de cargar/guardar
  setEncryptionPassword(password);

  const storage = await loadStorage();
  if (storage.credentials) {
    return { ok: false, error: "Admin account already exists" };
  }

  const passwordHash = await hashPasswordBcrypt(password);

  storage.credentials = {
    username: username.toLowerCase().trim(),
    passwordHash,
    salt: "", // No se usa con bcrypt, pero se mantiene para compatibilidad
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveStorage(storage);
  return { ok: true };
}

/**
 * Verifica credenciales de login
 */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<boolean> {
  // Configurar clave de encriptación antes de cargar
  setEncryptionPassword(password);

  const storage = await loadStorage();
  if (!storage.credentials) {
    return false;
  }

  const creds = storage.credentials;
  if (creds.username !== username.toLowerCase().trim()) {
    return false;
  }

  return verifyPasswordBcrypt(password, creds.passwordHash);
}

/**
 * Crea un token temporal para 2FA
 */
export async function createTempToken(
  username: string
): Promise<{ token: string; code: string }> {
  const storage = await loadStorage();

  // Limpiar tokens expirados
  const now = Date.now();
  storage.tempTokens = storage.tempTokens.filter((t) => t.expiresAt > now);

  const token = generateSecureToken(24);
  const code = generateSecureCode(6);

  storage.tempTokens.push({
    token,
    code,
    username: username.toLowerCase().trim(),
    createdAt: now,
    expiresAt: now + TEMP_TOKEN_TTL_MS,
  });

  await saveStorage(storage);
  return { token, code };
}

/**
 * Verifica un código de 2FA y retorna el username si es válido
 */
export async function verifyTempCode(
  tempToken: string,
  code: string
): Promise<string | null> {
  const storage = await loadStorage();
  const now = Date.now();

  // Limpiar tokens expirados
  storage.tempTokens = storage.tempTokens.filter((t) => t.expiresAt > now);

  const tokenData = storage.tempTokens.find(
    (t) => t.token === tempToken && t.code === code
  );

  if (!tokenData) {
    await saveStorage(storage);
    return null;
  }

  // Eliminar el token usado (one-time use)
  storage.tempTokens = storage.tempTokens.filter((t) => t.token !== tempToken);
  await saveStorage(storage);

  return tokenData.username;
}

/**
 * Crea una sesión de administrador
 */
export async function createSession(
  username: string,
  ip: string,
  userAgent?: string
): Promise<AdminSession> {
  const storage = await loadStorage();
  const now = Date.now();

  // Limpiar sesiones expiradas
  storage.sessions = storage.sessions.filter((s) => s.expiresAt > now);

  const session: AdminSession = {
    token: generateSecureToken(32),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    ip,
    userAgent,
  };

  storage.sessions.push(session);
  await saveStorage(storage);
  return session;
}

/**
 * Verifica una sesión por token
 */
export async function verifySession(
  token: string
): Promise<AdminSession | null> {
  const storage = await loadStorage();
  const now = Date.now();

  // Limpiar sesiones expiradas
  storage.sessions = storage.sessions.filter((s) => s.expiresAt > now);

  const session = storage.sessions.find((s) => s.token === token);

  if (session && session.expiresAt > now) {
    // Actualizar sesiones limpias
    if (storage.sessions.length < (storageCache?.sessions.length ?? 0)) {
      await saveStorage(storage);
    }
    return session;
  }

  return null;
}

/**
 * Invalida una sesión (logout)
 */
export async function invalidateSession(token: string): Promise<void> {
  const storage = await loadStorage();
  storage.sessions = storage.sessions.filter((s) => s.token !== token);
  await saveStorage(storage);
}

/**
 * Invalida todas las sesiones (logout global)
 */
export async function invalidateAllSessions(): Promise<void> {
  const storage = await loadStorage();
  storage.sessions = [];
  await saveStorage(storage);
}

/**
 * Cambia el password del admin
 * NOTA: Re-encripta todo el archivo con el nuevo password
 */
export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  // Configurar clave con oldPassword para poder leer
  setEncryptionPassword(oldPassword);

  const storage = await loadStorage();
  if (!storage.credentials) {
    return { ok: false, error: "No admin account found" };
  }

  // Verificar old password
  const creds = storage.credentials;
  if (creds.username !== username.toLowerCase().trim()) {
    return { ok: false, error: "Invalid username" };
  }

  const valid = await verifyPasswordBcrypt(oldPassword, creds.passwordHash);
  if (!valid) {
    return { ok: false, error: "Invalid current password" };
  }

  // Actualizar password hash
  storage.credentials.passwordHash = await hashPasswordBcrypt(newPassword);
  storage.credentials.updatedAt = new Date().toISOString();

  // Invalidar todas las sesiones por seguridad
  storage.sessions = [];

  // Cambiar clave de encriptación al nuevo password y guardar
  setEncryptionPassword(newPassword);
  await saveStorage(storage);
  return { ok: true };
}
