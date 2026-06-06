import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("owner nav exposes the Menu Builder section", async () => {
  const source = await readFile("lib/owner/nav.ts", "utf8");

  assert.match(source, /\/owner\/menu-builder/);
  assert.match(source, /Menu Builder/);
});

test("owner menu builder route renders the builder component", async () => {
  const source = await readFile("app/owner/menu-builder/page.tsx", "utf8");

  assert.match(source, /MenuUiBuilder/);
  assert.match(source, /getOwnerRestaurantsData/);
  assert.match(source, /Menu UI Builder/);
});

test("menu builder preview never imports model-viewer or heavy 3D assets", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
});

test("menu builder loads real menu data, config, and shared renderer", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.match(source, /\/api\/owner\/menu-data/);
  assert.match(source, /\/api\/owner\/menu-ui-config/);
  assert.match(source, /PublicMenuRenderer/);
  assert.match(source, /Source : Supabase/);
  assert.match(source, /Import rapide/);
});

test("menu builder saves drafts, publishes UI, and generates only public menu QR targets", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.match(source, /Sauvegarder draft UI/);
  assert.match(source, /Publier UI/);
  assert.match(source, /\/api\/owner\/qr-codes/);
  assert.match(source, /targetKind:\s*"menu"/);
  assert.match(source, /targetPath:\s*publicMenuPath/);
  assert.doesNotMatch(source, /targetKind:\s*"admin"/);
  assert.doesNotMatch(source, /targetPath:\s*publicMenuUrl/);
});

test("menu builder includes reusable theme presets", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.match(source, /fresh-homemade/);
  assert.match(source, /premium-gastronomic/);
  assert.match(source, /street-casual/);
  assert.match(source, /cafe-brunch/);
  assert.match(source, /minimal-clean/);
});

test("menu builder derives welcome copy from the selected restaurant", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.doesNotMatch(source, /useState\("Bienvenue chez Resto Marc"\)/);
  assert.match(source, /menuUiConfigForRestaurant/);
  assert.match(source, /welcomeTitle/);
});
