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
  assert.match(experienceSection, /LandingPublicMenuLink/);
  assert.match(ownerSection, /restaurateurDashboard/);
  assert.match(copy, /Trois expériences\. Trois identités\./);
  assert.match(copy, /Three experiences\. Three identities\./);
  assert.doesNotMatch(
    `${data}\n${copy}\n${ownerSection}`,
    /collaborateurs|permissions|augmente vos ventes|plus de ventes|nos clients/i
  );
});

test("featured dish links derive from each experience route contract", async () => {
  const data = await source("lib/landing/menuExperiences.ts");

  assert.match(
    data,
    /buildPublicDishPath\(\s*experience\.menuSlug,\s*experience\.featuredDish\.slug,\s*\{[\s\S]*lang: locale === "en" \? "en-CA" : "fr-CA"/
  );
  assert.match(
    data,
    /experience\.id === "sauge-noire" && experience\.dishView[\s\S]*view: experience\.dishView/
  );
  assert.doesNotMatch(
    data,
    /experience\.id !== "sauge-noire"[\s\S]{0,180}view:/
  );
  assert.match(
    data,
    /buildPublicDishPath\(\s*"maison-elyse",\s*"ravioles-de-chevre-frais-miel-de-monteregie",\s*\{\s*lang\s*\}/
  );
  assert.match(
    data,
    /buildPublicDishPath\("trouvable", "pesto-burrata-verde", \{ lang \}\)/
  );
  assert.match(
    data,
    /buildPublicDishPath\("sauge-noire", "betterave-sous-la-cendre", \{\s*lang,\s*view: "sauge-2"/
  );
  assert.match(data, /locale === "en" \? "en-CA" : "fr-CA"/);
});

test("landing public menu links use the shared secure new-tab contract", async () => {
  const [
    publicMenuLink,
    hero,
    experienceSection,
    comparison,
    dishSection
  ] = await Promise.all([
    source("components/landing/LandingPublicMenuLink.tsx"),
    source("components/landing/LandingHero.tsx"),
    source("components/landing/LandingExperienceSection.tsx"),
    source("components/landing/comparison/LandingComparison.tsx"),
    source("components/landing/LandingDishStorySection.tsx")
  ]);

  assert.ok(
    publicMenuLink.includes(
      "export type LandingPublicMenuHref = `/menu/${string}`"
    )
  );
  assert.match(publicMenuLink, /target="_blank"/);
  assert.match(publicMenuLink, /rel="noopener noreferrer"/);
  assert.match(publicMenuLink, /Sâ€™ouvre dans un nouvel onglet\./);
  assert.match(publicMenuLink, /Opens in a new tab\./);

  assert.equal((hero.match(/<LandingPublicMenuLink/g) ?? []).length, 2);
  assert.equal((hero.match(/href=\{maisonHref\}/g) ?? []).length, 2);
  assert.equal(
    (experienceSection.match(/<LandingPublicMenuLink/g) ?? []).length,
    1
  );
  assert.equal(
    (experienceSection.match(/href=\{experience\.publicMenuHref\}/g) ?? [])
      .length,
    1
  );
  assert.equal((comparison.match(/<LandingPublicMenuLink/g) ?? []).length, 1);
  assert.equal(
    (comparison.match(/href=\{activeExperience\.publicMenuHref\}/g) ?? [])
      .length,
    1
  );
  assert.equal((dishSection.match(/<LandingPublicMenuLink/g) ?? []).length, 1);
  assert.equal(
    (dishSection.match(/href=\{experience\.featuredDish\.href\}/g) ?? [])
      .length,
    1
  );

  const rawPublicMenuLink =
    /<(?:Link|a)\b[\s\S]{0,240}href=(?:\{(?:maisonHref|experience\.publicMenuHref|activeExperience\.publicMenuHref|experience\.featuredDish\.href)\}|["']\/menu\/)/;
  for (const callSite of [hero, experienceSection, comparison, dishSection]) {
    assert.doesNotMatch(callSite, rawPublicMenuLink);
  }
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
  assert.match(previewStyles, /\.handle[\s\S]{0,300}touch-action:\s*none/);
  assert.match(previewLayer, /data-comparison-scroll-root="pdf"/);
  assert.match(previewLayer, /digitalLayer/);

  assert.match(activeRenderer, /MaisonElyseComparisonPreview/);
  assert.match(activeRenderer, /TrouvableComparisonPreview/);
  assert.match(activeRenderer, /SaugeNoireComparisonPreview/);
  assert.match(activeRenderer, /data-display-mode="comparison-preview"/);
  assert.match(activeRenderer, /data-comparison-scroll-root="digital"/);
  assert.match(activeRenderer, /rendererKey === "sauge-noire-book-v1"/);
  assert.doesNotMatch(activeRenderer, /\sinert(?:\s|>)/);
  assert.doesNotMatch(activeRenderer, /phone-preview/);
  assert.doesNotMatch(activeRenderer, /import\s*\(\s*[`'"].*\$\{/);
  assert.doesNotMatch(activeRenderer, /model-viewer|\.glb|\.usdz/i);
});

test("landing comparison shares each public menu UI without the generic preview renderer", async () => {
  const [
    activeRenderer,
    maisonPreview,
    trouvablePreview,
    saugePreview,
    saugePages,
    maisonPublic,
    trouvablePublic,
    saugePublic
  ] = await Promise.all([
    source("components/landing/comparison/LandingActiveMenuPreview.tsx"),
    source("components/landing/comparison/MaisonElyseComparisonPreview.tsx"),
    source("components/landing/comparison/TrouvableComparisonPreview.tsx"),
    source("components/landing/comparison/SaugeNoireComparisonPreview.tsx"),
    source(
      "components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx"
    ).catch(() => ""),
    source("components/menu/MaisonElyseQrMenu.tsx"),
    source("components/menu/TrouvablePremiumMenuExperience.tsx"),
    source("components/menu/unique/sauge-noire/SaugeNoireBookMenu.tsx")
  ]);

  for (const preview of [maisonPreview, trouvablePreview, saugePreview]) {
    assert.doesNotMatch(preview, /ComparisonPreviewMenu/);
  }

  assert.match(maisonPreview, /MaisonElyseQrMenu/);
  assert.match(maisonPreview, /displayMode="comparison-preview"/);
  assert.match(trouvablePreview, /TrouvablePremiumMenuExperience/);
  assert.match(trouvablePreview, /displayMode="comparison-preview"/);
  assert.match(saugePreview, /SaugeNoireMenuPages/);
  assert.match(saugePages, /CoverPage/);
  assert.match(saugePages, /ContentsPage/);
  assert.match(saugePages, /SectionPage/);
  assert.match(saugePages, /EndingPage/);
  assert.doesNotMatch(
    `${saugePreview}\n${saugePages}`,
    /react-pageflip|from\s+["'][^"']*SaugeNoireBookMenu["']|SaugeNoirePageFlip|useRouter|usePathname|useSearchParams/
  );

  for (const menuUi of ["maison-elyse", "trouvable", "sauge-noire"]) {
    assert.match(activeRenderer, new RegExp(`data-menu-ui="${menuUi}"`));
  }
  assert.doesNotMatch(activeRenderer, /data-comparison-preview/);

  assert.match(maisonPublic, /data-menu-ui="maison-elyse"/);
  assert.match(trouvablePublic, /data-menu-ui="trouvable"/);
  assert.match(saugePublic, /data-menu-ui="sauge-noire"/);
});

test("landing Trouvable comparison uses the public route typography contract", async () => {
  const [trouvablePreview, publicRoute, typography] = await Promise.all([
    source("components/landing/comparison/TrouvableComparisonPreview.tsx"),
    source("app/menu/[slug]/page.tsx"),
    source("app/menu/[slug]/trouvableTypography.ts")
  ]);

  assert.match(typography, /Inter\(/);
  assert.match(typography, /Noto_Serif_Display\(/);
  assert.match(publicRoute, /typographyClassName=\{trouvableTypographyClassName\}/);
  assert.match(trouvablePreview, /trouvableTypographyClassName/);
  assert.match(
    trouvablePreview,
    /typographyClassName=\{trouvableTypographyClassName\}/
  );
});

test("landing menu payload serializes alternate localized menus without duplicating the active locale", async () => {
  const landingData = await source("lib/landing/menuExperiences.ts");

  assert.match(
    landingData,
    /locale !== context\.locale[\s\S]{0,160}projectLandingMenuUiMenu\(menu\)/
  );
});

test("comparison renderers remove dead controls from the keyboard and pointer contract", async () => {
  const [maison, trouvable, saugePages] = await Promise.all([
    source("components/menu/MaisonElyseQrMenu.tsx"),
    source("components/menu/TrouvablePremiumMenuExperience.tsx"),
    source("components/menu/unique/sauge-noire/SaugeNoireMenuPages.tsx")
  ]);

  assert.match(maison, /disableNavigation=\{isComparisonPreview\}/);
  assert.match(maison, /disabled=\{isComparisonPreview\}/);
  assert.equal(
    (maison.match(/disableNavigation=\{isComparisonPreview\}/g) ?? []).length,
    2
  );
  assert.equal(
    (maison.match(/disabled=\{isComparisonPreview\}/g) ?? []).length,
    4
  );
  assert.doesNotMatch(
    maison,
    /isComparisonPreview\s*\?\s*\(\)\s*=>\s*undefined/
  );

  assert.match(
    trouvable,
    /disabled=\{isComparisonPreview \|\| !canChangeCurrency\}/
  );
  assert.match(
    trouvable,
    /disabled=\{isComparisonPreview \|\| !canChangeLanguage\}/
  );
  assert.match(trouvable, /disabled=\{isComparisonPreview\}/);
  assert.equal(
    (trouvable.match(/disabled=\{isComparisonPreview\}/g) ?? []).length,
    3
  );
  assert.match(
    trouvable,
    /disabled=\{isComparisonPreview \|\| !dish\.available\}/
  );
  assert.match(
    trouvable,
    /isComparisonPreview\s*\?\s*\(\s*<span[\s\S]{0,900}styles\.dishSummary/
  );

  assert.match(saugePages, /interactive=\{false\}/);
  assert.match(saugePages, /disabled=\{!interactive\}/);
  assert.equal(
    (saugePages.match(/disabled=\{!interactive\}/g) ?? []).length,
    7
  );
  assert.match(
    saugePages,
    /disableNavigation=\{disableNavigation\}/
  );
  assert.match(saugePages, /interactive=\{!disableNavigation\}/);
  assert.match(
    saugePages,
    /disableNavigation\s*\?\s*\([\s\S]{0,500}<span[\s\S]{0,500}data-sauge-featured-dish/
  );
  assert.match(
    saugePages,
    /disableNavigation\s*\?\s*\([\s\S]{0,500}<span[\s\S]{0,500}data-sauge-dish-row/
  );
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
  assert.match(section, /data-menu-slug/);
  assert.match(section, /data-dish-slug/);
  assert.match(section, /data-dish-id/);
  assert.match(section, /data-image-source/);
  assert.doesNotMatch(section, /fallbackSrc=\{experience\.image\}/);
});

test("landing comparison projects complete available menu data without arbitrary slices", async () => {
  const projection = await source("lib/landing/publicMenuPreview.ts");
  const activeRenderer = await source(
    "components/landing/comparison/LandingActiveMenuPreview.tsx"
  );
  const menuUiProjection = await source(
    "lib/landing/landingMenuUiPreview.ts"
  );

  assert.match(projection, /buildFullPdfMenuData/);
  assert.match(projection, /menu\.dishes\.filter\(\(dish\) => dish\.available\)/);
  assert.doesNotMatch(projection, /categories\.slice\(/);
  assert.doesNotMatch(projection, /currentDishes\.slice\(/);
  assert.doesNotMatch(
    projection,
    /categoryDishes\([^)]*\)[\s\S]{0,80}\.slice\(/
  );
  assert.match(menuUiProjection, /menu\.dishes\.map/);
  assert.match(activeRenderer, /data-comparison-scroll-root="digital"/);
});

test("landing preview payload is sanitized and excludes immersive asset fields", async () => {
  const data = await source("lib/landing/menuExperiences.ts");
  const menuUiProjection = await source(
    "lib/landing/landingMenuUiPreview.ts"
  );
  const activeRenderer = await source(
    "components/landing/comparison/LandingActiveMenuPreview.tsx"
  );
  const serializedProjection =
    menuUiProjection.split("export function inflateLandingMenuUiMenu")[0];

  assert.match(data, /comparison:\s*PdfComparePreviewData/);
  assert.doesNotMatch(data, /type LandingPreviewBase[\s\S]{0,300}menu:\s*PublicMenu/);
  assert.match(data, /menuUi:\s*LandingMenuUiPreview/);
  assert.doesNotMatch(serializedProjection, /model3dUrl|usdzUrl|has3d|hasAr/);
  assert.doesNotMatch(menuUiProjection, /as PublicMenu/);
  assert.doesNotMatch(activeRenderer, /PageFlip|model-viewer|\.glb|\.usdz/i);
});

test("public dish images report loading only until the real image load event", async () => {
  const image = await source("components/public-menu/PublicDishImage.tsx");

  assert.match(image, /data-image-state=\{imageState\}/);
  assert.match(image, /onLoad=\{\(\) => setLoadedSource\(currentSrc\)\}/);
  assert.match(image, /"loading"/);
  assert.match(image, /"fallback"/);
  assert.match(image, /data-image-state="unavailable"/);
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
