import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("localized SEO showcase routes reuse the verified landing menu pipeline", async () => {
  const routes = await Promise.all([
    source("app/(seo)/menu-pdf-vs-menu-digital/page.tsx"),
    source("app/en/pdf-vs-digital-menu/page.tsx"),
    source("app/(seo)/menu-digital-restaurant/page.tsx"),
    source("app/en/digital-restaurant-menu/page.tsx")
  ]);

  for (const route of routes) {
    assert.match(route, /SeoInteractiveComparison/);
    assert.match(route, /seoAppendix/);
    assert.match(route, /buildSeoPillarJsonLd/);
  }

  assert.match(routes[0], /locale="fr" interaction="slider"/);
  assert.match(routes[1], /locale="en" interaction="slider"/);
  assert.match(routes[2], /locale="fr" interaction="reveal"/);
  assert.match(routes[3], /locale="en" interaction="reveal"/);
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

test("circular reveal accepts the selected renderer and can be unlocked with Escape", async () => {
  const [reveal, styles] = await Promise.all([
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.tsx"),
    source("components/vistaire-preview/VistairePdfToDigitalHoverReveal.module.css")
  ]);

  assert.match(reveal, /digitalLayer\?: ReactNode/);
  assert.match(reveal, /event\.key === "Escape"/);
  assert.match(reveal, /setLocked\(false\)/);
  assert.match(reveal, /data-reveal-locked/);
  assert.match(reveal, /touchAction: "pan-y pinch-zoom"/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
