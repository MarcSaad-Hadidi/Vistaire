import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getAdminAssistantAnswerWithDependencies } from "../lib/admin/assistant.ts";
import { isAdminAssistantRuntimeEnabled } from "../lib/admin/assistant.ts";
import { buildAdminEvidenceBundle } from "../lib/admin/data/evidenceRegistry.ts";
import { parseIanaTimeZone } from "../lib/admin/data/contracts.ts";

const timezone = parseIanaTimeZone("UTC");
const scope = { restaurantId: "r1", menuId: "m1", source: "production", timezone };
const observationWindow = {
  range: "today", timezone, alignment: "local-calendar-v1", calendarDayCount: 1,
  observedAt: "2026-08-11T20:00:00.000Z",
  current: { from: "2026-08-11T00:00:00.000Z", to: "2026-08-11T20:00:00.000Z" },
  previous: { from: "2026-08-10T00:00:00.000Z", to: "2026-08-10T20:00:00.000Z" }
};
const access = {
  ok: true, sessionKind: "qr", assurance: "live-admin-qr", qrId: "q1",
  restaurantId: "r1", expiresAt: 2_000_000_000, capabilities: ["dashboard:read"]
};

function evidenceBundle() {
  return buildAdminEvidenceBundle({
    scope,
    window: observationWindow,
    generatedAt: observationWindow.observedAt,
    records: [
      { metricId: "observed-menu-opens", definitionVersion: "v1", labelKey: "metrics.observed-menu-opens", period: "current", state: { kind: "available", value: { count: 9 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate", promptUnsafe: false }, audiences: ["ui", "mistral"] },
      { metricId: "observed-menu-opens", definitionVersion: "v1", labelKey: "metrics.observed-menu-opens", period: "previous", state: { kind: "available", value: { count: 7 } }, provenance: {}, freshness: {}, sample: {}, privacy: { classification: "aggregate", promptUnsafe: false }, audiences: ["ui", "mistral"] }
    ]
  });
}

test("admin assistant client sends no restaurant identifier", async () => {
  const component = await readFile("components/admin/insights/AdminAssistantDrawer.tsx", "utf8");

  assert.match(component, /fetch\(["']\/admin\/api\/assistant["']/);
  assert.match(
    component,
    /JSON\.stringify\(requestBody\)/
  );
  assert.doesNotMatch(component, /restaurantId/);
  assert.doesNotMatch(component, /\/api\/admin\/assistant/);
});

test("admin assistant endpoint authenticates the session before deriving restaurant scope", async () => {
  const route = await readFile("app/(fr)/admin/api/assistant/route.ts", "utf8");

  assert.match(route, /requireAdminRestaurantAccess\(["']dashboard:read["']\)/);
  assert.match(route, /access,/);
  assert.doesNotMatch(route, /body\.restaurantId|validation\.restaurantId/);
  assert.match(route, /readBoundedJsonBody\(request,\s*MAX_BODY_BYTES\)/);
  assert.doesNotMatch(route, /request\.text\(\)/);
  assert.match(route, /Cache-Control["']?\s*:\s*["']no-store["']/i);
  assert.match(route, /isAdminAssistantRuntimeEnabled\(\)/);
  assert.ok(
    route.indexOf('requireAdminRestaurantAccess("dashboard:read")') <
      route.indexOf("readBoundedJsonBody(request, MAX_BODY_BYTES)")
  );
});

test("assistant runtime gate is fail-closed and explicitly enabled for the hermetic fixture", () => {
  assert.equal(isAdminAssistantRuntimeEnabled({}), false);
  assert.equal(isAdminAssistantRuntimeEnabled({ VISTAIRE_ADMIN_ASSISTANT_ENABLED: "0" }), false);
  assert.equal(isAdminAssistantRuntimeEnabled({ VISTAIRE_ADMIN_ASSISTANT_ENABLED: "1" }), true);
  assert.equal(isAdminAssistantRuntimeEnabled({ NODE_ENV: "test", VISTAIRE_ADMIN_VISUAL_FIXTURE: "1" }), true);
  assert.equal(isAdminAssistantRuntimeEnabled({ NODE_ENV: "production", VISTAIRE_ADMIN_VISUAL_FIXTURE: "1" }), false);
});

test("assistant pipeline never calls Mistral unless distributed quota allows it", async () => {
  for (const state of ["denied", "unavailable", "error"]) {
    let modelCalls = 0;
    let scopedRestaurant = "";
    const result = await getAdminAssistantAnswerWithDependencies(
      { access, range: "today", mode: "question", locale: "fr", question: "Quels plats attirent le plus les clients ?" },
      {
        loadBundle: async (granted) => {
          scopedRestaurant = granted.restaurantId;
          return { ok: true, bundle: evidenceBundle() };
        },
        consumeQuota: async () => state === "denied" ? { state, remaining: 0, resetAt: "2026-08-11T20:01:00.000Z" } : { state },
        generateClaims: async () => { modelCalls += 1; return []; }
      }
    );
    assert.equal(scopedRestaurant, "r1");
    assert.equal(modelCalls, 0);
    assert.equal(result?.answer.source, "rules");
  }
});

test("assistant blocks likely personal data before quota and never forwards free-form text to Mistral", async () => {
  for (const question of [
    "Le client Jean Dupont cherche quels plats ?",
    "Que cherche le client au 12 rue Royale ?",
    "Que cherche jean.dupont@example.com ?",
    "Que cherche le +1 514 555 0199 ?",
    "Que cherche le client H2X 1Y4 ?",
    "Le client demande https://example.com/menu"
  ]) {
    let quotaCalls = 0;
    let modelCalls = 0;
    const result = await getAdminAssistantAnswerWithDependencies(
      { access, range: "7d", mode: "question", locale: "fr", question },
      {
        loadBundle: async () => ({ ok: true, bundle: evidenceBundle() }),
        consumeQuota: async () => { quotaCalls += 1; return { state: "allowed", remaining: 3, resetAt: "2026-08-11T20:01:00.000Z" }; },
        generateClaims: async () => { modelCalls += 1; return []; }
      }
    );
    assert.equal(result?.status, "blocked");
    assert.equal(quotaCalls, 0);
    assert.equal(modelCalls, 0);
  }

  let modelQuestion = "";
  let loadedRange = "";
  await getAdminAssistantAnswerWithDependencies(
    { access, range: "30d", mode: "question", locale: "fr", question: "Quels plats attirent le plus les clients ?" },
    {
      loadBundle: async (_access, range) => { loadedRange = range; return { ok: true, bundle: evidenceBundle() }; },
      consumeQuota: async () => ({ state: "allowed", remaining: 3, resetAt: "2026-08-11T20:01:00.000Z" }),
      generateClaims: async (input) => { modelQuestion = input.question; return []; }
    }
  );
  assert.equal(loadedRange, "30d");
  assert.doesNotMatch(modelQuestion, /Quels plats attirent/);
  assert.match(modelQuestion, /signaux mesurés/i);
});

test("assistant pipeline renders only evidence-bound claims after quota allowance", async () => {
  const bundle = evidenceBundle();
  const current = Object.values(bundle.records).find((record) => record.period === "current");
  let projected;
  const result = await getAdminAssistantAnswerWithDependencies(
    { access, range: "today", mode: "question", locale: "en", question: "Which menu activity attracts attention?" },
    {
      loadBundle: async () => ({ ok: true, bundle }),
      consumeQuota: async ({ restaurantId }) => {
        assert.equal(restaurantId, access.restaurantId);
        return { state: "allowed", remaining: 3, resetAt: "2026-08-11T20:01:00.000Z" };
      },
      generateClaims: async (input) => {
        projected = input.evidence;
        return [{ claimType: "metric-observation", evidenceIds: [current.evidenceId] }];
      }
    }
  );
  assert.equal(result?.answer.source, "mistral");
  assert.equal(result?.answer.blocks[0].value, "9");
  assert.doesNotMatch(JSON.stringify(projected), /restaurantId|menuId|r1|m1/);
});

test("legacy assistant endpoint is inert", async () => {
  const route = await readFile("app/api/admin/assistant/route.ts", "utf8");

  assert.match(route, /status:\s*410/);
  assert.match(route, /Cache-Control["']?\s*:\s*["']no-store["']/i);
  assert.doesNotMatch(route, /getAdminAssistantAnswer|generateMistral|restaurantId/);
});
