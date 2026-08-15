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
  const { buildCheckpointEnvelope, checkpointEntryMatches } = await loadBackfillModule();
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
  assert.equal(report.reportVersion, 1);
  assert.equal(report.capacity.headroomBeforeBytes, 500);
  assert.equal(report.capacity.headroomAfterBytes, 400);
  assert.equal(report.capacity.headroomAfterPercent, 40);
  assert.equal(report.status, "pass");
});

test("apply gate rejects stale, mismatched, low-headroom or non-opted-in reports", async () => {
  const { validateApplyMeasureReport } = await loadBackfillModule();
  const base = {
    reportVersion: 1,
    projectRef: "project-a",
    generatedAt: "2026-08-15T12:00:00.000Z",
    codeVersion: "abc123",
    recipeId: "dish-photo-v2",
    schemaVersion: 2,
    sourceSetDigest: sha("set"),
    authoritativeQuotaBytes: 1_000,
    capacity: { headroomAfterPercent: 25 },
    status: "pass",
    errors: []
  };
  const context = {
    now: new Date("2026-08-15T12:10:00.000Z"),
    projectRef: "project-a",
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
  assert.equal(validateApplyMeasureReport({ ...base, projectRef: "other" }, context).ok, false);
  assert.equal(validateApplyMeasureReport({ ...base, capacity: { headroomAfterPercent: 19.99 } }, context).ok, false);
  assert.equal(validateApplyMeasureReport(base, { ...context, productionOptIn: false }).ok, false);
  assert.equal(validateApplyMeasureReport(base, { ...context, mediaWritesEnabled: false }).ok, false);
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
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: {} } }).classification, "partial");
  const derivatives = {
    thumbnail: validDerivative({ variant: "thumbnail", storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/thumbnail-${outputSha}.webp`, width: 320 }),
    card: validDerivative(),
    display: validDerivative({ variant: "display", storagePath: `restaurants/${restaurantId}/photos/derivatives/${sourceSha}/dish-photo-v2/display-${outputSha}.webp`, width: 1280 })
  };
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: derivatives } }).classification, "v2-complete");
  assert.equal(classifyDishPhotoUsage({ metadata: { ...base, photoDerivatives: { ...derivatives, card: validDerivative({ sourceSha256: sha("wrong") }) } } }).classification, "wrong-source-sha");
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
