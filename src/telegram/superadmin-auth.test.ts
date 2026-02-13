import { describe, it, expect, beforeEach } from 'vitest';
import { TelegramSuperAdminAuth } from './superadmin-auth.js';
import type { SuperAdminConfig } from '../config/types.gateway.js';

describe('TelegramSuperAdminAuth', () => {
  const SUPERADMIN_USER_ID = 123456789;
  const OTHER_USER_ID = 987654321;
  const ACTIVATION_KEYWORD = 'ACTIVAR_BOT';

  describe('with activation keyword', () => {
    let auth: TelegramSuperAdminAuth;

    beforeEach(() => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: ACTIVATION_KEYWORD,
        enabled: true,
      };
      auth = new TelegramSuperAdminAuth(config);
    });

    it('should identify superadmin correctly', () => {
      expect(auth.isSuperAdmin(SUPERADMIN_USER_ID)).toBe(true);
      expect(auth.isSuperAdmin(OTHER_USER_ID)).toBe(false);
    });

    it('should not be activated initially', () => {
      expect(auth.isActivated()).toBe(false);
    });

    it('should activate when superadmin sends keyword', () => {
      const result = auth.handleActivation(ACTIVATION_KEYWORD, SUPERADMIN_USER_ID);
      expect(result).toBe(true);
      expect(auth.isActivated()).toBe(true);
    });

    it('should activate when keyword is in message', () => {
      const result = auth.handleActivation(`Hola, ${ACTIVATION_KEYWORD} por favor`, SUPERADMIN_USER_ID);
      expect(result).toBe(true);
      expect(auth.isActivated()).toBe(true);
    });

    it('should not activate with wrong keyword', () => {
      const result = auth.handleActivation('PALABRA_INCORRECTA', SUPERADMIN_USER_ID);
      expect(result).toBe(false);
      expect(auth.isActivated()).toBe(false);
    });

    it('should not activate for non-superadmin user', () => {
      const result = auth.handleActivation(ACTIVATION_KEYWORD, OTHER_USER_ID);
      expect(result).toBe(false);
      expect(auth.isActivated()).toBe(false);
    });

    it('should not process messages before activation', () => {
      expect(auth.shouldProcessMessage(SUPERADMIN_USER_ID)).toBe(false);
    });

    it('should process messages after activation', () => {
      auth.handleActivation(ACTIVATION_KEYWORD, SUPERADMIN_USER_ID);
      expect(auth.shouldProcessMessage(SUPERADMIN_USER_ID)).toBe(true);
    });

    it('should never process messages from non-superadmin', () => {
      auth.handleActivation(ACTIVATION_KEYWORD, SUPERADMIN_USER_ID);
      expect(auth.shouldProcessMessage(OTHER_USER_ID)).toBe(false);
    });

    it('should return activation message', () => {
      const message = auth.getActivationMessage();
      expect(message).toContain('activado');
    });

    it('should return null for unauthorized users (silent ignore)', () => {
      const message = auth.getUnauthorizedMessage();
      expect(message).toBeNull();
    });

    it('should return pending activation message', () => {
      const message = auth.getPendingActivationMessage();
      expect(message).toContain(ACTIVATION_KEYWORD);
    });

    it('should reset activation state', () => {
      auth.handleActivation(ACTIVATION_KEYWORD, SUPERADMIN_USER_ID);
      expect(auth.isActivated()).toBe(true);
      
      auth.resetActivation();
      expect(auth.isActivated()).toBe(false);
    });
  });

  describe('without activation keyword', () => {
    let auth: TelegramSuperAdminAuth;

    beforeEach(() => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: '', // Sin palabra clave
        enabled: true,
      };
      auth = new TelegramSuperAdminAuth(config);
    });

    it('should be activated automatically', () => {
      expect(auth.isActivated()).toBe(true);
    });

    it('should process messages immediately for superadmin', () => {
      expect(auth.shouldProcessMessage(SUPERADMIN_USER_ID)).toBe(true);
    });

    it('should still reject non-superadmin users', () => {
      expect(auth.shouldProcessMessage(OTHER_USER_ID)).toBe(false);
    });

    it('should not reset activation when no keyword is set', () => {
      expect(auth.isActivated()).toBe(true);
      auth.resetActivation();
      expect(auth.isActivated()).toBe(true); // Permanece activado
    });
  });

  describe('with undefined activation keyword', () => {
    let auth: TelegramSuperAdminAuth;

    beforeEach(() => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        // activationKeyword no definido
        enabled: true,
      };
      auth = new TelegramSuperAdminAuth(config);
    });

    it('should be activated automatically when keyword is undefined', () => {
      expect(auth.isActivated()).toBe(true);
    });

    it('should process messages immediately', () => {
      expect(auth.shouldProcessMessage(SUPERADMIN_USER_ID)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in keyword', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: '  ACTIVAR  ',
        enabled: true,
      };
      const auth = new TelegramSuperAdminAuth(config);

      const result = auth.handleActivation('  ACTIVAR  ', SUPERADMIN_USER_ID);
      expect(result).toBe(true);
    });

    it('should handle case-sensitive keywords', () => {
      const config: SuperAdminConfig = {
        telegramUserId: SUPERADMIN_USER_ID,
        activationKeyword: 'ACTIVAR',
        enabled: true,
      };
      const auth = new TelegramSuperAdminAuth(config);

      // Debe coincidir exactamente
      expect(auth.handleActivation('activar', SUPERADMIN_USER_ID)).toBe(false);
      expect(auth.handleActivation('ACTIVAR', SUPERADMIN_USER_ID)).toBe(true);
    });

    it('should handle user ID 0', () => {
      const config: SuperAdminConfig = {
        telegramUserId: 0,
        enabled: true,
      };
      const auth = new TelegramSuperAdminAuth(config);

      expect(auth.isSuperAdmin(0)).toBe(true);
      expect(auth.isSuperAdmin(123)).toBe(false);
    });
  });
});
