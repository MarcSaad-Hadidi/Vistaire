import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminEvidenceBundle, requireEvidenceReferences } from "../lib/admin/data/evidenceRegistry.ts";
import { parseIanaTimeZone } from "../lib/admin/data/contracts.ts";
import { isAssistantClaim } from "../lib/admin/assistant/contracts.ts";
import { renderAssistantClaims } from "../lib/admin/assistant/renderClaims.ts";

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
