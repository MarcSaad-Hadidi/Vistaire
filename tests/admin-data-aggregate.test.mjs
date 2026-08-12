import assert from "node:assert/strict";
import test from "node:test";
import { aggregateObservedMetric, compareAdminCountStates } from "../lib/admin/data/aggregateAnalytics.ts";

const bounds = { from: "2026-01-10T00:00:00.000Z", to: "2026-01-11T00:00:00.000Z" };
const coverage = (renderer, overrides = {}) => ({
  version: "admin-vnext-observed-v1", renderer, source: "production",
  coverageStartAt: "2026-01-01T00:00:00.000Z", coverageEndAt: "2026-02-01T00:00:00.000Z",
  proof: { kind: "verified-deployment", deploymentId: `deploy-${renderer}` }, signals: { menu_opened: "covered" }, ...overrides
});

test("measured zero requires complete verified coverage for every renderer", () => {
  const input = { eventName: "menu_opened", signal: "menu_opened", requiredRenderers: ["public-menu", "trouvable"], bounds, events: [], truncated: false };
  assert.deepEqual(aggregateObservedMetric({ ...input, coverages: [coverage("public-menu"), coverage("trouvable")] }), { kind: "available", value: { count: 0 } });
  assert.deepEqual(aggregateObservedMetric({ ...input, coverages: [coverage("public-menu"), coverage("trouvable", { proof: { kind: "unverified" } })] }), { kind: "unmeasured", reason: "instrumentation-unverified" });
});

test("truncation affects only event-derived metrics and immersive clicks stay intentions", () => {
  assert.deepEqual(aggregateObservedMetric({ eventName: "dish_3d_clicked", signal: "dish_3d_clicked", requiredRenderers: ["public-menu"], bounds, coverages: [coverage("public-menu", { signals: { dish_3d_clicked: "covered" } })], events: [], truncated: true, observedRows: 101, rowLimit: 100 }), { kind: "truncated", observedRows: 101, rowLimit: 100 });
});

test("comparison keeps absolute delta but null rate on zero baseline and rejects incompatible context", () => {
  assert.deepEqual(compareAdminCountStates({ current: { kind: "available", value: { count: 4 } }, previous: { kind: "available", value: { count: 0 } }, compatible: true }), { kind: "available", value: { count: 4, previousCount: 0, delta: 4, changeRate: null } });
  assert.deepEqual(compareAdminCountStates({ current: { kind: "available", value: { count: 4 } }, previous: { kind: "available", value: { count: 2 } }, compatible: false }), { kind: "insufficient", reason: "comparison-unavailable" });
});
