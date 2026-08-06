import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin thumbnails use a single source-keyed fallback without retry loops", async () => {
  const [thumbnail, topDishes] = await Promise.all([
    readFile("components/admin/AdminDishThumbnail.tsx", "utf8"),
    readFile("components/admin/overview/AdminTopDishes.tsx", "utf8")
  ]);

  assert.match(thumbnail, /^"use client";/);
  assert.match(thumbnail, /useState/);
  assert.match(thumbnail, /failedSource === source/);
  assert.match(thumbnail, /onError=\{\(\) => setFailedSource\(source\)\}/);
  assert.match(thumbnail, /data-admin-dish-thumbnail-fallback/);
  assert.match(thumbnail, /unoptimized=\{isAdminDishPhotoUrl\(source\)\}/);
  assert.doesNotMatch(thumbnail, /setAttribute\([^)]*['"]src|window\.location|\.src\s*=/i);
  assert.match(topDishes, /AdminDishThumbnail/);
  assert.doesNotMatch(topDishes, /from ["']next\/image["']/);
});

test("admin thumbnail failure state is keyed by source so a changed source retries once", async () => {
  const thumbnail = await readFile(
    "components/admin/AdminDishThumbnail.tsx",
    "utf8"
  );
  assert.match(thumbnail, /const requestedSource = thumbnailUrl \|\| imageUrl/);
  assert.match(thumbnail, /const source = buildAdminDishPhotoUrl\(requestedSource\)/);
  assert.match(thumbnail, /useState<string \| null>/);
  assert.doesNotMatch(thumbnail, /setFailedSource\(null\)/);
});
