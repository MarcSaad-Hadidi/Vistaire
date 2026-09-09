import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_ASSISTANT_CLAIMS_RESPONSE_FORMAT,
  generateMistralAdminClaims
} from "../lib/admin/assistant/mistralClaims.ts";

const evidenceId = "ev:observed-menu-opens:current:v1";
const evidence = {
  records: {
    [evidenceId]: {
      evidenceId,
      metricId: "observed-menu-opens",
      labelKey: "metrics.observed-menu-opens",
      state: { kind: "available", value: { count: 12 } },
      period: "current"
    }
  }
};

function response(content, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ choices: [{ message: { content } }] })
  };
}

test("Mistral transport uses Chat Completions and the exact closed JSON schema", async () => {
  const calls = [];
  const claims = await generateMistralAdminClaims({ locale: "fr", question: "Que remarquer ?", evidence }, {
    apiKey: "test-key", model: "test-model",
    fetchImpl: async (...args) => { calls.push(args); return response(JSON.stringify({ claims: [{ claimType: "metric-observation", evidenceIds: [evidenceId] }] })); }
  });
  assert.deepEqual(claims, [{ claimType: "metric-observation", evidenceIds: [evidenceId] }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://api.mistral.ai/v1/chat/completions");
  const options = calls[0][1];
  assert.equal(options.method, "POST");
  const body = JSON.parse(options.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.temperature, 0);
  assert.deepEqual(body.response_format, ADMIN_ASSISTANT_CLAIMS_RESPONSE_FORMAT);
  assert.deepEqual(Object.keys(body.response_format.json_schema.schema), ["type", "additionalProperties", "required", "properties"]);
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
  const item = body.response_format.json_schema.schema.properties.claims.items;
  assert.equal(body.response_format.json_schema.schema.properties.claims.minItems, 1);
  assert.equal(item.additionalProperties, false);
  assert.deepEqual(item.required, ["claimType", "evidenceIds"]);
  assert.deepEqual(item.properties.claimType.enum, ["metric-observation", "period-comparison", "rank-observation", "attention-observation"]);
});

test("missing config, non-2xx and malformed structured output return null without retry", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response("{}", 503); };
  assert.equal(await generateMistralAdminClaims({ locale: "fr", question: "Résumé", evidence }, { apiKey: "", model: "test-model", fetchImpl }), null);
  assert.equal(calls, 0);
  assert.equal(await generateMistralAdminClaims({ locale: "fr", question: "Résumé", evidence }, { apiKey: "test-key", model: "", fetchImpl }), null);
  assert.equal(calls, 0);
  assert.equal(await generateMistralAdminClaims({ locale: "fr", question: "Résumé", evidence }, { apiKey: "test-key", model: "test-model", fetchImpl }), null);
  assert.equal(calls, 1);
});

test("validator rejects unknown evidence, prose, extra fields, prefixes and fences without a second call", async () => {
  const invalid = [
    { claims: [] },
    { claims: [{ claimType: "metric-observation", evidenceIds: ["ev:unknown"] }] },
    { claims: [{ claimType: "metric-observation", evidenceIds: [evidenceId], prose: "twelve" }] },
    { claims: [{ claimType: "metric-observation", evidenceIds: [evidenceId] }], prose: "extra" },
    { claims: [{ claimType: "free-prose", evidenceIds: [evidenceId] }] }
  ];
  for (const payload of invalid) {
    let calls = 0;
    const result = await generateMistralAdminClaims({ locale: "en", question: "What changed?", evidence }, {
      apiKey: "test-key", model: "test-model",
      fetchImpl: async () => { calls += 1; return response(JSON.stringify(payload)); }
    });
    assert.equal(result, null);
    assert.equal(calls, 1);
  }
  for (const content of [`prefix ${JSON.stringify(invalid[0])}`, `\`\`\`json\n${JSON.stringify(invalid[0])}\n\`\`\``]) {
    let calls = 0;
    assert.equal(await generateMistralAdminClaims({ locale: "fr", question: "Résumé", evidence }, { apiKey: "test-key", model: "test-model", fetchImpl: async () => { calls += 1; return response(content); } }), null);
    assert.equal(calls, 1);
  }
});

test("transport caps input, times out and emits no sensitive logs", async () => {
  const messages = [];
  const originalError = console.error;
  console.error = (...args) => messages.push(args.join(" "));
  try {
    const timedOut = await generateMistralAdminClaims({ locale: "fr", question: "Résumé", evidence }, {
      apiKey: "secret-key", model: "secret-model", timeoutMs: 5,
      fetchImpl: async (_url, options) => await new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }))
    });
    assert.equal(timedOut, null);
    const huge = { records: Object.fromEntries(Array.from({ length: 1000 }, (_, index) => [`ev:item:${index}`, { evidenceId: `ev:item:${index}`, metricId: "catalog-dishes", labelKey: "x".repeat(40), state: { kind: "available", value: { count: index } }, period: "snapshot" }])) };
    let calls = 0;
    assert.equal(await generateMistralAdminClaims({ locale: "fr", question: "x".repeat(1000), evidence: huge }, { apiKey: "secret-key", model: "secret-model", fetchImpl: async () => { calls += 1; return response("{}"); } }), null);
    assert.equal(calls, 0);
    assert.equal(messages.join(" ").includes("secret-key"), false);
    assert.equal(messages.join(" ").includes("secret-model"), false);
  } finally {
    console.error = originalError;
  }
});
