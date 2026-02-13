/**
 * Middleware de autenticación para el panel de administración.
 *
 * Etapa 17: Middleware de Autenticación Admin
 *
 * Proporciona:
 * - Rate limiting en endpoints admin
 * - Validación de sesiones
 * - Logging de accesos
 * - Protección de rutas sensibles
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { getHeader } from "../../gateway/http-utils.js";
import { resolveGatewayClientIp } from "../../gateway/net.js";
import { logWarn } from "../../logger.js";
import { validateSession } from "./auth.js";
import type { AdminSession } from "./types.js";

// Logger específico para middleware
function logMiddleware(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  const prefix = "admin-middleware:";
  if (level === "error") {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    logWarn(`${prefix} ${message}${metaStr}`);
  } else if (level === "warn") {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    logWarn(`${prefix} ${message}${metaStr}`);
  } else {
    // En producción podría ser logInfo, por ahora usamos logWarn
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    logWarn(`${prefix} ${message}${metaStr}`);
  }
}

/**
 * Rate limiter para endpoints de administración
 */
class AdminRateLimiter {
  private requests = new Map<
    string,
    { count: number; resetAt: number; blocked: boolean }
  >();

  constructor(
    private readonly maxRequests: number = 100,
    private readonly windowMs: number = 60 * 1000, // 1 minuto
    private readonly blockDurationMs: number = 15 * 60 * 1000 // 15 minutos
  ) {}

  /**
   * Verifica si una IP puede hacer la request
   */
  canProceed(ip: string): { allowed: boolean; retryAfter?: number } {
    this.cleanup();

    const data = this.requests.get(ip);
    const now = Date.now();

    if (!data) {
      return { allowed: true };
    }

    // Si está bloqueado
    if (data.blocked) {
      if (now < data.resetAt) {
        return { allowed: false, retryAfter: Math.ceil((data.resetAt - now) / 1000) };
      }
      // Desbloquear
      data.blocked = false;
      data.count = 0;
      data.resetAt = now + this.windowMs;
    }

    return { allowed: true };
  }

  /**
   * Registra una request
   */
  recordRequest(ip: string, isBlocked: boolean): void {
    this.cleanup();

    const data = this.requests.get(ip);
    const now = Date.now();

    if (!data) {
      this.requests.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
        blocked: isBlocked && this.maxRequests <= 1,
      });
      return;
    }

    data.count++;

    if (data.count >= this.maxRequests) {
      data.blocked = true;
      data.resetAt = now + this.blockDurationMs;
      logMiddleware("warn", "IP rate limited", { ip, count: data.count });
    }
  }

  /**
   * Limpia entradas expiradas
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, data] of this.requests.entries()) {
      if (now > data.resetAt && !data.blocked) {
        this.requests.delete(ip);
      }
    }
  }
}

// Rate limiters por tipo de endpoint
const strictRateLimiter = new AdminRateLimiter(10, 60 * 1000, 30 * 60 * 1000); // 10 req/min, 30min block
const standardRateLimiter = new AdminRateLimiter(100, 60 * 1000, 15 * 60 * 1000); // 100 req/min, 15min block

/**
 * Opciones para el middleware de autenticación
 */
export interface AuthMiddlewareOptions {
  trustedProxies?: string[];
  requireAuth?: boolean;
  rateLimit?: "strict" | "standard" | "none";
}

/**
 * Contexto de autenticación agregado a la request
 */
export interface AuthContext {
  session: AdminSession;
  clientIp: string;
  userAgent?: string;
}

// Symbol para guardar el contexto en la request
export const AUTH_CONTEXT_SYMBOL = Symbol("adminAuthContext");

// Extendemos IncomingMessage para incluir authContext
declare module "node:http" {
  interface IncomingMessage {
    [AUTH_CONTEXT_SYMBOL]?: AuthContext;
  }
}

/**
 * Extrae la IP del cliente
 */
export function extractClientIp(
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
 * Extrae el session token del header Authorization
 */
export function extractBearerToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;

  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }

  return undefined;
}

/**
 * Middleware de autenticación para el panel admin.
 *
 * Uso:
 * ```typescript
 * const result = await requireAdminAuth(req, res, { requireAuth: true });
 * if (!result.ok) return; // Ya se envió respuesta de error
 *
 * // Acceder a la sesión
 * const { session } = req[AUTH_CONTEXT_SYMBOL]!;
 * ```
 */
