import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const componentPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const cssPath = "components/menu/TrouvablePremiumMenuExperience.module.css";
const helperPath = "lib/menu/trouvableMenuExperience.ts";

test("public Trouvable menu is centralized in a targeted premium experience", async () => {
  const page = await readFile(pagePath, "utf8");
  const helper = await readFile(helperPath, "utf8");

  assert.match(page, /TrouvablePremiumMenuExperience/);
  assert.match(page, /isTrouvablePublicMenu\(menu\)/);
  assert.match(page, /resolvePublicMenuUiConfig\(menu, configRecord\.config\)/);
  assert.match(helper, /slug === "trouvable"/);
  assert.match(helper, /theme:\s*"premium-gastronomic"/);
  assert.match(helper, /autoLoad:\s*false/);
});

test("Trouvable premium menu keeps 3D assets behind dish detail intent", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.doesNotMatch(source, /DishModelViewer/);
  assert.doesNotMatch(source, /model-viewer/);
  assert.doesNotMatch(source, /@google\/model-viewer/);
  assert.doesNotMatch(source, /\.glb/);
  assert.doesNotMatch(source, /\.usdz/);
  assert.match(source, /buildPublicDishPath/);
  assert.match(source, /prefetch=\{false\}/);
});

test("Trouvable premium menu includes local selection and waiter-only flows", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /useState<Map<string, SelectionItem>>/);
  assert.match(source, /Sélection locale/);
  assert.match(source, /quantityControls/);
  assert.match(source, /Total estimé/);
  assert.match(source, /Demander au serveur/);
  assert.match(source, /Aucune commande n&apos;est envoyée automatiquement/);
  assert.match(source, /Question allergène/);
  assert.match(source, /Demander une recommandation/);
  assert.match(source, /Demander ma sélection/);
});

test("Trouvable premium menu styles are mobile-first and overflow-safe", async () => {
  const css = await readFile(cssPath, "utf8");

  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /\.categoryRail[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/);
});
