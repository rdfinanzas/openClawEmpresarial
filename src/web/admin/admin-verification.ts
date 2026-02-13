/**
 * Verificación de administrador vía Telegram.
 *
 * Etapa 16: Sistema de Autenticación - Paso 2 (Telegram)
 *
 * Este módulo envía códigos de verificación al superadmin vía Telegram
 * para completar el proceso de 2FA del panel de administración.
 */

import { Bot } from "grammy";
import { loadConfig } from "../../config/config.js";
import { logWarn } from "../../logger.js";

const logger = (message: string, meta?: Record<string, unknown>) => {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  logWarn(`admin-verification: ${message}${metaStr}`);
};

/**
 * Envía un código de verificación al superadmin vía Telegram.
 *
 * @param code Código de 6 dígitos a enviar
 * @returns true si se envió exitosamente, false en caso contrario
 */
export async function sendVerificationCodeToTelegram(
  code: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const config = loadConfig();

    // Verificar que hay configuración de superadmin
    const superadminConfig = config.superadmin;
    if (!superadminConfig?.enabled) {
      return {
        ok: false,
        error: "Superadmin not configured",
      };
    }

    const superadminUserId = superadminConfig.telegramUserId;
    if (!superadminUserId || superadminUserId <= 0) {
      return {
        ok: false,
        error: "Invalid superadmin Telegram User ID",
      };
    }

    // Obtener token de Telegram
    const telegramConfig = config.channels?.telegram;
    if (!telegramConfig?.enabled) {
      return {
        ok: false,
        error: "Telegram channel not enabled",
      };
    }

    // Intentar obtener token de la cuenta default
    const accounts = telegramConfig.accounts;
    let botToken: string | undefined;

    if (accounts) {
      // Buscar cuenta default - accounts es Record<string, TelegramAccountConfig>
      const accountList = Object.values(accounts);
      const defaultAccount = accountList.find((acc) => acc.default) || accountList[0];
      if (defaultAccount) {
        botToken = defaultAccount.botToken;

        // Si hay tokenFile, intentar leerlo
        if (!botToken && defaultAccount.tokenFile) {
          try {
            const fs = await import("node:fs");
            botToken = fs.readFileSync(defaultAccount.tokenFile, "utf-8").trim();
          } catch {
            logger("Failed to read token file", { path: defaultAccount.tokenFile });
          }
        }
      }
    }

    // Fallback a variable de entorno
    if (!botToken) {
      botToken = process.env.TELEGRAM_BOT_TOKEN;
    }

    if (!botToken) {
      return {
        ok: false,
        error: "Telegram bot token not configured",
      };
    }

    // Crear instancia del bot
    const bot = new Bot(botToken);

    // Mensaje de verificación
    const message = `
🔐 <b>OpenClaw Admin Panel - Verification Code</b>

Your verification code is: <code>${code}</code>

This code will expire in 5 minutes.

If you didn't request this code, please ignore this message.
    `.trim();

    // Enviar mensaje
    await bot.api.sendMessage(superadminUserId, message, {
      parse_mode: "HTML",
    });

    logger("Verification code sent to superadmin", {
      userId: superadminUserId,
      codePrefix: code.slice(0, 2) + "****",
    });

    return { ok: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger("Failed to send verification code", { error: errorMessage });

    return {
      ok: false,
      error: `Failed to send Telegram message: ${errorMessage}`,
    };
  }
}

/**
 * Formato alternativo del mensaje con botones inline (para futuras mejoras)
 */
export function formatVerificationMessage(
  code: string,
  expiresInMinutes: number = 5
): { text: string; parseMode: "HTML" } {
  return {
    text: `
🔐 <b>OpenClaw Admin Panel</b>

Your verification code:
<code>${code}</code>

⏱ Expires in: ${expiresInMinutes} minutes

Enter this code in the admin panel to complete your login.
    `.trim(),
    parseMode: "HTML",
  };
}

/**
 * Verifica si la configuración de Telegram está completa para enviar códigos.
 */
export function canSendTelegramVerification(): {
  canSend: boolean;
  reason?: string;
} {
  const config = loadConfig();

  // Verificar superadmin
  const superadminConfig = config.superadmin;
  if (!superadminConfig?.enabled) {
    return { canSend: false, reason: "Superadmin not configured" };
  }

  if (!superadminConfig.telegramUserId || superadminConfig.telegramUserId <= 0) {
    return { canSend: false, reason: "Invalid superadmin Telegram User ID" };
  }

  // Verificar Telegram
  const telegramConfig = config.channels?.telegram;
  if (!telegramConfig?.enabled) {
    return { canSend: false, reason: "Telegram channel not enabled" };
  }

  // Verificar que hay al menos una cuenta con token o tokenFile
  const accounts = telegramConfig.accounts;
  const hasValidAccount = accounts
    ? Object.values(accounts).some(
        (acc) => acc.botToken || acc.tokenFile
      )
    : false;

  if (!hasValidAccount && !process.env.TELEGRAM_BOT_TOKEN) {
    return { canSend: false, reason: "Telegram bot token not configured" };
  }

  return { canSend: true };
}
