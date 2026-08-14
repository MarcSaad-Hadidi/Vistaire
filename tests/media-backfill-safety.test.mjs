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

test("media backfill rollback preserves derivatives that are still referenced or uncertain", async () => {
  const script = await source();

  assert.match(script, /\.from\("menu_dishes"\)[\s\S]*\.eq\("restaurant_id", plan\.restaurantId\)/);
  assert.match(script, /if \(!references\) return;/);
  assert.match(script, /const rollbackPaths = uploadedPaths\.filter\(\(storagePath\) => !references\.has\(storagePath\)\)/);
  assert.match(script, /rollbackUploadedDerivatives\(bucket, client, plan, uploadedPaths\)/);
});

test("media backfill capacity accounting retains V1 derivative bytes", async () => {
  const script = await source();

  assert.match(script, /function legacyDerivativeByteSize/);
  assert.match(script, /legacyDerivativeBytes: derivativeByteTotals\.v1/);
  assert.match(script, /existingDerivativeBytes = derivativeByteTotals\.v1 \+ derivativeByteTotals\.v2/);
});

test("verify-only checks Storage metadata before optional source download", async () => {
  const script = await source();

  assert.match(script, /const verifySource = args\.has\("--verify-source"\)/);
  assert.match(script, /if \(verifyOnly\) \{[\s\S]*?bucket\.info\(metadata\.storagePath\)[\s\S]*?if \(verifySource\)/);
});
