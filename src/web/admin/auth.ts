/**
 * Sistema de autenticación del panel de administración.
 *
 * Implementa autenticación de doble factor:
 * 1. Paso 1: Username + Password -> Token temporal
 * 2. Paso 2: Token temporal + Código Telegram -> Sesión
 *
 * Además, proporciona rate limiting para prevenir ataques de fuerza bruta.
 */

import type { IncomingMessage } from "node:http";
import { getHeader } from "../../gateway/http-utils.js";
import { resolveGatewayClientIp } from "../../gateway/net.js";
import { logWarn } from "../../logger.js";
import {
  hasAdminAccount,
  createAdminAccount,
  verifyCredentials,
  createTempToken,
  verifyTempCode,
  createSession,
  verifySession,
  invalidateSession,
  TEMP_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} from "./auth-storage.js";
import type { AdminSession, AdminLoginPayload, AdminVerifyPayload } from "./types.js";
import {
  sendVerificationCodeToTelegram,
  canSendTelegramVerification,
} from "./admin-verification.js";

// Logger para el módulo de auth
function logAuth(message: string, meta?: Record<string, unknown>) {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`admin-auth: ${message}${metaStr}`);
}

/**
 * Rate limiter simple en memoria para intentos de login
 */
class LoginRateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutos

  /**
   * Verifica si una IP puede intentar login
   */
  canAttempt(ip: string): boolean {
    this.cleanup();
    const data = this.attempts.get(ip);
    if (!data) return true;
    if (Date.now() > data.resetAt) return true;
    return data.count < this.maxAttempts;
  }

  /**
   * Registra un intento de login (exitoso o fallido)
   */
  recordAttempt(ip: string, success: boolean): void {
    this.cleanup();

    if (success) {
      // Limpiar intentos fallidos en login exitoso
      this.attempts.delete(ip);
      return;
    }

    const data = this.attempts.get(ip);
    const now = Date.now();

    if (!data || now > data.resetAt) {
      // Nueva ventana
      this.attempts.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
    } else {
      // Incrementar contador
      data.count++;
    }
  }

  /**
   * Obtiene tiempo restante de bloqueo
   */
  getTimeToReset(ip: string): number {
    const data = this.attempts.get(ip);
    if (!data) return 0;
    return Math.max(0, data.resetAt - Date.now());
  }

  /**
   * Limpia entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, data] of this.attempts.entries()) {
      if (now > data.resetAt) {
        this.attempts.delete(ip);
      }
    }
  }
}

// Instancia singleton del rate limiter
const rateLimiter = new LoginRateLimiter();

/**
 * Extrae la IP del cliente de una request
 */
function extractClientIp(
  req: IncomingMessage,
  trustedProxies: string[] = []
): string {
  const forwardedFor = getHeader(req, "x-forwarded-for");
  const realIp = getHeader(req, "x-real-ip");

  return (
    resolveGatewayClientIp({
      remoteAddr: req.socket?.remoteAddress ?? "",
      forwardedFor,
      realIp,
      trustedProxies,
    }) || "unknown"
  );
}

/**
 * Resultado de autenticación
 */
export type AuthResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode: number };

/**
 * Paso 1: Autenticación con username/password
 *
 * Retorna un token temporal que debe ser verificado con 2FA
 */
