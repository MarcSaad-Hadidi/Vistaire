import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_METRIC_IDS,
  assertProductionAdminMetricScope,
  parseAdminRange,
  parseIanaTimeZone
} from "../lib/admin/data/contracts.ts";

const scope = {
  restaurantId: "11111111-1111-1111-1111-111111111111",
  menuId: "22222222-2222-2222-2222-222222222222",
  source: "production",
  timezone: "America/Toronto"
};

test("production scope requires every server-derived identity field", () => {
  assert.deepEqual(assertProductionAdminMetricScope(scope), scope);
  for (const key of ["restaurantId", "menuId", "timezone"]) {
    const invalid = { ...scope };
    delete invalid[key];
    assert.throws(() => assertProductionAdminMetricScope(invalid));
  }
  for (const source of ["demo", "internal", "test"]) {
    assert.throws(() => assertProductionAdminMetricScope({ ...scope, source }));
  }
});

test("ranges and IANA timezones are closed and validated", () => {
  assert.equal(parseAdminRange("today"), "today");
  assert.equal(parseAdminRange("7d"), "7d");
  assert.equal(parseAdminRange("30d"), "30d");
  assert.throws(() => parseAdminRange("90d"));
  assert.equal(parseIanaTimeZone("America/Toronto"), "America/Toronto");
  assert.throws(() => parseIanaTimeZone("Toronto"));
});

test("metric identifiers exclude commercial claims", () => {
  const serialized = JSON.stringify(ADMIN_METRIC_IDS);
  for (const forbidden of ["revenue", "orders", "sales", "commercial-conversion"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }
});
