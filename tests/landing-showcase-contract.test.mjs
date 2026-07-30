import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("landing showcase keeps the existing chrome and promoted video contract", async () => {
  const landing = await source("components/landing/VistaireLanding.tsx");
  const hero = await source("components/landing/LandingHero.tsx");
  const media = await source("components/landing/LandingHeroMedia.tsx");
  const adapter = await source(
    "components/vistaire-preview/VistairePreviewLanding.tsx"
  );

  assert.match(landing, /PreviewNav/);
  assert.match(landing, /PreviewFooter/);
  assert.doesNotMatch(landing, /components\/Header/);
  assert.match(hero, /LandingHeroMedia/);
  assert.match(media, /\/videos\/Vistaire2\.mp4/);
  assert.match(media, /\/frames\/menualive\/frame_0200\.webp/);
  assert.match(media, /autoPlay/);
  assert.match(media, /muted/);
  assert.match(media, /loop/);
  assert.match(media, /playsInline/);
  assert.match(media, /saveData/);
  assert.match(media, /onError/);
  assert.match(adapter, /VistaireLanding/);
});

test("landing showcase presents verified experiences, routes, and owner capabilities", async () => {
  const data = await source("lib/landing/menuExperiences.ts");
  const copy = await source("lib/landing/landingCopy.ts");
  const experienceSection = await source(
    "components/landing/LandingExperienceSection.tsx"
  );
  const ownerSection = await source(
    "components/landing/LandingOwnerSection.tsx"
  );

  for (const name of ["Maison Élyse", "Trouvable", "Sauge Noire"]) {
    assert.match(data, new RegExp(name));
  }

  assert.match(data, /buildPublicMenuPath/);
  assert.match(data, /resolvePublicMenuRenderContext/);
  assert.match(data, /buildPublicDishPath/);
  assert.doesNotMatch(data, /\/demo/);
  assert.match(experienceSection, /next\/image/);
  assert.match(experienceSection, /target="_blank"/);
  assert.match(experienceSection, /rel="noopener noreferrer"/);
  assert.match(ownerSection, /restaurateurDashboard/);
  assert.match(copy, /Trois expériences\. Trois identités\./);
  assert.match(copy, /Three experiences\. Three identities\./);
  assert.doesNotMatch(
    `${data}\n${copy}\n${ownerSection}`,
    /collaborateurs|permissions|augmente vos ventes|plus de ventes|nos clients/i
  );
});

