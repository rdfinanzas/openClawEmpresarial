/**
 * Tests de Roles de Canales
 *
 * Etapa 13: Tests de Filtrado de Herramientas
 *
 * Verifica:
 * - Asignación correcta de roles por canal
 * - Operaciones permitidas/prohibidas por rol
 */

import { describe, it, expect } from "vitest";
import { getChannelRole, isOperationAllowed, SENSITIVE_OPERATIONS } from "./roles.js";

describe("Channel Roles", () => {
  describe("getChannelRole", () => {
    it("should assign superadmin role to telegram", () => {
      expect(getChannelRole("telegram")).toBe("superadmin");
      expect(getChannelRole("Telegram")).toBe("superadmin");
      expect(getChannelRole("TELEGRAM")).toBe("superadmin");
    });

    it("should assign public role to whatsapp", () => {
      expect(getChannelRole("whatsapp")).toBe("public");
      expect(getChannelRole("WhatsApp")).toBe("public");
      expect(getChannelRole("WHATSAPP")).toBe("public");
    });

    it("should assign public role to discord", () => {
      expect(getChannelRole("discord")).toBe("public");
      expect(getChannelRole("Discord")).toBe("public");
    });

    it("should assign public role to slack", () => {
      expect(getChannelRole("slack")).toBe("public");
      expect(getChannelRole("Slack")).toBe("public");
    });

    it("should assign public role to signal", () => {
      expect(getChannelRole("signal")).toBe("public");
      expect(getChannelRole("Signal")).toBe("public");
    });

    it("should assign public role to imessage", () => {
      expect(getChannelRole("imessage")).toBe("public");
      expect(getChannelRole("iMessage")).toBe("public");
    });

    it("should default to public for unknown channels", () => {
      expect(getChannelRole("unknown")).toBe("public");
      expect(getChannelRole("custom")).toBe("public");
      expect(getChannelRole("")).toBe("public");
    });
  });

  describe("isOperationAllowed - Superadmin", () => {
    it("should allow all operations for superadmin", () => {
      const role = "superadmin";
      const operations = Object.values(SENSITIVE_OPERATIONS);

      for (const operation of operations) {
        expect(
          isOperationAllowed(role, operation),
          `Operation ${operation} should be allowed for superadmin`
        ).toBe(true);
      }
    });

    it("should allow any string operation for superadmin", () => {
      const role = "superadmin";
      expect(isOperationAllowed(role, "custom_operation")).toBe(true);
      expect(isOperationAllowed(role, "dangerous_action")).toBe(true);
    });
  });

  describe("isOperationAllowed - Public", () => {
    it("should deny FILE_DELETE for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.FILE_DELETE)).toBe(false);
    });

    it("should deny FILE_WRITE for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.FILE_WRITE)).toBe(false);
    });

    it("should deny SYSTEM_EXEC for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.SYSTEM_EXEC)).toBe(false);
    });

    it("should deny CONFIG_WRITE for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.CONFIG_WRITE)).toBe(false);
    });

    it("should deny USER_DATA_ACCESS for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.USER_DATA_ACCESS)).toBe(false);
    });

    it("should deny ROOT_ACCESS for public", () => {
      expect(isOperationAllowed("public", SENSITIVE_OPERATIONS.ROOT_ACCESS)).toBe(false);
    });

    it("should allow unknown operations for public", () => {
      // Operaciones no listadas como sensibles deben ser permitidas
      expect(isOperationAllowed("public", "read_file")).toBe(true);
      expect(isOperationAllowed("public", "view_data")).toBe(true);
    });
  });

  describe("SENSITIVE_OPERATIONS constants", () => {
    it("should have all expected sensitive operations", () => {
      expect(SENSITIVE_OPERATIONS.FILE_DELETE).toBe("file_delete");
      expect(SENSITIVE_OPERATIONS.FILE_WRITE).toBe("file_write");
      expect(SENSITIVE_OPERATIONS.SYSTEM_EXEC).toBe("system_exec");
      expect(SENSITIVE_OPERATIONS.CONFIG_WRITE).toBe("config_write");
      expect(SENSITIVE_OPERATIONS.USER_DATA_ACCESS).toBe("user_data_access");
      expect(SENSITIVE_OPERATIONS.ROOT_ACCESS).toBe("root_access");
    });
  });

  describe("Integration with channel roles", () => {
    it("should correctly combine channel role with operation check", () => {
      const channelId = "telegram";
      const role = getChannelRole(channelId);
      const operation = SENSITIVE_OPERATIONS.FILE_DELETE;

      expect(role).toBe("superadmin");
      expect(isOperationAllowed(role, operation)).toBe(true);
    });

    it("should correctly restrict public channel operations", () => {
      const channelId = "whatsapp";
      const role = getChannelRole(channelId);
      const operation = SENSITIVE_OPERATIONS.SYSTEM_EXEC;

      expect(role).toBe("public");
      expect(isOperationAllowed(role, operation)).toBe(false);
    });
  });
});
