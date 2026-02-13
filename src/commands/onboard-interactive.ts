import type { RuntimeEnv } from "../runtime.js";
import type { OnboardOptions } from "./onboard-types.js";
import { defaultRuntime } from "../runtime.js";
import { restoreTerminalState } from "../terminal/restore.js";
import { createClackPrompter } from "../wizard/clack-prompter.js";
import { runUnifiedOnboarding } from "../wizard/onboarding-unified.js";
import { WizardCancelledError } from "../wizard/prompts.js";

export async function runInteractiveOnboarding(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const prompter = createClackPrompter();
  try {
    // Usar el nuevo wizard unificado que incluye onboard + enterprise
    await runUnifiedOnboarding(opts, runtime, prompter);
  } catch (err) {
    if (err instanceof WizardCancelledError) {
      runtime.exit(0);
      return;
    }
    throw err;
  } finally {
    restoreTerminalState("onboarding finish");
  }
}
