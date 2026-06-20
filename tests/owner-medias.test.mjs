import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("owner medias page accepts targeted restaurant params and falls back globally", async () => {
  const source = await readFile("app/owner/medias/page.tsx", "utf8");

  assert.match(source, /searchParams/);
  assert.match(source, /restaurantId/);
  assert.match(source, /restaurantSlug/);
  assert.match(source, /getOwnerRestaurantDashboardData\(lookup\)/);
  assert.match(source, /getOwnerMenuStatusData\(\)/);
  assert.match(source, /Restaurant introuvable, vue globale affichee\./);
});

test("owner medias page shows targeted media path and dishes without photos", async () => {
  const source = await readFile("app/owner/medias/page.tsx", "utf8");

  assert.match(source, /getOwnerMenuData\(restaurant\.id\)/);
  assert.match(source, /buildMediaBasePath\(restaurant\)/);
  assert.match(source, /restaurants\/\$\{restaurant\.id\}\/photos\//);
  assert.match(source, /dishesWithoutPhoto/);
  assert.match(source, /missingPhotoCount/);
  assert.match(source, /coverageLabel\(photoCount, dishCount\)/);
  assert.match(source, /Chemin Storage\/CDN reference/);
  assert.match(source, /Photos des plats/);
  assert.match(source, /OwnerDishPhotoUploader/);
  assert.match(source, /Supabase Storage/);
  assert.doesNotMatch(source, /Les uploads ne sont pas geres dans ce module/);
});

test("owner medias global rows link to the targeted restaurant view", async () => {
  const source = await readFile("app/owner/medias/page.tsx", "utf8");

  assert.match(source, /href=\{`\/owner\/restaurants\/\$\{encodeURIComponent\(restaurant\.id\)\}\/medias`\}/);
  assert.match(source, /encodeURIComponent\(restaurant\.id\)/);
  assert.match(source, /Photos manquantes par restaurant/);
});
