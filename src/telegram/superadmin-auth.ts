import type { SuperAdminConfig } from '../config/types.gateway.js';

/**
 * Gestiona la autenticación y autorización del superadmin en Telegram.
 * 
 * Características:
 * - Verifica que el usuario sea el superadmin configurado
 * - Maneja activación mediante palabra clave (opcional)
 * - Controla acceso exclusivo al bot de Telegram
 */
export class TelegramSuperAdminAuth {
  private readonly config: SuperAdminConfig;
  private activated: boolean = false;

  constructor(config: SuperAdminConfig) {
    this.config = config;
    
    // Si no hay palabra clave de activación, activar automáticamente
    if (!config.activationKeyword || config.activationKeyword.trim() === '') {
      this.activated = true;
    }
  }

  /**
   * Verifica si un User ID corresponde al superadmin configurado.
   * 
   * @param userId User ID de Telegram del remitente
   * @returns true si es el superadmin, false en caso contrario
   */
  isSuperAdmin(userId: number): boolean {
    return userId === this.config.telegramUserId;
  }

  /**
   * Verifica si el superadmin está activado y puede usar el bot.
   * 
   * @returns true si está activado, false si requiere activación
   */
  isActivated(): boolean {
    return this.activated;
  }

  /**
   * Maneja el proceso de activación mediante palabra clave.
   * 
   * @param message Mensaje recibido del usuario
   * @param userId User ID del remitente
   * @returns true si se activó exitosamente, false en caso contrario
   */
  handleActivation(message: string, userId: number): boolean {
    // Solo el superadmin puede activar
    if (!this.isSuperAdmin(userId)) {
      return false;
    }

    // Si ya está activado, no hacer nada
    if (this.activated) {
      return true;
    }

    // Si no hay palabra clave configurada, activar automáticamente
    if (!this.config.activationKeyword || this.config.activationKeyword.trim() === '') {
      this.activated = true;
      return true;
    }

    // Verificar si el mensaje contiene la palabra clave
    const keyword = this.config.activationKeyword.trim();
    const messageText = message.trim();
    
    if (messageText.includes(keyword)) {
      this.activated = true;
      return true;
    }

    return false;
  }

  /**
   * Determina si un mensaje debe ser procesado por el bot.
   * 
   * Reglas:
   * - Solo el superadmin puede enviar mensajes
   * - El superadmin debe estar activado (si se requiere palabra clave)
   * 
   * @param userId User ID del remitente
   * @returns true si el mensaje debe procesarse, false si debe ignorarse
   */
  shouldProcessMessage(userId: number): boolean {
    // Verificar que sea el superadmin
    if (!this.isSuperAdmin(userId)) {
      return false;
    }

    // Verificar que esté activado
    return this.activated;
  }

  /**
   * Obtiene un mensaje de respuesta para la activación.
   * 
   * @returns Mensaje de confirmación de activación
   */
  getActivationMessage(): string {
    return '✅ Bot activado. Ahora puedes usar todas las funcionalidades.';
  }

  /**
   * Obtiene un mensaje de instrucción para usuarios no autorizados.
   * 
   * @returns Mensaje informativo (opcional, puede ser null para ignorar silenciosamente)
   */
  getUnauthorizedMessage(): string | null {
    // Retornar null para ignorar silenciosamente mensajes no autorizados
    // Esto evita revelar la existencia del bot a usuarios no autorizados
    return null;
  }

  /**
   * Obtiene un mensaje de instrucción cuando se requiere activación.
   * 
   * @returns Mensaje con instrucciones de activación
   */
  getPendingActivationMessage(): string {
    if (!this.config.activationKeyword) {
      return '⚠️ El bot está configurado pero no activado. Contacta al administrador.';
    }
    return `🔐 Para activar el bot, envía un mensaje que contenga: "${this.config.activationKeyword}"`;
  }

  /**
   * Resetea el estado de activación (útil para testing o reinicio manual).
   */
  resetActivation(): void {
    if (this.config.activationKeyword && this.config.activationKeyword.trim() !== '') {
      this.activated = false;
    }
  }
}
