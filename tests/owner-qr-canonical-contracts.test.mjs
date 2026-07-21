import assert from "node:assert/strict";
import test from "node:test";
import {
  createQrSupabaseFixture,
  loadQrPatchRoute,
  loadQrPostRoute,
  loadQrRetargetRoute,
  loadQrRotateRoute,
  loadQrStore
} from "./helpers/owner-qr-test-runtime.mjs";

const slot = {
  restaurantId: "restaurant-fixture",
  targetKind: "admin",
  purposeKey: "default"
};

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

function candidate(ordinal, overrides = {}) {
  const suffix = String(ordinal).padStart(2, "0");
  return {
    id: `qr-candidate-${suffix}`,
    ...slot,
    label: "QR dashboard restaurant",
    targetPath: "/admin",
    tokenHash: `sha256:candidate-${suffix}`,
    tokenPreview: `cand${suffix}…`,
    tokenCiphertext: `ciphertext-${suffix}`,
    tokenNonce: `nonce-${suffix}`,
    tokenKeyVersion: "v1",
    redirectUrl: `/q/canonical-${suffix}`,
    style: structuredClone(style),
    ...overrides
  };
}

function assertSafeConflictRecord(record) {
  assert.ok(record);
  for (const secret of [
    "token",
    "tokenHash",
    "tokenPreview",
    "tokenCiphertext",
    "tokenNonce",
    "tokenKeyVersion",
    "redirectUrl"
  ]) {
    assert.equal(secret in record, false, secret);
  }
}

function seedHistory(fixture, ordinal, overrides = {}) {
  return fixture.seedQr({
    id: `qr-history-${ordinal}`,
    token: `historical-token-${ordinal}`,
    restaurant_id: slot.restaurantId,
    target_kind: slot.targetKind,
    target_path: "/admin",
    label: `Historique ${ordinal}`,
    style_json: { foregroundColor: `#11111${ordinal}` },
    status: "active",
    scan_count: ordinal,
    last_scanned_at: `2026-07-0${ordinal}T12:00:00.000Z`,
    created_at: `2026-06-0${ordinal}T12:00:00.000Z`,
    updated_at: `2026-06-1${ordinal}T12:00:00.000Z`,
    ...overrides
  });
}

function historyRows(fixture) {
  return fixture.snapshotRows().filter((row) => row.id.startsWith("qr-history-"));
}

test("[FIXTURE 1/9] an empty migrated slot stays empty until explicit get-or-create", async () => {
  const fixture = createQrSupabaseFixture();

  assert.equal(fixture.rows.filter((row) => row.is_canonical).length, 0);
  assert.equal(fixture.readCanonical(slot).record, null);
  assert.equal(fixture.rows.length, 0);

  const created = await fixture.getOrCreateCanonical(candidate(0));
  assert.equal(created.ok, true);
  assert.equal(created.created, true);
  assert.equal(created.resultStatus, "canonical");
  assert.equal(created.record.isCanonical, true);
  assert.equal(created.record.redirectUrl, "/q/canonical-00");
  assert.equal(fixture.rows.filter((row) => row.is_canonical).length, 1);
});

test("[FIXTURE 2/9] active historical rows remain byte-for-byte unchanged and noncanonical", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  seedHistory(fixture, 2);
  const before = historyRows(fixture);

  const result = await fixture.getOrCreateCanonical(candidate(0));

  assert.equal(result.ok, true);
  assert.deepEqual(historyRows(fixture), before);
  assert.equal(historyRows(fixture).every((row) => row.is_canonical === false), true);
  assert.equal(historyRows(fixture).every((row) => row.status === "active"), true);
});

test("[FIXTURE 3/9] GET and reload are read-only and generate no candidate", () => {
  const fixture = createQrSupabaseFixture();
  let generated = 0;
  const before = fixture.snapshotRows();

  const first = fixture.readCanonical(slot);
  const second = fixture.readCanonical(slot);

  assert.equal(first.record, null);
  assert.equal(second.record, null);
  assert.equal(generated, 0);
  assert.deepEqual(fixture.snapshotRows(), before);
  assert.deepEqual(
    fixture.calls.map((call) => call.method),
    ["canonical-read", "canonical-read"]
  );
  assert.equal(
    fixture.calls.some((call) =>
      ["insert", "update", "upsert", "rpc", "canonical-update"].includes(call.method)
    ),
    false
  );
});

