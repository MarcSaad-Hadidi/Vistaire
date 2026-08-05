import assert from "node:assert/strict";
import test from "node:test";
import {
  createQrSupabaseFixture,
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

async function createMenuCanonical(fixture, context, status = "active") {
  context.after(fixture.install());
  if (status === "paused") {
    fixture.seedQr({
      id: "menu-paused-legacy",
      token: "M".repeat(32),
      restaurant_id: restaurantId,
      target_kind: "menu",
      purpose_key: "default",
      target_path: "/menu/restaurant-fixture",
      status,
      is_canonical: true,
      token_ciphertext: "cipher-menu",
      token_nonce: "nonce-menu",
      token_key_version: "test-v1",
      style_json: style
    });
    const { getOwnerCanonicalQrCode } = await loadQrStore();
    const read = await getOwnerCanonicalQrCode({
      restaurantId,
      targetKind: "menu",
      purposeKey: "default"
    });
    assert.equal(read.found, true);
    return read.record;
  }

  const { getOrCreateOwnerQrCode } = await loadQrStore();
  const created = await getOrCreateOwnerQrCode({
    restaurantId,
    targetKind: "menu",
    purposeKey: "default",
    style
  });
  assert.equal(created.ok, true);
  return created.record;
}

function rotationCandidate({ id, disposition, expectedConfigVersion }) {
  return {
    id,
    restaurantId,
    targetKind: "menu",
    purposeKey: "default",
    targetPath: "/menu/restaurant-fixture",
    tokenHash: `${id}-hash`,
    tokenPreview: "menu-new",
    tokenCiphertext: "cipher-new",
    tokenNonce: "nonce-new",
    tokenKeyVersion: "test-v1",
    style,
    previousDisposition: disposition,
    expectedConfigVersion,
    idempotencyKey: `${id.slice(0, 8)}-0000-4000-8000-000000000001`
  };
}

test("public menu rotation rejects pause and revoke before any server mutation", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createMenuCanonical(fixture, t);
  const { rotateOwnerQrCode } = await loadQrStore();

  for (const [index, disposition] of ["pause", "revoke"].entries()) {
    const before = fixture.snapshotRows();
    const result = await rotateOwnerQrCode(previous.id, {
      confirmed: true,
      idempotencyKey: `11111111-1111-4111-8111-00000000000${index + 1}`,
      previousDisposition: disposition,
      expectedConfigVersion: previous.configVersion
    });

    assert.deepEqual(result, {
      ok: false,
      code: "public-qr-permanent",
      error: "Les QR publics existants doivent rester actifs."
    });
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
    assert.equal(fixture.rpcCallCount("owner_rotate_canonical_qr"), 0);
  }
});

test("direct rotation API maps the permanence refusal to HTTP 409", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createMenuCanonical(fixture, t);
  const { POST } = await loadQrRotateRoute();

  for (const [index, disposition] of ["pause", "revoke"].entries()) {
    const before = fixture.snapshotRows();
    const response = await POST(
      new Request(`https://fixture.invalid/api/owner/qr-codes/${previous.id}/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          idempotencyKey: `12121212-1212-4121-8121-00000000000${index + 1}`,
          previousDisposition: disposition,
          expectedConfigVersion: previous.configVersion
        })
      }),
      { params: Promise.resolve({ id: previous.id }) }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.code, "public-qr-permanent");
    assert.equal(payload.error, "Les QR publics existants doivent rester actifs.");
    assert.deepEqual(fixture.snapshotRows(), before);
  }
});

test("public menu lifecycle rejects pause, archive, and revoke without an event", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createMenuCanonical(fixture, t);
  const { POST } = await loadQrStatusRoute();

  for (const [index, action] of ["pause", "archive", "revoke"].entries()) {
    const before = fixture.snapshotRows();
    const response = await POST(
      new Request(`https://fixture.invalid/api/owner/qr-codes/${previous.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          expectedConfigVersion: previous.configVersion,
          idempotencyKey: `22222222-2222-4222-8222-00000000000${index + 1}`
        })
      }),
      { params: Promise.resolve({ id: previous.id }) }
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.equal(payload.code, "public-qr-permanent");
    assert.equal(payload.error, "Un QR public ne peut pas être désactivé.");
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
  }
});

test("direct RPC calls enforce public permanence while allowing keep-active and historical resume", async (t) => {
  const fixture = createQrSupabaseFixture();
  const previous = await createMenuCanonical(fixture, t);
  const before = fixture.snapshotRows();

  for (const [index, disposition] of ["pause", "revoke"].entries()) {
    const result = await fixture.rotateCanonical(
      previous.id,
      rotationCandidate({
        id: `menu-direct-${index}`,
        disposition,
        expectedConfigVersion: previous.configVersion
      }),
      true
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, "P0001");
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
  }

  const kept = await fixture.rotateCanonical(
    previous.id,
    rotationCandidate({
      id: "menu-direct-keep",
      disposition: "keep-active",
      expectedConfigVersion: previous.configVersion
    }),
    true
  );
  assert.equal(kept.ok, true);
  assert.equal(kept.record.status, "active");
  assert.equal(fixture.rows.find((row) => row.id === previous.id).status, "active");

  const pausedFixture = createQrSupabaseFixture();
  const paused = await createMenuCanonical(pausedFixture, t, "paused");
  const resumed = await pausedFixture.client.rpc("owner_set_canonical_qr_lifecycle", {
    p_qr_code_id: paused.id,
    p_restaurant_id: restaurantId,
    p_action: "resume",
    p_expected_config_version: paused.configVersion,
    p_operation_id: "33333333-3333-4333-8333-333333333333"
  });
  assert.equal(resumed.error, null);
  assert.equal(resumed.data[0].status, "active");
});

test("direct lifecycle RPC calls reject menu destructive actions without mutation", async (t) => {
  for (const [index, action] of ["pause", "revoke"].entries()) {
    const fixture = createQrSupabaseFixture();
    const previous = await createMenuCanonical(fixture, t);
    const before = fixture.snapshotRows();
    const response = await fixture.client.rpc("owner_set_canonical_qr_lifecycle", {
      p_qr_code_id: previous.id,
      p_restaurant_id: restaurantId,
      p_action: action,
      p_expected_config_version: previous.configVersion,
      p_operation_id: `44444444-4444-4444-8444-00000000000${index + 1}`
    });
    assert.equal(response.error.code, "P0001");
    assert.equal(response.error.message, "public_qr_permanent");
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
  }

  for (const [index, disposition] of ["archive", "revoke"].entries()) {
    const fixture = createQrSupabaseFixture();
    const previous = await createMenuCanonical(fixture, t);
    const before = fixture.snapshotRows();
    const response = await fixture.client.rpc("owner_clear_canonical_qr", {
      p_qr_code_id: previous.id,
      p_restaurant_id: restaurantId,
      p_disposition: disposition,
      p_expected_config_version: previous.configVersion,
      p_operation_id: `55555555-5555-4555-8555-00000000000${index + 1}`
    });
    assert.equal(response.error.code, "P0001");
    assert.equal(response.error.message, "public_qr_permanent");
    assert.deepEqual(fixture.snapshotRows(), before);
    assert.equal(fixture.lifecycleEvents.length, 0);
  }
});
