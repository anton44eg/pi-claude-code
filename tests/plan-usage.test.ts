import assert from "node:assert/strict";
import test from "node:test";
import { formatPlanUsage, latestRateLimit } from "../src/plan-usage.ts";

const NOW = 1_793_709_259_000;
const info = {
  status: "allowed",
  rateLimitType: "five_hour",
  unifiedWindows: {
    five_hour: { utilization: 0.02, resetsAt: 1_793_715_000, status: "allowed" },
    seven_day: { utilization: 0.034, resetsAt: 1_793_955_600, status: "allowed" },
  },
};

function assistant(details: unknown, provider = "claude-code") {
  return {
    role: "assistant",
    provider,
    diagnostics: [
      { type: "claude-code.turn-relay", timestamp: 0, details: {} },
      { type: "claude-code.rate-limit", timestamp: 0, details },
    ],
  };
}

test("formats both plan windows with time until reset", () => {
  assert.equal(formatPlanUsage(info, NOW), "Claude 5h 2% (1h35m) · 7d 3% (2d20h)");
});

test("includes the Fable weekly window when present", () => {
  const withFable = {
    unifiedWindows: {
      ...info.unifiedWindows,
      seven_day_overage_included: { utilization: 0.41, resetsAt: 1_793_955_600, status: "allowed" },
    },
  };
  assert.equal(formatPlanUsage(withFable, NOW), "Claude 5h 2% (1h35m) · 7d 3% (2d20h) · Fable 41% (2d20h)");
});

test("omits missing windows and clamps past resets", () => {
  const partial = { unifiedWindows: { five_hour: { utilization: 1, resetsAt: NOW / 1000 - 60 } } };
  assert.equal(formatPlanUsage(partial, NOW), "Claude 5h 100% (0m)");
});

test("returns undefined when no window is usable", () => {
  assert.equal(formatPlanUsage({ status: "allowed" }, NOW), undefined);
  assert.equal(formatPlanUsage({ unifiedWindows: { five_hour: { utilization: "x" } } }, NOW), undefined);
});

test("finds the newest claude-code rate-limit diagnostic", () => {
  const older = { unifiedWindows: { five_hour: { utilization: 0.5, resetsAt: 0 } } };
  const messages = [
    assistant(older),
    { role: "user" },
    assistant(info),
    assistant({ unifiedWindows: {} }, "openai-codex"),
    { role: "assistant", provider: "claude-code" },
  ];
  assert.equal(latestRateLimit(messages), info);
  assert.equal(latestRateLimit([{ role: "user" }]), undefined);
});
