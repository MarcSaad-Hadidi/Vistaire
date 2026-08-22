import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import {
  getGoogleReviewCta,
  normalizeGoogleReviewConfig
} from "../lib/menu/publicMenuCore.ts";

const googleReviewCardPath = "components/menu/GoogleReviewCard.tsx";
const trackingPath = "components/menu/googleReviewTracking.ts";
const trouvableMenuPath = "components/menu/TrouvablePremiumMenuExperience.tsx";
const trouvableDishPath = "components/menu/TrouvableDishDetailExperience.tsx";
const trouvableSurfacePath = "components/menu/TrouvableDishDetailSurface.tsx";
const maisonPath = "components/menu/MaisonElyseQrMenu.tsx";
const rendererPath = "components/menu/PublicMenuRenderer.tsx";
const swipePath = "lib/menu/dishReviewSwipe.ts";
const controlsPath = "components/menu/trouvableMenuControls.ts";

const VALID_WRITE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=abc123";
const VALID_G_PAGE_URL = "https://g.page/r/CYEXAMPLE/review";

test("enabled Google Review config with a valid URL yields a direct CTA", () => {
  assert.deepEqual(
    getGoogleReviewCta({
      enabled: true,
      googleReviewUrl: VALID_WRITE_REVIEW_URL
    }),
    { href: VALID_WRITE_REVIEW_URL }
  );
  assert.deepEqual(
    getGoogleReviewCta({
      enabled: true,
      googleReviewUrl: VALID_G_PAGE_URL
    }),
    { href: VALID_G_PAGE_URL }
  );
});

test("presentation-only Google Review config yields no CTA even with a valid URL", () => {
  assert.equal(
    getGoogleReviewCta({
      enabled: true,
      presentationOnly: true,
      googleReviewUrl: VALID_WRITE_REVIEW_URL
    }),
    null
  );
});

test("disabled Google Review config yields no CTA even with a valid URL", () => {
  assert.equal(
    getGoogleReviewCta({
      enabled: false,
      googleReviewUrl: VALID_WRITE_REVIEW_URL
    }),
    null
  );
});

test("enabled Google Review config with an invalid or empty URL yields no CTA", () => {
  for (const googleReviewUrl of [
    "",
    "http://search.google.com/local/writereview?placeid=abc123",
    "https://user:pass@search.google.com/local/writereview?placeid=abc123",
    "https://search.google.com.evil.com/local/writereview?placeid=abc123",
    "https://evil-search.google.com/local/writereview?placeid=abc123",
    "https://g.page.evil.com/r/x/review",
    "https://notg.page/r/x/review",
    "https://maps.google.com/?cid=123",
    "https://www.google.com/maps/place/Foo",
    "https://example.com/review",
    "javascript:alert(1)",
    "https://search.google.com/local/writereview",
    "https://search.google.com/local/writereview?placeid="
  ]) {
    const normalized = normalizeGoogleReviewConfig({
      enabled: true,
      googleReviewUrl
    });
    assert.equal(normalized.googleReviewUrl, "");
    assert.equal(
      getGoogleReviewCta(normalized),
      null,
      `${googleReviewUrl} must not become a public CTA`
    );
  }
});

