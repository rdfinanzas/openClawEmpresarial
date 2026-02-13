/**
 * CLI commands for OpenClaw Empresarial
 * 
 * Sistema de dual-personality:
 * - openclaw enterprise setup: Configura personalidades ventas/admin
 * - openclaw enterprise status: Muestra configuración
 * - openclaw enterprise reconfigure: Reconfigura personalidades
 * - openclaw enterprise test-sales: Prueba personalidad ventas
 * - openclaw enterprise test-admin: Prueba personalidad admin
 * - openclaw enterprise apis: Lista APIs configuradas
 * - openclaw enterprise test-api <id>: Prueba una API
 */

import type { Command } from "commander";
import {
  runEnterpriseSetup,
  runEnterpriseStatus,
  runEnterpriseReconfigure,
  runEnterpriseTestSales,
  runEnterpriseTestAdmin,
  runEnterpriseTestApi,
  runEnterpriseApis,
  runEnterpriseAddApi,
  runEnterpriseRemoveApi,
} from "../commands/enterprise-setup.js";

export function registerEnterpriseCli(program: Command): void {
  const enterprise = program
    .command("enterprise")
    .description("OpenClaw Empresarial - Sistema de dual-personality para negocios")
    .addHelpText(
      "after",
      `
Ejemplos:
  openclaw enterprise setup              Configura el sistema empresarial completo
  openclaw enterprise status             Muestra la configuración actual
  openclaw enterprise reconfigure        Reconfigura las personalidades
  openclaw enterprise test-sales         Prueba la personalidad de ventas
  openclaw enterprise test-admin         Prueba la personalidad de admin
  openclaw enterprise apis               Lista las APIs configuradas
  openclaw enterprise test-api stock     Prueba la API de stock

OpenClaw Empresarial te permite tener:
  👤 Personalidad VENTAS para atención al público (WhatsApp, Discord)
  👔 Personalidad ADMIN para control total (Telegram)

El agente de ventas puede escalar casos al admin automáticamente.
`
    );

  enterprise
    .command("setup")
    .description("Configura el sistema empresarial completo (ventas + admin)")
    .action(async () => {
      await runEnterpriseSetup();
    });

  enterprise
    .command("status")
    .description("Muestra la configuración empresarial actual")
    .action(async () => {
      await runEnterpriseStatus();
    });

  enterprise
    .command("reconfigure")
    .description("Reconfigura las personalidades de ventas y admin")
    .action(async () => {
      await runEnterpriseReconfigure();
    });

  enterprise
    .command("test-sales")
    .description("Prueba la personalidad de VENTAS (muestra el system prompt)")
    .action(async () => {
      await runEnterpriseTestSales();
    });

  enterprise
    .command("test-admin")
    .description("Prueba la personalidad de ADMIN (muestra el system prompt)")
    .action(async () => {
      await runEnterpriseTestAdmin();
    });

  // Comando apis con subcomandos
  const apisCmd = enterprise
    .command("apis")
    .description("Gestiona las APIs empresariales");

  apisCmd
    .command("list")
    .alias("ls")
    .description("Lista las APIs empresariales configuradas")
    .action(async () => {
      await runEnterpriseApis();
    });

  apisCmd
    .command("add")
    .description("Agrega una nueva API empresarial")
    .action(async () => {
      await runEnterpriseAddApi();
    });

  apisCmd
    .command("remove <api-id>")
    .alias("rm")
    .description("Elimina una API empresarial")
    .action(async (apiId: string) => {
      await runEnterpriseRemoveApi(apiId);
    });

  // Por defecto, apis lista las APIs
  apisCmd.action(async () => {
    await runEnterpriseApis();
  });

  enterprise
    .command("test-api <api-id>")
    .description("Prueba la conexión a una API empresarial")
    .action(async (apiId: string) => {
      await runEnterpriseTestApi(apiId);
    });
}
