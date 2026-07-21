import assert from "node:assert/strict";
import test from "node:test";
import {
  createOwnerQrCustomizerHarness
} from "./helpers/owner-qr-test-runtime.mjs";

test("an unchanged owner QR Save makes no second mutation", async () => {
  const harness = createOwnerQrCustomizerHarness();
  assert.equal(await harness.save(), false, "Save stays blocked until GET completes");
  await harness.load();
  await harness.save();
  const mutationsAfterFirstSave = harness.requests.filter(
    (request) => request.method !== "GET"
  ).length;
  await harness.save();

  assert.equal(mutationsAfterFirstSave, 1);
  assert.equal(
    harness.requests.filter((request) => request.method !== "GET").length,
    mutationsAfterFirstSave,
    "unchanged Save must not call POST or PATCH"
  );
  assert.equal(harness.requests[0].method, "GET");
  const creation = harness.requests.find((request) => request.method === "POST");
  assert.ok(creation);
  assert.deepEqual(Object.keys(creation.body), [
    "restaurantId",
    "label",
    "targetKind",
    "purposeKey",
    "style"
  ]);
  assert.equal(creation.body.restaurantId, "restaurant-fixture");
  assert.equal(creation.body.label, "QR dashboard restaurant");
  assert.equal(creation.body.targetKind, "admin");
  assert.equal(creation.body.purposeKey, "default");
  assert.equal(typeof creation.body.style, "object");
  for (const forbidden of ["targetPath", "id", "token", "unknown"]) {
    assert.equal(forbidden in creation.body, false);
  }
  assert.match(harness.renderedText(), /\/q\/opaque-fixture-token/);
});

test("a style-only owner QR Save PATCHes style with its expected version and preserves the URL", async () => {
  const harness = createOwnerQrCustomizerHarness();
  await harness.load();
  await harness.save();
  harness.changeForeground("#222222");
  await harness.save();
  const mutations = harness.requests.filter((request) => request.method !== "GET");
  const mutation = mutations[1];

  assert.equal(mutations.length, 2);
  assert.equal(mutation.method, "PATCH");
  assert.equal(mutation.url, "/api/owner/qr-codes/qr-observable-1");
  assert.equal(mutation.body.style.foregroundColor, "#222222");
  assert.equal(mutation.body.expectedConfigVersion, 1);
  assert.deepEqual(Object.keys(mutation.body), ["style", "expectedConfigVersion"]);
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
  assert.match(harness.renderedText(), /Style du QR enregistr/);
  assert.match(harness.renderedText(), /\/q\/opaque-fixture-token/);
  assert.doesNotMatch(harness.renderedText(), /Sauvegarde QR impossible/);
});

test("GET hydration prevents a duplicate POST and routes later edits through PATCH", async () => {
  const canonicalRecord = {
    id: "qr-observable-1",
    redirectUrl: "/q/opaque-fixture-token",
    targetPath: "/admin",
    targetKind: "admin",
    purposeKey: "default",
    persisted: true,
    recoverable: true,
    tokenPreview: "…token",
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
  const harness = createOwnerQrCustomizerHarness({ canonicalRecord });

  assert.equal(await harness.save(), false);
  await harness.load();
  harness.changeForeground("#222222");
  assert.equal(await harness.save(), true);

  const mutations = harness.requests.filter((request) => request.method !== "GET");
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].method, "PATCH");
  assert.equal(mutations[0].body.style.foregroundColor, "#222222");
  assert.equal(mutations[0].body.expectedConfigVersion, 1);
  assert.equal(
    harness.requests.some((request) => request.method === "POST"),
    false
  );
});

test("lifecycle writes require the loaded version and send one UUID per user attempt", async () => {
  const canonicalRecord = {
    id: "qr-observable-1",
    redirectUrl: "/q/opaque-fixture-token",
    targetPath: "/admin",
    targetKind: "admin",
    purposeKey: "default",
    persisted: true,
    recoverable: true,
    status: "active",
    isCanonical: true,
    configVersion: 7,
    tokenPreview: "…token",
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
  const uuids = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000004"
  ];
  const harness = createOwnerQrCustomizerHarness({
    canonicalRecord,
    randomUUID: (sequence) => uuids[sequence - 1]
  });

  await harness.load();
  for (const action of ["pause", "resume", "archive"]) {
    assert.equal(await harness.status(action), true);
  }

  const statusRequests = harness.requests.filter((request) =>
    request.url.endsWith("/status")
  );
  assert.deepEqual(
    statusRequests.map((request) => request.body),
    [
      { action: "pause", expectedConfigVersion: 7, idempotencyKey: uuids[0] },
      { action: "resume", expectedConfigVersion: 8, idempotencyKey: uuids[1] },
      { action: "archive", expectedConfigVersion: 9, idempotencyKey: uuids[2] }
    ]
  );
});

test("lifecycle writes fail closed when the canonical version is absent", async () => {
  const harness = createOwnerQrCustomizerHarness({
    canonicalRecord: {
      id: "qr-observable-1",
      redirectUrl: "/q/opaque-fixture-token",
      targetPath: "/admin",
      targetKind: "admin",
      purposeKey: "default",
      persisted: true,
      recoverable: true,
      status: "active",
      isCanonical: true,
      tokenPreview: "…token",
      style: {}
    },
    omitConfigVersion: true
  });

  await harness.load();
  assert.equal(await harness.status("pause"), true);
  assert.equal(
    harness.requests.some((request) => request.url.endsWith("/status")),
    false
  );
  assert.match(harness.renderedText(), /Version de configuration absente/);
});
