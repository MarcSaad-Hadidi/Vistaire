import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const componentPath = "components/menu/MaisonElyseQrMenu.tsx";
const cssPath = "components/menu/MaisonElyseQrMenu.module.css";

test("Maison Elyse public menu is the only dedicated QR table experience", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /MaisonElyseQrMenu/);
  assert.match(source, /menu\.slug === "maison-elyse"/);
  assert.match(source, /PublicMenuRenderer/);
  assert.match(source, /getPublishedMenuUiConfigForRestaurant/);
});

test("Maison Elyse QR menu starts with welcome and visual category navigation", async () => {
  const [component, css] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(cssPath, "utf8")
  ]);

  for (const text of [
    "Bienvenue chez Maison Élyse",
    "Carte à table",
    "Choisir une section",
    "La carte Maison Élyse",
    "Plats signatures",
    "Retour aux sections",
    "Voir toute la carte"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /getVisiblePublicMenuCategories/);
  assert.match(component, /getPublicMenuCategoryGroups/);
  assert.match(css, /\.categoryGrid/);
  assert.match(css, /\.categoryCard/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(max-width: 430px\)/);
});

test("Maison Elyse QR menu keeps premium filters and Google Reviews without 3D autoload", async () => {
  const component = await readFile(componentPath, "utf8");

  for (const text of [
    "Recommandés",
    "Signature",
    "3D / AR",
    "Disponibles",
    "Sans gluten",
    "Sans lactose",
    "Sans fruits à coque",
    "Sans crustacés",
    "Réinitialiser",
    "Aucun plat dans cette sélection"
  ]) {
    assert.match(component, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(component, /GoogleReviewCard/);
  assert.match(component, /googleReview=\{menu\.googleReview\}/);
  assert.match(component, /restaurantId=\{menu\.restaurantId\}/);
  assert.match(component, /restaurantName=\{menu\.name\}/);
  assert.match(component, /source=\{menu\.source\}/);
  assert.doesNotMatch(component, /DishModelViewer/);
  assert.doesNotMatch(component, /<model-viewer/);
  assert.doesNotMatch(component, /@google\/model-viewer/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.glb/);
  assert.doesNotMatch(component, /["'`](?:https?:\/\/|\/)[^"'`]*\.usdz/);
});
