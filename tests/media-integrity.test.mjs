import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

async function loadIntegrityModule() {
  try {
    return await import("../lib/owner/mediaObjectIntegrity.ts");
  } catch (error) {
    assert.fail(`media integrity module must load: ${error instanceof Error ? error.message : error}`);
  }
}

function sha(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function bucketFixture({ info, infoError = null, bytes, downloadError = null }) {
  return {
    infoCalls: [],
    downloadCalls: [],
    async info(path) {
      this.infoCalls.push(path);
      return { data: info, error: infoError };
    },
    async download(path) {
      this.downloadCalls.push(path);
      return {
        data: downloadError ? null : new Blob([bytes], { type: "image/webp" }),
        error: downloadError
      };
    }
  };
}

test("an existing immutable object is reusable only after hash, size and content-type proof", async () => {
  const { inspectImmutableStorageObject } = await loadIntegrityModule();
  const bytes = Buffer.from("canonical-derivative");
  const bucket = bucketFixture({
    info: { metadata: { size: bytes.byteLength, mimetype: "image/webp" } },
    bytes
  });
  const result = await inspectImmutableStorageObject({
    bucket,
    path: `restaurants/r/photos/derivatives/${"a".repeat(64)}/dish-photo-v2/card-${sha(bytes)}.webp`,
    expectedBytes: bytes.byteLength,
    expectedSha256: sha(bytes),
    expectedContentType: "image/webp",
    maxBytes: 1024,
    timeoutMs: 1_000
  });

  assert.deepEqual(result, { state: "reusable", bytes: bytes.byteLength, sha256: sha(bytes) });
  assert.equal(bucket.downloadCalls.length, 1);
});

test("same-size bytes with the wrong hash are an immutable conflict", async () => {
  const { MediaObjectIntegrityError, inspectImmutableStorageObject } = await loadIntegrityModule();
  const expected = Buffer.from("expected");
  const bucket = bucketFixture({
    info: { metadata: { size: expected.byteLength, mimetype: "image/webp" } },
    bytes: Buffer.from("tampered")
  });

  await assert.rejects(
    inspectImmutableStorageObject({
      bucket,
      path: "object.webp",
      expectedBytes: expected.byteLength,
      expectedSha256: sha(expected),
      expectedContentType: "image/webp",
      maxBytes: 1024,
      timeoutMs: 1_000
    }),
    (error) => error instanceof MediaObjectIntegrityError && error.reason === "hash-mismatch"
  );
});

test("a proven 404 is missing while partial provider responses are unavailable", async () => {
  const { MediaObjectIntegrityError, inspectImmutableStorageObject } = await loadIntegrityModule();
  const missing = bucketFixture({ info: null, infoError: { statusCode: 404 }, bytes: Buffer.alloc(0) });
  assert.deepEqual(await inspectImmutableStorageObject({
    bucket: missing,
    path: "missing.webp",
    expectedBytes: 1,
    expectedSha256: "a".repeat(64),
    expectedContentType: "image/webp",
    maxBytes: 1024,
    timeoutMs: 1_000
  }), { state: "missing" });

  const unavailable = bucketFixture({ info: null, infoError: null, bytes: Buffer.alloc(0) });
  await assert.rejects(
    inspectImmutableStorageObject({
      bucket: unavailable,
      path: "unknown.webp",
      expectedBytes: 1,
      expectedSha256: "a".repeat(64),
      expectedContentType: "image/webp",
      maxBytes: 1024,
      timeoutMs: 1_000
    }),
    (error) => error instanceof MediaObjectIntegrityError && error.reason === "provider-unavailable"
  );
});
