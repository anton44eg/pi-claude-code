import assert from "node:assert/strict";
import test from "node:test";
import claudeCodeExtension from "../src/index.ts";

const rateLimit = {
  unifiedWindows: { five_hour: { utilization: 0.06, resetsAt: Date.now() / 1000 + 3600 } },
};
const claudeReply = {
  role: "assistant",
  provider: "claude-code",
  diagnostics: [{ type: "claude-code.rate-limit", timestamp: 0, details: rateLimit }],
};

function setup(provider: string) {
  const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
  const pi = {
    registerProvider() {},
    registerCommand() {},
    on(event: string, handler: (event: unknown, ctx: unknown) => void) {
      handlers.set(event, handler);
    },
  };
  claudeCodeExtension(pi as never);
  const statuses = new Map<string, string | undefined>();
  const ctx = {
    model: { provider },
    ui: { setStatus: (key: string, value: string | undefined) => statuses.set(key, value) },
    sessionManager: { getBranch: () => [{ type: "message", message: claudeReply }] },
  };
  const emit = (event: string, payload: unknown = {}) => handlers.get(event)!(payload, ctx);
  return { emit, ctx, statuses };
}

test("shows plan usage next to pi-usage only while a claude-code model is selected", () => {
  const { emit, statuses } = setup("claude-code");
  emit("session_start");
  assert.match(statuses.get("usage-claude-code") ?? "", /^Claude 5h 6% /);
  assert.ok("usage-claude-code".localeCompare("usage") > 0, "sorts right after pi-usage's key");

  emit("model_select", { model: { provider: "openai-codex" } });
  assert.equal(statuses.get("usage-claude-code"), undefined);

  emit("model_select", { model: { provider: "claude-code" } });
  assert.match(statuses.get("usage-claude-code") ?? "", /^Claude 5h 6% /);
});

test("hides plan usage when a session starts on another provider", () => {
  const { emit, statuses } = setup("openai-codex");
  emit("session_start");
  assert.equal(statuses.get("usage-claude-code"), undefined);
});

test("keeps the last plan usage across replies without rate-limit data", () => {
  const { emit, statuses } = setup("claude-code");
  emit("session_start");
  emit("message_end", { message: { role: "user" } });
  assert.match(statuses.get("usage-claude-code") ?? "", /^Claude 5h 6% /);
});
