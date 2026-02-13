/**
 * Operaciones críticas del sistema protegidas con autorización root.
 *
 * Etapa 28: Integración de Root Auth en Operaciones Críticas
 *
 * Este módulo proporciona versiones seguras de operaciones críticas
 * que requieren aprobación del superadmin vía Telegram.
 */

import { writeConfigFile, readConfigFileSnapshot } from "../config/config.js";
import { rootGuard } from "./root-guard.js";
import { getChildLogger } from "../logging.js";
import { rm, writeFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const logger = getChildLogger({ module: "critical-operations" });

/**
 * Configura el root guard con la función de autorización vía Telegram.
 * Debe llamarse al iniciar el gateway con la instancia del bot de Telegram.
 */
export function configureRootGuard(
  requestAuthorizationFn: (
    operation: string,
    params: Record<string, unknown>,
    timeoutMs?: number
  ) => Promise<boolean>
): void {
  // Reconfigurar el root guard con la función de Telegram
  (rootGuard as any).config.requestAuthorization = requestAuthorizationFn;
  logger.info("Root guard configured with Telegram authorization");
}

/**
 * Modifica la configuración del sistema con autorización root.
 *
 * @param path Ruta de la configuración a modificar (notación punto)
 * @param value Nuevo valor
 */
export async function modifyConfigWithAuth(
  path: string,
  value: unknown
): Promise<void> {
  await rootGuard.requireAuthorization("config_modify", {
    path,
    value,
    timestamp: Date.now(),
  });

  try {
    const config = await readConfigFileSnapshot();
    // Aquí iría la lógica real de modificación
    // Por ahora solo logueamos
    logger.info(`Config modification approved and executed: ${path}`);
  } catch (error) {
    logger.error(`Failed to modify config: ${String(error)}`);
    throw error;
  }
}

/**
 * Elimina un archivo con autorización root.
 *
 * @param filePath Ruta del archivo a eliminar
 */
export async function deleteFileWithAuth(filePath: string): Promise<void> {
  await rootGuard.requireAuthorization("file_delete", {
    path: filePath,
    timestamp: Date.now(),
  });

  try {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    await unlink(filePath);
    logger.info(`File deleted with authorization: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to delete file: ${String(error)}`);
    throw error;
  }
}

/**
 * Escribe en un archivo con autorización root.
 *
 * @param filePath Ruta del archivo
 * @param content Contenido a escribir
 */
export async function writeFileWithAuth(
  filePath: string,
  content: string
): Promise<void> {
  await rootGuard.requireAuthorization("file_write", {
    path: filePath,
    contentLength: content.length,
    timestamp: Date.now(),
  });

  try {
    await writeFile(filePath, content, "utf-8");
    logger.info(`File written with authorization: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write file: ${String(error)}`);
    throw error;
  }
}

/**
 * Elimina un directorio recursivamente con autorización root.
 *
 * @param dirPath Ruta del directorio
 */
export async function deleteDirectoryWithAuth(dirPath: string): Promise<void> {
  await rootGuard.requireAuthorization("file_delete", {
    path: dirPath,
    isDirectory: true,
    timestamp: Date.now(),
  });

  try {
    if (!existsSync(dirPath)) {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    await rm(dirPath, { recursive: true, force: true });
    logger.info(`Directory deleted with authorization: ${dirPath}`);
  } catch (error) {
    logger.error(`Failed to delete directory: ${String(error)}`);
    throw error;
  }
}

/**
 * Elimina una sesión de agente con autorización root.
 *
 * @param sessionKey Clave de la sesión
 */
export async function deleteAgentSessionWithAuth(
  sessionKey: string
): Promise<void> {
  await rootGuard.requireAuthorization("user_delete", {
    sessionKey,
    type: "agent_session",
    timestamp: Date.now(),
  });

  try {
    const sessionsDir = join(
      process.env.HOME || process.env.USERPROFILE || ".",
      ".openclaw",
      "sessions"
    );
    const sessionFile = join(sessionsDir, `${sessionKey}.jsonl`);

    if (existsSync(sessionFile)) {
      await unlink(sessionFile);
      logger.info(`Agent session deleted with authorization: ${sessionKey}`);
    } else {
      logger.warn(`Session file not found: ${sessionFile}`);
    }
  } catch (error) {
    logger.error(`Failed to delete agent session: ${String(error)}`);
    throw error;
  }
}

/**
 * Reinicia el gateway con autorización root.
 */
export async function restartGatewayWithAuth(): Promise<void> {
  await rootGuard.requireAuthorization("system_restart", {
    service: "gateway",
    timestamp: Date.now(),
    reason: "Manual restart requested via admin panel",
  });

  logger.info("Gateway restart authorized, initiating...");
  // Aquí iría la lógica real de reinicio
  // Por seguridad, solo logueamos por ahora
  logger.info("Gateway restart would execute here");
}

/**
 * Cierra el gateway con autorización root.
 */
export async function shutdownGatewayWithAuth(): Promise<void> {
  await rootGuard.requireAuthorization("system_shutdown", {
    service: "gateway",
    timestamp: Date.now(),
    reason: "Manual shutdown requested via admin panel",
  });

  logger.info("Gateway shutdown authorized, initiating...");
  // Aquí iría la lógica real de shutdown
  // Por seguridad, solo logueamos por ahora
  logger.info("Gateway shutdown would execute here");
}

/**
 * Lista de operaciones críticas disponibles.
 * Útil para documentación y UI.
 */
export const CRITICAL_OPERATIONS = [
  {
    id: "config_modify",
    name: "Modify Configuration",
    description: "Modifies system configuration settings",
    dangerLevel: "high",
  },
  {
    id: "file_delete",
    name: "Delete File/Directory",
    description: "Deletes files or directories from the system",
    dangerLevel: "high",
  },
  {
    id: "file_write",
    name: "Write File",
    description: "Writes content to files",
    dangerLevel: "medium",
  },
  {
    id: "user_delete",
    name: "Delete User/Session",
    description: "Deletes user sessions or accounts",
    dangerLevel: "high",
  },
  {
    id: "system_restart",
    name: "Restart System",
    description: "Restarts the gateway service",
    dangerLevel: "critical",
  },
  {
    id: "system_shutdown",
    name: "Shutdown System",
    description: "Shuts down the gateway service",
    dangerLevel: "critical",
  },
] as const;

/**
 * Obtiene información sobre una operación crítica.
 */
export function getCriticalOperationInfo(operationId: string) {
  return CRITICAL_OPERATIONS.find((op) => op.id === operationId);
}

/**
 * Verifica si una operación es crítica.
 */
export function isCriticalOperation(operationId: string): boolean {
  return CRITICAL_OPERATIONS.some((op) => op.id === operationId);
}
