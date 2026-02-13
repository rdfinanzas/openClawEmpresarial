/**
 * Componente de estado de canales para el Dashboard.
 *
 * Etapa 20: Dashboard Principal - Frontend
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface ChannelHealth {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  latency?: number;
  lastError?: string;
}

/**
 * Estado de canales del Panel Admin
 */
@customElement("channel-status")
export class ChannelStatus extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .refresh-btn {
      background: none;
      border: none;
      color: #667eea;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .refresh-btn:hover {
      text-decoration: underline;
    }

    .refresh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .channel-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .channel-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border-radius: 8px;
      background: #f8f9fa;
      transition: background 0.2s;
    }

    .channel-item:hover {
      background: #e9ecef;
    }

    .channel-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .channel-icon {
      font-size: 24px;
    }

    .channel-name {
      font-weight: 500;
      color: #333;
    }

    .channel-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status-indicator.connected {
      background: #4caf50;
      box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
    }

    .status-indicator.disconnected {
      background: #9e9e9e;
    }

    .status-indicator.error {
      background: #f44336;
      box-shadow: 0 0 0 3px rgba(244, 67, 54, 0.2);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .status-text {
      font-size: 14px;
      color: #666;
      text-transform: capitalize;
    }

    .latency {
      font-size: 12px;
      color: #999;
      margin-left: 8px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .empty {
      text-align: center;
      padding: 40px;
      color: #999;
      font-style: italic;
    }
  `;

  @property({ type: Array }) channels: ChannelHealth[] = [];
  @property({ type: Boolean }) loading = false;

  private _getChannelIcon(channelId: string): string {
    const icons: Record<string, string> = {
      telegram: "📱",
      whatsapp: "💬",
      slack: "💼",
      discord: "🎮",
      signal: "🔒",
      imessage: "🍎",
    };
    return icons[channelId.toLowerCase()] || "📡";
  }

  private _handleRefresh() {
    this.dispatchEvent(new CustomEvent("refresh"));
  }

  render() {
    return html`
      <div class="container">
        <div class="header">
          <div class="title">Channel Status</div>
          <button
            class="refresh-btn"
            @click="${this._handleRefresh}"
            ?disabled="${this.loading}"
          >
            ${this.loading ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
        </div>

        ${this.loading
          ? html`<div class="loading">Loading channels...</div>`
          : this.channels.length === 0
            ? html`<div class="empty">No channels configured</div>`
            : html`
                <div class="channel-list">
                  ${this.channels.map(
                    (channel) => html`
                      <div class="channel-item">
                        <div class="channel-info">
                          <span class="channel-icon">
                            ${this._getChannelIcon(channel.id)}
                          </span>
                          <span class="channel-name">${channel.name}</span>
                        </div>
                        <div class="channel-status">
                          <span
                            class="status-indicator ${channel.status}"
                          ></span>
                          <span class="status-text">${channel.status}</span>
                          ${channel.latency
                            ? html`<span class="latency"
                                >(${channel.latency}ms)</span
                              >`
                            : ""}
                        </div>
                      </div>
                    `
                  )}
                </div>
              `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "channel-status": ChannelStatus;
  }
}