test("[FIXTURE 4/9] first POST creates one recoverable canonical and preserves history", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  seedHistory(fixture, 2);
  const before = historyRows(fixture);

  const first = await fixture.getOrCreateCanonical(candidate(0));

  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.resultStatus, "canonical");
  assert.equal(first.record.id, "qr-candidate-00");
  assert.equal(first.record.redirectUrl, "/q/canonical-00");
  assert.equal("token" in first, false);
  assert.equal(fixture.rows.filter((row) => row.is_canonical).length, 1);
  assert.deepEqual(historyRows(fixture), before);
});

test("[FIXTURE 5/9] second POST returns the same id, fingerprint, and URL without insert", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await fixture.getOrCreateCanonical(candidate(0));
  const rowCount = fixture.rows.length;

  const second = await fixture.getOrCreateCanonical(candidate(1));

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(fixture.rows.length, rowCount);
  assert.equal(second.record.id, first.record.id);
  assert.equal(second.record.fingerprint, first.record.fingerprint);
  assert.equal(second.record.redirectUrl, first.record.redirectUrl);
  assert.equal("token" in second, false);
  assert.equal(
    fixture.rows.some((row) => row.id === "qr-candidate-01"),
    false
  );
});

test("[FIXTURE 6/9] twenty concurrent POSTs deterministically converge without persisting or logging losers", async () => {
  const fixture = createQrSupabaseFixture({
    canonicalConcurrencyParticipants: 20
  });
  const candidates = Array.from({ length: 20 }, (_, index) => candidate(index));

  const results = await Promise.all(
    candidates.map((item) => fixture.getOrCreateCanonical(item))
  );

  assert.equal(results.every((result) => result.ok), true);
  assert.deepEqual(
    [...new Set(results.map((result) => result.record.id))],
    ["qr-candidate-00"]
  );
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(fixture.rows.length, 1);
  assert.equal(fixture.rows[0].id, "qr-candidate-00");
  const serializedRows = JSON.stringify(fixture.rows);
  const serializedLogs = JSON.stringify(fixture.calls);
  for (const loser of candidates.slice(1)) {
    assert.doesNotMatch(serializedRows, new RegExp(loser.id));
    assert.doesNotMatch(serializedRows, new RegExp(loser.tokenHash));
    assert.doesNotMatch(serializedLogs, new RegExp(loser.id));
    assert.doesNotMatch(serializedLogs, new RegExp(loser.tokenHash));
    assert.doesNotMatch(serializedLogs, new RegExp(loser.redirectUrl));
  }
});

test("[FIXTURE 7/9] missing, empty, or blank canonical envelopes fail closed without mutation", async (t) => {
  for (const [name, envelope] of [
    ["missing", [null, null, null]],
    ["empty", ["", "", ""]],
    ["blank", ["   ", "   ", "   "]]
  ]) {
    await t.test(name, async () => {
  const fixture = createQrSupabaseFixture();
  fixture.seedQr({
        id: `qr-unrecoverable-${name}`,
        token: `unrecoverable-token-${name}`,
    restaurant_id: slot.restaurantId,
    target_kind: slot.targetKind,
    purpose_key: slot.purposeKey,
    target_path: "/admin",
        is_canonical: true,
        token_ciphertext: envelope[0],
        token_nonce: envelope[1],
        token_key_version: envelope[2]
  });
  const before = fixture.snapshotRows();

  const result = await fixture.getOrCreateCanonical(candidate(0));

  assert.equal(result.ok, true);
  assert.equal(result.created, false);
  assert.equal(result.resultStatus, "canonical-unrecoverable");
      assert.equal(result.record.id, `qr-unrecoverable-${name}`);
  assert.equal(result.record.redirectUrl, "");
  assert.equal("token" in result, false);
  assert.deepEqual(fixture.snapshotRows(), before);
    });
  }
});

