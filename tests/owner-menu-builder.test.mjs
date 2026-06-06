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

test("menu builder includes reusable theme presets", async () => {
  const source = await readFile("components/owner/MenuUiBuilder.tsx", "utf8");

  assert.match(source, /fresh-homemade/);
  assert.match(source, /premium-gastronomic/);
  assert.match(source, /street-casual/);
  assert.match(source, /cafe-brunch/);
  assert.match(source, /minimal-clean/);
});
