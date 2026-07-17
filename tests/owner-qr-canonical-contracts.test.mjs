import assert from "node:assert/strict";
import test from "node:test";
import {
  createOwnerQrCustomizerHarness,
  createPromiseBarrier,
  createQrSupabaseFixture,
  loadQrPatchRoute,
  loadQrPostRoute,
  loadQrStore
} from "./helpers/owner-qr-test-runtime.mjs";

const createArgs = {
  restaurantId: "restaurant-fixture",
  label: "QR dashboard restaurant",
  targetKind: "admin",
  targetPath: "/admin",
  style: {
    foregroundColor: "#111111",
    backgroundColor: "#ffffff",
    accentColor: "#c9a96e",
    logoMode: "none",
    logoText: "V",
    logoImageUrl: "",
    logoSizePercent: 18,
    padding: 2,
    errorCorrectionLevel: "H"
  }
};

async function createThroughStore(fixture, overrides = {}) {
  fixture.install();
  const { createOwnerQrCode } = await loadQrStore();
  return createOwnerQrCode({
    ...createArgs,
    ...overrides,
    style: { ...createArgs.style, ...(overrides.style ?? {}) }
  });
}

test("A control: the real POST interface starts empty and creates one active persisted row", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.install();
  assert.equal(fixture.sanitizedRows().length, 0);

  const { POST } = await loadQrPostRoute();
  const response = await POST(
    new Request("https://fixture.invalid/api/owner/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createArgs)
    })
  );
  const payload = await response.json();
  const rows = fixture.sanitizedRows();

  assert.equal(response.status, 201);
  assert.equal(payload.ok, true);
  assert.equal(payload.persisted, true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, payload.record.id);
  assert.equal(rows[0].status, "active");
  assert.match(rows[0].fingerprint, /^[a-f0-9]{12}$/);
  assert.match(rows[0].tokenPreview, /^[A-Za-z0-9_-]{6}…$/);
  assert.equal(rows[0].count, 0);
});

test("C control: two unchanged saves currently create two rows", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await createThroughStore(fixture);
  const second = await createThroughStore(fixture);
  const rows = fixture.sanitizedRows();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.notEqual(rows[0].fingerprint, rows[1].fingerprint);
  assert.equal(rows.some((row) => row.id === first.record.id), true);
  assert.equal(
    rows.find((row) => row.id === first.record.id)?.status,
    "active"
  );
  assert.equal(rows.every((row) => row.status === "active"), true);
});

test("[RED: C] an unchanged Save must preserve one canonical row and the same id", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await createThroughStore(fixture);
  const originalHash = fixture.rows[0].token_hash;
  const second = await createThroughStore(fixture);
  const rows = fixture.sanitizedRows();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(rows.length, 1, "unchanged Save must not insert a second canonical QR");
  assert.equal(
    second.record.id,
    first.record.id,
    "unchanged Save must return the original canonical QR id"
  );
  assert.equal(fixture.rows[0].token_hash === originalHash, true);
  assert.equal("token" in second, false);
  assert.equal(Boolean(second.record.redirectUrl), false);
});

test("D control: a style-only second save currently creates a second row", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await createThroughStore(fixture);
  const second = await createThroughStore(fixture, {
    style: { foregroundColor: "#222222" }
  });
  const rows = fixture.sanitizedRows();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.notEqual(rows[0].fingerprint, rows[1].fingerprint);
  assert.equal(rows.some((row) => row.id === first.record.id), true);
  assert.equal(
    rows.find((row) => row.id === first.record.id)?.status,
    "active"
  );
  assert.equal(rows.every((row) => row.status === "active"), true);
  assert.equal(rows[1].style.foregroundColor, "#222222");
});

test("[RED: D] a style-only Save must update the canonical row without rotating its id", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await createThroughStore(fixture);
  const originalHash = fixture.rows[0].token_hash;
  const second = await createThroughStore(fixture, {
    style: { foregroundColor: "#222222" }
  });
  const rows = fixture.sanitizedRows();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(rows.length, 1, "style-only Save must not insert a second QR");
  assert.equal(second.record.id, first.record.id);
  assert.equal(rows[0].style.foregroundColor, "#222222");
  assert.equal(fixture.rows[0].token_hash === originalHash, true);
  assert.equal("token" in second, false);
  assert.equal(Boolean(second.record.redirectUrl), false);
});

