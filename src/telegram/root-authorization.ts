import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import type { AuthorizationRequest } from '../gateway/authorization-queue.js';
import { authorizationQueue } from '../gateway/authorization-queue.js';
import { getChildLogger } from '../logging.js';

const logger = getChildLogger({ module: 'telegram-root-authorization' });

/**
 * Configuración para el sistema de autorización root vía Telegram.
 */
export interface RootAuthorizationConfig {
  /** User ID del superadmin que recibirá las solicitudes */
  superadminUserId: number;
  /** Timeout por defecto para solicitudes (ms). Default: 5 minutos */
  defaultTimeoutMs?: number;
}

/**
 * Gestiona el envío de solicitudes de autorización al superadmin vía Telegram.
 * 
 * Características:
 * - Envía mensajes con botones inline "Aprobar" / "Rechazar"
 * - Maneja callbacks de botones
 * - Integra con AuthorizationQueue
 * - Formatea mensajes con detalles de la operación
 */
export class TelegramRootAuthorization {
  private readonly bot: Bot;
  private readonly config: Required<RootAuthorizationConfig>;

  constructor(bot: Bot, config: RootAuthorizationConfig) {
    this.bot = bot;
    this.config = {
      superadminUserId: config.superadminUserId,
      defaultTimeoutMs: config.defaultTimeoutMs ?? 5 * 60 * 1000,
    };

    // Registrar handler de callbacks
    this.registerCallbackHandlers();
  }

  /**
   * Formatea los parámetros de una operación para mostrar en el mensaje.
   */
  private formatParams(params: Record<string, unknown>): string {
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(params)) {
      let formattedValue: string;
      
      if (typeof value === 'string') {
        formattedValue = value.length > 100 ? `${value.substring(0, 100)}...` : value;
      } else if (typeof value === 'object' && value !== null) {
        formattedValue = JSON.stringify(value, null, 2);
        if (formattedValue.length > 200) {
          formattedValue = `${formattedValue.substring(0, 200)}...`;
        }
      } else {
        formattedValue = String(value);
      }
      
      lines.push(`  • ${key}: ${formattedValue}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Formatea el mensaje de solicitud de autorización.
   */
  private formatAuthorizationMessage(request: AuthorizationRequest): string {
    const expiresIn = Math.floor((request.expiresAt - Date.now()) / 1000);
    const expiresMinutes = Math.floor(expiresIn / 60);
    const expiresSeconds = expiresIn % 60;
    
    const parts = [
      '🔐 **SOLICITUD DE AUTORIZACIÓN**',
      '',
      `**Operación:** ${request.operation}`,
      '',
      '**Parámetros:**',
      this.formatParams(request.params),
      '',
      `⏱️ Expira en: ${expiresMinutes}m ${expiresSeconds}s`,
      `🆔 ID: \`${request.id}\``,
    ];
    
    return parts.join('\n');
  }

  /**
   * Crea el teclado inline con botones de aprobación/rechazo.
   */
  private createAuthorizationKeyboard(requestId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Aprobar', `auth_approve_${requestId}`)
      .text('❌ Rechazar', `auth_reject_${requestId}`);
  }

  /**
   * Envía una solicitud de autorización al superadmin.
   * 
   * @param operation Nombre de la operación
   * @param params Parámetros de la operación
   * @param timeoutMs Timeout personalizado (opcional)
   * @returns Promise que se resuelve cuando se aprueba/rechaza
   */
  async requestAuthorization(
    operation: string,
    params: Record<string, unknown>,
    timeoutMs?: number
  ): Promise<boolean> {
    // Encolar la solicitud
    const requestPromise = authorizationQueue.enqueue(
      operation,
      params,
      timeoutMs ?? this.config.defaultTimeoutMs
    );

    // Obtener la solicitud recién creada
    const pending = authorizationQueue.getPending();
    const request = pending[pending.length - 1]; // La última agregada

    if (!request) {
      throw new Error('Failed to create authorization request');
    }

    try {
      // Enviar mensaje al superadmin
      const message = this.formatAuthorizationMessage(request);
      const keyboard = this.createAuthorizationKeyboard(request.id);

      await this.bot.api.sendMessage(
        this.config.superadminUserId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );

      logger.info(`Authorization request sent to superadmin: ${request.id}`);

      // Esperar respuesta
      return await requestPromise;
    } catch (error) {
      logger.error(`Failed to send authorization request: ${String(error)}`);
      // Rechazar la solicitud si no se pudo enviar
      authorizationQueue.reject(request.id, 'Failed to send request');
      throw error;
    }
  }

  /**
   * Registra los handlers de callbacks para los botones.
   */
  private registerCallbackHandlers(): void {
    // Handler para aprobar
    this.bot.callbackQuery(/^auth_approve_(.+)$/, async (ctx) => {
      const requestId = ctx.match[1];
      
      const approved = authorizationQueue.approve(requestId);
      
      if (approved) {
        await ctx.answerCallbackQuery({ text: '✅ Operación aprobada' });
        await ctx.editMessageText(
          `${ctx.callbackQuery.message?.text}\n\n✅ **APROBADA** por el superadmin`
        );
        logger.info(`Authorization approved: ${requestId}`);
      } else {
        await ctx.answerCallbackQuery({ text: '⚠️ Solicitud ya procesada o expirada' });
      }
    });

    // Handler para rechazar
    this.bot.callbackQuery(/^auth_reject_(.+)$/, async (ctx) => {
      const requestId = ctx.match[1];
      
      const rejected = authorizationQueue.reject(requestId, 'Rejected by superadmin');
      
      if (rejected) {
        await ctx.answerCallbackQuery({ text: '❌ Operación rechazada' });
        await ctx.editMessageText(
          `${ctx.callbackQuery.message?.text}\n\n❌ **RECHAZADA** por el superadmin`
        );
        logger.info(`Authorization rejected: ${requestId}`);
      } else {
        await ctx.answerCallbackQuery({ text: '⚠️ Solicitud ya procesada o expirada' });
      }
    });

    logger.info('Root authorization callback handlers registered');
  }
}
