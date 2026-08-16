import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

async function loadBackfillModule() {
  try {
    return await import("../lib/owner/mediaBackfill.ts");
  } catch (error) {
    assert.fail(`media backfill module must load: ${error instanceof Error ? error.message : error}`);
  }
}

const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceSha = sha("source");
const outputSha = sha("output");
const restaurantId = "11111111-2222-4333-8444-555555555555";
const dishId = "22222222-3333-4444-8555-666666666666";

function validDerivative(overrides = {}) {
  return {
    schemaVersion: 2,
    recipeId: "dish-photo-v2",
    variant: "card",
    storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/card-${outputSha}.webp`,
    sha256: outputSha,
    outputSha256: outputSha,
    contentType: "image/webp",
    format: "webp",
    width: 640,
    height: 400,
    bytes: 6,
    sourceSha256: sourceSha,
    generatedAt: "2026-08-15T12:00:00.000Z",
    encoder: "sharp-webp",
    ...overrides
  };
}

test("checkpoint identity binds row, source, recipe, variants and every output hash", async () => {
  const {
    buildCheckpointEnvelope,
    buildCheckpointRecordKey,
    checkpointEntryMatches
  } = await loadBackfillModule();
  const input = {
    dishId,
    restaurantId,
    sourcePath: `restaurants/${restaurantId}/photos/originals/${sourceSha}.png`,
    sourceSha256: sourceSha,
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    expectedVariants: ["thumbnail", "card", "display"],
    outputs: {
      thumbnail: sha("thumb"),
      card: outputSha,
      display: sha("display")
    },
    validatedAt: "2026-08-15T12:00:00.000Z"
  };
  const envelope = buildCheckpointEnvelope(input);
  assert.equal(checkpointEntryMatches(envelope, input), true);
  const recordKey = buildCheckpointRecordKey(input);

  for (const mutation of [
    { dishId: "33333333-3333-4333-8333-333333333333" },
    { sourcePath: `${input.sourcePath}.other` },
    { sourceSha256: sha("other-source") },
    { recipeId: "dish-photo-v3" },
    { schemaVersion: 3 },
    { expectedVariants: ["card"] },
    { outputs: { ...input.outputs, card: sha("other-output") } }
  ]) {
    assert.equal(checkpointEntryMatches(envelope, { ...input, ...mutation }), false);
  }
  for (const mutation of [
    { dishId: "33333333-3333-4333-8333-333333333333" },
    { restaurantId: "44444444-4444-4444-8444-444444444444" },
    { sourcePath: `${input.sourcePath}.other` },
    { sourceSha256: sha("other-source") },
    { recipeId: "dish-photo-v3" },
    { schemaVersion: 3 }
  ]) {
    assert.notEqual(buildCheckpointRecordKey({ ...input, ...mutation }), recordKey);
  }
});

test("measure report is versioned, deterministic and uses authoritative global quota", async () => {
  const { buildMeasureReport, deterministicSourceSetDigest } = await loadBackfillModule();
  const rows = [
    { dishId: "b", restaurantId, sourcePath: "p2", sourceSha256: sha("2") },
    { dishId: "a", restaurantId, sourcePath: "p1", sourceSha256: sha("1") }
  ];
  const digest = deterministicSourceSetDigest(rows);
  assert.equal(digest, deterministicSourceSetDigest([...rows].reverse()));

  const report = buildMeasureReport({
    projectRef: "project-a",
    target: "non-production",
    generatedAt: "2026-08-15T12:00:00.000Z",
    usageMeasuredAt: "2026-08-15T11:55:00.000Z",
    codeVersion: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: digest,
    rowCount: 2,
    sourceCount: 2,
    currentGlobalBytes: 500,
    existingSourceBytes: 100,
    existingDerivativeBytes: 200,
    measuredDerivativeBytes: 120,
    uniqueAdditionalBytes: 100,
    authoritativeQuotaBytes: 1_000,
    errors: []
  });
  assert.equal(report.reportSchemaVersion, 1);
  assert.equal(report.reportVersion, 1);
  assert.equal(report.gitHead, "abc123");
  assert.equal(report.rows, 2);
  assert.equal(report.sources, 2);
  assert.equal(report.existingStorageBytes, 500);
  assert.equal(report.additionalBytes, 100);
  assert.equal(report.usageMeasuredAt, "2026-08-15T11:55:00.000Z");
  assert.equal(report.capacity.headroomBeforeBytes, 500);
  assert.equal(report.capacity.headroomAfterBytes, 400);
  assert.equal(report.capacity.headroomAfterPercent, 40);
  assert.deepEqual(report.headroomBefore, { bytes: 500, percent: 50 });
  assert.deepEqual(report.headroomAfter, { bytes: 400, percent: 40 });
  assert.equal(report.headroomPercent, 40);
  assert.deepEqual(report.capacityGate, {
    status: "pass",
    minimumHeadroomPercent: 20,
    reasons: []
  });
  assert.equal(report.status, "pass");
});

test("apply gate rejects stale, mismatched, low-headroom or non-opted-in reports", async () => {
  const { buildMeasureReport, validateApplyMeasureReport } = await loadBackfillModule();
  const base = buildMeasureReport({
    projectRef: "project-a",
    target: "production",
    generatedAt: "2026-08-15T12:00:00.000Z",
    usageMeasuredAt: "2026-08-15T11:55:00.000Z",
    codeVersion: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: sha("set"),
    rowCount: 2,
    sourceCount: 2,
    currentGlobalBytes: 500,
    existingSourceBytes: 100,
    existingDerivativeBytes: 200,
    measuredDerivativeBytes: 100,
    uniqueAdditionalBytes: 100,
    authoritativeQuotaBytes: 1_000,
    errors: []
  });
  const context = {
    now: new Date("2026-08-15T12:10:00.000Z"),
    projectRef: "project-a",
    usageMeasuredAt: "2026-08-15T11:55:00.000Z",
    codeVersion: "abc123",
    compatibleCommit: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: sha("set"),
    productionOptIn: true,
    mediaWritesEnabled: true
  };
  assert.equal(validateApplyMeasureReport(base, context).ok, true);
  assert.equal(validateApplyMeasureReport({ ...base, generatedAt: "2026-08-15T11:44:59.000Z" }, context).ok, false);
  assert.ok(
    validateApplyMeasureReport(
      { ...base, usageMeasuredAt: "2026-08-15T11:54:59.000Z" },
      context
    ).reasons?.includes("stale-capacity-usage-measurement")
  );
  assert.deepEqual(
    validateApplyMeasureReport(base, {
      ...context,
      usageMeasuredAt: "2026-08-15T11:56:00.000Z"
    }),
    { ok: false, reasons: ["capacity-usage-measurement-mismatch"] }
  );
  assert.ok(
    validateApplyMeasureReport(
      { ...base, usageMeasuredAt: "2026-08-15T12:10:00.001Z" },
      context
    ).reasons?.includes("stale-capacity-usage-measurement")
  );
  assert.equal(validateApplyMeasureReport({ ...base, projectRef: "other" }, context).ok, false);
  assert.equal(validateApplyMeasureReport({
    ...base,
    headroomAfterBytes: 199,
    headroomAfterPercent: 19.9,
    capacity: { ...base.capacity, headroomAfterBytes: 199, headroomAfterPercent: 19.9 }
  }, context).ok, false);
  assert.equal(validateApplyMeasureReport(base, { ...context, productionOptIn: false }).ok, false);
  assert.equal(validateApplyMeasureReport(base, { ...context, mediaWritesEnabled: false }).ok, false);
});

test("apply gate requires a finite, complete and internally consistent measure report", async () => {
  const { buildMeasureReport, validateApplyMeasureReport } = await loadBackfillModule();
  const base = buildMeasureReport({
    projectRef: "project-a",
    target: "production",
    generatedAt: "2026-08-15T12:00:00.000Z",
    usageMeasuredAt: "2026-08-15T11:55:00.000Z",
    codeVersion: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: sha("set"),
    rowCount: 2,
    sourceCount: 2,
    currentGlobalBytes: 500,
    existingSourceBytes: 100,
    existingDerivativeBytes: 200,
    measuredDerivativeBytes: 100,
    uniqueAdditionalBytes: 100,
    authoritativeQuotaBytes: 1_000,
    errors: []
  });
  const context = {
    now: new Date("2026-08-15T12:10:00.000Z"),
    projectRef: "project-a",
    usageMeasuredAt: "2026-08-15T11:55:00.000Z",
    codeVersion: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: sha("set"),
    productionOptIn: true,
    mediaWritesEnabled: true
  };

  for (const invalid of [
    { ...base, pass: undefined },
    { ...base, errors: undefined },
    { ...base, reasons: ["hidden-failure"] },
    { ...base, currentGlobalBytes: Number.NaN },
    { ...base, uniqueAdditionalBytes: Number.POSITIVE_INFINITY },
    { ...base, headroomAfterBytes: base.headroomAfterBytes - 1 },
    { ...base, headroomBeforePercent: base.headroomBeforePercent + 1 },
    { ...base, capacity: { ...base.capacity, headroomAfterBytes: base.capacity.headroomAfterBytes - 1 } },
    { ...base, gitCommit: "different" },
    { ...base, reportSchemaVersion: 2 },
    { ...base, gitHead: "different" },
    { ...base, additionalBytes: base.additionalBytes + 1 },
    { ...base, headroomAfter: { ...base.headroomAfter, bytes: base.headroomAfter.bytes - 1 } },
    { ...base, capacityGate: { ...base.capacityGate, status: "fail" } }
  ]) {
    assert.equal(validateApplyMeasureReport(invalid, context).ok, false, JSON.stringify(invalid));
  }
});

test("backfill planning distinguishes rows without photos from invalid photo contracts", async () => {
  const { planDishPhotoBackfillSource } = await loadBackfillModule();
  const sourcePath = `restaurants/${restaurantId}/photos/originals/${sourceSha}.png`;
  const valid = {
    id: dishId,
    restaurant_id: restaurantId,
    metadata: {
      photoStoragePath: sourcePath,
      photoSha256: sourceSha
    }
  };

  assert.deepEqual(planDishPhotoBackfillSource({
    id: "no-photo",
    restaurant_id: restaurantId,
    metadata: { menuCopy: "preserved" }
  }), { status: "no-photo" });
  assert.equal(planDishPhotoBackfillSource(valid).status, "valid");

  for (const [label, row] of [
    ["restaurant", { ...valid, restaurant_id: "not-a-uuid" }],
    ["source path", { ...valid, metadata: { ...valid.metadata, photoStoragePath: ` ${sourcePath}` } }],
    ["source SHA", { ...valid, metadata: { ...valid.metadata, photoSha256: ` ${sourceSha}` } }],
    ["partial photo", { ...valid, metadata: { photoStoragePath: sourcePath } }]
  ]) {
    const planned = planDishPhotoBackfillSource(row);
    assert.equal(planned.status, "invalid", label);
    assert.match(planned.error, /invalid photo source/i, label);
  }
});

test("shared audit classifies empty derivatives as partial and exact V2 as complete", async () => {
  const { classifyDishPhotoUsage } = await loadBackfillModule();
  const base = {
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: `restaurants/${restaurantId}/photos/originals/${sourceSha}.png`,
    photoSha256: sourceSha,
    photoContentType: "image/png",
    photoBytes: 10
  };
  assert.equal(classifyDishPhotoUsage({ metadata: {} }).classification, "no-photo");
  assert.deepEqual(
    classifyDishPhotoUsage({
      metadata: {
        photoStatus: "ready",
        photoStorageBucket: "vistaire-media",
        photoBytes: 12,
        photoDerivatives: {}
      }
    }),
    {
      classification: "invalid-metadata",
      status: "fail",
      reasons: ["invalid-metadata"]
    }
  );
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: {} } }).classification, "partial");
  const derivatives = {
    thumbnail: validDerivative({ variant: "thumbnail", storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/thumbnail-${outputSha}.webp`, width: 320 }),
    card: validDerivative(),
    display: validDerivative({ variant: "display", storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/display-${outputSha}.webp`, width: 1280 })
  };
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: derivatives } }).classification, "v2-complete");
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: { ...derivatives, card: validDerivative({ sourceSha256: sha("wrong") }) } } }).classification, "wrong-source-sha");
});

test("strict photo coverage exports every operator counter", async () => {
  const { buildStrictPhotoCoverageCounts } = await loadBackfillModule();
  const counts = buildStrictPhotoCoverageCounts([
    { classification: "no-photo", status: "pass", reasons: [] },
    { classification: "original-only", status: "partial", reasons: ["original-fallback"] },
    { classification: "image-url-only", status: "partial", reasons: ["image-url-fallback"] },
    { classification: "legacy-v1-complete", status: "pass", reasons: [] },
    { classification: "v2-complete", status: "pass", reasons: [] },
    { classification: "invalid-metadata", status: "fail", reasons: ["invalid-metadata"] },
    { classification: "wrong-recipe", status: "fail", reasons: ["wrong-recipe", "wrong-source-sha"] },
    { classification: "wrong-output-sha", status: "fail", reasons: ["wrong-output-sha"] },
    { classification: "missing-object", status: "partial", reasons: ["missing-object"] },
    { classification: "wrong-size", status: "fail", reasons: ["wrong-size", "wrong-content-type"] },
    { classification: "wrong-hash", status: "fail", reasons: ["wrong-hash"] }
  ]);

  assert.deepEqual(counts, {
    rowsWithoutPhoto: 1,
    rowsOriginalOnly: 1,
    rowsV1Complete: 1,
    rowsV2Complete: 1,
    rowsPartial: 3,
    rowsInvalidMetadata: 1,
    rowsWrongRecipe: 1,
    rowsWrongSourceSha: 1,
    rowsWrongOutputSha: 1,
    rowsMissingObject: 1,
    rowsWrongSize: 1,
    rowsWrongContentType: 1,
    rowsHashMismatch: 1,
    rowsOriginalFallback: 2
  });
});

test("shared audit is metadata-validity aware and validates exact V1 identity", async () => {
  const {
    classifyDishPhotoUsage,
    parseMediaMetadata,
    requireStorageObjectBytes,
    validateLegacyDerivativeMetadata
  } = await loadBackfillModule();
  assert.equal(parseMediaMetadata("{broken").valid, false);
  assert.equal(parseMediaMetadata(null).valid, true);
  assert.equal(requireStorageObjectBytes({ size: 0 }, "empty.webp"), 0);
  assert.throws(() => requireStorageObjectBytes({}, "unknown.webp"), /unknown object size/);
  assert.equal(classifyDishPhotoUsage({ metadata: {}, metadataValid: false }).classification, "invalid-metadata");
  assert.equal(classifyDishPhotoUsage({ metadata: {}, imageUrl: "/legacy/photo.jpg" }).classification, "image-url-only");

  const legacy = {
    schemaVersion: 1,
    recipeId: "dish-photo-v1",
    variant: "card",
    storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/card.webp`,
    sha256: outputSha,
    outputSha256: outputSha,
    sourceSha256: sourceSha,
    contentType: "image/webp",
    format: "webp",
    bytes: 6
  };
  assert.deepEqual(validateLegacyDerivativeMetadata({
    restaurantId,
    sourceSha256: sourceSha,
    variant: "card",
    metadata: legacy
  }), []);
  for (const mutation of [
    { storagePath: `${legacy.storagePath}.other` },
    { sourceSha256: sha("wrong") },
    { variant: "display" },
    { recipeId: "dish-photo-v2" },
    { schemaVersion: 2 }
  ]) {
    assert.notDeepEqual(validateLegacyDerivativeMetadata({
      restaurantId,
      sourceSha256: sourceSha,
      variant: "card",
      metadata: { ...legacy, ...mutation }
    }), []);
  }
});

