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

test("public menu renderer dispatches each experience blueprint to a distinct renderer", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  for (const functionName of [
    "renderClassicTabs",
    "renderEditorialMagazine",
    "renderPhotoGrid",
    "renderFastBoard",
    "renderBentoShowcase",
    "renderStoryFirst",
    "renderMinimalList",
    "renderLoungeCocktail",
    "renderFamilyComfort",
    "renderImmersiveFirst",
    "renderTastingJourney",
    "renderCompactQr"
  ]) {
    assert.match(source, new RegExp(`function ${functionName}\\(`));
  }

  assert.match(source, /switch \(config\.experience\.blueprint\)/);
  assert.match(source, /case "compact-qr"/);
  assert.match(source, /case "editorial-magazine"/);
  assert.match(source, /case "immersive-first"/);
});

test("blueprint renderers expose genuinely different public structures", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(source, /data-blueprint=\{config\.experience\.blueprint\}/);
  assert.match(source, /styles\.compactQrLayout/);
  assert.match(source, /styles\.editorialLayout/);
  assert.match(source, /styles\.fastBoardLayout/);
  assert.match(source, /styles\.bentoLayout/);
  assert.match(source, /styles\.immersiveLayout/);
  assert.match(source, /styles\.tastingLayout/);
  assert.match(source, /immersiveDishes/);
  assert.match(source, /priceBoard/);
  assert.match(source, /featuredDishes/);
});

test("public menu renderer keeps owner-only status copy out of public mode", async () => {
  const source = await readFile("components/menu/PublicMenuRenderer.tsx", "utf8");

  assert.match(
    source,
    /mode === "builder-preview" &&\s*config\.photos\.ownerMissingWarnings &&\s*!dish\.hasPhoto/
  );
  assert.match(source, /mode === "builder-preview" \? renderOwnerStatusFacts/);
  assert.doesNotMatch(source, /<dt>Photo<\/dt>[\s\S]*?<dd>\{selectedDish\.hasPhoto \? "Prete" : "A faire"\}<\/dd>/);
  assert.doesNotMatch(source, /mode === "public"[\s\S]{0,220}Photo a faire/);
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