test("[FIXTURE 8/9] style Save preserves canonical identity, vault material, URL, and history", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  seedHistory(fixture, 2);
  const historyBefore = historyRows(fixture);
  const created = await fixture.getOrCreateCanonical(candidate(0));
  const canonicalBefore = structuredClone(fixture.rows.find(
    (row) => row.id === created.record.id
  ));

  const saved = fixture.updateCanonicalStyle(created.record.id, {
    ...style,
    foregroundColor: "#222222"
  });
  const canonicalAfter = fixture.rows.find((row) => row.id === created.record.id);

  assert.equal(saved.ok, true);
  assert.equal(saved.record.id, created.record.id);
  assert.equal(saved.record.redirectUrl, created.record.redirectUrl);
  for (const field of [
    "id",
    "token_hash",
    "token_ciphertext",
    "token_nonce",
    "token_key_version",
    "status",
    "scan_count",
    "last_scanned_at",
    "target_kind",
    "target_path",
    "created_at"
  ]) {
    assert.deepEqual(canonicalAfter[field], canonicalBefore[field], field);
  }
  assert.equal(canonicalAfter.style_json.foregroundColor, "#222222");
  assert.deepEqual(historyRows(fixture), historyBefore);
});

test("[FIXTURE 9/9] confirmed rotation alone replaces the canonical and leaves the old QR active and resolvable", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  const historyBefore = historyRows(fixture);
  const created = await fixture.getOrCreateCanonical(candidate(0));
  const oldBefore = structuredClone(fixture.rows.find(
    (row) => row.id === created.record.id
  ));
  const beforeRejectedRotation = fixture.snapshotRows();

  const rejected = await fixture.rotateCanonical(
    created.record.id,
    candidate(1),
    false
  );
  assert.equal(rejected.ok, false);
  assert.deepEqual(fixture.snapshotRows(), beforeRejectedRotation);

  const invalid = await fixture.rotateCanonical(
    created.record.id,
    candidate(1, { tokenCiphertext: "   " }),
    true
  );
  assert.equal(invalid.ok, false);
  assert.deepEqual(fixture.snapshotRows(), beforeRejectedRotation);

  const rotated = await fixture.rotateCanonical(
    created.record.id,
    candidate(1),
    true
  );
  const oldAfter = fixture.rows.find((row) => row.id === created.record.id);

  assert.equal(rotated.ok, true);
  assert.equal(rotated.created, true);
  assert.equal(rotated.record.id, "qr-candidate-01");
  assert.equal(rotated.record.redirectUrl, "/q/canonical-01");
  assert.equal(oldAfter.is_canonical, false);
  assert.equal(oldAfter.status, "active");
  for (const [field, value] of Object.entries(oldBefore)) {
    if (field === "is_canonical") continue;
    assert.deepEqual(oldAfter[field], value, field);
  }
  assert.deepEqual(historyRows(fixture), historyBefore);
  assert.deepEqual(
    fixture.rows.filter((row) => row.is_canonical).map((row) => row.id),
    ["qr-candidate-01"]
  );

  const resolved = await fixture.client.rpc("resolve_qr_code_scan", {
    p_token_hash: oldBefore.token_hash
  });
  assert.equal(resolved.error, null);
  assert.equal(resolved.data, "/admin");
});

const consumerArgs = {
  restaurantId: slot.restaurantId,
  label: "QR dashboard restaurant",
  targetKind: slot.targetKind,
  style
};

async function createThroughCurrentStore(fixture, overrides = {}) {
  fixture.install();
  const { createOwnerQrCode } = await loadQrStore();
  return createOwnerQrCode({ ...consumerArgs, ...overrides });
}

test("[CONSUMER] repeated store POST returns the same id and URL with no raw token field", async () => {
  const fixture = createQrSupabaseFixture();
  const first = await createThroughCurrentStore(fixture);
  const second = await createThroughCurrentStore(fixture);

  assert.equal(second.record.id, first.record.id);
  assert.equal(second.record.redirectUrl, first.record.redirectUrl);
  assert.equal("token" in second, false);
});

test("[CONSUMER] GET reload is implemented and performs no Supabase mutation", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const route = await loadQrPostRoute();
  assert.equal(typeof route.GET, "function");
  const before = fixture.snapshotRows();
  const response = await route.GET(
    new Request(
      "https://fixture.invalid/api/owner/qr-codes?restaurantId=restaurant-fixture&targetKind=admin&purposeKey=default"
    )
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(fixture.snapshotRows(), before);
  assert.equal(
    fixture.calls.some((call) =>
      ["insert", "update", "upsert", "canonical-update"].includes(call.method)
    ),
    false
  );
});

