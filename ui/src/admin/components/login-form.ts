/**
 * Componente de Login para el Panel de Administración.
 *
 * Etapa 18: UI de Login - Frontend
 *
 * Implementa un formulario de login con tres modos:
 * 1. Token directo (más simple)
 * 2. Username + Password
 * 3. Código de verificación (2FA)
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// Tipos de respuesta de la API
interface LoginResponse {
  ok: boolean;
  data?: {
    tempToken?: string;
    sessionToken?: string;
    message?: string;
    debugCode?: string;
    expiresAt?: number;
  };
  error?: string;
}

type LoginMode = "token" | "credentials";

/**
 * Formulario de Login del Panel Admin
 */
@customElement("admin-login-form")
export class AdminLoginForm extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      margin: 0 auto;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo h1 {
      font-size: 28px;
      color: #333;
      margin: 0;
    }

    .logo p {
      color: #666;
      margin-top: 8px;
      margin-bottom: 0;
    }

    /* Tabs para cambiar entre modos */
    .tabs {
      display: flex;
      margin-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }

    .tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      color: #666;
      font-weight: 500;
      transition: all 0.3s;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
    }

    .tab:hover {
      color: #667eea;
    }

    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }

    input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      transition: border-color 0.3s;
      box-sizing: border-box;
    }

    input:focus {
      outline: none;
      border-color: #667eea;
    }

    input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }

    button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    .secondary-btn {
      background: #999;
      margin-top: 10px;
    }

    .step-2 {
      display: none;
    }

    .step-2.active {
      display: block;
    }

    .step-1.hidden {
      display: none;
    }

    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      display: none;
    }

    .error.visible {
      display: block;
    }

    .info {
      background: #eef;
      color: #448;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      display: none;
    }

    .info.visible {
      display: block;
    }

    .success {
      background: #efe;
      color: #484;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      display: none;
    }

    .success.visible {
      display: block;
    }

    .code-display {
      background: #f0f0f0;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
      margin-bottom: 20px;
      border: 2px dashed #667eea;
    }

    .code-display .code {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      letter-spacing: 8px;
      font-family: monospace;
    }

    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .status {
      text-align: center;
      margin-top: 20px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
    }

    .back-link {
      display: block;
      text-align: center;
      margin-top: 15px;
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
      cursor: pointer;
    }

    .back-link:hover {
      text-decoration: underline;
    }

    .hint {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }

    .token-form, .credentials-form {
      display: none;
    }

    .token-form.active, .credentials-form.active {
      display: block;
    }
  `;

  @property({ type: String }) apiBaseUrl = "/admin/api";

  @state() private loginMode: LoginMode = "token";
  @state() private step: 1 | 2 = 1;
  @state() private loading = false;
  @state() private error = "";
  @state() private info = "";
  @state() private success = "";
  @state() private tempToken = "";
  @state() private debugCode = "";
  @state() private username = "";

  // Manejar login con token directo
  private async _handleTokenLogin(e: Event) {
    e.preventDefault();
    if (this.loading) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const token = formData.get("token") as string;

    if (!token || token.trim().length < 10) {
      this.error = "Por favor ingresa un token válido";
      return;
    }

    this.loading = true;
    this.error = "";
    this.success = "";

    try {
      // Verificar el token contra el gateway
      const response = await fetch(`/api/health`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token.trim()}`,
        },
      });

      if (response.ok) {
        // Token válido - guardar y redirigir
        localStorage.setItem("adminSession", token.trim());
        this.success = "✅ Token válido. Redirigiendo...";

        setTimeout(() => {
          // Obtener URL de redirección del query param o usar default
          const params = new URLSearchParams(window.location.search);
          const redirect = params.get("redirect") || "/chat";
          window.location.href = redirect;
        }, 500);
      } else {
        this.error = "Token inválido o expirado. Verifica e intenta nuevamente.";
      }
    } catch (err) {
      this.error = "Error de conexión. Asegúrate de que el gateway esté corriendo.";
    } finally {
      this.loading = false;
    }
  }

  private async _handleStep1(e: Event) {
    e.preventDefault();
    if (this.loading) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    this.username = username;
    this.loading = true;
    this.error = "";
    this.info = "";

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data: LoginResponse = await response.json();

      if (!data.ok) {
        this.error = data.error || "Login failed";
        return;
      }

      this.tempToken = data.data?.tempToken || "";
      this.debugCode = data.data?.debugCode || "";

      // Mostrar mensaje informativo
      if (this.debugCode) {
        this.info = `Your verification code is: ${this.debugCode}`;
      } else {
        this.info =
          data.data?.message || "Check your Telegram for the verification code";
      }

      // Avanzar al paso 2
      this.step = 2;
    } catch (err) {
      this.error = "Network error. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private async _handleStep2(e: Event) {
    e.preventDefault();
    if (this.loading) return;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const code = formData.get("code") as string;

    this.loading = true;
    this.error = "";

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tempToken: this.tempToken,
          code: code,
        }),
      });

      const data: LoginResponse = await response.json();

      if (!data.ok) {
        this.error = data.error || "Verification failed";
        return;
      }

      // Guardar sesión y redirigir
      if (data.data?.sessionToken) {
        localStorage.setItem("adminSession", data.data.sessionToken);
        window.location.href = "/admin/dashboard";
      }
    } catch (err) {
      this.error = "Network error. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private _goBack() {
    this.step = 1;
    this.error = "";
    this.info = "";
    this.tempToken = "";
    this.debugCode = "";
  }

  private _switchMode(mode: LoginMode) {
    this.loginMode = mode;
    this.error = "";
    this.info = "";
    this.success = "";
    this.step = 1;
  }

  render() {
    return html`
      <div class="container">
        <div class="logo">
          <h1>🦞 Agento</h1>
          <p>Panel de Control</p>
        </div>

        <div class="error ${this.error ? "visible" : ""}">${this.error}</div>
        <div class="info ${this.info ? "visible" : ""}">${this.info}</div>
        <div class="success ${this.success ? "visible" : ""}">${this.success}</div>

        <!-- Tabs para cambiar modo -->
        <div class="tabs">
          <div
            class="tab ${this.loginMode === "token" ? "active" : ""}"
            @click="${() => this._switchMode("token")}"
          >
            🔑 Token
          </div>
          <div
            class="tab ${this.loginMode === "credentials" ? "active" : ""}"
            @click="${() => this._switchMode("credentials")}"
          >
            👤 Usuario
          </div>
        </div>

        <!-- MODO TOKEN -->
        <div class="token-form ${this.loginMode === "token" ? "active" : ""}">
          <form @submit="${this._handleTokenLogin}">
            <div class="form-group">
              <label>Token de Acceso</label>
              <input
                type="text"
                name="token"
                placeholder="sk-..."
                required
                autocomplete="off"
                ?disabled="${this.loading}"
              />
              <div class="hint">
                El token se generó durante la configuración inicial.
                <br>También puedes encontrarlo con: <code>agento config get gateway.auth.token</code>
              </div>
            </div>
            <button type="submit" ?disabled="${this.loading}">
              ${this.loading
                ? html`<span class="loading"></span> Verificando...`
                : "Acceder"}
            </button>
          </form>
        </div>

        <!-- MODO CREDENCIALES -->
        <div class="credentials-form ${this.loginMode === "credentials" ? "active" : ""}">

          <!-- Paso 1: Login -->
          <form
            class="step-1 ${this.step === 2 ? "hidden" : ""}"
            @submit="${this._handleStep1}"
          >
            <div class="form-group">
              <label>Usuario</label>
              <input
                type="text"
                name="username"
                required
                autocomplete="username"
                .value="${this.username}"
                ?disabled="${this.loading}"
              />
            </div>
            <div class="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                name="password"
                required
                autocomplete="current-password"
                ?disabled="${this.loading}"
              />
            </div>
            <button type="submit" ?disabled="${this.loading}">
              ${this.loading
                ? html`<span class="loading"></span> Procesando...`
                : "Continuar"}
            </button>
          </form>

          <!-- Paso 2: 2FA -->
          <form
            class="step-2 ${this.step === 2 ? "active" : ""}"
            @submit="${this._handleStep2}"
          >
            ${this.debugCode
              ? html`
                  <div class="code-display">
                    <div class="code">${this.debugCode}</div>
                  </div>
                `
              : ""}

            <div class="form-group">
              <label>Código de Verificación</label>
              <input
                type="text"
                name="code"
                placeholder="000000"
                maxlength="6"
                pattern="[0-9]{6}"
                required
                autocomplete="one-time-code"
                ?disabled="${this.loading}"
              />
              <div class="hint">Revisa tu Telegram para el código</div>
            </div>
            <button type="submit" ?disabled="${this.loading}">
              ${this.loading
                ? html`<span class="loading"></span> Verificando...`
                : "Verificar"}
            </button>
            <button
              type="button"
              class="secondary-btn"
              @click="${this._goBack}"
              ?disabled="${this.loading}"
            >
              Cancelar
            </button>
          </form>
        </div>

        <div class="status">
          Agento v2026.2 | <a href="/chat">Chat</a> | <a href="/admin/dashboard">Dashboard</a>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "admin-login-form": AdminLoginForm;
  }
}