export async function requireAdminAuth(
  req: IncomingMessage,
  res: ServerResponse,
  options: AuthMiddlewareOptions = {}
): Promise<{ ok: true } | { ok: false }> {
  const { trustedProxies = [], requireAuth = true, rateLimit = "standard" } = options;

  const clientIp = extractClientIp(req, trustedProxies);
  const userAgent = getHeader(req, "user-agent");

  // Aplicar rate limiting
  if (rateLimit !== "none") {
    const limiter = rateLimit === "strict" ? strictRateLimiter : standardRateLimiter;
    const rateCheck = limiter.canProceed(clientIp);

    if (!rateCheck.allowed) {
      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Retry-After", String(rateCheck.retryAfter ?? 60));
      res.end(
        JSON.stringify({
          ok: false,
          error: "Rate limit exceeded",
          retryAfter: rateCheck.retryAfter,
        })
      );
      return { ok: false };
    }

    limiter.recordRequest(clientIp, false);
  }

  // Si no requiere auth, solo agregar IP y continuar
  if (!requireAuth) {
    req[AUTH_CONTEXT_SYMBOL] = {
      session: null as unknown as AdminSession, // Type hack para evitar check
      clientIp,
      userAgent,
    };
    return { ok: true };
  }

  // Extraer y validar token
  const token = extractBearerToken(req);

  if (!token) {
    logMiddleware("warn", "Missing authorization header", { ip: clientIp });
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("WWW-Authenticate", 'Bearer realm="admin"');
    res.end(JSON.stringify({ ok: false, error: "Authentication required" }));
    return { ok: false };
  }

  const session = await validateSession(token);

  if (!session) {
    logMiddleware("warn", "Invalid or expired session", { ip: clientIp });
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, error: "Invalid or expired session" }));
    return { ok: false };
  }

  // Guardar contexto en la request
  req[AUTH_CONTEXT_SYMBOL] = {
    session,
    clientIp,
    userAgent,
  };

  // Log de acceso exitoso
  logMiddleware("info", "Admin access granted", {
    ip: clientIp,
    path: req.url,
    sessionToken: session.token.slice(0, 8) + "...",
  });

  return { ok: true };
}

/**
 * Obtiene el contexto de autenticación de la request.
 * Debe llamarse después de requireAdminAuth.
 */
export function getAuthContext(req: IncomingMessage): AuthContext | undefined {
  return req[AUTH_CONTEXT_SYMBOL];
}

/**
 * Helper para enviar respuestas de error estandarizadas
 */
export function sendAuthError(
  res: ServerResponse,
  status: number,
  error: string
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, error }));
}

/**
 * Helper para enviar respuestas exitosas
 */
export function sendAuthSuccess<T>(
  res: ServerResponse,
  data: T,
  status = 200
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, data }));
}

/**
 * Verifica si la conexión es HTTPS
 * Considera headers de proxy como X-Forwarded-Proto
 */
function isSecureConnection(
  req: IncomingMessage,
  trustedProxies: string[] = []
): boolean {
  // Conexión directa HTTPS
  if ((req.socket as { encrypted?: boolean }).encrypted) {
    return true;
  }

  // Verificar header de proxy confiable
  const forwardedProto = getHeader(req, "x-forwarded-proto");
  if (forwardedProto === "https") {
    return true;
  }

  // En desarrollo, permitir HTTP
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

/**
 * Middleware de seguridad adicional:
 * - Verifica headers de seguridad
 * - Bloquea requests sospechosos
 * - Opcional: fuerza HTTPS en producción
 */
export function securityMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  trustedProxies: string[] = [],
  options: { requireHttps?: boolean } = {}
): boolean {
  const clientIp = extractClientIp(req, trustedProxies);

  // Verificar HTTPS en producción si está configurado
  if (options.requireHttps && !isSecureConnection(req, trustedProxies)) {
    logMiddleware("warn", "Blocked HTTP request in production", {
      ip: clientIp,
      url: req.url,
    });
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      ok: false,
      error: "HTTPS required in production",
    }));
    return false;
  }

  // Lista simple de User-Agents bloqueados (bots conocidos)
  const blockedUserAgents = [
    "sqlmap",
    "nikto",
    "nmap",
    "masscan",
    "zgrab",
    "gobuster",
    "dirbuster",
  ];

  const userAgent = getHeader(req, "user-agent")?.toLowerCase() || "";

  for (const blocked of blockedUserAgents) {
    if (userAgent.includes(blocked)) {
      logMiddleware("warn", "Blocked suspicious user-agent", {
        ip: clientIp,
        userAgent,
      });
      res.statusCode = 403;
      res.end();
      return false;
    }
  }

  // Agregar headers de seguridad a la respuesta
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy (CSP) - previene XSS y data injection
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  
  // HTTP Strict Transport Security (HSTS) - fuerza HTTPS
  // max-age: 1 año, includeSubDomains: aplica a subdominios
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  
  // Permissions Policy - restringe características del navegador
  res.setHeader(
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  return true;
}
