import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEO_PAGE_FILES = {
  "menu-pdf-vs-menu-digital": "components/seo/pages/MenuPdfVsDigitalPage.tsx",
  "menu-digital-restaurant": "components/seo/pages/MenuDigitalRestaurantPage.tsx",
  "menu-qr-code-restaurant": "components/seo/pages/MenuQrCodeRestaurantPage.tsx",
  "menu-3d-ar-restaurant": "components/seo/pages/Menu3dArRestaurantPage.tsx"
};

const FORBIDDEN_HEAVY_REFS = [
  "@google/model-viewer",
  "import { useGLTF",
  "model-viewer",
  ".glb",
  ".usdz",
  ".mp4",
  ".webm",
  "gsap",
  "framer-motion",
  "three"
];

const SIGNATURE_ANIMATION_FILES = [
  "components/seo/PdfVistaireCompareSlider.tsx",
  "components/seo/animations/CinematicMenuBloom.tsx"
];

function readSeo(file) {
  return readFileSync(join(process.cwd(), file), "utf8");
}

test("PDF vs digital page hosts the signature comparison slider", () => {
  const file = readSeo(SEO_PAGE_FILES["menu-pdf-vs-menu-digital"]);
  assert.match(
    file,
    /from "@\/components\/seo\/PdfVistaireCompareSlider"/,
    "MenuPdfVsDigitalPage must import PdfVistaireCompareSlider"
  );
  assert.match(
    file,
    /<PdfVistaireCompareSlider\b/,
    "MenuPdfVsDigitalPage must render <PdfVistaireCompareSlider />"
  );
});

test("PDF vs digital page wires slider preview data from the demo menu source", () => {
  const file = readSeo(SEO_PAGE_FILES["menu-pdf-vs-menu-digital"]);
  assert.match(
    file,
    /buildPdfComparePreviewData/,
    "MenuPdfVsDigitalPage must build preview data from demo menu source"
  );
  assert.match(
    file,
    /preview=\{comparePreview\}/,
    "MenuPdfVsDigitalPage must pass comparePreview to the slider"
  );
});

test("Comparison slider stays aligned with demo menu data helpers", () => {
  const sliderPath = "components/seo/PdfVistaireCompareSlider.tsx";
  const scenePath = "components/seo/VistaireDigitalMenuScene.tsx";
  const sliderFile = readSeo(sliderPath);
  const sceneFile = readSeo(scenePath);
  assert.match(
    sliderFile,
    /preview: PdfComparePreviewData/,
    "slider must accept PdfComparePreviewData from the shared helper"
  );
  assert.match(
    sceneFile,
    /SceneCategoryCard/,
    "shared Vistaire scene must render Maison Élyse category cards"
  );
  assert.match(
    sceneFile,
    /Bienvenue chez Maison/,
    "shared Vistaire scene must open on the Maison Élyse welcome screen"
  );
  assert.match(
    sceneFile,
    /Voir toute la carte/,
    "shared Vistaire scene must include the full-menu call to action"
  );
  assert.doesNotMatch(
    sceneFile,
    /Menu client|CompareDishCardPreview|CompareCategoryChip/,
    "shared Vistaire scene must not keep the old tabbed demo menu"
  );
  assert.match(
    sliderFile,
    /VistaireDigitalMenuScene/,
    "slider must render the shared Vistaire digital menu scene"
  );
  assert.doesNotMatch(
    sliderFile,
    /dishPrice = "16 \$"/,
    "slider must not keep stale hardcoded demo dish defaults"
  );
});

test("Comparison slider keeps PDF and Vistaire labels inside distinct clipped layers", () => {
  const sliderPath = "components/seo/PdfVistaireCompareSlider.tsx";
  const scenePath = "components/seo/VistaireDigitalMenuScene.tsx";
  const file = readSeo(sliderPath);
  const sceneFile = readSeo(scenePath);
  assert.match(
    file,
    /function PdfLayerLabel/,
    "slider must render the PDF label inside the PDF layer"
  );
  assert.match(
    sceneFile,
    /function VistaireLayerLabel/,
    "shared Vistaire scene must render the Vistaire label inside the Vistaire layer"
  );
  assert.match(
    file,
    /clipPath: "inset\(0 calc\(100% - var\(--split\)\) 0 0\)"/,
    "PDF layer must clip to the left side of the slider"
  );
  assert.match(
    file,
    /clipPath: "inset\(0 0 0 var\(--split\)\)"/,
    "Vistaire layer must clip to the right side of the slider"
  );
  assert.doesNotMatch(
    file,
    /maison-elyse-carte\.pdf/,
    "slider must not render a PDF filename bar"
  );
  assert.doesNotMatch(
    file,
    /pdfFilename/,
    "slider must not depend on a PDF filename field"
  );
});

