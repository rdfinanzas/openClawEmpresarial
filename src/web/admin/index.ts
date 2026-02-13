/**
 * Panel de Administración de OpenClaw
 *
 * Este módulo proporciona una interfaz web para configurar y monitorear
 * el bot. Incluye autenticación de doble factor (password + Telegram).
 *
 * Rutas disponibles:
 * - GET  /admin          -> Redirige al login o dashboard
 * - GET  /admin/login    -> Página de login
 * - POST /admin/api/auth/login    -> Iniciar sesión (paso 1)
 * - POST /admin/api/auth/verify   -> Verificar 2FA (paso 2)
 * - POST /admin/api/auth/logout   -> Cerrar sesión
 * - GET  /admin/api/auth/session  -> Verificar sesión actual
 * - GET  /admin/api/dashboard/health -> Estado del sistema
 *
 * Etapas implementadas:
 * - ✅ 14: Estructura Base del Panel Admin
 * - ✅ 15: Sistema de Autenticación - Paso 1 (Password)
 * - ⏳ 16: Sistema de Autenticación - Paso 2 (Telegram) - parcial
 * - ⏳ 17: Middleware de Autenticación Admin
 * - ⏳ 18: UI de Login - Frontend
 * - ⏳ 19: Dashboard Principal - Backend
 * - ⏳ 20: Dashboard Principal - Frontend
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { OpenClawConfig } from "../../config/types.js";
import type {
  AdminLoginPayload,
  AdminVerifyPayload,
  GatewayHealthStatus,
  DashboardMetrics,
  AdminChatSendPayload,
  AdminConfigUpdatePayload,
} from "./types.js";
import { agentCommand } from "../../commands/agent.js";
import { loadConfig } from "../../config/config.js";
import { readConfigFileSnapshot, writeConfigFile } from "../../config/config.js";
import { logWarn } from "../../logger.js";
import {
  loginWithPassword,
  verifyTelegramCode,
  validateSession,
  logout,
  getSessionInfo,
} from "./auth.js";
import { handleDashboardRequest } from "./dashboard.js";
import { requireAdminAuth, sendAuthError, sendAuthSuccess } from "./middleware.js";
import {
  ADMIN_BASE_PATH,
  isAdminPath,
  isAdminApiPath,
  sendAdminError,
  sendAdminSuccess,
  readAdminJsonBody,
} from "./routes.js";

// Logger para el admin panel
function logAdmin(message: string, meta?: Record<string, unknown>) {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`admin-panel: ${message}${metaStr}`);
}

/**
 * Handler principal para requests del panel admin.
 * Retorna true si el request fue manejado, false en caso contrario.
 */
export async function handleAdminHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  // Solo procesar rutas del admin
  if (!isAdminPath(pathname)) {
    return false;
  }

  // Cargar config para trusted proxies
  const config = loadConfig();
  const trustedProxies = config.gateway?.trustedProxies ?? [];

  logAdmin(`${req.method} ${pathname}`);

  try {
    // Rutas de API
    if (isAdminApiPath(pathname)) {
      return await handleAdminApiRequest(req, res, pathname, trustedProxies);
    }

    // Rutas de UI (páginas)
    return await handleAdminUiRequest(req, res, pathname, trustedProxies);
  } catch (error) {
    logAdmin("Error handling request:", { error: String(error) });
    sendAdminError(res, 500, "internal server error");
    return true;
  }
}

/**
 * Extrae el session token del header Authorization
 */
function extractSessionToken(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  if (!auth) return undefined;

  // Format: "Bearer <token>"
  const parts = auth.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }

  return undefined;
}

/**
 * Maneja requests a la API del admin
 */
async function handleAdminApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  trustedProxies: string[],
): Promise<boolean> {
  const apiPath = pathname.slice(ADMIN_BASE_PATH.length);

  // POST /admin/api/auth/login
  if (apiPath === "/api/auth/login" && req.method === "POST") {
    const body = await readAdminJsonBody<AdminLoginPayload>(req);
    if (!body.ok) {
      sendAdminError(res, 400, body.error);
      return true;
    }

    const result = await loginWithPassword(req, body.data, trustedProxies);
    if (!result.ok) {
      sendAdminError(res, result.statusCode, result.error);
      return true;
    }

    sendAdminSuccess(res, result.data);
    return true;
  }

  // POST /admin/api/auth/verify
  if (apiPath === "/api/auth/verify" && req.method === "POST") {
    const body = await readAdminJsonBody<AdminVerifyPayload>(req);
    if (!body.ok) {
      sendAdminError(res, 400, body.error);
      return true;
    }

    const result = await verifyTelegramCode(req, body.data, trustedProxies);
    if (!result.ok) {
      sendAdminError(res, result.statusCode, result.error);
      return true;
    }

    sendAdminSuccess(res, result.data);
    return true;
  }

  // POST /admin/api/auth/logout
  if (apiPath === "/api/auth/logout" && req.method === "POST") {
    const token = extractSessionToken(req);
    if (token) {
      await logout(token);
    }
    sendAdminSuccess(res, { message: "Logged out successfully" });
    return true;
  }

  // GET /admin/api/auth/session
  if (apiPath === "/api/auth/session" && req.method === "GET") {
    const token = extractSessionToken(req);
    const sessionInfo = await getSessionInfo(token);
    sendAdminSuccess(res, sessionInfo);
    return true;
  }

  // Dashboard endpoints (health, metrics, channels)
  const dashboardHandled = await handleDashboardRequest(req, res, apiPath, trustedProxies);
  if (dashboardHandled) {
    return true;
  }

  // CHAT endpoints - requieren autenticación
  if (apiPath === "/api/chat/send" && req.method === "POST") {
    return handleChatSend(req, res, trustedProxies);
  }

  // CONFIG endpoints - requieren autenticación
  if (apiPath === "/api/config" && req.method === "GET") {
    return handleConfigGet(req, res, trustedProxies);
  }
  if (apiPath === "/api/config" && req.method === "POST") {
    return handleConfigUpdate(req, res, trustedProxies);
  }

  // Ruta API no encontrada
  sendAdminError(res, 404, "api endpoint not found");
  return true;
}

/**
 * POST /admin/api/chat/send
 *
 * Envía un mensaje al agente y retorna la respuesta.
 */
