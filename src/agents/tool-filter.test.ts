/**
 * Tests de Filtrado de Herramientas
 *
 * Etapa 13: Tests de Filtrado de Herramientas
 *
 * Verifica:
 * - Superadmin tiene acceso a todos los tools
 * - Público solo ve tools en whitelist
 * - Patterns con wildcards funcionan
 * - Config custom sobrescribe defaults
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ToolAccessFilter } from "./tool-filter.js";

describe("ToolAccessFilter", () => {
  let filter: ToolAccessFilter;

  beforeEach(() => {
    filter = new ToolAccessFilter();
  });

  describe("Superadmin Access", () => {
    it("should allow all tools for superadmin", () => {
      const role = "superadmin";
      const tools = [
        "bash",
        "exec",
        "file_delete",
        "browser",
        "search",
        "enterprise_api",
      ];

      for (const tool of tools) {
        expect(filter.canUseTool(role, tool), `Tool ${tool} should be allowed for superadmin`).toBe(true);
      }
    });

    it("should return all tools when filtering for superadmin", () => {
      const role = "superadmin";
      const tools = [
        { name: "bash" },
        { name: "search" },
        { name: "enterprise_api" },
      ];

      const filtered = filter.filterToolsForRole(role, tools);
      expect(filtered).toHaveLength(3);
      expect(filtered.map((t) => t.name)).toEqual(["bash", "search", "enterprise_api"]);
    });

    it("should return wildcard pattern for superadmin allowed tools", () => {
      const patterns = filter.getAllowedToolPatterns("superadmin");
      expect(patterns).toEqual(["*"]);
    });

    it("should return empty forbidden patterns for superadmin", () => {
      const patterns = filter.getForbiddenToolPatterns("superadmin");
      expect(patterns).toEqual([]);
    });
  });

  describe("Public User Restrictions", () => {
    it("should deny dangerous tools for public users", () => {
      const role = "public";
      const dangerousTools = [
        "bash",
        "exec",
        "run_command",
        "file_delete",
        "file_write",
        "write_to_file",
        "browser",
        "browser_subagent",
      ];

      for (const tool of dangerousTools) {
        expect(filter.canUseTool(role, tool), `Tool ${tool} should be denied for public`).toBe(false);
      }
    });

    it("should allow safe tools for public users", () => {
      const role = "public";
      const safeTools = ["search", "search_web", "read_url_content", "calendar_view"];

      for (const tool of safeTools) {
        expect(filter.canUseTool(role, tool), `Tool ${tool} should be allowed for public`).toBe(true);
      }
    });

    it("should filter tools correctly for public role", () => {
      const role = "public";
      const tools = [
        { name: "search" },
        { name: "bash" },
        { name: "file_delete" },
        { name: "enterprise_api" },
        { name: "calendar_view" },
      ];

      const filtered = filter.filterToolsForRole(role, tools);
      expect(filtered).toHaveLength(3);
      expect(filtered.map((t) => t.name)).toContain("search");
      expect(filtered.map((t) => t.name)).toContain("enterprise_api");
      expect(filtered.map((t) => t.name)).toContain("calendar_view");
      expect(filtered.map((t) => t.name)).not.toContain("bash");
      expect(filtered.map((t) => t.name)).not.toContain("file_delete");
    });

    it("should return empty array when no tools are allowed", () => {
      const role = "public";
      const tools = [{ name: "bash" }, { name: "exec" }];

      const filtered = filter.filterToolsForRole(role, tools);
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Wildcard Patterns", () => {
    it("should match enterprise_* pattern", () => {
      const role = "public";
      expect(filter.canUseTool(role, "enterprise_stock")).toBe(true);
      expect(filter.canUseTool(role, "enterprise_orders")).toBe(true);
      expect(filter.canUseTool(role, "enterprise_calendar")).toBe(true);
    });

    it("should match api_* pattern", () => {
      const role = "public";
      expect(filter.canUseTool(role, "api_custom")).toBe(true);
      expect(filter.canUseTool(role, "api_external")).toBe(true);
    });

    it("should match view_* pattern", () => {
      const role = "public";
      expect(filter.canUseTool(role, "view_calendar")).toBe(true);
      expect(filter.canUseTool(role, "view_profile")).toBe(true);
    });

    it("should match system_* pattern in forbidden list", () => {
      const role = "public";
      expect(filter.canUseTool(role, "system_restart")).toBe(false);
      expect(filter.canUseTool(role, "system_config")).toBe(false);
    });

    it("should match config_* pattern in forbidden list", () => {
      const role = "public";
      expect(filter.canUseTool(role, "config_write")).toBe(false);
      expect(filter.canUseTool(role, "config_modify")).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty tool name", () => {
      const role = "public";
      expect(filter.canUseTool(role, "")).toBe(false);
    });

    it("should handle case sensitivity correctly", () => {
      const role = "public";
      // Los nombres de tools son case-sensitive por diseño
      expect(filter.canUseTool(role, "Bash")).toBe(false); // Forbidden pattern match
      expect(filter.canUseTool(role, "SEARCH")).toBe(false); // Allowed pattern no match
    });

    it("should handle tools with special characters in name", () => {
      const role = "public";
      expect(filter.canUseTool(role, "tool-name")).toBe(false);
      expect(filter.canUseTool(role, "tool_name")).toBe(false);
    });
  });

  describe("Integration Tests", () => {
    it("should correctly filter mixed tools list", () => {
      const role = "public";
      const allTools = [
        { name: "bash", description: "Execute bash commands" },
        { name: "search", description: "Search web" },
        { name: "file_delete", description: "Delete files" },
        { name: "enterprise_stock", description: "Check stock" },
        { name: "browser", description: "Browse web" },
        { name: "calendar_view", description: "View calendar" },
        { name: "api_orders", description: "API orders" },
      ];

      const filtered = filter.filterToolsForRole(role, allTools);

      expect(filtered).toHaveLength(4);
      expect(filtered.map((t) => t.name)).toEqual([
        "search",
        "enterprise_stock",
        "calendar_view",
        "api_orders",
      ]);
    });

    it("should preserve additional tool properties when filtering", () => {
      const role = "public";
      const tools = [
        { name: "search", description: "Web search", category: "web" },
        { name: "bash", description: "Bash exec", category: "system" },
      ];

      const filtered = filter.filterToolsForRole(role, tools);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toHaveProperty("description", "Web search");
      expect(filtered[0]).toHaveProperty("category", "web");
    });
  });

  describe("Pattern Matching", () => {
    it("should return correct allowed patterns for public", () => {
      const patterns = filter.getAllowedToolPatterns("public");
      expect(patterns).toContain("search");
      expect(patterns).toContain("enterprise_*");
      expect(patterns).toContain("api_*");
    });

    it("should return correct forbidden patterns for public", () => {
      const patterns = filter.getForbiddenToolPatterns("public");
      expect(patterns).toContain("bash");
      expect(patterns).toContain("system_*");
      expect(patterns).toContain("config_*");
    });
  });
});