test("[CONSUMER] POST reports an unrecoverable canonical without mutation", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.seedQr({
    id: "qr-consumer-unrecoverable",
    token: "consumer-unrecoverable",
    restaurant_id: slot.restaurantId,
    target_kind: slot.targetKind,
    purpose_key: slot.purposeKey,
    target_path: "/admin",
    is_canonical: true
  });
  fixture.install();
  const before = fixture.snapshotRows();
  const { POST } = await loadQrPostRoute();
  const response = await POST(
    new Request("https://fixture.invalid/api/owner/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consumerArgs)
    })
  );
  const payload = await response.json();

  assert.equal(payload.code, "canonical-unrecoverable");
  assert.equal("token" in payload, false);
  assert.deepEqual(fixture.snapshotRows(), before);
});

test("POST rejects a whitespace restaurant id as invalid input", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { POST } = await loadQrPostRoute();
  const response = await POST(
    new Request("https://fixture.invalid/api/owner/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...consumerArgs, restaurantId: "   " })
    })
  );

  assert.equal(response.status, 400);
  assert.equal(fixture.rows.length, 0);
  assert.equal(fixture.rpcCallCount("owner_get_or_create_canonical_qr"), 0);
});

test("GET reports missing vault configuration without mutating the canonical", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  const before = fixture.snapshotRows();
  delete process.env.VISTAIRE_QR_TOKEN_ACTIVE_KEY_VERSION;
  delete process.env.VISTAIRE_QR_TOKEN_KEY_RING;

  const route = await loadQrPostRoute();
  const response = await route.GET(
    new Request(
      "https://fixture.invalid/api/owner/qr-codes?restaurantId=restaurant-fixture&targetKind=admin&purposeKey=default"
    )
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "QR_CANONICAL_READ_FAILED");
  assert.deepEqual(fixture.snapshotRows(), before);
});

test("a non-empty tampered ciphertext fails authentication and POST stays closed", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  const row = fixture.rows.find((candidateRow) => candidateRow.id === created.record.id);
  assert.ok(row);
  const originalCiphertext = row.token_ciphertext;
  const finalCharacter = originalCiphertext.at(-1);
  row.token_ciphertext = `${originalCiphertext.slice(0, -1)}${
    finalCharacter === "A" ? "B" : "A"
  }`;
  const before = fixture.snapshotRows();

  const { POST } = await loadQrPostRoute();
  const response = await POST(
    new Request("https://fixture.invalid/api/owner/qr-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consumerArgs)
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, "canonical-unrecoverable");
  assert.equal("token" in payload, false);
  assert.deepEqual(fixture.snapshotRows(), before);
});

test("[CONSUMER] PATCH style preserves the recovered URL and canonical vault fields", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  seedHistory(fixture, 2);
  const historyBefore = historyRows(fixture);
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  const before = structuredClone(
    fixture.rows.find((row) => row.id === created.record.id)
  );
  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${created.record.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: { ...style, foregroundColor: "#333333" },
          expectedConfigVersion: created.record.configVersion
        })
      }
    ),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();
  const after = fixture.rows.find((row) => row.id === created.record.id);

  assert.equal(response.status, 200);
  assert.equal(payload.record.id, created.record.id);
  assert.equal(payload.record.redirectUrl, created.record.redirectUrl);
  assert.equal("token" in payload, false);
  for (const [field, value] of Object.entries(before)) {
    if (field === "style_json" || field === "updated_at" || field === "config_version") continue;
    assert.deepEqual(after[field], value, field);
  }
  assert.equal(after.style_json.foregroundColor, "#333333");
  assert.deepEqual(historyRows(fixture), historyBefore);
});

test("[CONSUMER] rotate route requires confirmation and preserves the old active QR", async () => {
  const fixture = createQrSupabaseFixture();
  seedHistory(fixture, 1);
  seedHistory(fixture, 2);
  const historyBefore = historyRows(fixture);
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  const before = fixture.snapshotRows();
  const oldBefore = structuredClone(
    fixture.rows.find((row) => row.id === created.record.id)
  );
  const { POST } = await loadQrRotateRoute();
  const url =
    `https://fixture.invalid/api/owner/qr-codes/${created.record.id}/rotate`;

  const rejected = await POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: false })
    }),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  assert.notEqual(rejected.status, 200);
  assert.deepEqual(fixture.snapshotRows(), before);

  const confirmed = await POST(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        previousDisposition: "keep-active",
        expectedConfigVersion: created.record.configVersion
      })
    }),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await confirmed.json();
  const old = fixture.rows.find((row) => row.id === created.record.id);

  assert.equal(confirmed.status, 201);
  assert.notEqual(payload.current.id, created.record.id);
  assert.equal(old.is_canonical, false);
  for (const [field, value] of Object.entries(oldBefore)) {
    if (field === "is_canonical") continue;
    assert.deepEqual(old[field], value, field);
  }
  assert.deepEqual(historyRows(fixture), historyBefore);
  assert.equal(fixture.rows.length, before.length + 1);
  assert.equal(fixture.rows.filter((row) => row.is_canonical).length, 1);
  const resolved = await fixture.client.rpc("resolve_qr_code_scan", {
    p_token_hash: oldBefore.token_hash
  });
  assert.equal(resolved.error, null);
  assert.equal(resolved.data, oldBefore.target_path);
  assert.equal("token" in payload, false);
});

