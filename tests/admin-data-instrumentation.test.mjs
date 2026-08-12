import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_INSTRUMENTATION_LIMITS,
  coversEntirePeriod
} from "../lib/admin/data/instrumentation.ts";

const bounds = { from: "2026-01-10T00:00:00.000Z", to: "2026-01-11T00:00:00.000Z" };
const base = {
  version: "admin-vnext-observed-v1", renderer: "public-menu", source: "production",
  coverageStartAt: "2026-01-01T00:00:00.000Z", coverageEndAt: "2026-02-01T00:00:00.000Z",
  proof: { kind: "verified-deployment", deploymentId: "deployment-1" },
  signals: { menu_opened: "covered" }
};

test("coverage requires verified production deployment and the entire interval", () => {
  assert.equal(coversEntirePeriod(base, bounds, "menu_opened"), true);
  assert.equal(coversEntirePeriod({ ...base, proof: { kind: "unverified" } }, bounds, "menu_opened"), false);
  assert.equal(coversEntirePeriod({ ...base, coverageStartAt: null }, bounds, "menu_opened"), false);
  assert.equal(coversEntirePeriod({ ...base, coverageStartAt: "2026-01-10T00:00:01.000Z" }, bounds, "menu_opened"), false);
  assert.equal(coversEntirePeriod({ ...base, coverageEndAt: "2026-01-10T23:59:59.000Z" }, bounds, "menu_opened"), false);
  assert.equal(coversEntirePeriod({ ...base, signals: { menu_opened: "partial" } }, bounds, "menu_opened"), false);
});

test("instrumentation provenance declares public-client residual limits", () => {
  assert.deepEqual(ADMIN_INSTRUMENTATION_LIMITS, {
    sameOrigin: "enforced-v1", entityMembership: "enforced-v1", instrumentationVersion: "enforced-v1",
    rateLimit: "not-enforced-distributed", idempotence: "client-dedupe-only-not-durable",
    clientAuthenticity: "public-client-not-attested"
  });
});
