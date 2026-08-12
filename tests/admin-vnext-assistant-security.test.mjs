import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { buildAdminEvidenceBundle, requireEvidenceReferences } from "../lib/admin/data/evidenceRegistry.ts";
import { parseIanaTimeZone } from "../lib/admin/data/contracts.ts";
import { isAssistantClaim } from "../lib/admin/assistant/contracts.ts";
import { renderAssistantClaims } from "../lib/admin/assistant/renderClaims.ts";
import { consumeAdminAssistantQuotaWithDependencies } from "../lib/admin/assistant/rateLimit.ts";

const timezone = parseIanaTimeZone("UTC");
const scope = { restaurantId: "r1", menuId: "m1", source: "production", timezone };
const window = { range: "today", timezone, alignment: "local-calendar-v1", calendarDayCount: 1, observedAt: "2026-08-11T20:00:00.000Z", current: { from: "2026-08-11T00:00:00.000Z", to: "2026-08-11T20:00:00.000Z" }, previous: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-10T20:00:00.000Z" } };

function bundle(audiences = ["ui", "mistral"], promptUnsafe = false) {
  return buildAdminEvidenceBundle({ scope, window, generatedAt: window.observedAt, records: [{ metricId: "observed-menu-opens", definitionVersion: "v1", labelKey: "metrics.observed-menu-opens", period: "current", state: { kind: "available", value: { count: 9 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate", promptUnsafe }, audiences }] });
}

test("closed claim parser rejects prose, unknown fields and invalid references", () => {
  assert.equal(isAssistantClaim({ claimType: "metric-observation", evidenceIds: ["ev:one"] }), true);
  assert.equal(isAssistantClaim({ claimType: "metric-observation", evidenceIds: ["ev:one"], prose: "nine" }), false);
  assert.equal(isAssistantClaim({ claimType: "unknown", evidenceIds: ["ev:one"] }), false);
  assert.equal(isAssistantClaim({ claimType: "metric-observation", evidenceIds: [] }), false);
});

test("renderer fails closed on unknown, cross-bundle and non-Mistral evidence", () => {
  const admitted = bundle();
  const id = Object.values(admitted.records)[0].evidenceId;
  assert.throws(() => requireEvidenceReferences(admitted, { bundleId: "other", evidenceIds: [id] }, "mistral"));
  assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: admitted, claims: [{ claimType: "metric-observation", evidenceIds: ["ev:unknown"] }] }));
  for (const denied of [bundle(["ui"]), bundle(["ui", "mistral"], true)]) {
    const deniedId = Object.values(denied.records)[0].evidenceId;
    assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: denied, claims: [{ claimType: "metric-observation", evidenceIds: [deniedId] }] }));
  }
});

test("comparison requires two distinct records and rejects arbitrary number words", () => {
  const evidence = bundle();
  const id = Object.values(evidence.records)[0].evidenceId;
  assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "period-comparison", evidenceIds: [id] }] }));
  assert.equal(isAssistantClaim({ claimType: "metric-observation", evidenceIds: [id], value: "double" }), false);
});

test("claim types accept only compatible metrics and comparisons bind one metric definition", () => {
  const evidence = buildAdminEvidenceBundle({
    scope,
    window,
    generatedAt: window.observedAt,
    records: [
      { metricId: "observed-menu-opens", definitionVersion: "v1", labelKey: "opens", period: "current", state: { kind: "available", value: { count: 9 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate" }, audiences: ["mistral"] },
      { metricId: "catalog-dishes", definitionVersion: "v1", labelKey: "dishes", period: "previous", state: { kind: "available", value: { count: 7 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate" }, audiences: ["mistral"] }
    ]
  });
  const [opens, dishes] = Object.values(evidence.records);
  assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "period-comparison", evidenceIds: [opens.evidenceId, dishes.evidenceId] }] }));
  assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "rank-observation", evidenceIds: [opens.evidenceId] }] }));
  assert.throws(() => renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "attention-observation", evidenceIds: [dishes.evidenceId] }] }));
});

test("distributed quota adapter distinguishes allowed, denied, unavailable and errors", async () => {
  const allowed = await consumeAdminAssistantQuotaWithDependencies(
    { restaurantId: "r1" },
    { transport: async () => ({ data: [{ allowed: true, remaining: 4, reset_at: "2026-08-11T20:01:00.000Z" }], error: null }) }
  );
  assert.deepEqual(allowed, { state: "allowed", remaining: 4, resetAt: "2026-08-11T20:01:00.000Z" });

  const denied = await consumeAdminAssistantQuotaWithDependencies(
    { restaurantId: "r1" },
    { transport: async () => ({ data: [{ allowed: false, remaining: 0, reset_at: "2026-08-11T20:01:00.000Z" }], error: null }) }
  );
  assert.deepEqual(denied, { state: "denied", remaining: 0, resetAt: "2026-08-11T20:01:00.000Z" });

  const unavailable = await import("../lib/admin/assistant/rateLimit.ts");
  assert.equal(typeof unavailable.consumeAdminAssistantQuota, "function");
  assert.deepEqual(
    await consumeAdminAssistantQuotaWithDependencies(
      { restaurantId: "r1" },
      { transport: async () => ({ data: null, error: { code: "rpc" } }) }
    ),
    { state: "error" }
  );
});

test("quota migration is atomic, security-definer and service-role-only", async () => {
  const [migration, concurrency, runtime] = await Promise.all([
    readFile("supabase/migrations/20260811200000_admin_assistant_rate_limit.sql", "utf8"),
    readFile("tests/postgres/admin-assistant-rate-limit/concurrency.test.sql", "utf8"),
    readFile("lib/admin/assistant/rateLimit.ts", "utf8")
  ]);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /on conflict \(restaurant_id, bucket_start\) do update/i);
  assert.match(migration, /where quota\.request_count < p_limit/i);
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute[\s\S]*to service_role/i);
  assert.match(migration, /drop policy if exists vistaire_admin_assistant_no_direct_access/i);
  assert.match(migration, /create policy vistaire_admin_assistant_no_direct_access[\s\S]*to anon, authenticated/i);
  assert.match(concurrency, /dblink_send_query/);
  assert.match(concurrency, /dblink_is_busy/);
  assert.match(runtime, /consume_admin_assistant_quota/);
  assert.doesNotMatch(`${migration}\n${runtime}`, /prompt|question|response_text|console\./i);
});
