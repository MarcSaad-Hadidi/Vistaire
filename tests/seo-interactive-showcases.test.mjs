import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertInteractiveComparison(source, locale, interaction) {
  assert.match(
    source,
    new RegExp(
      `<SeoInteractiveComparison\\b(?=[^>]*\\slocale\\s*=\\s*"${locale}")(?=[^>]*\\sinteraction\\s*=\\s*"${interaction}")[^>]*\\/>`
    )
  );
}

test("localized SEO showcase routes reuse the verified landing menu pipeline", async () => {
  const routes = await Promise.all([
    source("app/(fr)/(seo)/menu-pdf-vs-menu-digital/page.tsx"),
    source("app/(en)/en/pdf-vs-digital-menu/page.tsx"),
    source("app/(fr)/(seo)/menu-digital-restaurant/page.tsx"),
    source("app/(en)/en/digital-restaurant-menu/page.tsx")
  ]);

  for (const route of routes) {
    assert.match(route, /SeoInteractiveComparison/);
    assert.match(route, /seoAppendix/);
    assert.match(route, /buildSeoPillarJsonLd/);
  }

  assertInteractiveComparison(routes[0], "fr", "slider");
  assertInteractiveComparison(routes[1], "en", "slider");
  assertInteractiveComparison(routes[2], "fr", "reveal");
  assertInteractiveComparison(routes[3], "en", "reveal");

  assert.doesNotThrow(() =>
    assertInteractiveComparison(
      `<SeoInteractiveComparison interaction = "slider" deviceEmphasis locale = "fr" />`,
      "fr",
      "slider"
    )
  );

  for (const source of [
    `<SeoInteractiveComparisonCard locale="fr" interaction="slider" />`,
    `<SeoInteractiveComparison data-locale="fr" data-interaction="slider" />`,
    `<SeoInteractiveComparison locale="fr" />
     <OtherComparison interaction="slider" />`
  ]) {
    assert.throws(() => assertInteractiveComparison(source, "fr", "slider"));
  }
});

test("SEO interactive showcase mounts one selected real renderer, not mock previews", async () => {
  const [showcase, comparison, pdfPage, digitalPage] = await Promise.all([
    source("components/landing/SeoInteractiveComparison.tsx"),
    source("components/landing/comparison/LandingComparison.tsx"),
    source("components/vistaire-preview/VistairePdfVsMenuDigitalPreview.tsx"),
    source("components/vistaire-preview/VistaireMenuDigitalRestaurantPreview.tsx")
  ]);

  assert.match(showcase, /getLandingExperiences/);
  assert.match(showcase, /getLandingCopy\(locale\)\.comparison/);
  assert.match(showcase, /<LandingComparison/);
  assert.match(comparison, /activeExperience/);
  assert.match(comparison, /LandingActiveMenuPreview/);
  assert.match(comparison, /data-active-preview/);
  assert.match(comparison, /interaction === "reveal"/);
  assert.match(comparison, /VistairePreviewPdfCompareSlider/);
  assert.match(comparison, /VistairePdfToDigitalHoverReveal/);
  assert.match(pdfPage, /interactiveShowcase/);
  assert.match(digitalPage, /interactiveShowcase/);
  assert.doesNotMatch(`${pdfPage}\n${digitalPage}`, /buildPdfComparePreviewData/);
});

test("embedded restaurant renderers preserve the SEO page heading hierarchy", async () => {
  const [trouvable, sauge] = await Promise.all([
    source("components/menu/TrouvablePremiumMenuExperience.tsx"),
    source("components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx")
  ]);

  assert.match(trouvable, /const HeroHeading = isEmbeddedPreview \? "h2" : "h1"/);
  assert.match(sauge, /headingLevel=\{2\}/);
  assert.match(sauge, /const Heading = headingLevel === 1 \? "h1" : "h2"/);
});

test("circular reveal keeps nested menu controls usable and can be unlocked with Escape", async () => {
  const [reveal, styles] = await Promise.all([
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.tsx"),
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.module.css")
  ]);

  assert.match(reveal, /digitalLayer\?: ReactNode/);
  assert.match(reveal, /event\.key === "Escape"/);
  assert.match(reveal, /setLocked\(false\)/);
  assert.match(reveal, /data-reveal-locked/);
  assert.match(reveal, /role=\{locked \? "group" : "button"\}/);
  assert.match(reveal, /event\.target !== event\.currentTarget/);
  assert.match(reveal, /nestedControl/);
  assert.match(reveal, /aria-hidden=\{!locked\}/);
  assert.match(reveal, /inert=\{!locked\}/);
  assert.match(reveal, /onClick=\{onClick\}/);
  assert.match(reveal, /touchAction: "pan-y pinch-zoom"/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
