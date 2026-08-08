import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const localizationPath = "lib/menu/maisonElyseLocalization.ts";
const menuPath = "components/menu/MaisonElyseQrMenu.tsx";

test("Maison Elyse language options use configured ready locales only", async () => {
  const [localization, menu] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile(menuPath, "utf8")
  ]);

  assert.match(localization, /getMaisonElyseLanguageOptions/);
  assert.match(localization, /status === "up_to_date"/);
  assert.match(localization, /status === "source"/);
  assert.match(menu, /getMaisonElyseLanguageOptions\(/);
  assert.doesNotMatch(menu, /const LANGUAGE_OPTIONS\s*=/);
});

test("Maison Elyse UI copy resolves exact/base/pack sources with diagnostics", async () => {
  const [source, resolverSource] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile("components/menu/trouvableMenuControls.ts", "utf8")
  ]);

  assert.match(source, /resolveTrouvableCopy/);
  assert.match(resolverSource, /requestedLocale/);
  assert.match(resolverSource, /dynamicSource/);
  assert.match(resolverSource, /usedNeutralFallback/);
});

test("Maison Elyse keeps its branded collection cover copy", async () => {
  const source = await readFile(menuPath, "utf8");

  // The shared Trouvable resolver owns generic navigation copy. Its
  // `categories` and `activeCategoryAll` values must not replace Maison's
  // cover lockup, which is part of the public restaurant experience.
  assert.doesNotMatch(source, /collectionKicker:\s*resolved\.categories/);
  assert.doesNotMatch(source, /collectionTitle:\s*resolved\.activeCategoryAll/);
  assert.doesNotMatch(source, /collectionBody:\s*resolved\.heroBlurb/);
  assert.match(source, /collectionKicker:\s*"LA COLLECTION"/);
  assert.match(source, /collectionKicker:\s*"THE COLLECTION"/);
});

test("Maison Elyse detail keeps its restaurant-specific return label", async () => {
  const source = await readFile("components/menu/MaisonElyseDishDetail.tsx", "utf8");

  assert.doesNotMatch(source, /backToMenu:\s*resolved\.backToMenu/);
  assert.match(source, /backToMenu:\s*"Retour à la carte"/);
  assert.match(source, /backToMenu:\s*"Back to menu"/);
});

test("Maison demo showcase projects localized menus by canonical public locale", async () => {
  const [showcase, demo, englishDemo, projection, landingData] = await Promise.all([
    readFile("components/vistaire-preview/DemoPhoneShowcase.tsx", "utf8"),
    readFile("app/demo/page.tsx", "utf8"),
    readFile("app/en/vistaire-menu/page.tsx", "utf8"),
    readFile("lib/landing/landingMenuUiPreview.ts", "utf8"),
    readFile("lib/landing/menuExperiences.ts", "utf8")
  ]);

  assert.match(showcase, /experiences: LandingExperience\[\]/);
  assert.match(demo, /getLandingExperiences/);
  assert.match(englishDemo, /getLandingExperiences/);
  assert.match(projection, /Partial<Record<PublicMenuLocale, LandingMenuUiMenu>>/);
  assert.match(landingData, /locale !== context\.publicLocale/);
  assert.match(landingData, /getMaisonElyseIdentity/);
});

test("Maison Elyse server context loads every ready locale for reload persistence", async () => {
  const source = await readFile("lib/menu/publicMenuRenderContext.ts", "utf8");

  assert.match(source, /lang: hasLangParam \? publicLocale : undefined/);
  assert.match(source, /translationLocales/);
  assert.match(source, /settings\.supportedLocales\.filter/);
  assert.match(source, /status === "up_to_date"/);
  assert.match(source, /getPublicMenuBySlug\(slug, candidate\)/);
});

test("Arabic text direction is scoped to text zones, not the menu root", async () => {
  const source = await readFile(menuPath, "utf8");

  assert.match(source, /data-text-direction=\{textDirection\}/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /dir=\{textDirection\}/);
});
