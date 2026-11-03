/**
 * Footer status for Claude plan limits, read from the `rate_limit_event`
 * Claude Code sends with every response (stored as a message diagnostic).
 */

const WINDOWS = [
  ["five_hour", "5h"],
  ["seven_day", "7d"],
  // Claude Code labels this window "Fable limit".
  ["seven_day_overage_included", "Fable"],
] as const;

type Window = { utilization?: unknown; resetsAt?: unknown };

function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${minutes % 60}m`;
  return `${minutes}m`;
}

export function formatPlanUsage(info: unknown, now = Date.now()): string | undefined {
  const windows = (info as { unifiedWindows?: Record<string, Window> } | undefined)?.unifiedWindows;
  const parts: string[] = [];
  for (const [key, label] of WINDOWS) {
    const window = windows?.[key];
    if (typeof window?.utilization !== "number" || typeof window.resetsAt !== "number") continue;
    const percent = Math.round(window.utilization * 100);
    parts.push(`${label} ${percent}% (${formatDuration(window.resetsAt * 1000 - now)})`);
  }
  return parts.length > 0 ? `Claude ${parts.join(" · ")}` : undefined;
}

/** Most recent rate-limit details recorded on a claude-code assistant message. */
export function latestRateLimit(messages: readonly unknown[]): unknown {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { role?: string; provider?: string; diagnostics?: unknown[] };
    if (message?.role !== "assistant" || message.provider !== "claude-code") continue;
    const diagnostic = message.diagnostics?.find(
      (item) => (item as { type?: string })?.type === "claude-code.rate-limit",
    ) as { details?: unknown } | undefined;
    if (diagnostic) return diagnostic.details;
  }
  return undefined;
}
