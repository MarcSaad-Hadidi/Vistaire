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
  assert.match(source, /resolvePublicMenuUiConfig/);
  assert.match(source, /config=\{resolvedConfig\}/);
  assert.doesNotMatch(source, /isFreshHomemadeMenu/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /PublicDishDetailExperience/);
  assert.match(source, /query=\{menuQuery\}/);
});

test("public dish detail component renders the required Resto Marc detail affordances", async () => {
  const source = await readFile(detailComponentPath, "utf8");

  assert.match(source, /"use client"/);
  assert.match(source, /Catégorie/);
  assert.match(source, /Disponibilité/);
  assert.match(source, /Image du plat à venir/);
  assert.match(source, /Retour au menu/);
  assert.match(source, /dish\.ingredients\.length/);
  assert.match(source, /AllergenDisclosure/);
  assert.match(source, /<AllergenDisclosure dish=\{dish\} locale=\{locale\} \/>/);
  assert.match(source, /dish\.options\.length/);
  assert.match(source, /dish\.houseNote/);
  assert.match(source, /config\?: MenuUiConfig/);
  assert.match(source, /cleanDisplayText/);
  assert.match(source, /restaurantDisplayName/);
  assert.match(source, /mode\?: "public" \| "builder-preview"/);
  assert.match(source, /onBack\?: \(\) => void/);
  assert.match(source, /data-theme=\{config\?\.theme/);
  assert.match(source, /data-blueprint=\{config\?\.experience\.blueprint/);
  assert.match(source, /mode === "builder-preview"/);
  assert.match(source, /hasPublic3d/);
  assert.match(source, /hasPublicAr/);
  assert.match(source, /builderStatusHas3d/);
  assert.match(source, /builderStatusHasAr/);
  assert.match(source, /type DishModelViewerComponent = ComponentType<DishModelViewerProps>/);
  assert.match(source, /setModelViewerComponent/);
  assert.match(source, /if \(!showModelViewer \|\| ModelViewerComponent \|\| modelViewerLoadFailed\) return/);
  assert.match(source, /import\("@\/components\/dish\/DishModelViewer"\)/);
  assert.match(source, /Voir en 3D/);
  assert.doesNotMatch(source, /dynamic<DishModelViewerProps>/);
  assert.doesNotMatch(source, /LazyDishModelViewer/);
  assert.doesNotMatch(source, /modelActionButtonSecondary/);
  assert.match(source, /Preview statut seulement dans le builder/);
  assert.doesNotMatch(source, /<model-viewer/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(source, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});

test("builder preview uses simulated immersive status flags without public model URLs", async () => {
  const source = await readFile(detailComponentPath, "utf8");

  assert.match(source, /function builderStatusHas3d\(dish: PublicMenuDish\): boolean/);
  assert.match(source, /return Boolean\(dish\.has3d \|\| hasPublic3d\(dish\)\)/);
  assert.match(source, /function builderStatusHasAr\(dish: PublicMenuDish\): boolean/);
  assert.match(source, /return Boolean\(dish\.hasAr \|\| hasPublicAr\(dish\)\)/);
  assert.match(source, /const hasPublic3dAsset = hasPublic3d\(dish\)/);
  assert.match(source, /const hasPublicArAsset = hasPublicAr\(dish\)/);
  assert.match(
    source,
    /showPublicModelActions =\s*mode === "public" && hasPublic3dAsset/
  );
  assert.match(
    source,
    /showBuilderModelStatus =\s*mode === "builder-preview" && \(hasBuilder3dStatus \|\| hasBuilderArStatus\)/
  );
  assert.match(
    source,
    /dishBadges\(dish,\s*\{[\s\S]*has3d: hasDisplay3d,[\s\S]*hasAr: hasDisplayAr/
  );
  assert.match(source, /hasBuilder3dStatus \? \(/);
  assert.match(source, /hasBuilderArStatus \? \(/);
});

test("public dish detail premium theme keeps Maison Elyse nav readable and glass gold", async () => {
  const css = await readFile(detailCssPath, "utf8");

  assert.match(css, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.navRestaurantName[\s\S]*max-width:\s*min\(52vw,\s*220px\)/);
  assert.match(css, /#f0d18a/);
  assert.match(css, /rgba\(240,\s*209,\s*138,\s*0\.095\)/);
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(118%\)/);
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
