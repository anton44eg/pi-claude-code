import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getClaudeStatus } from "./claude-cli.ts";
import { formatPlanUsage, latestRateLimit } from "./plan-usage.ts";
import { claudeCodeEnv, createClaudeCodeProvider } from "./provider.ts";

export default function claudeCodeExtension(pi: ExtensionAPI): void {
  pi.registerProvider(createClaudeCodeProvider());

  pi.on("session_start", (_event, ctx) => {
    const messages = ctx.sessionManager
      .getBranch()
      .flatMap((entry) => (entry.type === "message" ? [entry.message] : []));
    const status = formatPlanUsage(latestRateLimit(messages));
    if (status) ctx.ui.setStatus("claude-code", status);
  });

  pi.on("message_end", (event, ctx) => {
    const status = formatPlanUsage(latestRateLimit([event.message]));
    if (status) ctx.ui.setStatus("claude-code", status);
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
