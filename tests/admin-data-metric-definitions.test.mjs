import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_METRIC_DEFINITIONS } from "../lib/admin/data/metricDefinitions.ts";

test("metric definitions are versioned, sourced, audience-scoped and non-commercial", () => {
  assert.ok(ADMIN_METRIC_DEFINITIONS.length > 10);
  for (const definition of ADMIN_METRIC_DEFINITIONS) {
    assert.match(definition.definitionVersion, /^admin-vnext-/);
    assert.equal(definition.source, "production");
    assert.ok(definition.audiences.includes("ui"));
  }
  assert.doesNotMatch(JSON.stringify(ADMIN_METRIC_DEFINITIONS), /revenue|orders|sales|commercial-conversion|chiffre-affaires/i);
});

test("unsupported signals remain explicitly unmeasured", () => {
  for (const id of ["active-sessions", "average-duration", "funnel", "3d-success", "ar-success", "mobile-performance", "asset-errors"]) {
    assert.equal(ADMIN_METRIC_DEFINITIONS.find((item) => item.id === id).measurement, "unmeasured");
  }
});
