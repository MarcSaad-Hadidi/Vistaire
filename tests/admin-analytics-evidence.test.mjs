import test from "node:test";
import assert from "node:assert/strict";

const window = { range: "7d", startInclusive: "a", endExclusive: "b", comparisonStartInclusive: "c", comparisonEndExclusive: "a" };

test("evidence never promotes failures, truncation or unproven zero", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, databaseError: true }).kind, "unavailable");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, truncated: true }).completeness, "truncated");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, partialSource: true }).completeness, "partial-source");
  assert.equal(buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: false, eventCount: 0 }).reason, "instrumentation-unproven");
});

test("complete zero and small samples remain distinct and comparisons avoid division by zero", async () => {
  const { buildAdminAnalyticsState } = await import("../lib/admin/analyticsState.ts");
  const zero = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 0 });
  assert.equal(zero.kind, "insufficient");
  assert.equal(zero.reason, "no-relevant-events");
  const limited = buildAdminAnalyticsState({ observationWindow: window, instrumentationProven: true, eventCount: 3, metrics: [{ id: "opens", value: 3, baseline: 0 }] });
  assert.equal(limited.completeness, "limited-sample");
  assert.equal(limited.metrics[0].changeRate, null);
});
