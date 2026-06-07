import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("public menu route loads the published UI config and shared renderer", async () => {
  const source = await readFile("app/menu/[slug]/page.tsx", "utf8");

  assert.match(source, /getPublishedMenuUiConfigForRestaurant/);
  assert.match(source, /PublicMenuRenderer/);
  assert.doesNotMatch(source, /PublicMenuExperience/);
});

test("shared public menu renderer avoids heavy 3D auto-loads", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /mode:\s*"public" \| "builder-preview"/);
  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /@google\/model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
});

test("public menu renderer links dish cards to shareable detail routes with QR context", async () => {
  const pageSource = await readFile("app/menu/[slug]/page.tsx", "utf8");
  const rendererSource = await readFile(
    "components/menu/PublicMenuRenderer.tsx",
    "utf8"
  );

  assert.match(pageSource, /query=\{query\}/);
  assert.match(rendererSource, /import Link from "next\/link"/);
  assert.match(rendererSource, /buildPublicDishPath/);
  assert.match(rendererSource, /query\?: PublicMenuContextQuery/);
  assert.match(
    rendererSource,
    /const dishHref = buildPublicDishPath\(menu\.slug, dish\.slug, query\)/
  );
  assert.match(rendererSource, /href=\{dishHref\}/);
  assert.match(rendererSource, /prefetch=\{false\}/);
  assert.match(rendererSource, /mode === "public"/);
  assert.match(rendererSource, /onClick=\{\(\) => openDish\(dish\)\}/);
});