test("GoogleReviewCard is the canonical direct Google CTA and has no local review flow", async () => {
  const source = await readFile(googleReviewCardPath, "utf8");

  assert.match(source, /getGoogleReviewCta/);
  assert.match(source, /trackGoogleReviewClick/);
  assert.match(source, /dishSlug/);
  assert.match(source, /data-google-review-action="true"/);
  assert.match(source, /data-no-dish-swipe="true"/);
  assert.match(source, /href=\{cta\.href\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.doesNotMatch(source, /onReviewRequest/);
  assert.doesNotMatch(source, /data-google-review-trigger/);
  assert.doesNotMatch(source, /<textarea/);
  assert.doesNotMatch(source, /reviewRating|reviewText|onRatingChange/);
  assert.doesNotMatch(source, /disabled/);
  assert.match(source, /copy\.opensInNewTab/);
});

test("demo menus keep fictional listings presentation-only outside E2E fixtures", async () => {
  const [demoData, publicMenu, fixture] = await Promise.all([
    readFile("lib/demoMenuData.ts", "utf8"),
    readFile("lib/menu/publicMenu.ts", "utf8"),
    readFile("e2e/support/sauge-noire-fixture-data.mjs", "utf8")
  ]);

  assert.match(demoData, /presentationOnly:\s*true/);
  assert.match(demoData, /googleReviewUrl:\s*""/);
  assert.doesNotMatch(demoData, /ChIJMaisonElyseDemoVistaire/);
  assert.match(publicMenu, /enabled:\s*false,\s*googleReviewUrl:\s*""/);
  assert.match(publicMenu, /VISTAIRE_E2E_MAISON_PUBLIC_MENU === "1"/);
  assert.match(publicMenu, /e2eImmersiveFixture/);
  assert.match(
    publicMenu,
    /search\.google.com\/local\/writereview\?placeid=ChIJMaisonElyseDemoVistaire/
  );
  assert.match(
    publicMenu,
    /search\.google.com\/local\/writereview\?placeid=ChIJTrouvableDemoVistaire/
  );
  assert.match(fixture, /google_review_enabled:\s*true/);
  assert.match(
    fixture,
    /google_review_url:\s*TROUVABLE_GOOGLE_REVIEW_URL/
  );
  assert.match(
    fixture,
    /search\.google.com\/local\/writereview\?placeid=ChIJTrouvableDemoVistaire/
  );
});

test("public menus consume GoogleReviewCard without restaurant-specific Google contracts", async () => {
  const [trouvable, dish, maison, renderer] = await Promise.all([
    readFile(trouvableMenuPath, "utf8"),
    readFile(trouvableDishPath, "utf8"),
    readFile(maisonPath, "utf8"),
    readFile(rendererPath, "utf8")
  ]);

  for (const [label, source] of [
    ["Trouvable menu", trouvable],
    ["Maison Elyse", maison],
    ["generic renderer", renderer]
  ]) {
    assert.match(source, /GoogleReviewCard/, `${label} must render GoogleReviewCard`);
    assert.doesNotMatch(
      source,
      /onReviewRequest/,
      `${label} must not intercept the Google CTA`
    );
    assert.doesNotMatch(
      source,
      /if\s*\(\s*(?:restaurant|slug|menu\.slug)\s*===/,
      `${label} must not hardcode a restaurant slug for Google Reviews`
    );
  }

  assert.match(dish, /GoogleReviewCard/);
  assert.match(dish, /dishSlug=\{activeDish\.slug\}/);
  assert.doesNotMatch(dish, /onReviewRequest/);
  assert.match(renderer, /mode === "public"/);
  assert.match(maison, /if \(!showGoogleReview\) return null/);
});

test("Trouvable no longer collects a local Google review form", async () => {
  const [menu, dish, surface, controls, swipe, tracking] = await Promise.all([
    readFile(trouvableMenuPath, "utf8"),
    readFile(trouvableDishPath, "utf8"),
    readFile(trouvableSurfacePath, "utf8"),
    readFile(controlsPath, "utf8"),
    readFile(swipePath, "utf8"),
    readFile(trackingPath, "utf8")
  ]);

  for (const [label, source] of [
    ["Trouvable menu", menu],
    ["Trouvable dish", dish],
    ["Trouvable surface", surface]
  ]) {
    assert.doesNotMatch(source, /reviewRating/, `${label} must not keep reviewRating`);
    assert.doesNotMatch(source, /reviewText/, `${label} must not keep reviewText`);
    assert.doesNotMatch(
      source,
      /TrouvableDishReviewPanelBody/,
      `${label} must not render a local review panel`
    );
    assert.doesNotMatch(source, /openRestaurantReviewSheet|openReviewSheet/);
    assert.doesNotMatch(source, /experienceReview/);
    assert.doesNotMatch(source, /Publier l'avis|reviewPost/);
  }

  assert.doesNotMatch(surface, /onOpenReview/);
  assert.doesNotMatch(surface, /copy\.review[A-Z]/);
  assert.doesNotMatch(swipe, /reviewOpen/);
  assert.match(menu, /trackGoogleReviewClick|GoogleReviewCard/);
  assert.match(tracking, /ctaName:\s*"google_review"/);
  assert.doesNotMatch(tracking, /reviewText|rating|comment/);

  for (const deadCopy of [
    "reviewPost",
    "reviewComment",
    "reviewStars",
    "reviewPlaceholder",
    "reviewTitle",
    "reviewOpened",
    "reviewMissing",
    "reviewExperienceTitle",
    "reviewExperiencePlaceholder",
    "reviewExperienceStars",
    "reviewClose"
  ]) {
    assert.doesNotMatch(
      controls,
      new RegExp(`\\b${deadCopy}\\s*:`),
      `${deadCopy} must be removed from Trouvable copy`
    );
  }
});

test("CI and the Playwright runner keep the Google Review CTA on demo menus", async () => {
  const [runner, packageJson] = await Promise.all([
    readFile("scripts/run-playwright-e2e.mjs", "utf8"),
    readFile("package.json", "utf8")
  ]);

  assert.match(runner, /useGoogleReviewDirectCtaFixture/);
  assert.match(runner, /endsWith\("e2e\/google-review-direct-cta\.spec\.ts"\)/);
  assert.match(
    JSON.parse(packageJson).scripts["test:ci:e2e:menu"],
    /e2e\/google-review-direct-cta\.spec\.ts/
  );
});