test("hash verification checks canonical path, metadata, content type, size and downloaded bytes", async () => {
  const { verifyDerivativeObject } = await loadBackfillModule();
  const bytes = Buffer.from("output");
  const metadata = validDerivative({ bytes: bytes.byteLength, outputSha256: sha(bytes), sha256: sha(bytes), storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/card-${sha(bytes)}.webp` });
  const good = await verifyDerivativeObject({
    restaurantId,
    sourceSha256: sourceSha,
    variant: "card",
    metadata,
    object: { bytes: bytes.byteLength, contentType: "image/webp", body: bytes },
    verifyHash: true
  });
  assert.deepEqual(good.reasons, []);

  const bad = await verifyDerivativeObject({
    restaurantId,
    sourceSha256: sourceSha,
    variant: "card",
    metadata,
    object: { bytes: bytes.byteLength, contentType: "image/webp", body: Buffer.from("tamper") },
    verifyHash: true
  });
  assert.ok(bad.reasons.includes("wrong-hash"));
});

test("provider pagination reaches EOF, deduplicates stable identities and rejects partial pages", async () => {
  const { paginateProviderRows } = await loadBackfillModule();
  const pages = [
    [{ bucket: "media", path: "a", bytes: 1 }, { bucket: "media", path: "b", bytes: 2 }],
    [{ bucket: "media", path: "b", bytes: 2 }, { bucket: "models", path: "a", bytes: 3 }],
    []
  ];
  let cursor = 0;
  const rows = await paginateProviderRows({
    pageSize: 2,
    fetchPage: async () => ({ data: pages[cursor++], error: null }),
    identity: (row) => `${row.bucket}/${row.path}`
  });
  assert.deepEqual(rows, [
    { bucket: "media", path: "a", bytes: 1 },
    { bucket: "media", path: "b", bytes: 2 },
    { bucket: "models", path: "a", bytes: 3 }
  ]);
  await assert.rejects(
    paginateProviderRows({
      pageSize: 100,
      fetchPage: async () => ({ data: null, error: null }),
      identity: (row) => row.id
    }),
    /partial|unavailable/i
  );
});

test("media byte accounting deduplicates bucket/path and rejects conflicting sizes", async () => {
  const { deduplicateMediaObjectBytes } = await loadBackfillModule();
  assert.equal(deduplicateMediaObjectBytes([
    { bucket: "vistaire-media", path: "shared.webp", bytes: 10 },
    { bucket: "vistaire-media", path: "shared.webp", bytes: 10 },
    { bucket: "other", path: "shared.webp", bytes: 10 }
  ]), 20);
  assert.throws(() => deduplicateMediaObjectBytes([
    { bucket: "vistaire-media", path: "shared.webp", bytes: 10 },
    { bucket: "vistaire-media", path: "shared.webp", bytes: 11 }
  ]), /conflicting/i);
});