test("Comparison slider component declares a client boundary and pillar marker", () => {
  const sliderPath = "components/seo/PdfVistaireCompareSlider.tsx";
  const file = readSeo(sliderPath);
  assert.match(file, /^"use client";/, "slider must opt into a client boundary");
  assert.match(
    file,
    /data-pillar-animation="pdf-vs-digital"/,
    "slider must expose data-pillar-animation marker for QA"
  );
  assert.match(file, /role="slider"/, "slider must expose role=slider");
  assert.match(file, /aria-valuenow/, "slider must expose aria-valuenow");
  assert.match(file, /aria-valuemin=\{0\}/);
  assert.match(file, /aria-valuemax=\{100\}/);
  assert.match(
    file,
    /aria-valuetext=\{`\$\{pdfPercent\} pour cent PDF, \$\{vistairePercent\} pour cent Vistaire`\}/,
    "slider aria-valuetext must report PDF percentage first because --split drives the PDF clip"
  );
  assert.match(
    file,
    /touchAction: "pan-y"/,
    "slider must preserve vertical page scrolling on touch devices"
  );
  assert.doesNotMatch(
    file,
    /touchAction: "none"/,
    "slider must not disable all touch panning on the hero region"
  );
  assert.doesNotMatch(
    file,
    /\btouch-none\b/,
    "slider must not apply tailwind touch-none on the full phone frame"
  );
  assert.match(
    file,
    /onKeyDown=\{onKeyDown\}/,
    "slider must wire its keyboard handler"
  );
  assert.match(file, /motion-reduce:/, "slider must respect reduced motion classes");
  assert.match(
    file,
    /data-phone-comparison="true"/,
    "slider must expose phone comparison marker for QA"
  );
  assert.match(
    file,
    /aspect-\[9\/16\]/,
    "slider screen must use phone aspect ratio"
  );
});

test("Signature animations must not pull heavy media or runtime libraries", () => {
  for (const [slug, file] of Object.entries(SEO_PAGE_FILES)) {
    const content = readSeo(file);
    for (const ref of FORBIDDEN_HEAVY_REFS) {
      assert.equal(
        content.includes(ref),
        false,
        `${slug} page must not reference '${ref}'`
      );
    }
  }
  for (const animationPath of SIGNATURE_ANIMATION_FILES) {
    const content = readSeo(animationPath);
    for (const ref of FORBIDDEN_HEAVY_REFS) {
      assert.equal(
        content.includes(ref),
        false,
        `${animationPath} must not reference '${ref}'`
      );
    }
  }
});

test("Each pillar page keeps exactly one visible <h1> bound to its data", () => {
  for (const [slug, file] of Object.entries(SEO_PAGE_FILES)) {
    const content = readSeo(file);
    const h1Count = (content.match(/<h1\b/g) ?? []).length;
    assert.equal(
      h1Count,
      1,
      `${slug} page must contain exactly one <h1> element (found ${h1Count})`
    );
    assert.match(
      content,
      /\{page\.h1\}/,
      `${slug} page must bind its <h1> to page.h1`
    );
  }
});

test("Pillar pages keep JsonLd, FAQ, comparison and internal links wired", () => {
  for (const [slug, file] of Object.entries(SEO_PAGE_FILES)) {
    const content = readSeo(file);
    assert.match(content, /<JsonLd\b/, `${slug} must keep <JsonLd />`);
    assert.match(content, /<SeoFaq\b/, `${slug} must keep <SeoFaq />`);
    assert.match(
      content,
      /<InternalSeoLinks\b/,
      `${slug} must keep <InternalSeoLinks />`
    );
    assert.match(
      content,
      /buildSeoPillarJsonLd/,
      `${slug} must build pillar JSON-LD`
    );
  }
});