test("[CONSUMER] twenty real POST handlers converge on the database canonical", async () => {
  const fixture = createQrSupabaseFixture({
    canonicalConcurrencyParticipants: 20
  });
  fixture.install();
  const { POST } = await loadQrPostRoute();
  const loggedErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    loggedErrors.push(args);
  };

  let responses;
  try {
    responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        POST(
          new Request("https://fixture.invalid/api/owner/qr-codes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(consumerArgs)
          })
        )
      )
    );
  } finally {
    console.error = originalConsoleError;
  }
  const payloads = await Promise.all(responses.map((response) => response.json()));

  assert.deepEqual(
    [...new Set(payloads.map((payload) => payload.record.id))].length,
    1
  );
  assert.equal(payloads.every((payload) => !("token" in payload)), true);
  assert.equal(fixture.rows.filter((row) => row.is_canonical).length, 1);
  assert.deepEqual(loggedErrors, [], "successful losers must not log candidate secrets");
});

test("rotation response and new canonical use the style reread under the database lock", async () => {
  const fixture = createQrSupabaseFixture({
    beforeCanonicalRotation(row) {
      row.label = "Label concurrent";
      row.style_json = {
        ...row.style_json,
        foregroundColor: "#333333"
      };
      row.updated_at = "2026-07-17T12:00:02.000Z";
    }
  });
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  fixture.install();
  const { rotateOwnerQrCode } = await loadQrStore();

  const rotated = await rotateOwnerQrCode(created.record.id, {
    confirmed: true,
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    previousDisposition: "keep-active",
    expectedConfigVersion: created.record.configVersion
  });

  assert.equal(rotated.ok, true);
  assert.equal(rotated.previous.label, "Label concurrent");
  assert.equal(rotated.previous.style.foregroundColor, "#333333");
  assert.equal(rotated.current.label, "Label concurrent");
  assert.equal(rotated.current.style.foregroundColor, "#333333");
});

test("PATCH and rotation expose an absent canonical as 404, not a dependency outage", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { PATCH } = await loadQrPatchRoute();
  const { POST: rotate } = await loadQrRotateRoute();

  const patchResponse = await PATCH(
    new Request("https://fixture.invalid/api/owner/qr-codes/missing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ style, expectedConfigVersion: 1 })
    }),
    { params: Promise.resolve({ id: "missing" }) }
  );
  const rotateResponse = await rotate(
    new Request("https://fixture.invalid/api/owner/qr-codes/missing/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed: true,
        idempotencyKey: "33333333-3333-4333-8333-333333333333",
        previousDisposition: "keep-active",
        expectedConfigVersion: 1
      })
    }),
    { params: Promise.resolve({ id: "missing" }) }
  );

  assert.equal(patchResponse.status, 404);
  assert.equal(rotateResponse.status, 404);
});

test("POST rejects every client targetPath without creating a row", async () => {
  const fixture = createQrSupabaseFixture();
  fixture.install();
  const { POST } = await loadQrPostRoute();
  for (const targetPath of ["/admin", "/menu/forged", "https://evil.invalid/"]) {
    const response = await POST(
      new Request("https://fixture.invalid/api/owner/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...consumerArgs, targetPath })
      })
    );
    assert.equal(response.status, 400);
  }
  assert.equal(fixture.rows.length, 0);
  assert.equal(fixture.rpcCallCount("owner_get_or_create_canonical_qr"), 0);
});

