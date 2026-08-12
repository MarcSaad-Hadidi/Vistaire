import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const loadCapability = () => import("../lib/admin/availability/capability.ts");
const loadViewModel = () => import("../components/admin/availability/availabilityViewModel.ts");

const now = new Date("2026-08-11T20:00:00.000Z");
const base = {
  enabled: true,
  now: () => now,
  readCapability: async () => ({ schemaVersion: 1, workerLastSuccessAt: "2026-08-11T19:58:00.000Z", workerLastAttemptAt: "2026-08-11T19:58:00.000Z" })
};

test("scheduling is enabled only with the expected schema and recent successful worker", async () => {
  const { detectAvailabilitySchedulingCapability } = await loadCapability();
  assert.deepEqual(await detectAvailabilitySchedulingCapability(base), { kind: "available", schemaVersion: 1, workerLastSuccessAt: "2026-08-11T19:58:00.000Z" });
  assert.deepEqual(await detectAvailabilitySchedulingCapability({ ...base, enabled: false }), { kind: "unavailable", reason: "feature-disabled" });
  assert.deepEqual(await detectAvailabilitySchedulingCapability({ ...base, readCapability: async () => null }), { kind: "unavailable", reason: "schema-not-deployed" });
  assert.deepEqual(await detectAvailabilitySchedulingCapability({ ...base, readCapability: async () => ({ schemaVersion: 2, workerLastSuccessAt: "2026-08-11T19:58:00.000Z" }) }), { kind: "unavailable", reason: "rpc-version-mismatch" });
});

test("attempts do not prove worker success and invalid stale or future success fails closed", async () => {
  const { detectAvailabilitySchedulingCapability } = await loadCapability();
  for (const workerLastSuccessAt of [null, "invalid", "2026-08-11T19:40:00.000Z", "2026-08-11T20:01:00.000Z"]) {
    const value = await detectAvailabilitySchedulingCapability({ ...base, readCapability: async () => ({ schemaVersion: 1, workerLastSuccessAt, workerLastAttemptAt: "2026-08-11T19:59:00.000Z" }) });
    assert.deepEqual(value, { kind: "unavailable", reason: "worker-not-active" });
  }
});

test("permission and network failures remain errors rather than schema absence", async () => {
  const { detectAvailabilitySchedulingCapability } = await loadCapability();
  assert.deepEqual(await detectAvailabilitySchedulingCapability({ ...base, readCapability: async () => { throw Object.assign(new Error("permission denied"), { code: "42501" }); } }), { kind: "error", retryable: false });
  assert.deepEqual(await detectAvailabilitySchedulingCapability({ ...base, readCapability: async () => { throw new TypeError("fetch failed"); } }), { kind: "error", retryable: true });
});

test("view model preserves server totals, locale and timezone without inventing history", async () => {
  const { buildAvailabilityViewModel } = await loadViewModel();
  const model = buildAvailabilityViewModel({ locale: "fr", timezone: "America/Toronto", dishes: [{ id: "1", name: "Homard rôti", category: "Fruits de mer", available: false }], capability: { kind: "unavailable", reason: "worker-not-active" }, history: [], schedules: [] });
  assert.equal(model.summary.total, 1);
  assert.equal(model.summary.unavailable, 1);
  assert.equal(model.timezone, "America/Toronto");
  assert.deepEqual(model.history, []);
  assert.equal(model.copy.scheduleUnavailable.includes("indisponible"), true);
});

test("availability UI owns premium operational hierarchy and honest degraded state", async () => {
  const page = await readFile("components/admin/availability/AdminAvailabilityList.tsx", "utf8");
  const notice = await readFile("components/admin/availability/AvailabilityCapabilityNotice.tsx", "utf8");
  const form = await readFile("components/admin/availability/AvailabilityScheduleForm.tsx", "utf8");
  const history = await readFile("components/admin/availability/AvailabilityHistory.tsx", "utf8");
  const css = await readFile("components/admin/availability/AdminAvailability.module.css", "utf8");
  assert.match(page, /Gestion opérationnelle|Gestion opÃ©rationnelle/);
  assert.match(page, /Retours planifiés|Retours planifiÃ©s/);
  assert.match(history, /Historique récent|Historique rÃ©cent/);
  assert.match(notice, /capability\.kind/);
  assert.match(form, /maxLength=\{120\}/);
  assert.doesNotMatch(`${page}\n${form}`, /localStorage|sessionStorage/);
  assert.match(css, /@media \(max-width:\s*700px\)/);
  assert.match(css, /overflow-x:\s*clip/);
});

test("availability E2E is fixture-first, loopback-only and never skips", async () => {
  const legacy = await readFile("e2e/admin-availability.spec.ts", "utf8");
  const next = await readFile("e2e/admin-vnext-availability.spec.ts", "utf8");
  const contract = `${legacy}\n${next}`;
  assert.doesNotMatch(contract, /VISTAIRE_ADMIN_E2E_QR_TOKEN|test\.skip|test\.fixme/);
  assert.match(contract, /VISTAIRE_ADMIN_VISUAL_FIXTURE/);
  assert.match(contract, /localhost|127\.0\.0\.1|::1/);
});
