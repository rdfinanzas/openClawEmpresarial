/**
 * Dashboard del Panel de Administración.
 *
 * Etapa 20: Dashboard Principal - Frontend
 *
 * Componente principal que muestra:
 * - Métricas de mensajes, usuarios, tokens
 * - Estado de canales
 * - Acceso a configuración
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./components/metric-card.js";
import "./components/channel-status.js";
import type { ChannelHealth } from "./components/channel-status.js";

// Interfaces de respuesta de la API
interface DashboardMetrics {
  messages: {
    total: number;
    perChannel: Record<string, number>;
    lastHour: number;
    last24Hours: number;
  };
  users: {
    total: number;
    active: number;
    perChannel: Record<string, number>;
  };
  tokens: {
    consumed: number;
    estimatedCost: number;
  };
  channels: ChannelHealth[];
}

interface MetricsResponse {
  ok: boolean;
  data?: DashboardMetrics;
  error?: string;
}

/**
 * Dashboard del Panel Admin
 */
@customElement("admin-dashboard")
export class AdminDashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .user-info {
      font-size: 14px;
      opacity: 0.9;
    }

    .logout-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
    }

    .logout-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .two-columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
    }

    .error-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease;
      z-index: 1000;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .status-bar {
      background: white;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #666;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
    }

    .status-indicator.error {
      background: #f44336;
    }

    .last-updated {
      font-size: 12px;
      color: #999;
    }

    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .two-columns {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private metrics: DashboardMetrics | null = null;
  @state() private loading = true;
  @state() private error = "";
  @state() private lastUpdated = "";

  private refreshInterval?: number;

  connectedCallback() {
    super.connectedCallback();
    this._checkAuth();
    this._loadMetrics();
    // Auto-refresh cada 30 segundos
    this.refreshInterval = window.setInterval(() => {
      this._loadMetrics();
    }, 30000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private _checkAuth() {
    const sessionToken = localStorage.getItem("adminSession");
    if (!sessionToken) {
      window.location.href = "/admin/login";
      return;
    }

    // Verificar que la sesión sea válida
    fetch("/admin/api/auth/session", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok || !data.data?.valid) {
          localStorage.removeItem("adminSession");
          window.location.href = "/admin/login";
        }
      })
      .catch(() => {
        localStorage.removeItem("adminSession");
        window.location.href = "/admin/login";
      });
  }

  private async _loadMetrics() {
    const sessionToken = localStorage.getItem("adminSession");
    if (!sessionToken) return;

    this.loading = true;

    try {
      const response = await fetch("/admin/api/dashboard/metrics", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      const data: MetricsResponse = await response.json();

      if (!data.ok) {
        this.error = data.error || "Failed to load metrics";
        return;
      }

      this.metrics = data.data || null;
      this.lastUpdated = new Date().toLocaleTimeString();
      this.error = "";
    } catch (err) {
      this.error = "Network error. Please try again.";
    } finally {
      this.loading = false;
    }
  }

  private async _handleLogout() {
    const sessionToken = localStorage.getItem("adminSession");
    if (sessionToken) {
      try {
        await fetch("/admin/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        // Ignorar errores de logout
      }
    }
    localStorage.removeItem("adminSession");
    window.location.href = "/admin/login";
  }

  private _formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  private _formatCurrency(amount: number): string {
    return "$" + amount.toFixed(2);
  }

  render() {
    return html`
      ${this.error
        ? html` <div class="error-toast">${this.error}</div> `
        : ""}

      <div class="header">
        <h1>🔧 OpenClaw Admin</h1>
        <div class="header-actions">
          <span class="user-info">Administrator</span>
          <button class="logout-btn" @click="${this._handleLogout}">
            Logout
          </button>
        </div>
      </div>

      <div class="container">
        <div class="status-bar">
          <div class="status-item">
            <span class="status-indicator"></span>
            <span>System Online</span>
          </div>
          <div class="last-updated">
            Last updated: ${this.lastUpdated || "Never"}
          </div>
        </div>

        <!-- Métricas Principales -->
        <div class="section">
          <div class="section-title">📊 Overview</div>
          <div class="metrics-grid">
            <metric-card
              title="Total Messages"
              value="${this._formatNumber(
                this.metrics?.messages.total ?? 0
              )}"
              icon="💬"
              change="${this._formatNumber(
                this.metrics?.messages.last24Hours ?? 0
              )} in 24h"
              changeType="neutral"
              ?loading="${this.loading}"
            ></metric-card>

            <metric-card
              title="Active Users"
              value="${this._formatNumber(this.metrics?.users.active ?? 0)}"
              icon="👥"
              change="${this._formatNumber(
                this.metrics?.users.total ?? 0
              )} total"
              changeType="neutral"
              ?loading="${this.loading}"
            ></metric-card>

            <metric-card
              title="Tokens Consumed"
              value="${this._formatNumber(
                this.metrics?.tokens.consumed ?? 0
              )}"
              icon="🪙"
              change="${this._formatCurrency(
                this.metrics?.tokens.estimatedCost ?? 0
              )} est."
              changeType="neutral"
              ?loading="${this.loading}"
            ></metric-card>
          </div>
        </div>

        <!-- Estado de Canales -->
        <div class="section">
          <div class="section-title">📡 Channels</div>
          <div class="two-columns">
            <channel-status
              .channels="${this.metrics?.channels ?? []}"
              ?loading="${this.loading}"
              @refresh="${this._loadMetrics}"
            ></channel-status>

            <!-- Placeholder para futuras métricas -->
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 16px;">
                📈 Quick Stats
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px; color: #666;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Messages (1h):</span>
                  <strong>${this._formatNumber(
                    this.metrics?.messages.lastHour ?? 0
                  )}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Connected Channels:</span>
                  <strong>
                    ${this.metrics?.channels.filter((c) => c.status === "connected")
                      .length ?? 0}
                    / ${this.metrics?.channels.length ?? 0}
                  </strong>
                </div>
                <div style="margin-top: 8px; padding-top: 12px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
                  ✅ Etapa 20: Dashboard Frontend completada
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "admin-dashboard": AdminDashboard;
  }
}
