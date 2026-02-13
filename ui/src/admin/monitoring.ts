/**
 * Página de Monitoreo en el Panel Admin
 *
 * Etapa 24: UI de Monitoreo en Panel
 *
 * Muestra:
 * - Estado de canales en tiempo real
 * - Métricas de salud del gateway
 * - Logs recientes de errores
 * - Alertas activas
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./components/channel-status.js";
import type { ChannelHealth } from "./components/channel-status.js";

interface HealthMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    percentage: number;
  };
  websocket: {
    connected: boolean;
    clients: number;
  };
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  module?: string;
}

/**
 * Página de Monitoreo del Panel Admin
 */
@customElement("admin-monitoring")
export class AdminMonitoring extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        sans-serif;
      background: #f5f7fa;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 30px;
    }

    h1 {
      color: #333;
      margin: 0 0 30px 0;
      font-size: 28px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .card h2 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    .status-indicator.online {
      background: #4caf50;
      box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
    }

    .status-indicator.offline {
      background: #f44336;
      animation: none;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.6;
      }
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .metric-item {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    }

    .metric-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }

    .metric-unit {
      font-size: 14px;
      color: #666;
      margin-left: 4px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      margin-top: 8px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }

    .progress-fill.low {
      background: #4caf50;
    }

    .progress-fill.medium {
      background: #ff9800;
    }

    .progress-fill.high {
      background: #f44336;
    }

    .log-container {
      max-height: 400px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 13px;
    }

    .log-entry {
      padding: 10px;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 12px;
    }

    .log-entry:last-child {
      border-bottom: none;
    }

    .log-timestamp {
      color: #999;
      min-width: 80px;
    }

    .log-level {
      min-width: 50px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
    }

    .log-level.info {
      color: #2196f3;
    }

    .log-level.warn {
      color: #ff9800;
    }

    .log-level.error {
      color: #f44336;
    }

    .log-message {
      color: #333;
      flex: 1;
    }

    .log-module {
      color: #999;
      font-size: 11px;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .refresh-info {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .alert-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .alert-badge.critical {
      background: #ffebee;
      color: #c62828;
    }

    .alert-badge.warning {
      background: #fff3e0;
      color: #ef6c00;
    }

    .alert-badge.info {
      background: #e3f2fd;
      color: #1565c0;
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }

      .metric-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  @state() private channels: ChannelHealth[] = [];
  @state() private metrics: HealthMetrics | null = null;
  @state() private logs: LogEntry[] = [];
  @state() private loading = true;
  @state() private lastUpdated = "";

  private refreshInterval?: number;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
    this.refreshInterval = window.setInterval(() => {
      this._loadData();
    }, 30000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private async _loadData() {
    this.loading = true;

    try {
      const sessionToken = localStorage.getItem("adminSession");

      // Cargar datos en paralelo
      const [channelsRes, metricsRes, logsRes] = await Promise.all([
        fetch("/admin/api/channels/health", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        fetch("/admin/api/dashboard/health", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }),
        // Logs vendrían de otro endpoint
        Promise.resolve({ ok: true, json: async () => ({ logs: this.getMockLogs() }) }),
      ]);

      if (channelsRes.ok) {
        const channelsData = await channelsRes.json();
        this.channels = channelsData.data?.channels || [];
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        this.metrics = metricsData.data;
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        this.logs = logsData.logs;
      }

      this.lastUpdated = new Date().toLocaleTimeString();
    } catch (error) {
      console.error("Failed to load monitoring data", error);
    } finally {
      this.loading = false;
    }
  }

  private getMockLogs(): LogEntry[] {
    return [
      {
        timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
        level: "info",
        message: "Gateway health check passed",
        module: "health",
      },
      {
        timestamp: new Date(Date.now() - 1000 * 120).toISOString(),
        level: "info",
        message: "Telegram channel connected",
        module: "telegram",
      },
      {
        timestamp: new Date(Date.now() - 1000 * 300).toISOString(),
        level: "warn",
        message: "High memory usage detected: 78%",
        module: "monitor",
      },
      {
        timestamp: new Date(Date.now() - 1000 * 600).toISOString(),
        level: "info",
        message: "Admin login successful",
        module: "auth",
      },
    ];
  }

  private _formatBytes(bytes: number): string {
    const mb = Math.round(bytes / 1024 / 1024);
    return `${mb} MB`;
  }

  private _formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  render() {
    return html`
      <div class="container">
        <h1>📊 Monitoring</h1>

        ${this.loading
          ? html`<div class="loading">Loading...</div>`
          : html`
              <div class="grid">
                <!-- Estado del Sistema -->
                <div class="card">
                  <h2>🖥️ System Status</h2>
                  <div class="status-bar">
                    <div class="status-item">
                      <span
                        class="status-indicator ${this.metrics?.status === "healthy"
                          ? "online"
                          : "offline"}"
                      ></span>
                      <span>${this.metrics?.status === "healthy" ? "Online" : "Issues Detected"}</span>
                    </div>
                    <span class="alert-badge ${this.metrics?.status === "healthy" ? "info" : "warning"}">
                      ${this.metrics?.status === "healthy" ? "All Good" : "Check Required"}
                    </span>
                  </div>

                  <div class="metric-grid">
                    <div class="metric-item">
                      <div class="metric-label">Uptime</div>
                      <div class="metric-value">
                        ${this._formatDuration(this.metrics?.uptime || 0)}
                      </div>
                    </div>

                    <div class="metric-item">
                      <div class="metric-label">WebSocket Clients</div>
                      <div class="metric-value">
                        ${this.metrics?.websocket.clients || 0}
                      </div>
                    </div>

                    <div class="metric-item">
                      <div class="metric-label">Memory Usage</div>
                      <div class="metric-value">
                        ${this.metrics?.memory.percentage || 0}%
                        <span class="metric-unit">
                          (${this._formatBytes(this.metrics?.memory.used || 0)})
                        </span>
                      </div>
                      <div class="progress-bar">
                        <div
                          class="progress-fill ${(this.metrics?.memory.percentage || 0) > 90
                            ? "high"
                            : (this.metrics?.memory.percentage || 0) > 70
                              ? "medium"
                              : "low"}"
                          style="width: ${this.metrics?.memory.percentage || 0}%"
                        ></div>
                      </div>
                    </div>

                    <div class="metric-item">
                      <div class="metric-label">CPU Usage</div>
                      <div class="metric-value">
                        ${this.metrics?.cpu.percentage || 0}%
                      </div>
                      <div class="progress-bar">
                        <div
                          class="progress-fill ${(this.metrics?.cpu.percentage || 0) > 80
                            ? "high"
                            : (this.metrics?.cpu.percentage || 0) > 50
                              ? "medium"
                              : "low"}"
                          style="width: ${this.metrics?.cpu.percentage || 0}%"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Estado de Canales -->
                <div class="card">
                  <h2>📡 Channel Status</h2>
                  <channel-status
                    .channels="${this.channels}"
                    ?loading="${this.loading}"
                    @refresh="${this._loadData}"
                  ></channel-status>
                </div>

                <!-- Logs Recientes -->
                <div class="card" style="grid-column: 1 / -1;">
                  <h2>📝 Recent Logs</h2>
                  <div class="log-container">
                    ${this.logs.map(
                      (log) => html`
                        <div class="log-entry">
                          <span class="log-timestamp">
                            ${new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span class="log-level ${log.level}">
                            ${log.level}
                          </span>
                          <span class="log-message">${log.message}</span>
                          ${log.module
                            ? html`<span class="log-module">${log.module}</span>`
                            : ""}
                        </div>
                      `
                    )}
                  </div>
                </div>
              </div>

              <div class="refresh-info">
                Last updated: ${this.lastUpdated} | Auto-refresh every 30 seconds
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "admin-monitoring": AdminMonitoring;
  }
}
