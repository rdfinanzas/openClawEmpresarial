/**
 * Componente de Login para el Panel de Administración.
 *
 * Etapa 18: UI de Login - Frontend
 *
 * Implementa un formulario de login de dos pasos:
 * 1. Username + Password
 * 2. Código de verificación (2FA)
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
  `;

  @property({ type: String }) apiBaseUrl = "/admin/api";

  @state() private step: 1 | 2 = 1;
  @state() private loading = false;
  @state() private error = "";
  @state() private info = "";
  @state() private tempToken = "";
  @state() private debugCode = "";
  @state() private username = "";

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

  render() {
    return html`
      <div class="container">
        <div class="logo">
          <h1>🔧 OpenClaw</h1>
          <p>Admin Panel</p>
        </div>

        <div class="error ${this.error ? "visible" : ""}">${this.error}</div>
        <div class="info ${this.info ? "visible" : ""}">${this.info}</div>

        <!-- Paso 1: Login -->
        <form
          class="step-1 ${this.step === 2 ? "hidden" : ""}"
          @submit="${this._handleStep1}"
        >
          <div class="form-group">
            <label>Username</label>
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
            <label>Password</label>
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
              ? html`<span class="loading"></span> Processing...`
              : "Continue"}
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
            <label>Verification Code</label>
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
          </div>
          <button type="submit" ?disabled="${this.loading}">
            ${this.loading
              ? html`<span class="loading"></span> Verifying...`
              : "Verify"}
          </button>
          <button
            type="button"
            class="secondary-btn"
            @click="${this._goBack}"
            ?disabled="${this.loading}"
          >
            Cancel
          </button>
        </form>

        <div class="status">
          ✅ Etapa 15: Auth Password | ✅ Etapa 16: Auth Telegram | ⏳ Etapa 17:
          Middleware
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
