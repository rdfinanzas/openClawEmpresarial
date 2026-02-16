import fs from "node:fs/promises";
import path from "node:path";
import type { OnboardOptions } from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { GatewayWizardSettings, WizardFlow } from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";
import { DEFAULT_BOOTSTRAP_FILENAME } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "../commands/daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
  GATEWAY_DAEMON_RUNTIME_OPTIONS,
} from "../commands/daemon-runtime.js";
import { formatHealthCheckFailure } from "../commands/health-format.js";
import { healthCommand } from "../commands/health.js";
import {
  detectBrowserOpenSupport,
  formatControlUiSshHint,
  openUrl,
  probeGatewayReachable,
  waitForGatewayReachable,
  resolveControlUiLinks,
} from "../commands/onboard-helpers.js";
import { resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureControlUiAssetsBuilt } from "../infra/control-ui-assets.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { runTui } from "../tui/tui.js";
import { resolveUserPath } from "../utils.js";
import { setupOnboardingShellCompletion } from "./onboarding.completion.js";

type FinalizeOnboardingOptions = {
  flow: WizardFlow;
  opts: OnboardOptions;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  workspaceDir: string;
  settings: GatewayWizardSettings;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
};

export async function finalizeOnboardingWizard(
  options: FinalizeOnboardingOptions,
): Promise<{ launchedTui: boolean }> {
  const { flow, opts, baseConfig, nextConfig, settings, prompter, runtime } = options;

  const withWizardProgress = async <T>(
    label: string,
    options: { doneMessage?: string },
    work: (progress: { update: (message: string) => void }) => Promise<T>,
  ): Promise<T> => {
    const progress = prompter.progress(label);
    try {
      return await work(progress);
    } finally {
      progress.stop(options.doneMessage);
    }
  };

  const systemdAvailable =
    process.platform === "linux" ? await isSystemdUserServiceAvailable() : true;
  if (process.platform === "linux" && !systemdAvailable) {
    await prompter.note(
      "Servicios de usuario de Systemd no disponibles. Omitiendo verificación de lingering e instalación del servicio.",
      "Systemd",
    );
  }

  if (process.platform === "linux" && systemdAvailable) {
    const { ensureSystemdUserLingerInteractive } = await import("../commands/systemd-linger.js");
    await ensureSystemdUserLingerInteractive({
      runtime,
      prompter: {
        confirm: prompter.confirm,
        note: prompter.note,
      },
      reason:
        "Las instalaciones Linux usan un servicio de usuario de systemd por defecto. Sin lingering, systemd detiene la sesión del usuario al cerrar sesión/inactividad y mata el Gateway.",
      requireConfirm: false,
    });
  }

  const explicitInstallDaemon =
    typeof opts.installDaemon === "boolean" ? opts.installDaemon : undefined;
  let installDaemon: boolean;
  if (explicitInstallDaemon !== undefined) {
    installDaemon = explicitInstallDaemon;
  } else if (process.platform === "linux" && !systemdAvailable) {
    installDaemon = false;
  } else if (flow === "quickstart") {
    installDaemon = true;
  } else {
    installDaemon = await prompter.confirm({
      message: "¿Instalar servicio Gateway? (recomendado)",
      initialValue: true,
    });
  }

  if (process.platform === "linux" && !systemdAvailable && installDaemon) {
    await prompter.note(
      "Servicios de usuario de Systemd no disponibles; omitiendo instalación del servicio. Usá tu supervisor de contenedores o `docker compose up -d`.",
      "Servicio Gateway",
    );
    installDaemon = false;
  }

  if (installDaemon) {
    const daemonRuntime =
      flow === "quickstart"
        ? DEFAULT_GATEWAY_DAEMON_RUNTIME
        : await prompter.select({
            message: "Runtime del servicio Gateway",
            options: GATEWAY_DAEMON_RUNTIME_OPTIONS,
            initialValue: opts.daemonRuntime ?? DEFAULT_GATEWAY_DAEMON_RUNTIME,
          });
    if (flow === "quickstart") {
      await prompter.note(
        "QuickStart usa Node para el servicio Gateway (estable + soportado).",
        "Runtime del servicio Gateway",
      );
    }
    const service = resolveGatewayService();
    const loaded = await service.isLoaded({ env: process.env });
    if (loaded) {
      const action = await prompter.select({
        message: "Servicio Gateway ya instalado",
        options: [
          { value: "restart", label: "Reiniciar" },
          { value: "reinstall", label: "Reinstalar" },
          { value: "skip", label: "Omitir" },
        ],
      });
      if (action === "restart") {
        await withWizardProgress(
          "Servicio Gateway",
          { doneMessage: "Servicio Gateway reiniciado." },
          async (progress) => {
            progress.update("Reiniciando servicio Gateway…");
            await service.restart({
              env: process.env,
              stdout: process.stdout,
            });
          },
        );
      } else if (action === "reinstall") {
        await withWizardProgress(
          "Servicio Gateway",
          { doneMessage: "Servicio Gateway desinstalado." },
          async (progress) => {
            progress.update("Desinstalando servicio Gateway…");
            await service.uninstall({ env: process.env, stdout: process.stdout });
          },
        );
      }
    }

    if (!loaded || (loaded && !(await service.isLoaded({ env: process.env })))) {
      const progress = prompter.progress("Servicio Gateway");
      let installError: string | null = null;
      try {
        progress.update("Preparando servicio Gateway…");
        const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
          env: process.env,
          port: settings.port,
          token: settings.gatewayToken,
          runtime: daemonRuntime,
          warn: (message, title) => prompter.note(message, title),
          config: nextConfig,
        });

        progress.update("Instalando servicio Gateway…");
        await service.install({
          env: process.env,
          stdout: process.stdout,
          programArguments,
          workingDirectory,
          environment,
        });
      } catch (err) {
        installError = err instanceof Error ? err.message : String(err);
      } finally {
        progress.stop(
          installError ? "Falló la instalación del servicio Gateway." : "Servicio Gateway instalado.",
        );
      }
      if (installError) {
        await prompter.note(`Falló la instalación del servicio Gateway: ${installError}`, "Gateway");
        await prompter.note(gatewayInstallErrorHint(), "Gateway");
      }
    }
  }

  if (!opts.skipHealth) {
    const probeLinks = resolveControlUiLinks({
      bind: nextConfig.gateway?.bind ?? "loopback",
      port: settings.port,
      customBindHost: nextConfig.gateway?.customBindHost,
      basePath: undefined,
    });
    // Daemon install/restart can briefly flap the WS; wait a bit so health check doesn't false-fail.
    await waitForGatewayReachable({
      url: probeLinks.wsUrl,
      token: settings.gatewayToken,
      deadlineMs: 15_000,
    });
    try {
      await healthCommand({ json: false, timeoutMs: 10_000 }, runtime);
    } catch (err) {
      runtime.error(formatHealthCheckFailure(err));
      await prompter.note(
        [
          "Documentación:",
          "https://docs.agento.ai/gateway/health",
          "https://docs.agento.ai/gateway/troubleshooting",
        ].join("\n"),
        "Ayuda de health check",
      );
    }
  }

  const controlUiEnabled =
    nextConfig.gateway?.controlUi?.enabled ?? baseConfig.gateway?.controlUi?.enabled ?? true;
  if (!opts.skipUi && controlUiEnabled) {
    const controlUiAssets = await ensureControlUiAssetsBuilt(runtime);
    if (!controlUiAssets.ok && controlUiAssets.message) {
      runtime.error(controlUiAssets.message);
    }
  }

  await prompter.note(
    [
      "Agregá nodos para funciones extra:",
      "- App macOS (sistema + notificaciones)",
      "- App iOS (cámara/canvas)",
      "- App Android (cámara/canvas)",
    ].join("\n"),
    "Apps opcionales",
  );

  const controlUiBasePath =
    nextConfig.gateway?.controlUi?.basePath ?? baseConfig.gateway?.controlUi?.basePath;
  const links = resolveControlUiLinks({
    bind: settings.bind,
    port: settings.port,
    customBindHost: settings.customBindHost,
    basePath: controlUiBasePath,
  });
  // Abrir siempre en /admin/login con el token como parámetro
  const loginPath = controlUiBasePath ? `${controlUiBasePath}/admin/login` : "/admin/login";
  const authedUrl =
    settings.authMode === "token" && settings.gatewayToken
      ? `${links.httpUrl.replace(/\/$/, "")}${loginPath}?token=${encodeURIComponent(settings.gatewayToken)}`
      : `${links.httpUrl.replace(/\/$/, "")}${loginPath}`;
  const gatewayProbe = await probeGatewayReachable({
    url: links.wsUrl,
    token: settings.authMode === "token" ? settings.gatewayToken : undefined,
    password: settings.authMode === "password" ? nextConfig.gateway?.auth?.password : "",
  });
  const gatewayStatusLine = gatewayProbe.ok
    ? "Gateway: accesible"
    : `Gateway: no detectado${gatewayProbe.detail ? ` (${gatewayProbe.detail})` : ""}`;
  const bootstrapPath = path.join(
    resolveUserPath(options.workspaceDir),
    DEFAULT_BOOTSTRAP_FILENAME,
  );
  const hasBootstrap = await fs
    .access(bootstrapPath)
    .then(() => true)
    .catch(() => false);

  await prompter.note(
    [
      `Web UI: ${links.httpUrl}`,
      settings.authMode === "token" && settings.gatewayToken
        ? `Web UI (con token): ${authedUrl}`
        : undefined,
      `Gateway WS: ${links.wsUrl}`,
      gatewayStatusLine,
      "Docs: https://docs.agento.ai/web/control-ui",
    ]
      .filter(Boolean)
      .join("\n"),
    "Interfaz de Control",
  );

  let controlUiOpened = false;
  let controlUiOpenHint: string | undefined;
  let seededInBackground = false;
  let hatchChoice: "tui" | "web" | "later" | null = null;
  let launchedTui = false;

  if (!opts.skipUi && gatewayProbe.ok) {
    if (hasBootstrap) {
      await prompter.note(
        [
          "Esta es la acción que define a tu agente.",
          "Tomate tu tiempo.",
          "Cuanto más le cuentes, mejor será la experiencia.",
          'Enviaremos: "Wake up, my friend!"',
        ].join("\n"),
        "Iniciar TUI (mejor opción!)",
      );
    }

    await prompter.note(
      [
        "Token del Gateway: autenticación compartida para Gateway + Control UI.",
        "Guardado en: ~/.agento/agento.json (gateway.auth.token) o AGENTO_GATEWAY_TOKEN.",
        `Ver token: ${formatCliCommand("agento config get gateway.auth.token")}`,
        `Generar token: ${formatCliCommand("agento doctor --generate-gateway-token")}`,
        "La Web UI guarda una copia en localStorage (agento.control.settings.v1).",
        `Abrir dashboard: ${formatCliCommand("openclaw dashboard --no-open")}`,
        "Si te lo pide: pegá el token en la configuración del Control UI (o usá la URL con token).",
      ].join("\n"),
      "Token",
    );

    hatchChoice = await prompter.select({
      message: "¿Cómo querés iniciar tu bot?",
      options: [
        { value: "tui", label: "Iniciar en TUI (recomendado)" },
        { value: "web", label: "Abrir Web UI" },
        { value: "later", label: "Hacerlo después" },
      ],
      initialValue: "tui",
    });

    if (hatchChoice === "tui") {
      restoreTerminalState("pre-onboarding tui");
      await runTui({
        url: links.wsUrl,
        token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        password: settings.authMode === "password" ? nextConfig.gateway?.auth?.password : "",
        // Safety: onboarding TUI should not auto-deliver to lastProvider/lastTo.
        deliver: false,
        message: hasBootstrap ? "Wake up, my friend!" : undefined,
      });
      launchedTui = true;
    } else if (hatchChoice === "web") {
      const browserSupport = await detectBrowserOpenSupport();
      if (browserSupport.ok) {
        controlUiOpened = await openUrl(authedUrl);
        if (!controlUiOpened) {
          controlUiOpenHint = formatControlUiSshHint({
            port: settings.port,
            basePath: controlUiBasePath,
            token: settings.authMode === "token" ? settings.gatewayToken : undefined,
          });
        }
      } else {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.authMode === "token" ? settings.gatewayToken : undefined,
        });
      }
      await prompter.note(
        [
          `Link al dashboard (con token): ${authedUrl}`,
          controlUiOpened
            ? "Abierto en tu navegador. Mantené esa pestaña para controlar Agento."
            : "Copiá/pegá esta URL en un navegador de esta máquina para controlar Agento.",
          controlUiOpenHint,
        ]
          .filter(Boolean)
          .join("\n"),
        "Dashboard listo",
      );
    } else {
      await prompter.note(
        `Cuando estés listo: ${formatCliCommand("agento dashboard --no-open")}`,
        "Después",
      );
    }
  } else if (opts.skipUi) {
    await prompter.note("Omitiendo prompts de Control UI/TUI.", "Interfaz de Control");
  }

  await prompter.note(
    [
      "Hacé backup de tu workspace de agente.",
      "Docs: https://docs.agento.ai/concepts/agent-workspace",
    ].join("\n"),
    "Backup del workspace",
  );

  await prompter.note(
    "Ejecutar agentes en tu computadora es riesgoso — fortalecé tu configuración: https://docs.agento.ai/security",
    "Seguridad",
  );

  await setupOnboardingShellCompletion({ flow, prompter });

  const shouldOpenControlUi =
    !opts.skipUi &&
    settings.authMode === "token" &&
    Boolean(settings.gatewayToken) &&
    hatchChoice === null;
  if (shouldOpenControlUi) {
    const browserSupport = await detectBrowserOpenSupport();
    if (browserSupport.ok) {
      controlUiOpened = await openUrl(authedUrl);
      if (!controlUiOpened) {
        controlUiOpenHint = formatControlUiSshHint({
          port: settings.port,
          basePath: controlUiBasePath,
          token: settings.gatewayToken,
        });
      }
    } else {
      controlUiOpenHint = formatControlUiSshHint({
        port: settings.port,
        basePath: controlUiBasePath,
        token: settings.gatewayToken,
      });
    }

    await prompter.note(
      [
        `Link al dashboard (con token): ${authedUrl}`,
        controlUiOpened
          ? "Abierto en tu navegador. Mantené esa pestaña para controlar Agento."
          : "Copiá/pegá esta URL en un navegador de esta máquina para controlar Agento.",
        controlUiOpenHint,
      ]
        .filter(Boolean)
        .join("\n"),
      "Dashboard listo",
    );
  }

  const webSearchKey = (nextConfig.tools?.web?.search?.apiKey ?? "").trim();
  const webSearchEnv = (process.env.BRAVE_API_KEY ?? "").trim();
  const hasWebSearchKey = Boolean(webSearchKey || webSearchEnv);
  await prompter.note(
    hasWebSearchKey
      ? [
          "Búsqueda web habilitada, tu agente puede buscar en línea cuando lo necesite.",
          "",
          webSearchKey
            ? "API key: guardada en config (tools.web.search.apiKey)."
            : "API key: proporcionada via BRAVE_API_KEY env var (entorno Gateway).",
          "Docs: https://docs.agento.ai/tools/web",
        ].join("\n")
      : [
          "Si querés que tu agente pueda buscar en la web, vas a necesitar una API key.",
          "",
          "OpenClaw usa Brave Search para la herramienta `web_search`. Sin una API key de Brave Search, la búsqueda web no funcionará.",
          "",
          "Configurala interactivamente:",
          `- Ejecutá: ${formatCliCommand("agento configure --section web")}`,
          "- Habilitá web_search y pegá tu API key de Brave Search",
          "",
          "Alternativa: configurá BRAVE_API_KEY en el entorno del Gateway (sin cambios de config).",
          "Docs: https://docs.agento.ai/tools/web",
        ].join("\n"),
    "Búsqueda web (opcional)",
  );

  await prompter.note(
    'Qué hacer ahora: https://agento.ai/showcase ("Lo que la gente está construyendo").',
    "Qué sigue",
  );

  await prompter.outro(
    controlUiOpened
      ? "Onboarding completo. Dashboard abierto; mantené esa pestaña para controlar Agento."
      : seededInBackground
        ? "Onboarding completo. Web UI iniciada en segundo plano; abrila cuando quieras con el link arriba."
        : "Onboarding completo. Usá el link al dashboard arriba para controlar Agento.",
  );

  return { launchedTui };
}