test("rotation refuses an integrity-invalid canonical before calling the RPC", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughCurrentStore(fixture);
  assert.equal(created.ok, true);
  const row = fixture.rows.find((candidateRow) => candidateRow.id === created.record.id);
  row.token_hash = `sha256:${"0".repeat(64)}`;
  fixture.install();
  const { rotateOwnerQrCode } = await loadQrStore();

  const rotated = await rotateOwnerQrCode(created.record.id, {
    confirmed: true,
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
    previousDisposition: "keep-active",
    expectedConfigVersion: created.record.configVersion
  });

  assert.equal(rotated.ok, false);
  assert.equal(rotated.code, "canonical-unrecoverable");
  assert.equal(fixture.rpcCallCount("owner_rotate_canonical_qr"), 0);
});

test("QR resolution fails closed when the metadata RPC is unavailable", async () => {
  const fixture = createQrSupabaseFixture({ metadataUnavailable: true });
  const token = "A".repeat(32);
  fixture.seedQr({ token, target_kind: "admin", target_path: "/admin" });
  fixture.install();
  const { resolveQrToken } = await loadQrStore();

  const resolved = await resolveQrToken(token);

  assert.deepEqual(resolved, { ok: false });
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan_metadata"), 1);
  assert.equal(fixture.rpcCallCount("resolve_qr_code_scan"), 0);
  assert.equal(
    fixture.calls.some((call) => call.method === "from" && call.table === "qr_codes"),
    false
  );
});

test("retarget after a restaurant slug rename preserves QR identity and opaque URL", async () => {
  const fixtureOptions = { restaurantSlug: "ancien-slug" };
  const fixture = createQrSupabaseFixture(fixtureOptions);
  fixture.install();
  const { getOrCreateOwnerQrCode, retargetOwnerQrCode } = await loadQrStore();
  const created = await getOrCreateOwnerQrCode({
    restaurantId: slot.restaurantId,
    label: "QR menu",
    targetKind: "menu",
    purposeKey: "default",
    style
  });
  assert.equal(created.ok, true);
  const before = structuredClone(
    fixture.rows.find((row) => row.id === created.record.id)
  );
  fixtureOptions.restaurantSlug = "nouveau-slug";

  const retargeted = await retargetOwnerQrCode(created.record.id, {
    expectedConfigVersion: created.record.configVersion
  });
  const after = fixture.rows.find((row) => row.id === created.record.id);

  assert.equal(retargeted.ok, true);
  assert.equal(retargeted.changed, true);
  assert.equal(retargeted.record.redirectUrl, created.record.redirectUrl);
  assert.equal(after.target_path, "/menu/nouveau-slug");
  assert.equal(after.config_version, before.config_version + 1);
  for (const field of [
    "id",
    "token_hash",
    "token_preview",
    "token_ciphertext",
    "token_nonce",
    "token_key_version"
  ]) {
    assert.equal(after[field], before[field], field);
  }
});

test("PATCH two-tab CAS conflict returns current safe metadata without overwriting", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughCurrentStore(fixture);
  const row = fixture.rows.find((candidateRow) => candidateRow.id === created.record.id);
  row.config_version += 1;
  row.label = "Label onglet concurrent";
  const styleBefore = structuredClone(row.style_json);
  fixture.install();
  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style: { ...style, foregroundColor: "#999999" },
        expectedConfigVersion: created.record.configVersion
      })
    }),
    { params: Promise.resolve({ id: row.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, "config-version-conflict");
  assert.equal(payload.current.label, "Label onglet concurrent");
  assert.equal(payload.current.configVersion, row.config_version);
  assertSafeConflictRecord(payload.current);
  assert.deepEqual(row.style_json, styleBefore);
});

test("PATCH update-race conflict rereads safe current metadata and does not overwrite", async () => {
  const fixture = createQrSupabaseFixture({
    beforeQrUpdate(rows) {
      const row = rows.find((candidateRow) => candidateRow.is_canonical);
      row.config_version += 1;
      row.label = "Label gagne pendant update";
    }
  });
  const created = await createThroughCurrentStore(fixture);
  fixture.install();
  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${created.record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Label perdant",
        expectedConfigVersion: created.record.configVersion
      })
    }),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();
  const row = fixture.rows.find((candidateRow) => candidateRow.id === created.record.id);

  assert.equal(response.status, 409);
  assert.equal(payload.current.label, "Label gagne pendant update");
  assertSafeConflictRecord(payload.current);
  assert.equal(row.label, "Label gagne pendant update");
});

test("PATCH explicit config-version conflict rereads safe current metadata", async () => {
  const fixture = createQrSupabaseFixture({
    qrUpdateError: {
      code: "40001",
      message: "config_version_conflict"
    }
  });
  const created = await createThroughCurrentStore(fixture);
  fixture.install();
  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${created.record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Label perdant",
        expectedConfigVersion: created.record.configVersion
      })
    }),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, "config-version-conflict");
  assertSafeConflictRecord(payload.current);
});

