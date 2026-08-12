import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminEvidenceBundle } from "../lib/admin/data/evidenceRegistry.ts";
import { parseIanaTimeZone } from "../lib/admin/data/contracts.ts";
import { APPROVED_CLAIM_TYPES } from "../lib/admin/assistant/contracts.ts";
import { renderAssistantClaims } from "../lib/admin/assistant/renderClaims.ts";
import { buildRuleBasedAssistantClaims } from "../lib/admin/assistant/rulesFallback.ts";

const scope = { restaurantId: "r1", menuId: "m1", source: "production", timezone: parseIanaTimeZone("America/Toronto") };
const window = {
  range: "today", timezone: scope.timezone, alignment: "local-calendar-v1",
  calendarDayCount: 1, observedAt: "2026-08-11T20:00:00.000Z",
  current: { from: "2026-08-11T04:00:00.000Z", to: "2026-08-11T20:00:00.000Z" },
  previous: { from: "2026-08-10T04:00:00.000Z", to: "2026-08-10T20:00:00.000Z" }
};

function bundle(states = {}) {
  return buildAdminEvidenceBundle({
    scope, window, generatedAt: window.observedAt,
    records: [
      { metricId: "observed-menu-opens", definitionVersion: "admin-vnext-observed-v1", labelKey: "metrics.observed-menu-opens", period: "current", state: states.current ?? { kind: "available", value: { count: 1248 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate" }, audiences: ["ui", "mistral"] },
      { metricId: "observed-menu-opens", definitionVersion: "admin-vnext-observed-v1", labelKey: "metrics.observed-menu-opens", period: "previous", state: states.previous ?? { kind: "available", value: { count: 1056 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate" }, audiences: ["ui", "mistral"] },
      { metricId: "catalog-dishes", definitionVersion: "admin-vnext-observed-v1", labelKey: "metrics.catalog-dishes", period: "snapshot", state: states.catalog ?? { kind: "available", value: { count: 48 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate" }, audiences: ["ui", "mistral"] }
    ]
  });
}

test("assistant claim catalog is closed and never accepts prose", () => {
  assert.deepEqual([...APPROVED_CLAIM_TYPES], ["metric-observation", "period-comparison", "rank-observation", "attention-observation"]);
  assert.equal(APPROVED_CLAIM_TYPES.includes("free-prose"), false);
});

test("renderer formats canonical evidence values in French and English", () => {
  const evidence = bundle();
  const current = Object.values(evidence.records).find((record) => record.period === "current");
  const fr = renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "metric-observation", evidenceIds: [current.evidenceId] }] });
  const en = renderAssistantClaims({ locale: "en", bundle: evidence, claims: [{ claimType: "metric-observation", evidenceIds: [current.evidenceId] }] });
  assert.equal(fr.blocks[0].value, new Intl.NumberFormat("fr-CA").format(1248));
  assert.equal(en.blocks[0].value, new Intl.NumberFormat("en-CA").format(1248));
  assert.deepEqual(fr.evidenceIds, [current.evidenceId]);
});

test("comparison claim derives direction and delta from two admitted records", () => {
  const evidence = bundle();
  const records = Object.values(evidence.records).filter((record) => record.metricId === "observed-menu-opens");
  const answer = renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "period-comparison", evidenceIds: records.map((record) => record.evidenceId) }] });
  assert.equal(answer.blocks[0].direction, "up");
  assert.equal(answer.blocks[0].delta, 192);
});

test("insufficient evidence renders absence without a fabricated value", () => {
  const evidence = bundle({ current: { kind: "insufficient", reason: "sample-too-small" } });
  const current = Object.values(evidence.records).find((record) => record.period === "current");
  const answer = renderAssistantClaims({ locale: "fr", bundle: evidence, claims: [{ claimType: "metric-observation", evidenceIds: [current.evidenceId] }] });
  assert.equal(answer.blocks[0].kind, "unavailable");
  assert.equal(Object.hasOwn(answer.blocks[0], "value"), false);
});

test("rules fallback selects only renderable evidence and adds no free fact", () => {
  const evidence = bundle();
  const claims = buildRuleBasedAssistantClaims(evidence);
  assert.ok(claims.length > 0);
  const answer = renderAssistantClaims({ locale: "fr", bundle: evidence, claims });
  assert.equal(answer.source, "rules");
  assert.ok(answer.blocks.every((block) => block.evidenceIds.length > 0));
});
