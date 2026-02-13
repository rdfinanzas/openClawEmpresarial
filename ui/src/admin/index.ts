/**
 * Panel de Administración - Componentes Lit
 *
 * Etapas implementadas:
 * - ✅ 18: UI de Login - Frontend
 * - ✅ 20: Dashboard Principal - Frontend
 *
 * Uso:
 * ```html
 * <admin-login-form></admin-login-form>
 * <admin-dashboard></admin-dashboard>
 * ```
 */

export { AdminLoginForm } from "./components/login-form.js";
export { AdminDashboard } from "./dashboard.js";
export { MetricCard } from "./components/metric-card.js";
export { ChannelStatus } from "./components/channel-status.js";

// Re-exportar tipos
export type { ChannelHealth } from "./components/channel-status.js";
