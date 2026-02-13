import { describe, it, expect, beforeEach } from 'vitest';
import { Bot } from 'grammy';
import type { Update, Message } from '@grammyjs/types';
import { createSuperAdminFilter, checkSuperAdminAccess } from './superadmin-filter.js';
import type { SuperAdminConfig } from '../config/types.gateway.js';

describe('Telegram Superadmin Integration', () => {
  const SUPERADMIN_USER_ID = 123456789;
  const OTHER_USER_ID = 987654321;
  const ACTIVATION_KEYWORD = 'ACTIVAR_BOT';

  describe('createSuperAdminFilter middleware', () => {
    it('should allow messages from superadmin after activation', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      // Simular contexto de mensaje
      const ctx = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          text: ACTIVATION_KEYWORD,
        } as Message,
        reply: async (text: string) => {
          expect(text).toContain('activado');
        },
      };

      const next = async () => {
        nextCalled = true;
      };

      // Primera llamada con palabra clave - debe activar
      await filter(ctx as any, next);
      expect(nextCalled).toBe(false); // No procesa el mensaje de activación

      // Segunda llamada - debe procesar
      nextCalled = false;
      ctx.message.text = 'Hola bot';
      await filter(ctx as any, next);
      expect(nextCalled).toBe(true);
    });

    it('should block messages from non-superadmin users', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: '',
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        message: {
          from: { id: OTHER_USER_ID },
          text: 'Hola bot',
        } as Message,
      };

      const next = async () => {
        nextCalled = true;
      };

      await filter(ctx as any, next);
      expect(nextCalled).toBe(false);
    });

    it('should auto-activate when no keyword is set', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: '',
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          text: 'Hola bot',
        } as Message,
      };

      const next = async () => {
        nextCalled = true;
      };

      await filter(ctx as any, next);
      expect(nextCalled).toBe(true);
    });

    it('should allow all messages when superadmin is disabled', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: false,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        message: {
          from: { id: OTHER_USER_ID },
          text: 'Hola bot',
        } as Message,
      };

      const next = async () => {
        nextCalled = true;
      };

      await filter(ctx as any, next);
      expect(nextCalled).toBe(true);
    });

    it('should handle messages without user ID', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        message: {
          text: 'Hola bot',
        } as Message,
      };

      const next = async () => {
        nextCalled = true;
      };

      await filter(ctx as any, next);
      expect(nextCalled).toBe(false);
    });

    it('should pass through non-message updates', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        // No message, no editedMessage
        update: {} as Update,
      };

      const next = async () => {
        nextCalled = true;
      };

      await filter(ctx as any, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe('checkSuperAdminAccess helper', () => {
    it('should allow access for correct user after activation', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };

      // Primera verificación con palabra clave
      const result1 = checkSuperAdminAccess(config, SUPERADMIN_USER_ID, ACTIVATION_KEYWORD);
      expect(result1.allowed).toBe(true);

      // Segunda verificación sin palabra clave
      const result2 = checkSuperAdminAccess(config, SUPERADMIN_USER_ID, 'otro mensaje');
      expect(result2.allowed).toBe(true);
    });

    it('should deny access for wrong user', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: true,
      };

      const result = checkSuperAdminAccess(config, OTHER_USER_ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_superadmin');
    });

    it('should deny access when not activated', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };

      const result = checkSuperAdminAccess(config, SUPERADMIN_USER_ID, 'mensaje sin keyword');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('not_activated');
    });

    it('should deny access when no user ID provided', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: true,
      };

      const result = checkSuperAdminAccess(config, undefined);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('no_user_id');
    });

    it('should allow access when config is disabled', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: false,
      };

      const result = checkSuperAdminAccess(config, OTHER_USER_ID);
      expect(result.allowed).toBe(true);
    });

    it('should allow access when config is undefined', () => {
      const result = checkSuperAdminAccess(undefined, OTHER_USER_ID);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Activation state persistence', () => {
    it('should maintain activation state across multiple messages', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);

      // Primera llamada - activación
      let nextCalled = false;
      const ctx1 = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          text: ACTIVATION_KEYWORD,
        } as Message,
        reply: async () => {},
      };
      await filter(ctx1 as any, async () => { nextCalled = true; });
      expect(nextCalled).toBe(false);

      // Segunda llamada - debe estar activado
      nextCalled = false;
      const ctx2 = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          text: 'Mensaje 1',
        } as Message,
      };
      await filter(ctx2 as any, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);

      // Tercera llamada - debe seguir activado
      nextCalled = false;
      const ctx3 = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          text: 'Mensaje 2',
        } as Message,
      };
      await filter(ctx3 as any, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle edited messages', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);
      let nextCalled = false;

      const ctx = {
        editedMessage: {
          from: { id: SUPERADMIN_USER_ID },
          text: 'Mensaje editado',
        } as Message,
      };

      await filter(ctx as any, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('should handle messages with captions instead of text', async () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };

      const filter = createSuperAdminFilter(config);

      const ctx = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          caption: ACTIVATION_KEYWORD,
        } as Message,
        reply: async () => {},
      };

      await filter(ctx as any, async () => {});
      
      // Segundo mensaje debe ser procesado
      let nextCalled = false;
      const ctx2 = {
        message: {
          from: { id: SUPERADMIN_USER_ID },
          caption: 'Foto con caption',
        } as Message,
      };
      await filter(ctx2 as any, async () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });
});
