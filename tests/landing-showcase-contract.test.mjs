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
  assert.match(media, /preload="metadata"/);
  assert.doesNotMatch(media, /<button/);
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
  assert.match(data, /resolvePublicMenuStableRenderContext/);
  assert.match(data, /resolvePublicMenuExchangeRates/);
  assert.match(data, /buildPublicDishPath/);
  assert.doesNotMatch(
    data,
    /publicMenuHref[\s\S]{0,120}["']\/demo(?:[?"']|$)/
  );
  assert.match(experienceSection, /next\/image/);
  assert.match(experienceSection, /LandingPublicMenuLink/);
  assert.match(experienceSection, /showArrow=\{false\}/);
  assert.match(experienceSection, /styles\.linkArrow/);
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
  assert.match(publicMenuLink, /getLandingCopy\(locale\)\.experiences\.newTabLabel/);
  assert.match(publicMenuLink, /styles\.srOnly/);
  assert.doesNotMatch(publicMenuLink, /S(?:Ã|â).*nouvel onglet/);

  assert.equal((hero.match(/<LandingPublicMenuLink/g) ?? []).length, 2);
  assert.equal((hero.match(/href=\{maisonHref\}/g) ?? []).length, 1);
  assert.equal((hero.match(/href=\{saugeHref\}/g) ?? []).length, 1);
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

test("server landing comparison copy stays serializable across the client boundary", async () => {
  const landingCopy = await source("lib/landing/landingCopy.ts");
  const section = await source("components/landing/LandingComparisonSection.tsx");

  assert.match(section, /<LandingComparison copy=\{copy\}/);
  assert.doesNotMatch(
    landingCopy,
    /(?:pdfRegionLabel|digitalRegionLabel|dishPhotoAlt|categoryPhotoAlt|categoryAlt):\s*\([^)]*\)\s*=>/
  );
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
  assert.match(maisonPreview, /displayMode = "comparison-preview"/);
  assert.match(maisonPreview, /displayMode=\{displayMode\}/);
  assert.match(trouvablePreview, /TrouvablePremiumMenuExperience/);
  assert.match(trouvablePreview, /displayMode = "comparison-preview"/);
  assert.match(trouvablePreview, /displayMode=\{displayMode\}/);
  assert.match(saugePreview, /SaugeNoireMenuPages/);
  assert.match(saugePreview, /displayMode = "comparison-preview"/);
  assert.match(saugePreview, /displayMode=\{displayMode\}/);
  assert.doesNotMatch(saugePreview, /SaugeNoireBookMenu/);
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
    source("app/(fr)/menu/[slug]/page.tsx"),
    source("app/(fr)/menu/[slug]/trouvableTypography.ts")
  ]);

  assert.doesNotMatch(typography, /next\/font\/(?:google|local)/);
  assert.match(
    typography,
    /export const trouvableTypographyClassName:\s*string\s*=\s*"";/
  );
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
    /locale !== context\.publicLocale[\s\S]{0,160}projectLandingMenuUiMenu\(menu\)/
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

