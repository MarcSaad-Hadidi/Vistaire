import assert from "node:assert/strict";
import test from "node:test";

test("rollback releases only bytes whose Storage deletion is confirmed", async () => {
  const { rollbackCreatedMediaObjects } = await import("../lib/owner/mediaRollback.ts");
  const created = [
    { path: "a.webp", bytes: 10 },
    { path: "b.webp", bytes: 20 }
  ];

  const failed = await rollbackCreatedMediaObjects({
    bucket: { remove: async () => ({ data: null, error: { message: "provider failed" } }) },
    created,
    referencedPaths: new Set(["b.webp"])
  });
  assert.deepEqual(failed, {
    removedPaths: [],
    retainedPaths: ["a.webp", "b.webp"],
    retainedBytes: 30,
    errors: ["provider failed"]
  });

  const confirmed = await rollbackCreatedMediaObjects({
    bucket: { remove: async (paths) => ({ data: paths, error: null }) },
    created,
    referencedPaths: new Set(["b.webp"])
  });
  assert.deepEqual(confirmed, {
    removedPaths: ["a.webp"],
    retainedPaths: ["b.webp"],
    retainedBytes: 20,
    errors: []
  });
});

test("rollback keeps every object counted when reference lookup or remove throws", async () => {
  const { rollbackCreatedMediaObjects } = await import("../lib/owner/mediaRollback.ts");
  const created = [{ path: "a.webp", bytes: 10 }];

  assert.equal((await rollbackCreatedMediaObjects({
    bucket: { remove: async () => assert.fail("remove must not run") },
    created,
    referencedPaths: null
  })).retainedBytes, 10);

  const thrown = await rollbackCreatedMediaObjects({
    bucket: { remove: async () => { throw new Error("timeout"); } },
    created,
    referencedPaths: new Set()
  });
  assert.equal(thrown.retainedBytes, 10);
  assert.deepEqual(thrown.errors, ["timeout"]);

  const partial = await rollbackCreatedMediaObjects({
    bucket: { remove: async () => ({ data: [], error: null }) },
    created,
    referencedPaths: new Set()
  });
  assert.equal(partial.retainedBytes, 10);
  assert.deepEqual(partial.removedPaths, []);
  assert.deepEqual(partial.errors, ["Storage remove result incomplete"]);
});

test("rollback bills ambiguous upload attempts unless Storage absence was proven", async () => {
  const {
    potentiallyCreatedMediaObjectBytes,
    rollbackPotentiallyCreatedMediaObjects
  } = await import("../lib/owner/mediaRollback.ts");
  const potentiallyCreated = [
    { path: "confirmed.webp", bytes: 10, creation: "confirmed" },
    { path: "ambiguous.webp", bytes: 20, creation: "ambiguous" }
  ];

  assert.equal(potentiallyCreatedMediaObjectBytes(potentiallyCreated), 30);
  const rollback = await rollbackPotentiallyCreatedMediaObjects({
    bucket: { remove: async (paths) => ({ data: paths, error: null }) },
    potentiallyCreated,
    referencedPaths: new Set()
  });
  assert.deepEqual(rollback, {
    removedPaths: ["confirmed.webp"],
    retainedPaths: ["ambiguous.webp"],
    retainedBytes: 20,
    errors: ["ambiguous Storage upload retained conservatively"]
  });
});