test("No public copy in pillar pages or signature animations uses forbidden em-dash punctuation", () => {
  const files = [
    ...Object.values(SEO_PAGE_FILES),
    ...SIGNATURE_ANIMATION_FILES
  ];
  for (const file of files) {
    const content = readSeo(file);
    assert.equal(
      content.includes("\u2014"),
      false,
      `${file} must not contain an em-dash ("\u2014")`
    );
  }
});

test("Menu digital restaurant page hosts the Cinematic Menu Bloom animation", () => {
  const file = readSeo(SEO_PAGE_FILES["menu-digital-restaurant"]);
  assert.match(
    file,
    /from "@\/components\/seo\/animations\/CinematicMenuBloom"/,
    "MenuDigitalRestaurantPage must import CinematicMenuBloom"
  );
  assert.match(
    file,
    /<CinematicMenuBloom\b/,
    "MenuDigitalRestaurantPage must render <CinematicMenuBloom />"
  );
  assert.match(
    file,
    /data-pillar-animation="menu-digital-bloom"/,
    "MenuDigitalRestaurantPage must mark the bloom section for QA"
  );
});

test("Menu digital restaurant page wires bloom preview data from the demo menu source", () => {
  const file = readSeo(SEO_PAGE_FILES["menu-digital-restaurant"]);
  assert.match(
    file,
    /buildCinematicMenuBloomData/,
    "MenuDigitalRestaurantPage must build bloom preview data from the demo menu source"
  );
  assert.match(
    file,
    /preview=\{bloomPreview\}/,
    "MenuDigitalRestaurantPage must pass bloomPreview to <CinematicMenuBloom />"
  );
});

test("Cinematic Menu Bloom stays aligned with demo menu data helpers", () => {
  const animationPath = "components/seo/animations/CinematicMenuBloom.tsx";
  const file = readSeo(animationPath);
  assert.match(
    file,
    /^"use client";/,
    "CinematicMenuBloom must opt into a client boundary"
  );
  assert.match(
    file,
    /preview: CinematicMenuBloomData/,
    "CinematicMenuBloom must accept CinematicMenuBloomData from the shared helper"
  );
  assert.match(
    file,
    /from "@\/components\/seo\/VistaireDigitalMenuScene"/,
    "CinematicMenuBloom must reuse the shared Vistaire digital menu scene"
  );
  assert.match(
    file,
    /<VistaireDigitalMenuScene\b/,
    "CinematicMenuBloom must render the shared Vistaire digital menu scene"
  );
  assert.match(
    file,
    /data-pillar-animation="menu-digital-bloom"/,
    "CinematicMenuBloom must expose the data-pillar-animation marker for QA"
  );
  assert.match(
    file,
    /data-force-cinematic-motion="true"/,
    "CinematicMenuBloom must opt into forced cinematic motion for the bloom sequence"
  );
  assert.match(
    file,
    /--cmb-scrub-ms/,
    "CinematicMenuBloom must scrub the timeline from scroll progress"
  );
  assert.match(
    file,
    /data-bloom-progress=/,
    "CinematicMenuBloom must expose scroll progress for QA"
  );
  assert.match(
    file,
    /usePrefersReducedMotion/,
    "CinematicMenuBloom must respect the prefers-reduced-motion hook"
  );
  assert.match(
    file,
    /data-reduced-motion=/,
    "CinematicMenuBloom must wire a data-reduced-motion attribute for QA"
  );
  assert.match(
    file,
    /reducedMotion \? "true"/,
    "CinematicMenuBloom must set data-reduced-motion=\"true\" when reduced motion is preferred"
  );
  assert.match(
    file,
    /<noscript>/,
    "CinematicMenuBloom must ship a noscript fallback that keeps the menu visible"
  );
});

test("Cinematic Menu Bloom data source reads from the shared demo menu", () => {
  const file = readSeo("lib/cinematicMenuBloomData.ts");
  assert.match(
    file,
    /buildPdfComparePreviewData/,
    "cinematicMenuBloomData must reuse the PDF compare preview data source"
  );
  assert.match(
    file,
    /buildCinematicMenuBloomData/,
    "cinematicMenuBloomData must export buildCinematicMenuBloomData()"
  );
  assert.match(
    file,
    /plats-signatures/,
    "cinematicMenuBloomData must focus the digital bloom on plats signatures"
  );
});
