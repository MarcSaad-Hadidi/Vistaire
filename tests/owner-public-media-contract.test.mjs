import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("owner readiness derives immersive status from real URLs or storage paths", async () => {
  const source = await readFile("lib/owner/data.ts", "utf8");
  const start = source.indexOf("function rowHasImmersiveAsset");
  const end = source.indexOf("function getDishMetrics", start);
  const block = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(block, /has_immersive_view|hasImmersiveView|modelStatus|has_3d|hasAr/);
  assert.match(block, /webModel3dStoragePath/);
  assert.match(block, /arModel3dStoragePath/);
  assert.match(block, /arUsdzStoragePath/);
});

test("owner photo readiness ignores a stale ready status without a real photo", async () => {
  const source = await readFile("lib/owner/data.ts", "utf8");
  const start = source.indexOf("function rowHasPhoto");
  const end = source.indexOf("function rowHasImmersiveAsset", start);
  const block = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(block, /photoStatus|photo_status|has_photo|hasPhoto|photo_ready/);
  assert.match(block, /photoStoragePath/);
  assert.match(block, /thumbnailUrl/);
});

test("Maison Elyse public detail keeps the heavy viewer behind explicit action", async () => {
  const detail = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");
  const compare = await readFile(
    "components/owner/OwnerDishModelVisualCompare.tsx",
    "utf8"
  );

  assert.match(detail, /const canOpenImmersive = has3d \|\| hasAr/);
  assert.match(detail, /showModelViewer \?/);
  assert.match(detail, /showModelViewer \?\s*\(\s*<LazyDishModelViewer/);
  assert.doesNotMatch(detail, /loading=["']eager["']/);
  assert.doesNotMatch(compare, /loading=["']eager["']/);
});
