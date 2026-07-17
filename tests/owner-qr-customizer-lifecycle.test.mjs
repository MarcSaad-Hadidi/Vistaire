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
  assert.match(harness.renderedText(), /\/q\/opaque-fixture-token/);
});

test("a style-only owner QR Save PATCHes only style and preserves the URL", async () => {
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
  assert.equal(
    harness.requests.some((request) => request.method === "POST"),
    false
  );
});
