import assert from "node:assert/strict";
import test from "node:test";

test("content-addressed rollback retains every attempted object across concurrent reuse", async () => {
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
    potentiallyCreated
  });
  assert.deepEqual(rollback, {
    removedPaths: [],
    retainedPaths: ["confirmed.webp", "ambiguous.webp"],
    retainedBytes: 30,
    errors: ["content-addressed Storage objects retained for cross-instance safety"]
  });
});