test("landing comparison mounts one official public-menu renderer with accessible tabs", async () => {
  const comparison = await source(
    "components/landing/comparison/LandingComparison.tsx"
  );
  const activeRenderer = await source(
    "components/landing/comparison/LandingActiveMenuPreview.tsx"
  );
  const previewLayer = await source(
    "components/vistaire-preview/VistairePreviewPdfCompareSlider.tsx"
  );
  const previewStyles = await source(
    "components/vistaire-preview/VistairePreviewPdfCompareSlider.module.css"
  );

  assert.match(comparison, /role="tablist"/);
  assert.match(comparison, /aria-selected/);
  assert.match(comparison, /ArrowLeft/);
  assert.match(comparison, /ArrowRight/);
  assert.match(comparison, /Home/);
  assert.match(comparison, /End/);
  assert.match(comparison, /VistairePreviewPdfCompareSlider/);
  assert.match(comparison, /LandingActiveMenuPreview/);
  assert.match(comparison, /data-active-preview/);
  assert.match(previewLayer, /role="slider"/);
  assert.match(previewStyles, /touch-action:\s*pan-y/);
  assert.match(previewLayer, /digitalLayer/);

  assert.match(activeRenderer, /MaisonElyseQrMenu/);
  assert.match(activeRenderer, /TrouvablePremiumMenuExperience/);
  assert.match(activeRenderer, /SaugeNoireBookMenu/);
  assert.match(activeRenderer, /displayMode="phone-preview"/);
  assert.match(activeRenderer, /mode="phone-preview"/);
  assert.match(activeRenderer, /showGoogleReview=\{false\}/);
  assert.match(activeRenderer, /rendererKey === "sauge-noire-book-v1"/);
  assert.doesNotMatch(activeRenderer, /import\s*\(\s*[`'"].*\$\{/);
  assert.doesNotMatch(activeRenderer, /model-viewer|\.glb|\.usdz/i);
});

test("landing and the public menu route share the official render-context resolver", async () => {
  const route = await source("app/menu/[slug]/page.tsx");
  const previewRoute = await source(
    "app/api/public/landing-menu-preview/[experienceId]/route.ts"
  );
  const landingData = await source("lib/landing/menuExperiences.ts");
  const resolver = await source("lib/menu/publicMenuRenderContext.ts");

  assert.match(route, /resolvePublicMenuRenderContext/);
  assert.match(landingData, /resolvePublicMenuRenderContext/);
  assert.match(previewRoute, /isLandingExperienceId/);
  assert.match(previewRoute, /value === "fr" \|\| value === "en"/);
  assert.doesNotMatch(previewRoute, /import\s*\(\s*[`'"].*\$\{/);
  assert.match(resolver, /resolvePublicMenuExperience/);
  assert.match(resolver, /getPublishedMenuUiConfigForRestaurant/);
  assert.match(resolver, /getExchangeRates/);
});

test("landing serializes only Maison Elyse and lazy-loads later menu payloads", async () => {
  const comparison = await source(
    "components/landing/comparison/LandingComparison.tsx"
  );
  const landingData = await source("lib/landing/menuExperiences.ts");

  assert.match(
    landingData,
    /experience\.id === "maison-elyse"\s*\?\s*landingRenderPayload/
  );
  assert.match(
    comparison,
    /\/api\/public\/landing-menu-preview\/\$\{activeExperience\.id\}/
  );
  assert.match(comparison, /AbortController/);
  assert.match(comparison, /previewPayloads/);
  assert.doesNotMatch(comparison, /display:\s*none/);
});

test("landing dish cards use current public-menu detail routes", async () => {
  const data = await source("lib/landing/menuExperiences.ts");
  const projection = await source("lib/landing/publicMenuPreview.ts");
  const section = await source(
    "components/landing/LandingDishStorySection.tsx"
  );

  assert.match(data, /preferredDishSlug/);
  assert.match(data, /buildCurrentPublicMenuPreview/);
  assert.match(projection, /getVisiblePublicMenuCategories/);
  assert.match(section, /experience\.featuredDish\.href/);
  assert.match(section, /data-testid="landing-dishes"/);
});

test("landing dish photos keep versioned public routes compatible with Next Image", async () => {
  const data = await source("lib/landing/menuExperiences.ts");
  const nextConfig = (await import("../next.config.ts")).default;
  const localPatterns = nextConfig.images?.localPatterns ?? [];

  assert.ok(
    localPatterns.some(
      (pattern) =>
        pattern.pathname === "/api/public/menu-dishes/*/photo" &&
        pattern.search === undefined
    ),
    "versioned public dish photo URLs must be allowed without weakening every local image query"
  );
  assert.doesNotMatch(
    data,
    /\/api\/public\/menu-dishes\/[0-9a-f-]{36}\/photo["']/i,
    "landing fallbacks must not fabricate an unversioned canonical photo route"
  );
});

test("landing styles stop motion without forced animations", async () => {
  const styles = await source(
    "components/landing/VistaireLanding.module.css"
  );
  const comparisonStyles = await source(
    "components/landing/comparison/LandingComparison.module.css"
  );

  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(comparisonStyles, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(
    `${styles}\n${comparisonStyles}`,
    /prefers-reduced-motion[\s\S]{0,800}animation:[^;]+!important/
  );
});

test("landing keeps the restaurant backdrop visible through glass panels", async () => {
  const styles = await source(
    "components/landing/VistaireLanding.module.css"
  );
  const comparisonStyles = await source(
    "components/landing/comparison/LandingComparison.module.css"
  );

  assert.match(
    styles,
    /url\("\/images\/landing\/trouvable-experience\.jpg"\)/
  );
  assert.match(styles, /backdrop-filter:\s*blur\(/);
  assert.match(styles, /--landing-glass:/);
  assert.doesNotMatch(
    styles,
    /--landing-(?:surface|glass):\s*rgba\([^;]+,\s*0\.[5-9]\)/
  );
  assert.doesNotMatch(
    comparisonStyles,
    /\.tabs[\s\S]{0,300}background:\s*rgba\([^;]+,\s*0\.[4-9]\)/
  );
});
