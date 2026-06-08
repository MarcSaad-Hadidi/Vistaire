import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const detailPagePath = "app/menu/[slug]/dishes/[dishSlug]/page.tsx";
const detailComponentPath = "components/menu/PublicDishDetailExperience.tsx";

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
  assert.match(source, /Copier le lien/);
  assert.match(source, /Retour au menu/);
  assert.match(source, /dish\.ingredients\.length/);
  assert.match(source, /dish\.allergens\.length/);
  assert.match(source, /dish\.options\.length/);
  assert.match(source, /dish\.houseNote/);
  assert.match(source, /config\?: MenuUiConfig/);
  assert.match(source, /data-theme=\{config\?\.theme/);
  assert.match(source, /data-blueprint=\{config\?\.experience\.blueprint/);
});