test("PATCH does not emit an incomplete 409 when safe conflict reread fails", async () => {
  const fixture = createQrSupabaseFixture({
    qrUpdateError: {
      code: "40001",
      message: "config_version_conflict"
    },
    safeInventoryReadError: {
      code: "42703",
      message: "inventory contract unavailable"
    }
  });
  const created = await createThroughCurrentStore(fixture);
  fixture.install();
  const { PATCH } = await loadQrPatchRoute();
  const response = await PATCH(
    new Request(`https://fixture.invalid/api/owner/qr-codes/${created.record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: "Label perdant",
        expectedConfigVersion: created.record.configVersion
      })
    }),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "QR_UPDATE_FAILED");
  assert.equal("current" in payload, false);
});

test("retarget HTTP stale CAS returns the same safe current contract", async () => {
  const fixtureOptions = { restaurantSlug: "slug-a" };
  const fixture = createQrSupabaseFixture(fixtureOptions);
  fixture.install();
  const { getOrCreateOwnerQrCode } = await loadQrStore();
  const created = await getOrCreateOwnerQrCode({
    restaurantId: slot.restaurantId,
    label: "QR menu",
    targetKind: "menu",
    purposeKey: "default",
    style
  });
  const row = fixture.rows.find((candidateRow) => candidateRow.id === created.record.id);
  row.config_version += 1;
  fixtureOptions.restaurantSlug = "slug-b";

  const { POST } = await loadQrRetargetRoute();
  const response = await POST(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${row.id}/retarget`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedConfigVersion: created.record.configVersion
        })
      }
    ),
    { params: Promise.resolve({ id: row.id }) }
  );
  const result = await response.json();

  assert.equal(response.status, 409);
  assert.equal(result.code, "config-version-conflict");
  assertSafeConflictRecord(result.current);
  assert.equal(row.target_path, "/menu/slug-a");
});

test("retarget HTTP explicit DB conflict returns current safe metadata", async () => {
  const fixtureOptions = {
    restaurantSlug: "slug-a",
    qrUpdateError: {
      code: "40001",
      message: "config_version_conflict"
    }
  };
  const fixture = createQrSupabaseFixture(fixtureOptions);
  const created = await createThroughCurrentStore(fixture, {
    targetKind: "menu"
  });
  fixtureOptions.restaurantSlug = "slug-b";
  fixture.install();
  const { POST } = await loadQrRetargetRoute();
  const response = await POST(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${created.record.id}/retarget`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedConfigVersion: created.record.configVersion
        })
      }
    ),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, "config-version-conflict");
  assertSafeConflictRecord(payload.current);
});

test("retarget HTTP does not emit incomplete 409 when safe reread fails", async () => {
  const fixtureOptions = {
    restaurantSlug: "slug-a",
    qrUpdateError: {
      code: "40001",
      message: "config_version_conflict"
    },
    safeInventoryReadError: {
      code: "42703",
      message: "inventory contract unavailable"
    }
  };
  const fixture = createQrSupabaseFixture(fixtureOptions);
  const created = await createThroughCurrentStore(fixture, {
    targetKind: "menu"
  });
  fixtureOptions.restaurantSlug = "slug-b";
  fixture.install();
  const { POST } = await loadQrRetargetRoute();
  const response = await POST(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${created.record.id}/retarget`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedConfigVersion: created.record.configVersion
        })
      }
    ),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.code, "QR_UPDATE_FAILED");
  assert.equal("current" in payload, false);
});

test("rotate rejects the deprecated disposition field without an RPC call", async () => {
  const fixture = createQrSupabaseFixture();
  const created = await createThroughCurrentStore(fixture);
  fixture.install();
  const { POST } = await loadQrRotateRoute();
  const response = await POST(
    new Request(
      `https://fixture.invalid/api/owner/qr-codes/${created.record.id}/rotate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          idempotencyKey: "55555555-5555-4555-8555-555555555555",
          disposition: "keep-active",
          expectedConfigVersion: created.record.configVersion
        })
      }
    ),
    { params: Promise.resolve({ id: created.record.id }) }
  );
  assert.equal(response.status, 400);
  assert.equal(fixture.rpcCallCount("owner_rotate_canonical_qr"), 0);
});
