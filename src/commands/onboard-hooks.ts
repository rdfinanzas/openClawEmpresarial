import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { formatCliCommand } from "../cli/command-format.js";
import { buildWorkspaceHookStatus } from "../hooks/hooks-status.js";

export async function setupInternalHooks(
  cfg: OpenClawConfig,
  runtime: RuntimeEnv,
  prompter: WizardPrompter,
): Promise<OpenClawConfig> {
  await prompter.note(
    [
      "📎 Los Hooks son 'gatillos' automáticos que ejecutan acciones cuando usás ciertos comandos.",
      "",
      "🤔 ¿Para qué sirven?",
      "   • Guardar automáticamente el historial de chat antes de limpiarlo",
      "   • Enviar resúmenes por email cuando terminás una tarea",
      "   • Registrar todos los comandos que ejecutás",
      "   • Activar integraciones con otras apps (Calendar, Notion, etc.)",
      "",
      "💡 Ejemplo práctico:",
      "   Cuando escribís '/new' para empezar chat nuevo,",
      "   un hook puede guardar automáticamente la conversación anterior.",
      "",
      "📚 Más info: https://docs.agento.ai/hooks",
    ].join("\n"),
    "📎 Hooks (Automatizaciones)",
  );

  // Discover available hooks using the hook discovery system
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  const report = buildWorkspaceHookStatus(workspaceDir, { config: cfg });

  // Show every eligible hook so users can opt in during onboarding.
  const eligibleHooks = report.hooks.filter((h) => h.eligible);

  if (eligibleHooks.length === 0) {
    await prompter.note(
      "No eligible hooks found. You can configure hooks later in your config.",
      "No Hooks Available",
    );
    return cfg;
  }

  const toEnable = await prompter.multiselect({
    message: "Enable hooks?",
    options: [
      { value: "__skip__", label: "Skip for now" },
      ...eligibleHooks.map((hook) => ({
        value: hook.name,
        label: `${hook.emoji ?? "🔗"} ${hook.name}`,
        hint: hook.description,
      })),
    ],
  });

  const selected = toEnable.filter((name) => name !== "__skip__");
  if (selected.length === 0) {
    return cfg;
  }

  // Enable selected hooks using the new entries config format
  const entries = { ...cfg.hooks?.internal?.entries };
  for (const name of selected) {
    entries[name] = { enabled: true };
  }

  const next: OpenClawConfig = {
    ...cfg,
    hooks: {
      ...cfg.hooks,
      internal: {
        enabled: true,
        entries,
      },
    },
  };

  await prompter.note(
    [
      `Enabled ${selected.length} hook${selected.length > 1 ? "s" : ""}: ${selected.join(", ")}`,
      "",
      "You can manage hooks later with:",
      `  ${formatCliCommand("agento hooks list")}`,
      `  ${formatCliCommand("agento hooks enable <name>")}`,
      `  ${formatCliCommand("agento hooks disable <name>")}`,
    ].join("\n"),
    "Hooks Configured",
  );

  return next;
}
