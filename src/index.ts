import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { getClaudeStatus } from "./claude-cli.ts";
import { formatPlanUsage, latestRateLimit } from "./plan-usage.ts";
import { claudeCodeEnv, createClaudeCodeProvider } from "./provider.ts";

export default function claudeCodeExtension(pi: ExtensionAPI): void {
  pi.registerProvider(createClaudeCodeProvider());

  // Keyed after pi-usage's "usage" status so both sit together in the footer.
  const STATUS_KEY = "usage-claude-code";
  let planUsage: string | undefined;
  const showPlanUsage = (ctx: ExtensionContext, provider = ctx.model?.provider) =>
    ctx.ui.setStatus(STATUS_KEY, provider === "claude-code" ? planUsage : undefined);

  pi.on("session_start", (_event, ctx) => {
    const messages = ctx.sessionManager
      .getBranch()
      .flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
    planUsage = formatPlanUsage(latestRateLimit(messages));
    showPlanUsage(ctx);
  });

  pi.on("model_select", (event, ctx) => showPlanUsage(ctx, event.model.provider));

  pi.on("message_end", (event, ctx) => {
    planUsage = formatPlanUsage(latestRateLimit([event.message])) ?? planUsage;
    showPlanUsage(ctx);
  });

  pi.registerCommand("claude-code-status", {
    description: "Check the Claude Code executable and subscription login",
    handler: async (_args, ctx) => {
      const status = await getClaudeStatus(claudeCodeEnv(), ctx.signal);
      if (!status.available || !status.loggedIn) {
        ctx.ui.notify(status.detail ?? "Claude Code is not ready", "error");
        return;
      }
      const plan = status.plan ? ` (${status.plan})` : "";
      ctx.ui.notify(`Claude Code is installed and logged in${plan}`, "info");
    },
  });
}

export { createClaudeCodeProvider } from "./provider.ts";
export { streamClaudeCode } from "./stream.ts";
