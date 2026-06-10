import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const detailPagePath = "app/menu/[slug]/dishes/[dishSlug]/page.tsx";
const detailComponentPath = "components/menu/PublicDishDetailExperience.tsx";
const detailCssPath = "components/menu/PublicDishDetailExperience.module.css";

test("public dish detail route scopes dishes to the requested public menu", async () => {
  const source = await readFile(detailPagePath, "utf8");

  assert.match(source, /getPublicMenuBySlug/);
  assert.match(source, /getPublicMenuDishBySlug/);
  assert.match(source, /getPublishedMenuUiConfigForRestaurant/);
  assert.match(source, /config=\{configRecord\.config\}/);
  assert.doesNotMatch(source, /isFreshHomemadeMenu/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /PublicDishDetailExperience/);
  assert.match(source, /query=\{query\}/);
});

test("public dish detail component renders the required Resto Marc detail affordances", async () => {
  const source = await readFile(detailComponentPath, "utf8");

  assert.match(source, /"use client"/);
  assert.match(source, /Catégorie/);
  assert.match(source, /Disponibilité/);
  assert.match(source, /Image du plat à venir/);
  assert.match(source, /Retour au menu/);
  assert.match(source, /dish\.ingredients\.length/);
  assert.match(source, /dish\.allergens\.length/);
  assert.match(source, /dish\.options\.length/);
  assert.match(source, /dish\.houseNote/);
  assert.match(source, /config\?: MenuUiConfig/);
  assert.match(source, /mode\?: "public" \| "builder-preview"/);
  assert.match(source, /onBack\?: \(\) => void/);
  assert.match(source, /data-theme=\{config\?\.theme/);
  assert.match(source, /data-blueprint=\{config\?\.experience\.blueprint/);
  assert.match(source, /mode === "builder-preview"/);
  assert.match(source, /hasPublic3d/);
  assert.match(source, /hasPublicAr/);
  assert.match(source, /dynamic<DishModelViewerProps>/);
  assert.match(source, /ssr:\s*false/);
  assert.match(source, /LazyDishModelViewer/);
  assert.match(source, /Voir en 3D/);
  assert.match(source, /Afficher devant moi/);
  assert.match(source, /Preview statut seulement dans le builder/);
  assert.doesNotMatch(source, /<model-viewer/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});

test("public dish detail CSS keeps builder preview inside the simulated phone on desktop", async () => {
  const css = await readFile(detailCssPath, "utf8");

  assert.match(
    css,
    /@media \(min-width: 760px\)[\s\S]*\.builderPreview\s*\{[\s\S]*padding:\s*0;/
  );
  assert.match(
    css,
    /@media \(min-width: 760px\)[\s\S]*\.builderPreview \.card\s*\{[\s\S]*grid-template-columns:\s*1fr;/
  );
  assert.match(
    css,
    /@media \(min-width: 760px\)[\s\S]*\.builderPreview \.visual\s*\{[\s\S]*position:\s*static;[\s\S]*min-height:\s*220px;/
  );
  assert.match(
    css,
    /@media \(min-width: 760px\)[\s\S]*\.builderPreview \.heading h1\s*\{[\s\S]*font-size:\s*34px;/
  );
});