export async function loginWithPassword(
  req: IncomingMessage,
  payload: AdminLoginPayload,
  trustedProxies: string[] = []
): Promise<AuthResult<{ tempToken: string; message: string }>> {
  const clientIp = extractClientIp(req, trustedProxies);

  // Verificar rate limiting
  if (!rateLimiter.canAttempt(clientIp)) {
    const secondsToReset = Math.ceil(rateLimiter.getTimeToReset(clientIp) / 1000);
    logAuth("rate limit exceeded", { ip: clientIp });
    return {
      ok: false,
      error: `Too many attempts. Try again in ${secondsToReset} seconds.`,
      statusCode: 429,
    };
  }

  // Verificar que exista cuenta admin
  const hasAccount = await hasAdminAccount();
  if (!hasAccount) {
    // Auto-crear cuenta con credenciales proporcionadas (solo primera vez)
    if (!payload.username || !payload.password) {
      return {
        ok: false,
        error: "Admin account not configured. Provide username and password to create.",
        statusCode: 400,
      };
    }

    const result = await createAdminAccount(payload.username, payload.password);
    if (!result.ok) {
      rateLimiter.recordAttempt(clientIp, false);
      return { ok: false, error: result.error, statusCode: 400 };
    }

    logAuth("admin account auto-created", { username: payload.username });
  } else {
    // Verificar credenciales
    const valid = await verifyCredentials(payload.username, payload.password);
    if (!valid) {
      rateLimiter.recordAttempt(clientIp, false);
      logAuth("invalid login attempt", { ip: clientIp, username: payload.username });
      return {
        ok: false,
        error: "Invalid username or password",
        statusCode: 401,
      };
    }
  }

  // Generar token temporal
  const { token: tempToken, code } = await createTempToken(payload.username);

  // Enviar código a Telegram del superadmin
  const telegramCheck = canSendTelegramVerification();
  let telegramSent = false;
  let telegramError: string | undefined;

  if (telegramCheck.canSend) {
    const result = await sendVerificationCodeToTelegram(code);
    telegramSent = result.ok;
    if (!result.ok) {
      telegramError = result.error;
      logAuth("failed to send telegram code", { error: result.error });
    }
  } else {
    telegramError = telegramCheck.reason;
    logAuth("cannot send telegram code", { reason: telegramCheck.reason });
  }

  // En desarrollo, siempre mostrar el código
  // En producción, solo mostrar si no se pudo enviar por Telegram
  const isDev = process.env.NODE_ENV !== "production";
  const showCode = isDev || !telegramSent;

  rateLimiter.recordAttempt(clientIp, true);
  logAuth("login step 1 successful", {
    username: payload.username,
    ip: clientIp,
    telegramSent,
  });

  if (!telegramSent && !isDev) {
    // En producción sin Telegram configurado, mostrar error
    return {
      ok: false,
      error: `Cannot send verification code: ${telegramError || "Telegram not configured"}`,
      statusCode: 500,
    };
  }

  return {
    ok: true,
    data: {
      tempToken,
      message: telegramSent
        ? "Verification code sent to Telegram"
        : `Verification code: ${code}`,
      // Incluir código solo en desarrollo o si falló el envío
      ...(showCode && { debugCode: code }),
    },
  };
}

/**
 * Paso 2: Verificación de código 2FA
 *
 * Verifica el código y crea una sesión permanente
 */
export async function verifyTelegramCode(
  req: IncomingMessage,
  payload: AdminVerifyPayload,
  trustedProxies: string[] = []
): Promise<AuthResult<{ sessionToken: string; expiresAt: number; message: string }>> {
  const clientIp = extractClientIp(req, trustedProxies);

  if (!payload.tempToken || !payload.code) {
    return {
      ok: false,
      error: "tempToken and code are required",
      statusCode: 400,
    };
  }

  // Verificar código
  const username = await verifyTempCode(payload.tempToken, payload.code);
  if (!username) {
    logAuth("invalid 2fa code", { ip: clientIp });
    return {
      ok: false,
      error: "Invalid or expired verification code",
      statusCode: 401,
    };
  }

  // Crear sesión
  const userAgent = getHeader(req, "user-agent");
  const session = await createSession(username, clientIp, userAgent);

  logAuth("login step 2 successful", { username, ip: clientIp, sessionToken: session.token.slice(0, 8) + "..." });

  return {
    ok: true,
    data: {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      message: "Authentication successful",
    },
  };
}

/**
 * Valida una sesión existente
 */
export async function validateSession(
  sessionToken: string | undefined
): Promise<AdminSession | null> {
  if (!sessionToken) {
    return null;
  }
  return verifySession(sessionToken);
}

/**
 * Cierra una sesión (logout)
 */
export async function logout(sessionToken: string): Promise<void> {
  await invalidateSession(sessionToken);
  logAuth("session invalidated", { sessionToken: sessionToken.slice(0, 8) + "..." });
}

/**
 * Obtiene información de la sesión actual
 */
export async function getSessionInfo(
  sessionToken: string | undefined
): Promise<{ valid: boolean; session?: AdminSession; expiresIn?: number }> {
  if (!sessionToken) {
    return { valid: false };
  }

  const session = await verifySession(sessionToken);
  if (!session) {
    return { valid: false };
  }

  return {
    valid: true,
    session,
    expiresIn: Math.floor((session.expiresAt - Date.now()) / 1000),
  };
}

// Exportar configuraciones
export { TEMP_TOKEN_TTL_MS, SESSION_TTL_MS, hasAdminAccount };
