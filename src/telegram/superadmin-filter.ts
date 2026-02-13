import type { Context } from 'grammy';
import type { Message } from '@grammyjs/types';
import { TelegramSuperAdminAuth } from './superadmin-auth.js';
import type { SuperAdminConfig } from '../config/types.gateway.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'telegram-superadmin-filter' });

/**
 * Resultado del filtro de superadmin.
 */
export type SuperAdminFilterResult = 
  | { allowed: true }
  | { allowed: false; reason: 'not_superadmin' | 'not_activated' | 'no_user_id' };

/**
 * Crea un middleware de filtro de superadmin para el bot de Telegram.
 * 
 * Este middleware:
 * - Verifica que el mensaje provenga del superadmin configurado
 * - Maneja la activación mediante palabra clave (si está configurada)
 * - Bloquea silenciosamente mensajes de usuarios no autorizados
 * - Registra intentos de acceso bloqueados
 * 
 * @param config Configuración del superadmin
 * @returns Función middleware para grammY
 */
export function createSuperAdminFilter(config: SuperAdminConfig | undefined) {
  // Si no hay configuración de superadmin, permitir todos los mensajes (modo legacy)
  if (!config || !config.enabled) {
    logger.info('Superadmin filter disabled - all users can interact with bot');
    return async (_ctx: Context, next: () => Promise<void>) => {
      await next();
    };
  }

  const auth = new TelegramSuperAdminAuth(config);
  logger.info(`Superadmin filter enabled for user ID: ${config.telegramUserId}`);

  return async (ctx: Context, next: () => Promise<void>) => {
    // Solo filtrar mensajes (no otros tipos de updates)
    if (!ctx.message && !ctx.editedMessage) {
      await next();
      return;
    }

    const message = (ctx.message || ctx.editedMessage) as Message;
    const userId = message.from?.id;

    // Si no hay user ID, bloquear
    if (!userId) {
      logger.warn('Message without user ID blocked');
      return; // Ignorar silenciosamente
    }

    // Verificar si es el superadmin
    if (!auth.isSuperAdmin(userId)) {
      logger.warn(`Unauthorized access attempt from user ${userId}`);
      return; // Ignorar silenciosamente
    }

    // Manejar activación si hay palabra clave
    const messageText = message.text || message.caption || '';
    const wasActivated = auth.handleActivation(messageText, userId);

    if (wasActivated && !auth.isActivated()) {
      // Se intentó activar pero falló (no debería pasar si es superadmin)
      logger.error(`Activation failed for superadmin ${userId}`);
      return;
    }

    // Si se activó en este mensaje, enviar confirmación
    if (wasActivated && messageText.includes(config.activationKeyword || '')) {
      try {
        await ctx.reply(auth.getActivationMessage());
        logger.info(`Bot activated for superadmin ${userId}`);
      } catch (err) {
        logger.error(`Failed to send activation message: ${String(err)}`);
      }
      return; // No procesar el mensaje de activación como comando
    }

    // Verificar si debe procesar el mensaje
    if (!auth.shouldProcessMessage(userId)) {
      // Superadmin no activado aún
      try {
        await ctx.reply(auth.getPendingActivationMessage());
        logger.info(`Pending activation message sent to superadmin ${userId}`);
      } catch (err) {
        logger.error(`Failed to send pending activation message: ${String(err)}`);
      }
      return;
    }

    // Todo OK - procesar mensaje
    logger.debug(`Message from superadmin ${userId} allowed`);
    await next();
  };
}

/**
 * Verifica si un mensaje debe ser procesado según las reglas de superadmin.
 * Versión sin middleware para uso en código existente.
 * 
 * @param config Configuración del superadmin
 * @param userId User ID del remitente
 * @param messageText Texto del mensaje (opcional, para activación)
 * @returns Resultado del filtro
 */
export function checkSuperAdminAccess(
  config: SuperAdminConfig | undefined,
  userId: number | undefined,
  messageText?: string
): SuperAdminFilterResult {
  // Si no hay configuración, permitir acceso
  if (!config || !config.enabled) {
    return { allowed: true };
  }

  // Si no hay user ID, denegar
  if (!userId) {
    return { allowed: false, reason: 'no_user_id' };
  }

  const auth = new TelegramSuperAdminAuth(config);

  // Verificar si es superadmin
  if (!auth.isSuperAdmin(userId)) {
    return { allowed: false, reason: 'not_superadmin' };
  }

  // Manejar activación si hay texto
  if (messageText) {
    auth.handleActivation(messageText, userId);
  }

  // Verificar si debe procesar
  if (!auth.shouldProcessMessage(userId)) {
    return { allowed: false, reason: 'not_activated' };
  }

  return { allowed: true };
}
