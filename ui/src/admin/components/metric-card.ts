/**
 * Tarjeta de métricas para el Dashboard del Panel Admin.
 *
 * Etapa 20: Dashboard Principal - Frontend
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * Tarjeta de métrica individual
 */
@customElement("metric-card")
export class MetricCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .title {
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .icon {
      font-size: 24px;
      opacity: 0.7;
    }

    .value {
      font-size: 36px;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
    }

    .change {
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .change.positive {
      color: #4caf50;
    }

    .change.negative {
      color: #f44336;
    }

    .change.neutral {
      color: #999;
    }

    .loading {
      display: inline-block;
      width: 36px;
      height: 36px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `;

  @property({ type: String }) title = "";
  @property({ type: String }) value = "";
  @property({ type: String }) icon = "";
  @property({ type: String }) change = "";
  @property({ type: String }) changeType: "positive" | "negative" | "neutral" =
    "neutral";
  @property({ type: Boolean }) loading = false;

  render() {
    return html`
      <div class="card">
        <div class="header">
          <div class="title">${this.title}</div>
          <div class="icon">${this.icon}</div>
        </div>

        ${this.loading
          ? html`<div class="loading"></div>`
          : html`<div class="value">${this.value}</div>`}

        ${this.change && !this.loading
          ? html`
              <div class="change ${this.changeType}">
                ${this.changeType === "positive"
                  ? "↑"
                  : this.changeType === "negative"
                    ? "↓"
                    : "→"}
                ${this.change}
              </div>
            `
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "metric-card": MetricCard;
  }
}
