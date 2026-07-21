import assert from "node:assert/strict";
import test from "node:test";
import {
  createQrSupabaseFixture,
  loadQrInventoryRoute,
  loadQrRotateRoute,
  loadQrStatusRoute,
  loadQrStore
} from "./helpers/owner-qr-test-runtime.mjs";

const restaurantId = "11111111-1111-1111-1111-111111111111";
const style = {
  foregroundColor: "#111111",
  backgroundColor: "#ffffff",
  accentColor: "#c9a96e",
  logoMode: "none",
  logoText: "V",
  logoImageUrl: "",
  logoSizePercent: 18,
  padding: 2,
  errorCorrectionLevel: "H"
};

async function createCanonical(fixture, context) {
  context.after(fixture.install());
  const { getOrCreateOwnerQrCode } = await loadQrStore();
  const created = await getOrCreateOwnerQrCode({
    restaurantId,
    targetKind: "admin",
    purposeKey: "default",
    style
  });
  assert.equal(created.ok, true);
  return created.record;
}

test("rotation applies pause, persists one audit event, and replays the same operation exactly", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createCanonical(fixture, t);
  const { rotateOwnerQrCode } = await loadQrStore();
  const args = {
    confirmed: true,
    idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    previousDisposition: "pause",
    expectedConfigVersion: previous.configVersion
  };

  const first = await rotateOwnerQrCode(previous.id, args);
  const replay = await rotateOwnerQrCode(previous.id, args);

  assert.equal(first.ok, true);
  assert.equal(first.previous.status, "paused");
  assert.equal(first.previous.configVersion, previous.configVersion + 1);
  assert.equal(first.current.configVersion, previous.configVersion + 1);
  assert.deepEqual(replay, first);
  assert.equal(fixture.lifecycleEvents.length, 1);
  const [event] = fixture.lifecycleEvents;
  assert.equal(event.operation_id, args.idempotencyKey);
  assert.equal(event.qr_code_id, previous.id);
  assert.equal(event.successor_qr_code_id, first.current.id);
  assert.equal(event.action, "rotate");
  assert.equal(event.disposition, "pause");
  assert.equal(event.previous_status, "active");
  assert.equal(event.new_status, "paused");
  assert.equal(event.previous_config_version, previous.configVersion);
  assert.equal(event.new_config_version, previous.configVersion + 1);
  assert.match(event.request_fingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(event.request_fingerprint, /sha256:|ciphertext|nonce|test-v1/);
});

test("rotation audit failure rolls back predecessor, successor, and event state", async (t) => {
  const fixture = createQrSupabaseFixture({
    rotationAuditError: { code: "XX000", message: "audit insert failed" }
  });
  const previous = await createCanonical(fixture, t);
  const before = fixture.snapshotRows();
  const { rotateOwnerQrCode } = await loadQrStore();
  const originalConsoleError = console.error;
  console.error = () => {};
  let result;
  try {
    result = await rotateOwnerQrCode(previous.id, {
      confirmed: true,
      idempotencyKey: "abababab-abab-4bab-8bab-abababababab",
      previousDisposition: "revoke",
      expectedConfigVersion: previous.configVersion
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(result.ok, false);
  assert.deepEqual(fixture.snapshotRows(), before);
  assert.equal(fixture.lifecycleEvents.length, 0);
});

test("rotation rejects reuse of an idempotency key with a different disposition", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createCanonical(fixture, t);
  const { rotateOwnerQrCode } = await loadQrStore();
  const idempotencyKey = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const first = await rotateOwnerQrCode(previous.id, {
    confirmed: true,
    idempotencyKey,
    previousDisposition: "keep-active",
    expectedConfigVersion: previous.configVersion
  });
  assert.equal(first.ok, true);

  const reused = await rotateOwnerQrCode(previous.id, {
    confirmed: true,
    idempotencyKey,
    previousDisposition: "revoke",
    expectedConfigVersion: previous.configVersion
  });

  assert.equal(reused.ok, false);
  assert.equal(reused.code, "idempotency-conflict");
  assert.equal(fixture.lifecycleEvents.length, 1);
});

test("rotation route maps stale config_version to 409 without mutating history", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createCanonical(fixture, t);
  const row = fixture.rows.find((candidate) => candidate.id === previous.id);
  row.config_version += 1;
  const before = fixture.snapshotRows();
  const { POST } = await loadQrRotateRoute();

  const response = await POST(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${previous.id}/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        previousDisposition: "revoke",
        expectedConfigVersion: previous.configVersion
      })
    }),
    { params: Promise.resolve({ id: previous.id }) }
  );

  assert.equal(response.status, 409);
  assert.deepEqual(fixture.snapshotRows(), before);
  assert.equal(fixture.lifecycleEvents.length, 0);
});

