/**
 * Gestión de APIs Empresariales en el Panel Admin.
 *
 * Etapa 32: UI de Gestión de APIs en Panel Admin
 *
 * Permite al administrador:
 * - Listar APIs registradas
 * - Registrar nuevas APIs
 * - Eliminar APIs existentes
 * - Ver detalles de configuración
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

// Tipos de API
interface DynamicEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  parameters?: Record<string, {
    type: "string" | "number" | "boolean";
    required: boolean;
    description: string;
  }>;
}

interface APIConfig {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  authType: "bearer" | "api-key" | "oauth" | "none";
  authCredentials?: {
    token?: string;
    apiKey?: string;
  };
  endpoints: DynamicEndpoint[];
  enabled: boolean;
  createdAt: string;
}

interface APIListResponse {
  ok: boolean;
  data?: { apis: APIConfig[] };
  error?: string;
}

/**
 * Panel de gestión de APIs Empresariales
 */
@customElement("api-manager")
export class APIManager extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .header h2 {
      margin: 0;
      color: #333;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-danger {
      background: #f44336;
      color: white;
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .api-list {
      display: grid;
      gap: 20px;
    }

    .api-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .api-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .api-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .api-title {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px 0;
    }

    .api-description {
      color: #666;
      margin: 0;
    }

    .api-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .api-status.enabled {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .api-status.disabled {
      background: #ffebee;
      color: #c62828;
    }

    .api-details {
      display: grid;
      gap: 12px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .detail-label {
      color: #666;
    }

    .detail-value {
      color: #333;
      font-weight: 500;
      font-family: monospace;
    }

    .api-actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .loading {
      text-align: center;
      padding: 60px;
      color: #999;
    }

    .empty {
      text-align: center;
      padding: 60px;
      color: #999;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: white;
      border-radius: 12px;
      padding: 30px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal h3 {
      margin: 0 0 20px 0;
      color: #333;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      box-sizing: border-box;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
    }

    .error-message {
      background: #ffebee;
      color: #c62828;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  @property({ type: String }) apiBaseUrl = "/admin/api";

  @state() private apis: APIConfig[] = [];
  @state() private loading = true;
  @state() private error = "";
  @state() private showModal = false;
  @state() private saving = false;

  connectedCallback() {
    super.connectedCallback();
    this._loadAPIs();
  }

  private async _loadAPIs() {
    this.loading = true;
    this.error = "";

    try {
      const sessionToken = localStorage.getItem("adminSession");
      const response = await fetch(`${this.apiBaseUrl}/apis`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      const data: APIListResponse = await response.json();

      if (data.ok && data.data) {
        this.apis = data.data.apis;
      } else {
        this.error = data.error || "Failed to load APIs";
      }
    } catch (err) {
      this.error = "Network error. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private async _handleSubmit(e: Event) {
    e.preventDefault();
    this.saving = true;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const apiConfig: Partial<APIConfig> = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      baseUrl: formData.get("baseUrl") as string,
      authType: formData.get("authType") as APIConfig["authType"],
      enabled: true,
    };

    try {
      const sessionToken = localStorage.getItem("adminSession");
      const response = await fetch(`${this.apiBaseUrl}/apis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(apiConfig),
      });

      const data = await response.json();

      if (data.ok) {
        this.showModal = false;
        await this._loadAPIs();
      } else {
        this.error = data.error || "Failed to create API";
      }
    } catch (err) {
      this.error = "Network error. Please try again.";
    } finally {
      this.saving = false;
    }
  }

  private async _handleDelete(apiId: string) {
    if (!confirm("Are you sure you want to delete this API?")) {
      return;
    }

    try {
      const sessionToken = localStorage.getItem("adminSession");
      const response = await fetch(`${this.apiBaseUrl}/apis/${apiId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.ok) {
        await this._loadAPIs();
      } else {
        const data = await response.json();
        this.error = data.error || "Failed to delete API";
      }
    } catch (err) {
      this.error = "Network error. Please try again.";
    }
  }

  private _openModal() {
    this.showModal = true;
    this.error = "";
  }

  private _closeModal() {
    this.showModal = false;
    this.error = "";
  }

  render() {
    return html`
      <div class="container">
        <div class="header">
          <h2>🔌 API Management</h2>
          <button class="btn btn-primary" @click="${this._openModal}">
            + Add API
          </button>
        </div>

        ${this.loading
          ? html`<div class="loading">Loading APIs...</div>`
          : this.apis.length === 0
            ? html`
                <div class="empty">
                  <div class="empty-icon">🔌</div>
                  <p>No APIs configured yet</p>
                  <p>Add your first API to get started</p>
                </div>
              `
            : html`
                <div class="api-list">
                  ${this.apis.map(
                    (api) => html`
                      <div class="api-card">
                        <div class="api-header">
                          <div>
                            <h3 class="api-title">${api.name}</h3>
                            <p class="api-description">${api.description}</p>
                          </div>
                          <span
                            class="api-status ${api.enabled ? "enabled" : "disabled"}"
                          >
                            ${api.enabled ? "● Enabled" : "● Disabled"}
                          </span>
                        </div>

                        <div class="api-details">
                          <div class="detail-row">
                            <span class="detail-label">Base URL</span>
                            <span class="detail-value">${api.baseUrl}</span>
                          </div>
                          <div class="detail-row">
                            <span class="detail-label">Auth Type</span>
                            <span class="detail-value">${api.authType}</span>
                          </div>
                          <div class="detail-row">
                            <span class="detail-label">Endpoints</span>
                            <span class="detail-value"
                              >${api.endpoints?.length || 0}</span
                            >
                          </div>
                          <div class="detail-row">
                            <span class="detail-label">Created</span>
                            <span class="detail-value"
                              >${new Date(api.createdAt).toLocaleDateString()}</span
                            >
                          </div>
                        </div>

                        <div class="api-actions">
                          <button
                            class="btn btn-danger"
                            @click="${() => this._handleDelete(api.id)}"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    `
                  )}
                </div>
              `}

        ${this.showModal
          ? html`
              <div class="modal-overlay" @click="${this._closeModal}">
                <div class="modal" @click="${(e: Event) => e.stopPropagation()}">
                  <h3>Add New API</h3>

                  ${this.error
                    ? html`<div class="error-message">${this.error}</div>`
                    : ""}

                  <form @submit="${this._handleSubmit}">
                    <div class="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="My API"
                      />
                    </div>

                    <div class="form-group">
                      <label>Description</label>
                      <textarea
                        name="description"
                        rows="2"
                        placeholder="Brief description of the API"
                      ></textarea>
                    </div>

                    <div class="form-group">
                      <label>Base URL</label>
                      <input
                        type="url"
                        name="baseUrl"
                        required
                        placeholder="https://api.example.com"
                      />
                    </div>

                    <div class="form-group">
                      <label>Authentication Type</label>
                      <select name="authType" required>
                        <option value="none">None</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="api-key">API Key</option>
                        <option value="oauth">OAuth 2.0</option>
                      </select>
                    </div>

                    <div class="modal-actions">
                      <button
                        type="button"
                        class="btn btn-secondary"
                        @click="${this._closeModal}"
                      >
                        Cancel
                      </button>
                      <button type="submit" class="btn btn-primary" ?disabled="${this.saving}">
                        ${this.saving
                          ? html`<span class="spinner"></span>Saving...`
                          : "Save API"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "api-manager": APIManager;
  }
}