async function handleChatSend(
  req: IncomingMessage,
  res: ServerResponse,
  trustedProxies: string[],
): Promise<boolean> {
  // Verificar autenticación
  const authResult = await requireAdminAuth(req, res, {
    trustedProxies,
    requireAuth: true,
    rateLimit: "standard",
  });
  if (!authResult.ok) {
    return true;
  }

  // Leer body
  const body = await readAdminJsonBody<AdminChatSendPayload>(req);
  if (!body.ok) {
    sendAuthError(res, 400, body.error);
    return true;
  }

  const { message, conversationId } = body.data;
  if (!message || typeof message !== "string" || message.trim() === "") {
    sendAuthError(res, 400, "message is required");
    return true;
  }

  try {
    // Generar conversationId si no se proporciona
    const convId = conversationId || `admin-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Crear sessionKey basado en conversationId
    const sessionKey = `admin-chat:${convId}`;

    // Invocar al agente usando agentCommand
    // Usamos un agente por defecto (sin especificar agentId para usar el default)
    await agentCommand({
      message: message.trim(),
      sessionKey,
      thinking: "low", // Usar thinking level bajo para respuestas rápidas
      deliver: false, // No enviar a ningún canal, solo obtener respuesta
    });

    // Obtener la respuesta del agente
    // Como agentCommand no retorna directamente, usamos el gateway para obtener el resultado
    // Para simplificar, retornamos un mensaje de éxito
    // En una implementación completa, necesitaríamos integrarnos con el sistema de jobs del agente
    sendAuthSuccess(res, {
      response: "Message sent to agent. Use the conversation API to retrieve the response.",
      conversationId: convId,
    });
    return true;
  } catch (error) {
    logAdmin("Error sending message to agent:", { error: String(error) });
    sendAuthError(res, 500, "Failed to process message");
    return true;
  }
}

/**
 * GET /admin/api/config
 *
 * Lee la configuración actual del archivo config.json.
 */
async function handleConfigGet(
  req: IncomingMessage,
  res: ServerResponse,
  trustedProxies: string[],
): Promise<boolean> {
  // Verificar autenticación
  const authResult = await requireAdminAuth(req, res, {
    trustedProxies,
    requireAuth: true,
    rateLimit: "standard",
  });
  if (!authResult.ok) {
    return true;
  }

  try {
    const snapshot = await readConfigFileSnapshot();

    // Retornar la configuración parseada (o vacía si no existe)
    sendAuthSuccess(res, {
      config: snapshot.parsed || {},
      path: snapshot.path,
      exists: snapshot.exists,
      valid: snapshot.valid,
    });
    return true;
  } catch (error) {
    logAdmin("Error reading config:", { error: String(error) });
    sendAuthError(res, 500, "Failed to read configuration");
    return true;
  }
}

/**
 * POST /admin/api/config
 *
 * Actualiza la configuración en el archivo config.json.
 */
async function handleConfigUpdate(
  req: IncomingMessage,
  res: ServerResponse,
  trustedProxies: string[],
): Promise<boolean> {
  // Verificar autenticación
  const authResult = await requireAdminAuth(req, res, {
    trustedProxies,
    requireAuth: true,
    rateLimit: "strict", // Rate limit estricto para actualizaciones
  });
  if (!authResult.ok) {
    return true;
  }

  // Leer body
  const body = await readAdminJsonBody<AdminConfigUpdatePayload>(req);
  if (!body.ok) {
    sendAuthError(res, 400, body.error);
    return true;
  }

  const { config: newConfig } = body.data;
  if (!newConfig || typeof newConfig !== "object" || Array.isArray(newConfig)) {
    sendAuthError(res, 400, "config must be an object");
    return true;
  }

  try {
    // Validar y guardar la configuración
    await writeConfigFile(newConfig as OpenClawConfig);

    sendAuthSuccess(res, { message: "Configuration updated successfully" });
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logAdmin("Error writing config:", { error: errorMessage });
    sendAuthError(res, 400, `Failed to update configuration: ${errorMessage}`);
    return true;
  }
}

/**
 * Verifica autenticación para rutas UI protegidas
 */
async function checkUiAuth(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  // Extraer path relativo
  const relativePath = pathname === ADMIN_BASE_PATH ? "/" : pathname.slice(ADMIN_BASE_PATH.length);

  // Si es login, no requiere auth
  if (relativePath === "/login") {
    return true;
  }

  // Para todas las demás rutas, verificar sesión
  const token = extractSessionToken(req);
  const session = await validateSession(token);

  if (!session) {
    // No autenticado - redirigir a login
    res.statusCode = 302;
    res.setHeader("Location", `${ADMIN_BASE_PATH}/login?redirect=${encodeURIComponent(pathname)}`);
    res.end();
    return false;
  }

  // Autenticado - permitir acceso
  return true;
}

/**
 * Maneja requests a las páginas del admin
 * TODAS las rutas UI (excepto login) requieren autenticación
 */
async function handleAdminUiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  _trustedProxies: string[],
): Promise<boolean> {
  const relativePath = pathname === ADMIN_BASE_PATH ? "/" : pathname.slice(ADMIN_BASE_PATH.length);

  // Redirigir /admin -> /admin/login
  if (relativePath === "/") {
    res.statusCode = 302;
    res.setHeader("Location", `${ADMIN_BASE_PATH}/login`);
    res.end();
    return true;
  }

  // /admin/login - No requiere auth
  if (relativePath === "/login") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_LOGIN_LIT_HTML);
    return true;
  }

  // Verificar auth para todas las demás rutas
  const isAuthenticated = await checkUiAuth(req, res, pathname);
  if (!isAuthenticated) {
    return true; // Ya se envió redirección
  }

  // /admin/dashboard
  if (relativePath === "/dashboard" || relativePath === "/dashboard/") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_DASHBOARD_LIT_HTML);
    return true;
  }

  // /admin/chat - NUEVO
  if (relativePath === "/chat" || relativePath.startsWith("/chat/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_CHAT_LIT_HTML);
    return true;
  }

  // /admin/channels - NUEVO
  if (relativePath === "/channels" || relativePath.startsWith("/channels/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_CHANNELS_LIT_HTML);
    return true;
  }

  // /admin/config - NUEVO
  if (relativePath === "/config" || relativePath.startsWith("/config/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_CONFIG_LIT_HTML);
    return true;
  }

  // /admin/agents - NUEVO
  if (relativePath === "/agents" || relativePath.startsWith("/agents/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_AGENTS_LIT_HTML);
    return true;
  }

  // /admin/skills - NUEVO
  if (relativePath === "/skills" || relativePath.startsWith("/skills/")) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(ADMIN_SKILLS_LIT_HTML);
    return true;
  }

  // Ruta UI no encontrada
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(ADMIN_404_HTML);
  return true;
}

// HTML para página 404
const ADMIN_404_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Not Found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f7fa; }
    .container { text-align: center; padding: 40px; }
    h1 { font-size: 72px; margin: 0; color: #667eea; }
    p { color: #666; margin: 20px 0; }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Page not found</p>
    <a href="/admin/dashboard">Go to Dashboard</a>
  </div>
</body>
</html>`;

// HTML de la página de Chat (Integrado con Gateway Client)
const ADMIN_CHAT_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Chat</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    import { repeat } from 'https://unpkg.com/lit@3.3.2/directives/repeat.js?module';
    
    // Gateway Browser Client (simplificado para admin)
    class GatewayAdminClient {
      constructor(opts) {
        this.opts = opts;
        this.ws = null;
        this.pending = new Map();
        this.closed = false;
        this.backoffMs = 800;
        this.sessionToken = opts.token;
      }
      
      start() {
        this.closed = false;
        this.connect();
      }
      
      stop() {
        this.closed = true;
        this.ws?.close();
        this.ws = null;
      }
      
      get connected() {
        return this.ws?.readyState === WebSocket.OPEN;
      }
      
      connect() {
        if (this.closed) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = this.opts.url || \`\${protocol}//\${window.location.host}/gateway\`;
        this.ws = new WebSocket(wsUrl);
        this.ws.addEventListener('open', () => this.sendConnect());
        this.ws.addEventListener('message', (ev) => this.handleMessage(String(ev.data || '')));
        this.ws.addEventListener('close', () => {
          this.ws = null;
          setTimeout(() => this.connect(), this.backoffMs);
          this.backoffMs = Math.min(this.backoffMs * 1.5, 15000);
        });
      }
      
      async sendConnect() {
        const params = {
          minProtocol: 3, maxProtocol: 3,
          client: { id: 'openclaw-admin', version: '1.0.0', platform: 'web', mode: 'admin' },
          role: 'operator',
          scopes: ['operator.admin'],
          auth: { token: this.sessionToken },
          caps: []
        };
        try {
          await this.request('connect', params);
          this.backoffMs = 800;
          this.opts.onConnect?.();
        } catch (err) {
          this.opts.onError?.(String(err));
        }
      }
      
      handleMessage(raw) {
        try {
          const frame = JSON.parse(raw);
          if (frame.type === 'event') {
            this.opts.onEvent?.(frame);
          } else if (frame.type === 'res') {
            const pending = this.pending.get(frame.id);
            if (pending) {
              this.pending.delete(frame.id);
              frame.ok ? pending.resolve(frame.payload) : pending.reject(new Error(frame.error?.message || 'request failed'));
            }
          }
        } catch {}
      }
      
      request(method, params) {
        if (!this.connected) return Promise.reject(new Error('gateway not connected'));
        const id = 'req_' + Math.random().toString(36).slice(2);
        const frame = { type: 'req', id, method, params };
        return new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          this.ws.send(JSON.stringify(frame));
        });
      }
    }
    
    @customElement('admin-chat')
    class AdminChat extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s; }
        .nav a:hover, .nav a.active { opacity: 1; }
        .container { display: flex; height: calc(100vh - 60px); }
        .chat-area { flex: 1; display: flex; flex-direction: column; background: white; margin: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .chat-header { padding: 16px 20px; background: #f9f9f9; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
        .chat-header h3 { margin: 0; font-size: 16px; }
        .status { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
        .status-dot.connected { background: #4caf50; }
        .status-dot.connecting { background: #ff9800; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .message { display: flex; max-width: 80%; }
        .message.user { align-self: flex-end; }
        .message.assistant { align-self: flex-start; }
        .message.system { align-self: center; font-size: 12px; color: #666; font-style: italic; }
        .message-content { padding: 12px 16px; border-radius: 12px; word-wrap: break-word; }
        .message.user .message-content { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px; }
        .message.assistant .message-content { background: #f0f0f0; color: #333; border-bottom-left-radius: 4px; }
        .message-meta { font-size: 11px; color: #999; margin-top: 4px; }
        .input-area { padding: 16px 20px; border-top: 1px solid #e0e0e0; background: #fafafa; }
        .input-row { display: flex; gap: 12px; align-items: flex-end; }
        textarea { flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: none; min-height: 44px; max-height: 120px; font-family: inherit; font-size: 14px; }
        textarea:focus { outline: none; border-color: #667eea; }
        .btn { padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; transition: transform 0.2s, box-shadow 0.2s; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .error-banner { background: #fee; color: #c33; padding: 12px 16px; border-radius: 8px; margin: 0 20px 12px; font-size: 14px; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 40px; color: #666; }
        .spinner { width: 20px; height: 20px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .stream-indicator { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; font-size: 14px; color: #666; }
        .typing-dot { width: 6px; height: 6px; background: #999; border-radius: 50%; animation: typing 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
        .attachments { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .attachment { position: relative; width: 60px; height: 60px; border-radius: 8px; overflow: hidden; }
        .attachment img { width: 100%; height: 100%; object-fit: cover; }
        .attachment-remove { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; }
        .toolbar { display: flex; gap: 8px; margin-bottom: 8px; }
        .toolbar button { padding: 6px 12px; background: white; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 12px; }
        .toolbar button:hover { background: #f5f5f5; }
      \`;
      
      @state() messages = [];
      @state() draft = '';
      @state() connected = false;
      @state() loading = false;
      @state() sending = false;
      @state() error = '';
      @state() sessionKey = 'admin:default';
      @state() stream = '';
      @state() runId = null;
      @state() attachments = [];
      
      client = null;
      
      connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        this._initGateway();
      }
      
      disconnectedCallback() {
        super.disconnectedCallback();
        this.client?.stop();
      }
      
      _checkAuth() {
        const token = localStorage.getItem('adminSession');
        if (!token) { location.href = '/admin/login'; return false; }
        return token;
      }
      
      _initGateway() {
        const token = this._checkAuth();
        if (!token) return;
        
        this.client = new GatewayAdminClient({
          token,
          onConnect: () => { this.connected = true; this._loadHistory(); },
          onDisconnect: () => { this.connected = false; },
          onError: (err) => { this.error = String(err); },
          onEvent: (evt) => this._handleEvent(evt)
        });
        this.client.start();
      }
      
      async _loadHistory() {
        this.loading = true;
        try {
          const res = await this.client.request('chat.history', { sessionKey: this.sessionKey, limit: 100 });
          this.messages = Array.isArray(res.messages) ? res.messages : [];
        } catch (err) {
          this.error = 'Failed to load history: ' + String(err);
        } finally {
          this.loading = false;
        }
      }
      
      async _sendMessage() {
        const text = this.draft.trim();
        if (!text && !this.attachments.length) return;
        if (!this.connected) { this.error = 'Not connected to gateway'; return; }
        
        const userMsg = { role: 'user', content: [{ type: 'text', text }], timestamp: Date.now() };
        this.messages = [...this.messages, userMsg];
        this.draft = '';
        this.sending = true;
        this.runId = 'run_' + Math.random().toString(36).slice(2);
        
        try {
          await this.client.request('chat.send', {
            sessionKey: this.sessionKey,
            message: text,
            idempotencyKey: this.runId,
            deliver: false
          });
        } catch (err) {
          this.error = 'Failed to send: ' + String(err);
          this.sending = false;
        }
      }
      
      _handleEvent(evt) {
        if (evt.event === 'chat.delta') {
          const next = evt.payload?.message?.content?.[0]?.text;
          if (next) this.stream = next;
        } else if (evt.event === 'chat.final') {
          if (this.stream) {
            this.messages = [...this.messages, {
              role: 'assistant',
              content: [{ type: 'text', text: this.stream }],
              timestamp: Date.now()
            }];
          }
          this.stream = '';
          this.runId = null;
          this.sending = false;
        } else if (evt.event === 'chat.error') {
          this.error = evt.payload?.errorMessage || 'Chat error';
          this.sending = false;
        }
      }
      
      async _abort() {
        if (this.runId) {
          try {
            await this.client.request('chat.abort', { sessionKey: this.sessionKey, runId: this.runId });
          } catch {}
        }
        this.sending = false;
        this.stream = '';
      }
      
      _handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
      }
      
      _handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = () => {
                this.attachments = [...this.attachments, { id: 'att_' + Date.now(), dataUrl: reader.result, mimeType: file.type }];
              };
              reader.readAsDataURL(file);
            }
          }
        }
      }
      
      _removeAttachment(id) {
        this.attachments = this.attachments.filter(a => a.id !== id);
      }
      
      _formatTime(ts) {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      _extractText(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          return content.map(c => c.text || '').join(' ');
        }
        return '';
      }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/chat" class="active">Chat</a>
              <a href="/admin/channels">Channels</a>
              <a href="/admin/config">Config</a>
              <a href="#" @click="\${this._logout}">Logout</a>
            </nav>
          </div>
          <div class="container">
            <div class="chat-area">
              <div class="chat-header">
                <div>
                  <h3>💬 Admin Chat</h3>
                  <div style="font-size: 12px; color: #666; margin-top: 4px;">Session: \${this.sessionKey}</div>
                </div>
                <div class="status">
                  <span class="status-dot \${this.connected ? 'connected' : 'connecting'}"></span>
                  <span>\${this.connected ? 'Connected' : 'Connecting...'}</span>
                </div>
              </div>
              
              \${this.error ? html\`<div class="error-banner" @click="\${() => this.error = ''}">\${this.error} (click to dismiss)</div>\` : ''}
              
              <div class="messages">
                \${this.loading ? html\`<div class="loading"><div class="spinner"></div> Loading history...</div>\` : ''}
                
                \${repeat(this.messages, (m, i) => i, (m) => html\`
                  <div class="message \${m.role}">
                    <div>
                      <div class="message-content">\${this._extractText(m.content)}</div>
                      <div class="message-meta">\${this._formatTime(m.timestamp || Date.now())}</div>
                    </div>
                  </div>
                \`)}
                
                \${this.sending ? html\`
                  <div class="message assistant">
                    <div>
                      <div class="message-content">
                        \${this.stream || html\`<div class="stream-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>\`}
                      </div>
                    </div>
                  </div>
                \` : ''}
              </div>
              
              <div class="input-area">
                \${this.attachments.length ? html\`
                  <div class="attachments">
                    \${this.attachments.map(att => html\`
                      <div class="attachment">
                        <img src="\${att.dataUrl}" />
                        <button class="attachment-remove" @click="\${() => this._removeAttachment(att.id)}">×</button>
                      </div>
                    \`)}
                  </div>
                \` : ''}
                <div class="toolbar">
                  <button @click="\${this._loadHistory}">🔄 Refresh</button>
                  <button @click="\${() => this.sessionKey = 'admin:' + Date.now()}">➕ New Session</button>
                </div>
                <div class="input-row">
                  <textarea 
                    .value="\${this.draft}" 
                    @input="\${(e) => this.draft = e.target.value}" 
                    @keydown="\${this._handleKeydown}"
                    @paste="\${this._handlePaste}"
                    placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                    ?disabled="\${!this.connected}"
                  ></textarea>
                  <button class="btn" ?disabled="\${!this.connected || (!this.draft.trim() && !this.attachments.length)}" @click="\${this._sendMessage}">
                    \${this.sending ? 'Sending...' : 'Send'}
                  </button>
                  \${this.sending ? html\`<button class="btn btn-secondary" @click="\${this._abort}">Stop</button>\` : ''}
                </div>
              </div>
            </div>
          </div>
        \`;
      }
      
      async _logout(e) {
        e.preventDefault();
        const token = localStorage.getItem('adminSession');
        if (token) {
          try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } }); } catch {}
        }
        localStorage.removeItem('adminSession');
        location.href = '/admin/login';
      }
    }
  </script>
</head>
<body>
  <admin-chat></admin-chat>
</body>
</html>`;

// HTML de la página de Channels (Integrado con API real)
const ADMIN_CHANNELS_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Channels</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    import { repeat } from 'https://unpkg.com/lit@3.3.2/directives/repeat.js?module';
    
    const CHANNEL_ICONS = {
      whatsapp: '💬', telegram: '✈️', discord: '🎮', slack: '💼',
      signal: '🔒', imessage: '💬', googlechat: '💬', nostr: '🔑'
    };
    
    const CHANNEL_LABELS = {
      whatsapp: 'WhatsApp', telegram: 'Telegram', discord: 'Discord',
      slack: 'Slack', signal: 'Signal', imessage: 'iMessage',
      googlechat: 'Google Chat', nostr: 'Nostr'
    };
    
    @customElement('admin-channels')
    class AdminChannels extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s; }
        .nav a:hover, .nav a.active { opacity: 1; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        h2 { margin-bottom: 24px; color: #333; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 24px; }
        .channels-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .channel-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
        .channel-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .channel-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .channel-icon { font-size: 32px; }
        .channel-name { font-size: 18px; font-weight: 600; flex: 1; }
        .channel-status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .status-connected { background: #d4edda; color: #155724; }
        .status-disconnected { background: #f8d7da; color: #721c24; }
        .status-connecting { background: #fff3cd; color: #856404; }
        .status-active { background: #cce5ff; color: #004085; }
        .channel-info { color: #666; margin-bottom: 16px; font-size: 14px; line-height: 1.5; }
        .channel-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px; }
        .meta-row { display: flex; justify-content: space-between; }
        .meta-label { color: #666; }
        .meta-value { font-weight: 500; color: #333; }
        .channel-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-primary:hover { box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-success { background: #28a745; color: white; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .spinner { width: 24px; height: 24px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-banner { background: #fee; color: #c33; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
        .success-banner { background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: white; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; }
        .modal h3 { margin: 0 0 16px; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; }
        .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
        .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
        .qr-container { text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; margin: 16px 0; }
        .qr-container img { max-width: 200px; }
        .hidden { display: none; }
        .raw-json { background: #f5f5f5; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; max-height: 200px; }
      \`;
      
      @state() channels = [];
      @state() channelsSnapshot = null;
      @state() loading = true;
      @state() error = '';
      @state() success = '';
      @state() selectedChannel = null;
      @state() showModal = false;
      @state() modalMode = 'settings'; // 'settings' | 'qr' | 'logs'
      @state() whatsappQrUrl = '';
      @state() whatsappBusy = false;
      
      async connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        await this._loadChannels();
      }
      
      _checkAuth() {
        const token = localStorage.getItem('adminSession');
        if (!token) { location.href = '/admin/login'; return null; }
        return token;
      }
      
      async _apiCall(endpoint, options = {}) {
        const token = this._checkAuth();
        const res = await fetch(\`/admin/api\${endpoint}\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json', ...options.headers },
          ...options
        });
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json();
      }
      
      async _loadChannels() {
        this.loading = true;
        try {
          // Load from dashboard metrics endpoint
          const data = await this._apiCall('/dashboard/metrics');
          this.channelsSnapshot = data.data?.channelsSnapshot || null;
          this.channels = this._normalizeChannels(data.data);
        } catch (err) {
          this.error = 'Failed to load channels: ' + String(err);
          // Fallback to basic list
          this.channels = [
            { id: 'whatsapp', name: 'WhatsApp', status: 'disconnected', configured: false },
            { id: 'telegram', name: 'Telegram', status: 'disconnected', configured: false },
            { id: 'discord', name: 'Discord', status: 'disconnected', configured: false },
            { id: 'slack', name: 'Slack', status: 'disconnected', configured: false }
          ];
        } finally {
          this.loading = false;
        }
      }
      
      _normalizeChannels(data) {
        const snapshot = data?.channelsSnapshot;
        if (!snapshot?.channels) return [];
        
        return Object.entries(snapshot.channels).map(([id, status]) => ({
          id,
          name: CHANNEL_LABELS[id] || id,
          status: this._deriveStatus(status),
          configured: status?.configured || false,
          connected: status?.connected || false,
          running: status?.running || false,
          lastError: status?.lastError,
          details: status
        }));
      }
      
      _deriveStatus(status) {
        if (!status) return 'disconnected';
        if (status.connected) return 'connected';
        if (status.running) return 'active';
        if (status.configured) return 'connecting';
        return 'disconnected';
      }
      
      async _connectChannel(channel) {
        if (channel.id === 'whatsapp') {
          await this._connectWhatsApp();
        } else {
          this._openSettings(channel);
        }
      }
      
      async _connectWhatsApp() {
        this.whatsappBusy = true;
        this.modalMode = 'qr';
        this.showModal = true;
        try {
          // Use gateway WebSocket for WhatsApp login
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const ws = new WebSocket(\`\${protocol}//\${window.location.host}/gateway\`);
          
          ws.onopen = () => {
            const token = localStorage.getItem('adminSession');
            ws.send(JSON.stringify({
              type: 'req', id: 'wa_login', method: 'web.login.start',
              params: { force: false, timeoutMs: 30000 }
            }));
          };
          
          ws.onmessage = (ev) => {
            const data = JSON.parse(ev.data);
            if (data.type === 'res' && data.id === 'wa_login' && data.ok) {
              if (data.payload?.qrDataUrl) {
                this.whatsappQrUrl = data.payload.qrDataUrl;
              }
              if (data.payload?.message) {
                this.success = data.payload.message;
              }
            }
          };
          
          ws.onerror = () => { this.error = 'WebSocket error'; this.whatsappBusy = false; };
        } catch (err) {
          this.error = 'Failed to start WhatsApp login: ' + String(err);
          this.whatsappBusy = false;
        }
      }
      
      async _disconnectChannel(channel) {
        try {
          await this._apiCall(\`/channels/\${channel.id}/disconnect\`, { method: 'POST' });
          this.success = \`\${channel.name} disconnected\`;
          await this._loadChannels();
        } catch (err) {
          this.error = 'Failed to disconnect: ' + String(err);
        }
      }
      
      _openSettings(channel) {
        this.selectedChannel = channel;
        this.modalMode = 'settings';
        this.showModal = true;
      }
      
      async _saveSettings(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const config = Object.fromEntries(formData);
        
        try {
          await this._apiCall(\`/channels/\${this.selectedChannel.id}/config\`, {
            method: 'POST',
            body: JSON.stringify(config)
          });
          this.success = 'Settings saved';
          this.showModal = false;
          await this._loadChannels();
        } catch (err) {
          this.error = 'Failed to save: ' + String(err);
        }
      }
      
      async _probeChannel(channel) {
        try {
          const result = await this._apiCall(\`/channels/\${channel.id}/health\`);
          this.success = \`\${channel.name}: \${result.data?.status || 'OK'}\`;
        } catch (err) {
          this.error = 'Probe failed: ' + String(err);
        }
      }
      
      _renderStatusBadge(status) {
        const classes = { connected: 'status-connected', disconnected: 'status-disconnected', connecting: 'status-connecting', active: 'status-active' };
        return html\`<span class="channel-status \${classes[status] || 'status-disconnected'}">\${status}</span>\`;
      }
      
      _renderModal() {
        if (!this.showModal) return '';
        
        if (this.modalMode === 'qr') {
          return html\`
            <div class="modal-overlay" @click="\${() => this.showModal = false}">
              <div class="modal" @click="\${(e) => e.stopPropagation()}">
                <h3>📱 Connect WhatsApp</h3>
                <p>Scan the QR code with your WhatsApp app:</p>
                \${this.whatsappQrUrl 
                  ? html\`<div class="qr-container"><img src="\${this.whatsappQrUrl}" /></div>\`
                  : html\`<div class="loading"><div class="spinner"></div> Loading QR code...</div>\`
                }
                <div class="modal-actions">
                  <button class="btn btn-secondary" @click="\${() => { this.showModal = false; this.whatsappBusy = false; }}">Cancel</button>
                </div>
              </div>
            </div>
          \`;
        }
        
        if (this.modalMode === 'settings' && this.selectedChannel) {
          return html\`
            <div class="modal-overlay" @click="\${() => this.showModal = false}">
              <div class="modal" @click="\${(e) => e.stopPropagation()}">
                <h3>⚙️ \${this.selectedChannel.name} Settings</h3>
                <form @submit="\${this._saveSettings}">
                  <div class="form-group">
                    <label>Token / API Key</label>
                    <input type="password" name="token" placeholder="Enter token..." />
                  </div>
                  \${this.selectedChannel.id === 'telegram' ? html\`
                    <div class="form-group">
                      <label>Webhook URL</label>
                      <input type="url" name="webhookUrl" placeholder="https://..." />
                    </div>
                  \` : ''}
                  \${this.selectedChannel.id === 'slack' ? html\`
                    <div class="form-group">
                      <label>App Token</label>
                      <input type="password" name="appToken" placeholder="xapp-..." />
                    </div>
                    <div class="form-group">
                      <label>Bot Token</label>
                      <input type="password" name="botToken" placeholder="xoxb-..." />
                    </div>
                  \` : ''}
                  <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" @click="\${() => this.showModal = false}">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                  </div>
                </form>
                \${this.selectedChannel.details ? html\`
                  <details style="margin-top: 16px;">
                    <summary>Raw Status</summary>
                    <pre class="raw-json">\${JSON.stringify(this.selectedChannel.details, null, 2)}</pre>
                  </details>
                \` : ''}
              </div>
            </div>
          \`;
        }
        
        return '';
      }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/chat">Chat</a>
              <a href="/admin/channels" class="active">Channels</a>
              <a href="/admin/config">Config</a>
              <a href="#" @click="\${this._logout}">Logout</a>
            </nav>
          </div>
          
          <div class="container">
            <h2>📡 Channels Configuration</h2>
            
            \${this.error ? html\`<div class="error-banner" @click="\${() => this.error = ''}">\${this.error}</div>\` : ''}
            \${this.success ? html\`<div class="success-banner" @click="\${() => this.success = ''}">\${this.success}</div>\` : ''}
            
            <div class="toolbar">
              <button class="btn btn-primary" @click="\${this._loadChannels}">🔄 Refresh</button>
            </div>
            
            \${this.loading 
              ? html\`<div class="loading"><div class="spinner"></div> Loading channels...</div>\`
              : html\`
                <div class="channels-grid">
                  \${repeat(this.channels, (ch) => ch.id, (ch) => html\`
                    <div class="channel-card">
                      <div class="channel-header">
                        <span class="channel-icon">\${CHANNEL_ICONS[ch.id] || '📡'}</span>
                        <span class="channel-name">\${ch.name}</span>
                        \${this._renderStatusBadge(ch.status)}
                      </div>
                      <div class="channel-info">
                        \${ch.configured 
                          ? 'Channel is configured and ready to use.'
                          : 'Channel is not configured. Click Connect to set up.'
                        }
                      </div>
                      \${ch.lastError ? html\`<div style="color: #c33; font-size: 12px; margin-bottom: 12px;">Error: \${ch.lastError}</div>\` : ''}
                      <div class="channel-meta">
                        <div class="meta-row">
                          <span class="meta-label">Configured</span>
                          <span class="meta-value">\${ch.configured ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Running</span>
                          <span class="meta-value">\${ch.running ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="meta-row">
                          <span class="meta-label">Connected</span>
                          <span class="meta-value">\${ch.connected ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                      <div class="channel-actions">
                        \${ch.status === 'connected' || ch.status === 'active'
                          ? html\`<button class="btn btn-danger" @click="\${() => this._disconnectChannel(ch)}">Disconnect</button>\`
                          : html\`<button class="btn btn-primary" @click="\${() => this._connectChannel(ch)}">Connect</button>\`
                        }
                        <button class="btn btn-secondary" @click="\${() => this._openSettings(ch)}">Settings</button>
                        <button class="btn btn-secondary" @click="\${() => this._probeChannel(ch)}">Probe</button>
                      </div>
                    </div>
                  \`)}
                </div>
              \`
            }
          </div>
          
          \${this._renderModal()}
        \`;
      }
      
      async _logout(e) {
        e.preventDefault();
        const token = localStorage.getItem('adminSession');
        if (token) {
          try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } }); } catch {}
        }
        localStorage.removeItem('adminSession');
        location.href = '/admin/login';
      }
    }
  </script>
</head>
<body>
  <admin-channels></admin-channels>
</body>
</html>`;

// HTML de la página de Config (Integrado con API real)
const ADMIN_CONFIG_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Configuration</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    
    // Config sections metadata
    const SECTIONS = [
      { key: 'env', label: 'Environment', icon: '⚙️' },
      { key: 'update', label: 'Updates', icon: '⬆️' },
      { key: 'agents', label: 'Agents', icon: '🤖' },
      { key: 'auth', label: 'Authentication', icon: '🔐' },
      { key: 'channels', label: 'Channels', icon: '📡' },
      { key: 'messages', label: 'Messages', icon: '💬' },
      { key: 'commands', label: 'Commands', icon: '⌨️' },
      { key: 'hooks', label: 'Hooks', icon: '🔗' },
      { key: 'skills', label: 'Skills', icon: '⭐' },
      { key: 'tools', label: 'Tools', icon: '🛠️' },
      { key: 'gateway', label: 'Gateway', icon: '🌐' },
      { key: 'logging', label: 'Logging', icon: '📝' }
    ];
    
    @customElement('admin-config')
    class AdminConfig extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s; }
        .nav a:hover, .nav a.active { opacity: 1; }
        .config-layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 60px); }
        .sidebar { background: white; border-right: 1px solid #e0e0e0; padding: 20px; overflow-y: auto; }
        .sidebar-title { font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
        .nav-section { display: flex; flex-direction: column; gap: 2px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 14px; color: #333; }
        .nav-item:hover { background: #f5f5f5; }
        .nav-item.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .nav-item .icon { font-size: 16px; }
        .main { padding: 24px; overflow-y: auto; }
        .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .toolbar h2 { margin: 0; font-size: 24px; color: #333; }
        .btn-group { display: flex; gap: 8px; }
        .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-primary:hover { box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .config-panel { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .panel-header { padding: 16px 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
        .panel-title { font-size: 16px; font-weight: 600; }
        .panel-actions { display: flex; gap: 8px; }
        .mode-toggle { display: flex; background: #f0f0f0; border-radius: 6px; padding: 2px; }
        .mode-btn { padding: 6px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; border-radius: 4px; }
        .mode-btn.active { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .panel-body { padding: 20px; }
        .editor { width: 100%; min-height: 500px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Monaco', 'Menlo', 'Consolas', monospace; font-size: 13px; line-height: 1.5; resize: vertical; }
        .editor:focus { outline: none; border-color: #667eea; }
        .editor.error { border-color: #dc3545; background: #fff5f5; }
        .form-section { margin-bottom: 24px; }
        .form-section-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .form-group { display: flex; flex-direction: column; gap: 6px; }
        .form-group.full { grid-column: 1 / -1; }
        .form-group label { font-size: 13px; font-weight: 500; color: #555; }
        .form-group input, .form-group select, .form-group textarea { padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; font-family: inherit; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
        .form-group .hint { font-size: 12px; color: #888; }
        .status-bar { display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #f9f9f9; border-radius: 8px; margin-bottom: 16px; }
        .status-item { display: flex; align-items: center; gap: 6px; font-size: 13px; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
        .status-indicator.valid { background: #28a745; }
        .status-indicator.invalid { background: #dc3545; }
        .status-indicator.unknown { background: #ffc107; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .badge-valid { background: #d4edda; color: #155724; }
        .badge-invalid { background: #f8d7da; color: #721c24; }
        .badge-dirty { background: #fff3cd; color: #856404; }
        .error-list { background: #fee; border: 1px solid #fcc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .error-list h4 { margin: 0 0 8px; color: #c33; font-size: 14px; }
        .error-list ul { margin: 0; padding-left: 20px; font-size: 13px; color: #633; }
        .error-list li { margin-bottom: 4px; }
        .success-banner { background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
        .error-banner { background: #fee; color: #c33; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .spinner { width: 24px; height: 24px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty-state { text-align: center; padding: 60px 20px; color: #666; }
        .empty-state-icon { font-size: 48px; margin-bottom: 16px; }
        .diff-panel { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .diff-panel h4 { margin: 0 0 12px; font-size: 14px; color: #333; }
        .diff-item { display: flex; align-items: center; gap: 12px; padding: 8px; background: white; border-radius: 4px; margin-bottom: 8px; font-family: monospace; font-size: 12px; }
        .diff-path { font-weight: 600; color: #667eea; }
        .diff-arrow { color: #888; }
        .diff-old { color: #dc3545; text-decoration: line-through; }
        .diff-new { color: #28a745; }
      \`;
      
      @state() config = null;
      @state() rawConfig = '';
      @state() originalRaw = '';
      @state() configHash = '';
      @state() schema = null;
      @state() valid = null;
      @state() issues = [];
      @state() loading = true;
      @state() saving = false;
      @state() applying = false;
      @state() error = '';
      @state() success = '';
      @state() activeSection = null;
      @state() formMode = 'raw'; // 'raw' | 'form'
      @state() dirty = false;
      @state() parsedForm = null;
      
      async connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        await this._loadConfig();
      }
      
      _checkAuth() {
        const token = localStorage.getItem('adminSession');
        if (!token) { location.href = '/admin/login'; return null; }
        return token;
      }
      
      async _apiCall(endpoint, options = {}) {
        const token = this._checkAuth();
        const res = await fetch(\`/admin/api\${endpoint}\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json', ...options.headers },
          ...options
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error || \`HTTP \${res.status}\`);
        }
        return res.json();
      }
      
      async _loadConfig() {
        this.loading = true;
        this.error = '';
        try {
          // Try to get config from gateway first
          const token = this._checkAuth();
          const ws = await this._fetchConfigViaWs(token);
          if (ws) {
            this.config = ws.config || {};
            this.rawConfig = ws.raw || JSON.stringify(this.config, null, 2);
            this.originalRaw = this.rawConfig;
            this.configHash = ws.hash || '';
            this.valid = ws.valid ?? null;
            this.issues = ws.issues || [];
            this.parsedForm = this.config;
          } else {
            // Fallback to static config
            this.rawConfig = await this._fetchStaticConfig();
            this.originalRaw = this.rawConfig;
            try {
              this.config = JSON.parse(this.rawConfig);
              this.valid = true;
              this.parsedForm = this.config;
            } catch {
              this.valid = false;
              this.issues = [{ path: '', message: 'Invalid JSON' }];
            }
          }
          
          // Load schema
          await this._loadSchema(token);
        } catch (err) {
          this.error = 'Failed to load config: ' + String(err);
          this.rawConfig = this._getDefaultConfig();
          this.originalRaw = this.rawConfig;
        } finally {
          this.loading = false;
          this._checkDirty();
        }
      }
      
      async _fetchConfigViaWs(token) {
        return new Promise((resolve) => {
          try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(\`\${protocol}//\${window.location.host}/gateway\`);
            let resolved = false;
            
            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: 'req', id: 'cfg_get', method: 'config.get', params: {}
              }));
            };
            
            ws.onmessage = (ev) => {
              const data = JSON.parse(ev.data);
              if (data.type === 'res' && data.id === 'cfg_get') {
                resolved = true;
                ws.close();
                resolve(data.ok ? data.payload : null);
              }
            };
            
            ws.onerror = () => { if (!resolved) { resolve(null); } };
            setTimeout(() => { if (!resolved) { ws.close(); resolve(null); } }, 5000);
          } catch {
            resolve(null);
          }
        });
      }
      
      async _fetchStaticConfig() {
        // Try to fetch from a config endpoint or use default
        try {
          const res = await fetch('/admin/api/config');
          if (res.ok) {
            const data = await res.json();
            return JSON.stringify(data.data || data, null, 2);
          }
        } catch {}
        return this._getDefaultConfig();
      }
      
      async _loadSchema(token) {
        return new Promise((resolve) => {
          try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(\`\${protocol}//\${window.location.host}/gateway\`);
            let resolved = false;
            
            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: 'req', id: 'cfg_schema', method: 'config.schema', params: {}
              }));
            };
            
            ws.onmessage = (ev) => {
              const data = JSON.parse(ev.data);
              if (data.type === 'res' && data.id === 'cfg_schema') {
                resolved = true;
                ws.close();
                this.schema = data.ok ? data.payload?.schema : null;
                resolve();
              }
            };
            
            ws.onerror = () => resolve();
            setTimeout(() => { ws.close(); resolve(); }, 3000);
          } catch {
            resolve();
          }
        });
      }
      
      _getDefaultConfig() {
        return JSON.stringify({
          gateway: { port: 18789, bind: 'loopback' },
          channels: {},
          agents: { default: 'openclaw' },
          logging: { level: 'info' }
        }, null, 2);
      }
      
      _handleRawChange(e) {
        this.rawConfig = e.target.value;
        this._validateJson();
        this._checkDirty();
      }
      
      _validateJson() {
        try {
          this.config = JSON.parse(this.rawConfig);
          this.valid = this.issues.length === 0;
          this.parsedForm = this.config;
        } catch (err) {
          this.valid = false;
        }
      }
      
      _checkDirty() {
        this.dirty = this.rawConfig !== this.originalRaw;
      }
      
      async _saveConfig() {
        this.saving = true;
        this.error = '';
        this.success = '';
        try {
          const token = this._checkAuth();
          const result = await this._saveViaWs(token);
          if (result) {
            this.success = 'Configuration saved successfully';
            this.originalRaw = this.rawConfig;
            this._checkDirty();
          } else {
            throw new Error('Save failed');
          }
        } catch (err) {
          this.error = 'Failed to save: ' + String(err);
        } finally {
          this.saving = false;
        }
      }
      
      async _saveViaWs(token) {
        return new Promise((resolve) => {
          try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(\`\${protocol}//\${window.location.host}/gateway\`);
            let resolved = false;
            
            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: 'req', id: 'cfg_set', method: 'config.set',
                params: { raw: this.rawConfig, baseHash: this.configHash }
              }));
            };
            
            ws.onmessage = (ev) => {
              const data = JSON.parse(ev.data);
              if (data.type === 'res' && data.id === 'cfg_set') {
                resolved = true;
                ws.close();
                resolve(data.ok);
              }
            };
            
            ws.onerror = () => { if (!resolved) resolve(false); };
            setTimeout(() => { if (!resolved) { ws.close(); resolve(false); } }, 10000);
          } catch {
            resolve(false);
          }
        });
      }
      
      async _applyConfig() {
        this.applying = true;
        this.error = '';
        this.success = '';
        try {
          await this._saveConfig();
          const token = this._checkAuth();
          const result = await this._applyViaWs(token);
          if (result) {
            this.success = 'Configuration applied successfully';
          } else {
            throw new Error('Apply failed');
          }
        } catch (err) {
          this.error = 'Failed to apply: ' + String(err);
        } finally {
          this.applying = false;
        }
      }
      
      async _applyViaWs(token) {
        return new Promise((resolve) => {
          try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(\`\${protocol}//\${window.location.host}/gateway\`);
            let resolved = false;
            
            ws.onopen = () => {
              ws.send(JSON.stringify({
                type: 'req', id: 'cfg_apply', method: 'config.apply',
                params: { raw: this.rawConfig, baseHash: this.configHash, sessionKey: 'admin:config' }
              }));
            };
            
            ws.onmessage = (ev) => {
              const data = JSON.parse(ev.data);
              if (data.type === 'res' && data.id === 'cfg_apply') {
                resolved = true;
                ws.close();
                resolve(data.ok);
              }
            };
            
            ws.onerror = () => { if (!resolved) resolve(false); };
            setTimeout(() => { if (!resolved) { ws.close(); resolve(false); } }, 10000);
          } catch {
            resolve(false);
          }
        });
      }
      
      _formatValue(val) {
        if (val === null) return 'null';
        if (val === undefined) return 'undefined';
        if (typeof val === 'object') return JSON.stringify(val).slice(0, 50);
        return String(val).slice(0, 50);
      }
      
      _computeDiff() {
        if (!this.dirty) return [];
        try {
          const original = JSON.parse(this.originalRaw);
          const current = JSON.parse(this.rawConfig);
          const changes = [];
          
          const compare = (orig, curr, path) => {
            if (JSON.stringify(orig) === JSON.stringify(curr)) return;
            if (typeof orig !== typeof curr || typeof orig !== 'object' || orig === null || curr === null) {
              changes.push({ path: path || '(root)', from: this._formatValue(orig), to: this._formatValue(curr) });
              return;
            }
            const keys = new Set([...Object.keys(orig || {}), ...Object.keys(curr || {})]);
            for (const key of keys) {
              compare(orig?.[key], curr?.[key], path ? \`\${path}.\${key}\` : key);
            }
          };
          
          compare(original, current, '');
          return changes;
        } catch {
          return [{ path: 'JSON', from: 'original', to: 'modified (parse error)' }];
        }
      }
      
      _renderSidebar() {
        return html\`
          <div class="sidebar">
            <div class="sidebar-title">Configuration</div>
            <div class="nav-section">
              <div class="nav-item \${!this.activeSection ? 'active' : ''}" @click="\${() => this.activeSection = null}">
                <span class="icon">📄</span> Raw JSON
              </div>
              \${SECTIONS.map(s => html\`
                <div class="nav-item \${this.activeSection === s.key ? 'active' : ''}" @click="\${() => this.activeSection = s.key}">
                  <span class="icon">\${s.icon}</span> \${s.label}
                </div>
              \`)}
            </div>
          </div>
        \`;
      }
      
      _renderEditor() {
        const diff = this._computeDiff();
        
        return html\`
          <div class="config-panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">\${this.activeSection ? SECTIONS.find(s => s.key === this.activeSection)?.label : 'Raw Configuration'}</span>
                <div class="status-bar" style="margin-top: 8px; margin-bottom: 0;">
                  <div class="status-item">
                    <span class="status-indicator \${this.valid === true ? 'valid' : this.valid === false ? 'invalid' : 'unknown'}"></span>
                    <span>\${this.valid === true ? 'Valid' : this.valid === false ? 'Invalid' : 'Unknown'}</span>
                  </div>
                  \${this.dirty ? html\`<span class="badge badge-dirty">Unsaved</span>\` : ''}
                  \${this.configHash ? html\`<span style="font-size: 11px; color: #888;">Hash: \${this.configHash.slice(0, 8)}...</span>\` : ''}
                </div>
              </div>
              <div class="panel-actions">
                <div class="mode-toggle">
                  <button class="mode-btn \${this.formMode === 'form' ? 'active' : ''}" @click="\${() => this.formMode = 'form'}">Form</button>
                  <button class="mode-btn \${this.formMode === 'raw' ? 'active' : ''}" @click="\${() => this.formMode = 'raw'}">Raw</button>
                </div>
              </div>
            </div>
            
            <div class="panel-body">
              \${this.success ? html\`<div class="success-banner" @click="\${() => this.success = ''}">\${this.success}</div>\` : ''}
              \${this.error ? html\`<div class="error-banner" @click="\${() => this.error = ''}">\${this.error}</div>\` : ''}
              
              \${this.issues.length ? html\`
                <div class="error-list">
                  <h4>⚠️ Validation Issues (\${this.issues.length})</h4>
                  <ul>\${this.issues.map(i => html\`<li><strong>\${i.path || 'root'}:</strong> \${i.message}</li>\`)}</ul>
                </div>
              \` : ''}
              
              \${diff.length > 0 ? html\`
                <div class="diff-panel">
                  <h4>📝 Pending Changes (\${diff.length})</h4>
                  \${diff.map(d => html\`
                    <div class="diff-item">
                      <span class="diff-path">\${d.path}</span>
                      <span class="diff-old">\${d.from}</span>
                      <span class="diff-arrow">→</span>
                      <span class="diff-new">\${d.to}</span>
                    </div>
                  \`)}
                </div>
              \` : ''}
              
              \${this.formMode === 'raw' ? html\`
                <textarea 
                  class="editor \${this.valid === false ? 'error' : ''}"
                  .value="\${this.rawConfig}"
                  @input="\${this._handleRawChange}"
                  spellcheck="false"
                ></textarea>
              \` : html\`
                <div class="empty-state">
                  <div class="empty-state-icon">📝</div>
                  <p>Form mode is coming soon.<br>Please use Raw mode for now.</p>
                  <button class="btn btn-secondary" @click="\${() => this.formMode = 'raw'}" style="margin-top: 12px;">Switch to Raw</button>
                </div>
              \`}
            </div>
          </div>
        \`;
      }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/chat">Chat</a>
              <a href="/admin/channels">Channels</a>
              <a href="/admin/config" class="active">Config</a>
              <a href="#" @click="\${this._logout}">Logout</a>
            </nav>
          </div>
          
          <div class="config-layout">
            \${this._renderSidebar()}
            
            <div class="main">
              <div class="toolbar">
                <h2>⚙️ Configuration</h2>
                <div class="btn-group">
                  <button class="btn btn-secondary" ?disabled="\${this.loading}" @click="\${this._loadConfig}">
                    \${this.loading ? 'Loading...' : '🔄 Reload'}
                  </button>
                  <button class="btn btn-primary" ?disabled="\${!this.dirty || this.saving || this.valid === false}" @click="\${this._saveConfig}">
                    \${this.saving ? 'Saving...' : '💾 Save'}
                  </button>
                  <button class="btn btn-success" ?disabled="\${!this.dirty || this.applying || this.valid === false}" @click="\${this._applyConfig}">
                    \${this.applying ? 'Applying...' : '✓ Apply'}
                  </button>
                </div>
              </div>
              
              \${this.loading 
                ? html\`<div class="loading"><div class="spinner"></div> Loading configuration...</div>\`
                : this._renderEditor()
              }
            </div>
          </div>
        \`;
      }
      
      async _logout(e) {
        e.preventDefault();
        const token = localStorage.getItem('adminSession');
        if (token) {
          try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } }); } catch {}
        }
        localStorage.removeItem('adminSession');
        location.href = '/admin/login';
      }
    }
  </script>
</head>
<body>
  <admin-config></admin-config>
</body>
</html>`;

// HTML de la página de login con componentes Lit (Etapa 18)
const ADMIN_LOGIN_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
  </style>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    
    @customElement('admin-login-form')
    class AdminLoginForm extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { background: white; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 40px; width: 100%; max-width: 400px; margin: 0 auto; }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { font-size: 28px; color: #333; margin: 0; }
        .logo p { color: #666; margin-top: 8px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; font-size: 14px; }
        input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; transition: border-color 0.3s; box-sizing: border-box; }
        input:focus { outline: none; border-color: #667eea; }
        input:disabled { background: #f5f5f5; cursor: not-allowed; }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4); }
        button:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .secondary-btn { background: #999; margin-top: 10px; }
        .step-2 { display: none; }
        .step-2.active { display: block; }
        .step-1.hidden { display: none; }
        .error { background: #fee; color: #c33; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; display: none; }
        .error.visible { display: block; }
        .info { background: #eef; color: #448; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; display: none; }
        .info.visible { display: block; }
        .code-display { background: #f0f0f0; padding: 16px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 2px dashed #667eea; }
        .code-display .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace; }
        .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: white; animation: spin 1s ease-in-out infinite; margin-right: 8px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .status { text-align: center; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 8px; font-size: 12px; color: #666; }
      \`;
      
      @property({ type: String }) apiBaseUrl = '/admin/api';
      @state() step = 1;
      @state() loading = false;
      @state() error = '';
      @state() info = '';
      @state() tempToken = '';
      @state() debugCode = '';
      @state() username = '';
      
      async _handleStep1(e) {
        e.preventDefault();
        if (this.loading) return;
        const form = e.target;
        const formData = new FormData(form);
        this.username = formData.get('username');
        this.loading = true;
        this.error = '';
        this.info = '';
        try {
          const response = await fetch(\`\${this.apiBaseUrl}/auth/login\`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') })
          });
          const data = await response.json();
          if (!data.ok) { this.error = data.error || 'Login failed'; return; }
          this.tempToken = data.data?.tempToken || '';
          this.debugCode = data.data?.debugCode || '';
          this.info = this.debugCode ? \`Your verification code is: \${this.debugCode}\` : (data.data?.message || 'Check your Telegram for the verification code');
          this.step = 2;
        } catch (err) { this.error = 'Network error. Please try again.'; }
        finally { this.loading = false; }
      }
      
      async _handleStep2(e) {
        e.preventDefault();
        if (this.loading) return;
        const form = e.target;
        const formData = new FormData(form);
        this.loading = true;
        this.error = '';
        try {
          const response = await fetch(\`\${this.apiBaseUrl}/auth/verify\`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken: this.tempToken, code: formData.get('code') })
          });
          const data = await response.json();
          if (!data.ok) { this.error = data.error || 'Verification failed'; return; }
          if (data.data?.sessionToken) { localStorage.setItem('adminSession', data.data.sessionToken); location.href = '/admin/dashboard'; }
        } catch (err) { this.error = 'Network error. Please try again.'; }
        finally { this.loading = false; }
      }
      
      _goBack() { this.step = 1; this.error = ''; this.info = ''; this.tempToken = ''; this.debugCode = ''; }
      
      render() {
        return html\`
          <div class="container">
            <div class="logo"><h1>🔧 OpenClaw</h1><p>Admin Panel</p></div>
            <div class="error \${this.error ? 'visible' : ''}">\${this.error}</div>
            <div class="info \${this.info ? 'visible' : ''}">\${this.info}</div>
            <form class="step-1 \${this.step === 2 ? 'hidden' : ''}" @submit="\${this._handleStep1}">
              <div class="form-group"><label>Username</label><input type="text" name="username" required autocomplete="username" .value="\${this.username}" ?disabled="\${this.loading}"></div>
              <div class="form-group"><label>Password</label><input type="password" name="password" required autocomplete="current-password" ?disabled="\${this.loading}"></div>
              <button type="submit" ?disabled="\${this.loading}">\${this.loading ? html\`<span class="loading"></span> Processing...\` : 'Continue'}</button>
            </form>
            <form class="step-2 \${this.step === 2 ? 'active' : ''}" @submit="\${this._handleStep2}">
              \${this.debugCode ? html\`<div class="code-display"><div class="code">\${this.debugCode}</div></div>\` : ''}
              <div class="form-group"><label>Verification Code</label><input type="text" name="code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" ?disabled="\${this.loading}"></div>
              <button type="submit" ?disabled="\${this.loading}">\${this.loading ? html\`<span class="loading"></span> Verifying...\` : 'Verify'}</button>
              <button type="button" class="secondary-btn" @click="\${this._goBack}" ?disabled="\${this.loading}">Cancel</button>
            </form>
            <div class="status">✅ Etapa 15: Auth Password | ✅ Etapa 16: Auth Telegram | ✅ Etapa 17: Middleware | ✅ Etapa 18: UI Login | ✅ Etapa 20: Dashboard</div>
          </div>
        \`;
      }
    }
  </script>
</head>
<body>
  <admin-login-form></admin-login-form>
</body>
</html>`;

// HTML del dashboard con NAVEGACIÓN UNIFICADA
const ADMIN_DASHBOARD_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Dashboard</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    
    @customElement('admin-dashboard')
    class AdminDashboard extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .nav { display: flex; gap: 24px; margin: 0 24px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; font-size: 14px; padding: 8px 12px; border-radius: 6px; transition: opacity 0.2s, background 0.2s; }
        .nav a:hover { opacity: 1; background: rgba(255,255,255,0.1); }
        .nav a.active { opacity: 1; background: rgba(255,255,255,0.2); }
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .user-info { font-size: 14px; opacity: 0.9; }
        .logout-btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: background 0.2s; }
        .logout-btn:hover { background: rgba(255,255,255,0.3); }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .card-title { color: #666; font-size: 14px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
        .card-icon { font-size: 24px; opacity: 0.7; }
        .card-value { font-size: 36px; font-weight: bold; color: #333; margin-bottom: 8px; }
        .card-loading { display: inline-block; width: 36px; height: 36px; border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .status-bar { background: white; border-radius: 8px; padding: 16px 20px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; }
        .status-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #666; }
        .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: #4caf50; }
        .last-updated { font-size: 12px; color: #999; }
      \`;
      
      @state() metrics = null;
      @state() loading = true;
      @state() lastUpdated = '';
      refreshInterval;
      
      connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        this._loadMetrics();
        this.refreshInterval = setInterval(() => this._loadMetrics(), 30000);
      }
      
      disconnectedCallback() {
        super.disconnectedCallback();
        if (this.refreshInterval) clearInterval(this.refreshInterval);
      }
      
      _checkAuth() {
        const sessionToken = localStorage.getItem('adminSession');
        if (!sessionToken) { location.href = '/admin/login'; return; }
        fetch('/admin/api/auth/session', { headers: { Authorization: \`Bearer \${sessionToken}\` } })
          .then(r => r.json()).then(d => { if (!d.ok || !d.data?.valid) throw new Error(); })
          .catch(() => { localStorage.removeItem('adminSession'); location.href = '/admin/login'; });
      }
      
      async _loadMetrics() {
        const sessionToken = localStorage.getItem('adminSession');
        if (!sessionToken) return;
        this.loading = true;
        try {
          const response = await fetch('/admin/api/dashboard/metrics', { headers: { Authorization: \`Bearer \${sessionToken}\` } });
          const data = await response.json();
          if (data.ok) { this.metrics = data.data; this.lastUpdated = new Date().toLocaleTimeString(); }
        } catch (err) {}
        finally { this.loading = false; }
      }
      
      async _handleLogout() {
        const sessionToken = localStorage.getItem('adminSession');
        if (sessionToken) { try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${sessionToken}\` } }); } catch {} }
        localStorage.removeItem('adminSession'); location.href = '/admin/login';
      }
      
      _formatNumber(num) { if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'; if (num >= 1000) return (num / 1000).toFixed(1) + 'K'; return num?.toString() || '0'; }
      _formatCurrency(amount) { return '\$' + (amount || 0).toFixed(2); }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard" class="active">Dashboard</a>
              <a href="/admin/chat">Chat</a>
              <a href="/admin/channels">Channels</a>
              <a href="/admin/config">Config</a>
            </nav>
            <div class="header-actions"><span class="user-info">Administrator</span><button class="logout-btn" @click="\${this._handleLogout}">Logout</button></div>
          </div>
          <div class="container">
            <div class="status-bar"><div class="status-item"><span class="status-indicator"></span><span>System Online</span></div><div class="last-updated">Last updated: \${this.lastUpdated || 'Never'}</div></div>
            <div class="section"><div class="section-title">📊 Overview</div><div class="metrics-grid">
              <div class="card"><div class="card-header"><span class="card-title">Total Messages</span><span class="card-icon">💬</span></div>\${this.loading ? html\`<div class="card-loading"></div>\` : html\`<div class="card-value">\${this._formatNumber(this.metrics?.messages?.total)}</div>\`}</div>
              <div class="card"><div class="card-header"><span class="card-title">Active Users</span><span class="card-icon">👥</span></div>\${this.loading ? html\`<div class="card-loading"></div>\` : html\`<div class="card-value">\${this._formatNumber(this.metrics?.users?.active)}</div>\`}</div>
              <div class="card"><div class="card-header"><span class="card-title">Tokens Consumed</span><span class="card-icon">🪙</span></div>\${this.loading ? html\`<div class="card-loading"></div>\` : html\`<div class="card-value">\${this._formatNumber(this.metrics?.tokens?.consumed)}</div>\`}</div>
            </div></div>
            <div class="section"><div class="section-title">📡 Channels</div>
              <div class="metrics-grid">
                \${this.metrics?.channels?.map(ch => html\`<div class="card"><div class="card-header"><span class="card-title">\${ch.name}</span><span class="card-icon">📡</span></div><div style="color: \${ch.status === 'connected' ? '#4caf50' : '#f44336'}; font-weight: 600;">\${ch.status}</div></div>\`)}
              </div>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">✅ Admin Unificado - Dashboard + Chat + Config</div>
          </div>
        \`;
      }
    }
  </script>
</head>
<body>
  <admin-dashboard></admin-dashboard>
</body>
</html>`;

// HTML de la página de Agents
const ADMIN_AGENTS_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Agents</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    import { repeat } from 'https://unpkg.com/lit@3.3.2/directives/repeat.js?module';
    
    @customElement('admin-agents')
    class AdminAgents extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s; }
        .nav a:hover, .nav a.active { opacity: 1; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        h2 { margin-bottom: 24px; color: #333; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 24px; }
        .agents-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .agent-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .agent-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .agent-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 24px; }
        .agent-name { font-size: 18px; font-weight: 600; flex: 1; }
        .agent-status { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .status-active { background: #d4edda; color: #155724; }
        .status-inactive { background: #f8d7da; color: #721c24; }
        .agent-info { color: #666; margin-bottom: 16px; font-size: 14px; line-height: 1.5; }
        .agent-meta { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; font-size: 13px; }
        .meta-row { display: flex; justify-content: space-between; }
        .meta-label { color: #666; }
        .meta-value { font-weight: 500; color: #333; }
        .agent-actions { display: flex; gap: 8px; }
        .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .spinner { width: 24px; height: 24px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-banner { background: #fee; color: #c33; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
        .success-banner { background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
      \`;
      
      @state() agents = [];
      @state() loading = true;
      @state() error = '';
      @state() success = '';
      
      async connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        await this._loadAgents();
      }
      
      _checkAuth() {
        const token = localStorage.getItem('adminSession');
        if (!token) { location.href = '/admin/login'; return null; }
        return token;
      }
      
      async _apiCall(endpoint, options = {}) {
        const token = this._checkAuth();
        const res = await fetch(\`/admin/api\${endpoint}\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json', ...options.headers },
          ...options
        });
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json();
      }
      
      async _loadAgents() {
        this.loading = true;
        try {
          const data = await this._apiCall('/dashboard/metrics');
          this.agents = data.data?.agents || [
            { id: 'default', name: 'OpenClaw', status: 'active', model: 'claude-sonnet-4-20250514', tools: 12 },
            { id: 'sales', name: 'Sales Agent', status: 'inactive', model: 'claude-sonnet-4-20250514', tools: 8 }
          ];
        } catch (err) {
          this.error = 'Failed to load agents: ' + String(err);
          this.agents = [];
        } finally {
          this.loading = false;
        }
      }
      
      async _toggleAgent(agent) {
        try {
          await this._apiCall(\`/agents/\${agent.id}/toggle\`, { method: 'POST' });
          this.success = \`Agent \${agent.name} \${agent.status === 'active' ? 'stopped' : 'started'}\`;
          await this._loadAgents();
        } catch (err) {
          this.error = 'Failed to toggle agent: ' + String(err);
        }
      }
      
      _editAgent(agent) {
        location.href = \`/admin/config?section=agents&agent=\${agent.id}\`;
      }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/chat">Chat</a>
              <a href="/admin/channels">Channels</a>
              <a href="/admin/config">Config</a>
              <a href="/admin/agents" class="active">Agents</a>
              <a href="#" @click="\${this._logout}">Logout</a>
            </nav>
          </div>
          
          <div class="container">
            <h2>🤖 Agents</h2>
            
            \${this.error ? html\`<div class="error-banner" @click="\${() => this.error = ''}">\${this.error}</div>\` : ''}
            \${this.success ? html\`<div class="success-banner" @click="\${() => this.success = ''}">\${this.success}</div>\` : ''}
            
            <div class="toolbar">
              <button class="btn btn-primary" @click="\${this._loadAgents}">🔄 Refresh</button>
            </div>
            
            \${this.loading 
              ? html\`<div class="loading"><div class="spinner"></div> Loading agents...</div>\`
              : html\`
                <div class="agents-grid">
                  \${repeat(this.agents, (a) => a.id, (agent) => html\`
                    <div class="agent-card">
                      <div class="agent-header">
                        <div class="agent-avatar">🤖</div>
                        <span class="agent-name">\${agent.name}</span>
                        <span class="agent-status \${agent.status === 'active' ? 'status-active' : 'status-inactive'}">\${agent.status}</span>
                      </div>
                      <div class="agent-info">AI agent for handling conversations and tasks.</div>
                      <div class="agent-meta">
                        <div class="meta-row"><span class="meta-label">ID</span><span class="meta-value">\${agent.id}</span></div>
                        <div class="meta-row"><span class="meta-label">Model</span><span class="meta-value">\${agent.model || 'default'}</span></div>
                        <div class="meta-row"><span class="meta-label">Tools</span><span class="meta-value">\${agent.tools || 0}</span></div>
                      </div>
                      <div class="agent-actions">
                        <button class="btn \${agent.status === 'active' ? 'btn-secondary' : 'btn-primary'}" @click="\${() => this._toggleAgent(agent)}">
                          \${agent.status === 'active' ? 'Stop' : 'Start'}
                        </button>
                        <button class="btn btn-secondary" @click="\${() => this._editAgent(agent)}">Edit</button>
                      </div>
                    </div>
                  \`)}
                </div>
              \`
            }
          </div>
        \`;
      }
      
      async _logout(e) {
        e.preventDefault();
        const token = localStorage.getItem('adminSession');
        if (token) {
          try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } }); } catch {}
        }
        localStorage.removeItem('adminSession');
        location.href = '/admin/login';
      }
    }
  </script>
</head>
<body>
  <admin-agents></admin-agents>
</body>
</html>`;

// HTML de la página de Skills
const ADMIN_SKILLS_LIT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw Admin - Skills</title>
  <script type="module">
    import { LitElement, html, css } from 'https://unpkg.com/lit@3.3.2/index.js?module';
    import { customElement, property, state } from 'https://unpkg.com/lit@3.3.2/decorators.js?module';
    import { repeat } from 'https://unpkg.com/lit@3.3.2/directives/repeat.js?module';
    
    @customElement('admin-skills')
    class AdminSkills extends LitElement {
      static styles = css\`
        :host { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
        .header h1 { margin: 0; font-size: 20px; }
        .nav { display: flex; gap: 20px; }
        .nav a { color: white; text-decoration: none; opacity: 0.8; transition: opacity 0.2s; }
        .nav a:hover, .nav a.active { opacity: 1; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        h2 { margin-bottom: 24px; color: #333; }
        .toolbar { display: flex; gap: 12px; margin-bottom: 24px; }
        .skills-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .skill-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .skill-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .skill-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .skill-icon { font-size: 28px; }
        .skill-name { font-size: 16px; font-weight: 600; flex: 1; }
        .skill-status { padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; }
        .status-enabled { background: #d4edda; color: #155724; }
        .status-disabled { background: #f8d7da; color: #721c24; }
        .skill-desc { color: #666; font-size: 13px; margin-bottom: 16px; line-height: 1.5; }
        .skill-meta { display: flex; gap: 16px; font-size: 12px; color: #888; margin-bottom: 16px; }
        .skill-actions { display: flex; gap: 8px; }
        .btn { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-secondary { background: #e0e0e0; color: #333; }
        .loading { display: flex; align-items: center; justify-content: center; padding: 60px; }
        .spinner { width: 24px; height: 24px; border: 2px solid #e0e0e0; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 12px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-banner { background: #fee; color: #c33; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
        .success-banner { background: #d4edda; color: #155724; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
      \`;
      
      @state() skills = [];
      @state() loading = true;
      @state() error = '';
      @state() success = '';
      
      async connectedCallback() {
        super.connectedCallback();
        this._checkAuth();
        await this._loadSkills();
      }
      
      _checkAuth() {
        const token = localStorage.getItem('adminSession');
        if (!token) { location.href = '/admin/login'; return null; }
        return token;
      }
      
      async _apiCall(endpoint, options = {}) {
        const token = this._checkAuth();
        const res = await fetch(\`/admin/api\${endpoint}\`, {
          headers: { 'Authorization': \`Bearer \${token}\`, 'Content-Type': 'application/json', ...options.headers },
          ...options
        });
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json();
      }
      
      async _loadSkills() {
        this.loading = true;
        try {
          const data = await this._apiCall('/dashboard/metrics');
          this.skills = data.data?.skills || [
            { id: 'web_search', name: 'Web Search', icon: '🔍', description: 'Search the web for information', enabled: true, calls: 1523 },
            { id: 'file_read', name: 'File Read', icon: '📄', description: 'Read files from the system', enabled: true, calls: 892 },
            { id: 'memory', name: 'Memory', icon: '🧠', description: 'Store and retrieve memories', enabled: true, calls: 2341 },
            { id: 'weather', name: 'Weather', icon: '🌤️', description: 'Get weather information', enabled: false, calls: 0 }
          ];
        } catch (err) {
          this.error = 'Failed to load skills: ' + String(err);
          this.skills = [];
        } finally {
          this.loading = false;
        }
      }
      
      async _toggleSkill(skill) {
        try {
          await this._apiCall(\`/skills/\${skill.id}/toggle\`, { method: 'POST' });
          this.success = \`Skill \${skill.name} \${skill.enabled ? 'disabled' : 'enabled'}\`;
          await this._loadSkills();
        } catch (err) {
          this.error = 'Failed to toggle skill: ' + String(err);
        }
      }
      
      render() {
        return html\`
          <div class="header">
            <h1>🔧 OpenClaw Admin</h1>
            <nav class="nav">
              <a href="/admin/dashboard">Dashboard</a>
              <a href="/admin/chat">Chat</a>
              <a href="/admin/channels">Channels</a>
              <a href="/admin/config">Config</a>
              <a href="/admin/agents">Agents</a>
              <a href="/admin/skills" class="active">Skills</a>
              <a href="#" @click="\${this._logout}">Logout</a>
            </nav>
          </div>
          
          <div class="container">
            <h2>⭐ Skills</h2>
            
            \${this.error ? html\`<div class="error-banner" @click="\${() => this.error = ''}">\${this.error}</div>\` : ''}
            \${this.success ? html\`<div class="success-banner" @click="\${() => this.success = ''}">\${this.success}</div>\` : ''}
            
            <div class="toolbar">
              <button class="btn btn-primary" @click="\${this._loadSkills}">🔄 Refresh</button>
            </div>
            
            \${this.loading 
              ? html\`<div class="loading"><div class="spinner"></div> Loading skills...</div>\`
              : html\`
                <div class="skills-grid">
                  \${repeat(this.skills, (s) => s.id, (skill) => html\`
                    <div class="skill-card">
                      <div class="skill-header">
                        <span class="skill-icon">\${skill.icon || '⭐'}</span>
                        <span class="skill-name">\${skill.name}</span>
                        <span class="skill-status \${skill.enabled ? 'status-enabled' : 'status-disabled'}">\${skill.enabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div class="skill-desc">\${skill.description}</div>
                      <div class="skill-meta">
                        <span>ID: \${skill.id}</span>
                        <span>Calls: \${skill.calls || 0}</span>
                      </div>
                      <div class="skill-actions">
                        <button class="btn \${skill.enabled ? 'btn-secondary' : 'btn-primary'}" @click="\${() => this._toggleSkill(skill)}">
                          \${skill.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>
                  \`)}
                </div>
              \`
            }
          </div>
        \`;
      }
      
      async _logout(e) {
        e.preventDefault();
        const token = localStorage.getItem('adminSession');
        if (token) {
          try { await fetch('/admin/api/auth/logout', { method: 'POST', headers: { Authorization: \`Bearer \${token}\` } }); } catch {}
        }
        localStorage.removeItem('adminSession');
        location.href = '/admin/login';
      }
    }
  </script>
</head>
<body>
  <admin-skills></admin-skills>
</body>
</html>`;

// Exportar todo
export * from "./types.js";
export * from "./routes.js";
export * from "./auth.js";
export * from "./auth-storage.js";
export * from "./admin-verification.js";
export * from "./middleware.js";
export * from "./dashboard.js";
export * from "./metrics.js";