test("landing stable data and the public route share the official resolver facade", async () => {
  const route = await source("app/(fr)/menu/[slug]/page.tsx");
  const previewRoute = await source(
    "app/api/public/landing-menu-preview/[experienceId]/route.ts"
  );
  const landingData = await source("lib/landing/menuExperiences.ts");
  const landingFacade = await source("lib/landing/publicLandingMenuData.ts");
  const resolver = await source("lib/menu/publicMenuRenderContext.ts");

  assert.match(route, /resolvePublicMenuRenderContext/);
  assert.match(landingData, /resolvePublicMenuStableRenderContext/);
  assert.match(landingData, /resolvePublicMenuExchangeRates/);
  assert.match(landingFacade, /resolvePublicMenuStableRenderContextDelegate/);
  assert.match(landingFacade, /resolvePublicMenuExchangeRatesDelegate/);
  assert.deepEqual(
    [
      ...new Set(
        [...landingFacade.matchAll(/from\s+["']([^"']+)["']/g)].map(
          (match) => match[1]
        )
      )
    ],
    ["@/lib/menu/publicMenuRenderContext"]
  );
  assert.match(previewRoute, /isLandingExperienceId/);
  assert.match(previewRoute, /value === "fr" \|\| value === "en"/);
  assert.doesNotMatch(previewRoute, /import\s*\(\s*[`'"].*\$\{/);
  assert.match(resolver, /resolvePublicMenuExperience/);
  assert.match(resolver, /getPublishedMenuUiConfigForRestaurant/);
  assert.match(resolver, /getExchangeRates/);
});

test("landing serializes only the default renderer and lazy-loads inactive restaurants", async () => {
  const comparison = await source(
    "components/landing/comparison/LandingComparison.tsx"
  );
  const demo = await source(
    "components/vistaire-preview/DemoPhoneShowcase.tsx"
  );
  const landingData = await source("lib/landing/menuExperiences.ts");

  assert.equal(
    (landingData.match(/renderPayload:\s*landingRenderPayload\s*\(/g) ?? []).length,
    0
  );
  assert.match(
    landingData,
    /renderPayload:\s*experience\.id === "maison-elyse"\s*\?\s*stablePayload\s*:\s*null/
  );
  for (const client of [comparison, demo]) {
    assert.match(
      client,
      /\/api\/public\/landing-menu-preview\/\$\{activeExperience\.id\}/
    );
    assert.match(client, /AbortController/);
    assert.match(client, /controller\.signal\.aborted/);
    assert.doesNotMatch(client, /instanceof DOMException/);
    assert.match(client, /previewPayloads/);
    assert.match(client, /payloadMatchesExperience/);
  }
  assert.doesNotMatch(comparison, /display:\s*none/);
});

test("Next landing caches isolate French and English payloads structurally", async () => {
  const landingData = await source("lib/landing/menuExperiences.ts");

  assert.match(landingData, /landingExperienceCacheKeyParts/);
  assert.match(landingData, /landingPayloadCacheKeyParts/);
  assert.match(landingData, /landingCacheEpoch/);
  assert.match(landingData, /LANDING_DATA_CACHE_SECONDS/);
  assert.match(landingData, /readExperience[\s\S]*version:\s*"v12"/);
  assert.match(landingData, /readPayload[\s\S]*version:\s*"v10"/);
  assert.match(landingData, /restaurantKey:\s*experience\.menuSlug/);
  assert.match(landingData, /experienceId:\s*experience\.id/);
  assert.match(landingData, /experienceId,\s*locale,\s*version:\s*"v10"/);
  assert.doesNotMatch(landingData, /landing-menu-experiences-(?:fr|en)-v11/);
  assert.doesNotMatch(landingData, /landing-menu-preview-payload-(?:fr|en)-v9/);
  assert.doesNotMatch(landingData, /\{\s*revalidate:\s*60\s*\}/);
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
  assert.match(section, /lang=\{LOCALE_LANGUAGE_TAG\[locale\]\}/);
  assert.doesNotMatch(section, /fallbackSrc=\{experience\.image\}/);
});

test("landing fallback cards keep the real dish photos and localized descriptions", async () => {
  const data = await source("lib/landing/menuExperiences.ts");

  for (const photoId of [
    "fd64dc12-8bd2-4669-be63-51cf0d50b839",
    "7a312411-975a-4a12-9e74-d435a7c83406",
    "cb7121a7-a8df-4650-8453-df83135defeb"
  ]) {
    assert.match(
      data,
      new RegExp(`/api/public/menu-dishes/${photoId}/photo`)
    );
  }

  for (const copy of [
    "Delicate, tender ravioli",
    "Basil pesto pasta",
    "Ash-roasted beetroot"
  ]) {
    assert.match(data, new RegExp(copy));
  }

  assert.doesNotMatch(
    data,
    /Open the current dish page|Ouvrez la fiche actuelle/
  );
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
  assert.match(data, /type StableLandingMenuUiPreview = Omit<[\s\S]{0,100}"exchangeRates"/);
  assert.match(data, /menuUi:\s*StableLandingMenuUiPreview/);
  assert.match(data, /projectLandingMenuQuery/);
  assert.match(data, /exchangeRates = await resolveRates/);
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
  assert.match(
    data,
    /LANDING_FALLBACK_DISH_PHOTOS/,
    "landing fallbacks must use the verified canonical photo routes"
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
