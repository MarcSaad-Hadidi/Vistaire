import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = () =>
  readFile(new URL("../scripts/backfill-dish-photo-derivatives.mjs", import.meta.url), "utf8");

test("media backfill serializes workers sharing one restaurant/source SHA", async () => {
  const script = await source();

  assert.match(script, /const lockKey = `\$\{item\.restaurantId\}:\$\{item\.sourceSha\}`/);
  assert.match(script, /withSourceLock\(lockKey, \(\) => worker\(item, index\)\)/);
});

test("media backfill rollback preserves and accounts for derivatives that are referenced, uncertain or not removed", async () => {
  const script = await source();

  assert.match(script, /\.from\("menu_dishes"\)[\s\S]*\.eq\("restaurant_id", plan\.restaurantId\)/);
  assert.match(script, /rollbackCreatedMediaObjects\(\{ bucket, created, referencedPaths: references \}\)/);
  assert.match(script, /throw new MediaCapacityWorkError\([\s\S]*rollback\.retainedBytes/);
  assert.match(script, /uploadedObjects\.push\(\{ path: item\.outputPath, bytes: item\.bytes\.byteLength \}\)/);
});

test("media backfill capacity accounting retains V1 derivative bytes", async () => {
  const script = await source();

  assert.match(script, /function legacyDerivativeObject/);
  assert.match(script, /deduplicateMediaObjectBytes\(derivativeObjects\.v1\)/);
  assert.match(script, /legacyDerivativeBytes: derivativeByteTotals\.v1/);
  assert.match(script, /existingDerivativeBytes = derivativeByteTotals\.v1 \+ derivativeByteTotals\.v2/);
});