test("inventory handler returns newest-first metadata without token or vault fields", async (t) => {
  const fixture = createQrSupabaseFixture();
  fixture.seedQr({
    id: "11111111-1111-4111-8111-111111111111",
    token: "A".repeat(32),
    restaurant_id: restaurantId,
    target_kind: "admin",
    purpose_key: "default",
    is_canonical: false,
    rotated_at: "2026-07-18T12:01:00.000Z",
    created_at: "2026-07-17T12:00:00.000Z"
  });
  fixture.seedQr({
    id: "22222222-2222-4222-8222-222222222222",
    token: "B".repeat(32),
    restaurant_id: restaurantId,
    target_kind: "admin",
    purpose_key: "default",
    is_canonical: true,
    supersedes_qr_code_id: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-07-17T12:00:00.000Z"
  });
  t.after(fixture.install());
  const { GET } = await loadQrInventoryRoute();

  const response = await GET(
    new Request(`https://fixture.invalid/api/owner/qr-codes/inventory?restaurantId=${restaurantId}`)
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.records.map((record) => record.id), [
    "22222222-2222-4222-8222-222222222222",
    "11111111-1111-4111-8111-111111111111"
  ]);
  assert.equal(
    payload.records[0].supersedesQrCodeId,
    "11111111-1111-4111-8111-111111111111"
  );
  assert.equal(payload.records[1].rotatedAt, "2026-07-18T12:01:00.000Z");
  for (const record of payload.records) {
    for (const forbidden of [
      "token",
      "tokenHash",
      "tokenPreview",
      "tokenCiphertext",
      "tokenNonce",
      "tokenKeyVersion",
      "redirectUrl"
    ]) {
      assert.equal(forbidden in record, false, forbidden);
    }
  }
});

test("status handler executes replay-safe pause, resume, and revoke through lifecycle RPCs", async (t) => {
  const fixture = createQrSupabaseFixture();
  const canonical = await createCanonical(fixture, t);
  const { POST } = await loadQrStatusRoute();
  const url = `https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`;

  async function mutate(action, expectedConfigVersion, idempotencyKey) {
    const response = await POST(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedConfigVersion, idempotencyKey })
      }),
      { params: Promise.resolve({ id: canonical.id }) }
    );
    return { response, payload: await response.json() };
  }

  const pauseKey = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const paused = await mutate("pause", canonical.configVersion, pauseKey);
  assert.equal(paused.response.status, 200);
  assert.equal(paused.payload.record.status, "paused");
  const pauseReplay = await mutate("pause", canonical.configVersion, pauseKey);
  assert.equal(pauseReplay.response.status, 200);
  assert.deepEqual(pauseReplay.payload.record, paused.payload.record);
  assert.equal(fixture.lifecycleEvents.length, 1);

  const keyReuse = await mutate(
    "resume",
    paused.payload.record.configVersion,
    pauseKey
  );
  assert.equal(keyReuse.response.status, 409);
  assert.equal(keyReuse.payload.code, "idempotency-conflict");

  const resumed = await mutate(
    "resume",
    paused.payload.record.configVersion,
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
  );
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.payload.record.status, "active");
  const revoked = await mutate(
    "revoke",
    resumed.payload.record.configVersion,
    "ffffffff-ffff-4fff-8fff-ffffffffffff"
  );
  assert.equal(revoked.response.status, 200);
  assert.equal(revoked.payload.record.status, "revoked");

  assert.equal(fixture.lifecycleEvents.length, 3);
  assert.deepEqual(
    fixture.lifecycleEvents.map((event) => event.action),
    ["pause", "resume", "revoke"]
  );
});