test("E control: a Promise barrier exposes two inserts for concurrent first saves", async () => {
  const barrier = createPromiseBarrier(2);
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { createOwnerQrCode } = await loadQrStore();

  const [first, second] = await Promise.all([
    barrier.arrive().then(() => createOwnerQrCode(createArgs)),
    barrier.arrive().then(() => createOwnerQrCode(createArgs))
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(barrier.arrivals, 2);
  assert.equal(fixture.sanitizedRows().length, 2);
});

test("[RED: E] concurrent first saves must converge on one logical target_path identity", async () => {
  const barrier = createPromiseBarrier(2);
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { createOwnerQrCode } = await loadQrStore();

  const [first, second] = await Promise.all([
    barrier.arrive().then(() => createOwnerQrCode(createArgs)),
    barrier.arrive().then(() => createOwnerQrCode(createArgs))
  ]);
  const rows = fixture.sanitizedRows();

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(rows.length, 1, "concurrent creation must be idempotent");
  assert.equal(first.record.id, second.record.id);
});

test("[RED: E/G] only the concurrent creator may receive one-time raw token material", async () => {
  const barrier = createPromiseBarrier(2);
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { createOwnerQrCode } = await loadQrStore();

  const results = await Promise.all([
    barrier.arrive().then(() => createOwnerQrCode(createArgs)),
    barrier.arrive().then(() => createOwnerQrCode(createArgs))
  ]);
  const responsesWithRawMaterial = results.filter(
    (result) =>
      result.ok &&
      typeof result.token === "string" &&
      result.token.length > 0 &&
      typeof result.record.redirectUrl === "string" &&
      result.record.redirectUrl.startsWith("/q/")
  ).length;

  assert.equal(
    responsesWithRawMaterial,
    1,
    "a concurrency loser must identify the canonical row without recovering its token"
  );
});

test("F control: PATCH updates the same observable id through the real API route", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughStore(fixture);
  assert.equal(created.ok, true);
  const before = fixture.rows[0];
  const preservedHash = before.token_hash;
  const preservedPath = before.target_path;
  const preservedKind = before.target_kind;
  const preservedStatus = before.status;
  const preservedCount = before.scan_count;

  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${created.record.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: { ...createArgs.style, foregroundColor: "#333333" }
        })
      }
    ),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();
  const rows = fixture.sanitizedRows();
  const idFilter = fixture.calls.find(
    (call) =>
      call.method === "eq" &&
      call.column === "id" &&
      call.value === created.record.id
  );

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.record.id, created.record.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, created.record.id);
  assert.equal(rows[0].style.foregroundColor, "#333333");
  assert.ok(idFilter, "PATCH must constrain the update by the requested QR id");
  const after = fixture.rows[0];
  assert.equal(after.token_hash === preservedHash, true);
  assert.equal(after.target_path === preservedPath, true);
  assert.equal(after.target_kind === preservedKind, true);
  assert.equal(after.status === preservedStatus, true);
  assert.equal(after.scan_count === preservedCount, true);
});

test("C control: the customizer currently sends POST again for an unchanged Save", async () => {
  const harness = createOwnerQrCustomizerHarness();
  await harness.save();
  await harness.save();

  assert.equal(harness.requests.length, 2);
  assert.deepEqual(
    harness.requests.map((request) => request.method),
    ["POST", "POST"]
  );
});

test("[RED: C/F] the customizer must make no mutation call for an unchanged Save", async () => {
  const harness = createOwnerQrCustomizerHarness();
  await harness.save();
  const callsAfterFirstSave = harness.requests.length;
  await harness.save();

  assert.equal(callsAfterFirstSave, 1);
  assert.equal(
    harness.requests.length,
    callsAfterFirstSave,
    "unchanged Save must not call POST or PATCH"
  );
  assert.match(harness.renderedText(), /\/q\/opaque-fixture-token/);
});

test("D control: the customizer currently sends POST for a style-only Save", async () => {
  const harness = createOwnerQrCustomizerHarness();
  await harness.save();
  harness.changeForeground("#222222");
  await harness.save();

  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1].method, "POST");
  assert.equal(harness.requests[1].url, "/api/owner/qr-codes");
});

test("[RED: D/F] the customizer must PATCH the first response id for a style-only Save", async () => {
  const harness = createOwnerQrCustomizerHarness();
  await harness.save();
  harness.changeForeground("#222222");
  await harness.save();
  const mutation = harness.requests[1];

  assert.equal(harness.requests.length, 2);
  assert.equal(mutation.method, "PATCH");
  assert.equal(mutation.url, "/api/owner/qr-codes/qr-observable-1");
  assert.equal(mutation.body.style.foregroundColor, "#222222");
  assert.deepEqual(Object.keys(mutation.body), ["style"]);
  for (const forbidden of [
    "id",
    "restaurantId",
    "targetKind",
    "targetPath",
    "token",
    "tokenHash",
    "scanCount"
  ]) {
    assert.equal(forbidden in mutation.body, false);
  }
  assert.match(harness.renderedText(), /QR securise enregistre/);
  assert.match(harness.renderedText(), /\/q\/opaque-fixture-token/);
  assert.doesNotMatch(harness.renderedText(), /Sauvegarde QR impossible/);
});

test("G control: persistence stores only hash plus preview and a reload has no redirect material", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughStore(fixture);
  assert.equal(created.ok, true);

  const stored = fixture.rows[0];
  const keys = Object.keys(stored);
  assert.equal(typeof stored.token_hash, "string");
  assert.match(stored.token_preview, /^[A-Za-z0-9_-]{6}…$/);
  assert.equal(keys.includes("rawToken"), false);
  assert.equal(keys.includes("raw_token"), false);
  assert.equal(keys.includes("redirectUrl"), false);
  assert.equal(keys.includes("redirect_url"), false);
  assert.equal(keys.includes("purpose"), false);
  assert.equal(Object.values(stored).includes(created.token), false);

  const { updateOwnerQrCode } = await loadQrStore();
  const reloaded = await updateOwnerQrCode(created.record.id, {
    style: createArgs.style
  });
  assert.equal(reloaded.ok, true);
  assert.equal(reloaded.record.id, created.record.id);
  assert.equal(reloaded.record.redirectUrl.length === 0, true);
  assert.equal("token" in reloaded, false);
});
