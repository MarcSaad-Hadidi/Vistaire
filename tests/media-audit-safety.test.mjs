import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = () => readFile(new URL("../scripts/supabase-usage-audit.mjs", import.meta.url), "utf8");

test("usage audit selects image_url and preserves invalid metadata as invalid", async () => {
  const script = await source();

  assert.match(script, /select\("id,restaurant_id,image_url,metadata"\)/);
  assert.match(script, /metadataValid/);
  assert.match(script, /imageUrl: row\.image_url/);
});

test("usage audit rejects absent object sizes and delegates strict V1 validation", async () => {
  const script = await source();

  assert.match(script, /requireStorageObjectBytes/);
  assert.match(script, /verifyLegacyDerivativeObject/);
  assert.doesNotMatch(script, /Number\(entry\.metadata\?\.size \?\? entry\.metadata\?\.size_bytes \?\? 0\) \|\| 0/);
});