test("status handler archives through owner_clear_canonical_qr", async (t) => {
  const fixture = createQrSupabaseFixture();
  const canonical = await createCanonical(fixture, t);
  const { POST } = await loadQrStatusRoute();
  const response = await POST(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "archive",
        expectedConfigVersion: canonical.configVersion,
        idempotencyKey: "99999999-9999-4999-8999-999999999999"
      })
    }),
    { params: Promise.resolve({ id: canonical.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.record.status, "archived");
  assert.equal(fixture.lifecycleEvents.length, 1);
  assert.equal(fixture.lifecycleEvents[0].action, "archive");

  const staleResponse = await POST(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "archive",
        expectedConfigVersion: canonical.configVersion,
        idempotencyKey: "78787878-7878-4878-8878-787878787878"
      })
    }),
    { params: Promise.resolve({ id: canonical.id }) }
  );
  const stalePayload = await staleResponse.json();
  assert.equal(staleResponse.status, 409);
  assert.equal(stalePayload.code, "config-version-conflict");
  assert.equal(stalePayload.current.status, "archived");

  const historicalResponse = await POST(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "archive",
        expectedConfigVersion: payload.record.configVersion,
        idempotencyKey: "90909090-9090-4090-8090-909090909090"
      })
    }),
    { params: Promise.resolve({ id: canonical.id }) }
  );
  const historicalPayload = await historicalResponse.json();
  assert.equal(historicalResponse.status, 404);
  assert.equal(historicalPayload.code, "not-found");
  assert.equal(fixture.lifecycleEvents.length, 1);
});

test("status handler maps stale lifecycle config_version to 409 without an audit event", async (t) => {
  const fixture = createQrSupabaseFixture();
  const canonical = await createCanonical(fixture, t);
  const row = fixture.rows.find((candidate) => candidate.id === canonical.id);
  row.config_version += 1;
  const { POST } = await loadQrStatusRoute();
  const response = await POST(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pause",
        expectedConfigVersion: canonical.configVersion,
        idempotencyKey: "12121212-1212-4212-8212-121212121212"
      })
    }),
    { params: Promise.resolve({ id: canonical.id }) }
  );

  assert.equal(response.status, 409);
  assert.equal(fixture.lifecycleEvents.length, 0);
});

for (const action of ["pause", "archive"]) {
  test(`${action} audit failure rolls back QR lifecycle state`, async (t) => {
    const fixture = createQrSupabaseFixture({
      lifecycleAuditError: { code: "XX000", message: "audit insert failed" }
    });
    const canonical = await createCanonical(fixture, t);
    const before = fixture.snapshotRows();
    const { POST } = await loadQrStatusRoute();
    const originalConsoleError = console.error;
    console.error = () => {};
    let response;
    try {
      response = await POST(
        new Request(
          `https://fixture.invalid/api/owner/qr-codes/${canonical.id}/status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              expectedConfigVersion: canonical.configVersion,
              idempotencyKey:
                action === "pause"
                  ? "34343434-3434-4434-8434-343434343434"
                  : "56565656-5656-4656-8656-565656565656"
            })
          }
        ),
        { params: Promise.resolve({ id: canonical.id }) }
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.status, 503);
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
  });
}

test("fixture install teardown restores prior QR environment and admin global", () => {
  const activeKey = process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION;
  const keyRing = process.env.VISTAIRE_QR_TOKEN_KEY_RING;
  const admin = globalThis.__OWNER_QR_TEST_ADMIN__;
  process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION = "prior-version";
  process.env.VISTAIRE_QR_TOKEN_KEY_RING = "prior-ring";
  globalThis.__OWNER_QR_TEST_ADMIN__ = { prior: true };
  const fixture = createQrSupabaseFixture();

  const dispose = fixture.install();
  dispose();

  assert.equal(process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION, "prior-version");
  assert.equal(process.env.VISTAIRE_QR_TOKEN_KEY_RING, "prior-ring");
  assert.deepEqual(globalThis.__OWNER_QR_TEST_ADMIN__, { prior: true });
  if (activeKey === undefined) delete process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION;
  else process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION = activeKey;
  if (keyRing === undefined) delete process.env.VISTAIRE_QR_TOKEN_KEY_RING;
  else process.env.VISTAIRE_QR_TOKEN_KEY_RING = keyRing;
  if (admin === undefined) delete globalThis.__OWNER_QR_TEST_ADMIN__;
  else globalThis.__OWNER_QR_TEST_ADMIN__ = admin;
});
