import assert from "node:assert/strict";
import test from "node:test";
import {
  createQrSupabaseFixture,
  loadQrStore
} from "./helpers/owner-qr-test-runtime.mjs";

async function resolveWithFixture(fixture, token) {
  fixture.install();
  const { resolveQrToken } = await loadQrStore();
  return resolveQrToken(token);
}

async function captureExpectedIncident(action) {
  const original = console.error;
  const incidents = [];
  console.error = (...args) => {
    incidents.push(args[0]);
  };
  try {
    return { result: await action(), incidents };
  } finally {
    console.error = original;
  }
}

for (const scenario of [
  {
    name: "admin",
    token: "fixture-admin-token",
    row: {
      id: "qr-admin-present-kind",
      restaurant_id: "restaurant-fixture",
      target_kind: "admin",
      target_path: "/admin"
    },
    expected: {
      ok: true,
      qrId: "qr-admin-present-kind",
      restaurantId: "restaurant-fixture",
      targetKind: "admin",
      targetPath: "/admin"
    }
  },
  {
    name: "legacy menu",
    token: "fixture-menu-token",
    row: {
      id: "qr-menu-present-kind",
      restaurant_id: "restaurant-fixture",
      target_kind: "menu",
      target_path: "/menu/legacy"
    },
    expected: {
      ok: true,
      qrId: "qr-menu-present-kind",
      restaurantId: "restaurant-fixture",
      targetKind: "menu",
      targetPath: "/menu/legacy"
    }
  }
]) {
  test(`H control: PGRST202 fallback resolves ${scenario.name} when target_kind exists`, async () => {
    const fixture = createQrSupabaseFixture({ metadataUnavailable: true });
    fixture.seedQr({ token: scenario.token, ...scenario.row });

    const result = await resolveWithFixture(fixture, scenario.token);
    const metadataIndex = fixture.calls.findIndex(
      (call) =>
        call.method === "rpc" &&
        call.name === "resolve_qr_code_scan_metadata"
    );
    const selectIndex = fixture.calls.findIndex(
      (call) =>
        call.method === "select" && /\btarget_kind\b/.test(call.columns)
    );
    const legacyRpcIndex = fixture.calls.findIndex(
      (call) =>
        call.method === "rpc" && call.name === "resolve_qr_code_scan"
    );

    assert.deepEqual(result, scenario.expected);
    assert.equal(fixture.scanCount(scenario.row.id), 1);
    assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 1);
    assert.ok(metadataIndex >= 0);
    assert.ok(selectIndex > metadataIndex);
    assert.ok(
      legacyRpcIndex > selectIndex,
      "fallback must select and validate metadata before incrementing"
    );
  });
}

test("H control: an explicit incoherent target_kind is rejected before the legacy RPC", async () => {
  const token = "fixture-incoherent-token";
  const id = "qr-incoherent-present-kind";
  const fixture = createQrSupabaseFixture({ metadataUnavailable: true });
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_kind: "admin",
    target_path: "/menu/legacy"
  });

  const result = await resolveWithFixture(fixture, token);

  assert.deepEqual(result, { ok: false });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 0);
  assert.equal(fixture.scanCount(id), 0);
});

test("H control: a real missing target_kind projection retries safely and increments once", async () => {
  const token = "fixture-old-schema-control";
  const id = "qr-old-schema-control";
  const fixture = createQrSupabaseFixture({
    metadataUnavailable: true,
    oldSchemaWithoutTargetKind: true
  });
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_path: "/menu/legacy",
    omit_target_kind: true
  });

  const { result, incidents } = await captureExpectedIncident(() =>
    resolveWithFixture(fixture, token)
  );
  const schemaError = fixture.calls.find(
    (call) => call.method === "error" && call.code === "42703"
  );

  assert.deepEqual(result, {
    ok: true,
    qrId: id,
    restaurantId: "restaurant-fixture",
    targetKind: "menu",
    targetPath: "/menu/legacy"
  });
  assert.ok(schemaError, "the fixture must model a database projection error");
  assert.match(schemaError.columns, /\btarget_kind\b/);
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 1);
  assert.equal(fixture.scanCount(id), 1);
  assert.equal(incidents.length, 0);
});

test("[RED: H] after 42703, an old-schema menu row must retry the legacy projection then increment once", async () => {
  const token = "fixture-old-schema-red";
  const id = "qr-old-schema-red";
  const fixture = createQrSupabaseFixture({
    metadataUnavailable: true,
    oldSchemaWithoutTargetKind: true
  });
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_path: "/menu/legacy",
    omit_target_kind: true
  });

  const { result } = await captureExpectedIncident(() =>
    resolveWithFixture(fixture, token)
  );

  assert.deepEqual(result, {
    ok: true,
    qrId: id,
    restaurantId: "restaurant-fixture",
    targetKind: "menu",
    targetPath: "/menu/legacy"
  });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 1);
  assert.equal(fixture.scanCount(id), 1);
});

test("H control: an old-schema admin-like path stays invalid and uncounted", async () => {
  const token = "fixture-old-schema-admin";
  const id = "qr-old-schema-admin";
  const fixture = createQrSupabaseFixture({
    metadataUnavailable: true,
    oldSchemaWithoutTargetKind: true
  });
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_path: "/admin",
    omit_target_kind: true
  });

  const { result } = await captureExpectedIncident(() =>
    resolveWithFixture(fixture, token)
  );

  assert.deepEqual(result, { ok: false });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 0);
  assert.equal(fixture.scanCount(id), 0);
});

test("I control: metadata RPC increments before TypeScript validation", async () => {
  const token = "fixture-metadata-order";
  const id = "qr-metadata-order";
  const fixture = createQrSupabaseFixture();
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_kind: "admin",
    target_path: "/menu/incoherent"
  });

  const result = await resolveWithFixture(fixture, token);

  assert.deepEqual(result, { ok: false });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan_metadata"), 1);
  assert.equal(fixture.scanCount(id), 1);
});

test("I control: fallback validates an active incoherent row before incrementing", async () => {
  const token = "fixture-fallback-order";
  const id = "qr-fallback-order";
  const fixture = createQrSupabaseFixture({ metadataUnavailable: true });
  fixture.seedQr({
    token,
    id,
    restaurant_id: "restaurant-fixture",
    target_kind: "admin",
    target_path: "/menu/incoherent"
  });

  const result = await resolveWithFixture(fixture, token);

  assert.deepEqual(result, { ok: false });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 0);
  assert.equal(fixture.scanCount(id), 0);
});
