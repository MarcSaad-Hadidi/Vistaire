import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("demo pages share the three restaurant experiences and preserve the generic route contract", async () => {
  const [showcase, demo, english, landing] = await Promise.all([
    source("components/vistaire-preview/DemoPhoneShowcase.tsx"),
    source("app/(fr)/demo/page.tsx"),
    source("app/(en)/en/vistaire-menu/page.tsx"),
    source("components/landing/VistaireLanding.tsx")
  ]);

  assert.match(showcase, /RestaurantExperienceTabs/);
  assert.match(showcase, /ActiveRestaurantMenuPreview/);
  assert.match(showcase, /displayMode=\"phone-preview\"/);
  for (const id of ["maison-elyse", "trouvable", "sauge-noire"]) {
    assert.match(showcase, new RegExp(`"${id}"`));
  }
  assert.match(showcase, /experienceFromQuery/);
  assert.match(showcase, /router\.replace/);
  assert.match(showcase, /params\.delete\("experience"\)/);
  assert.match(showcase, /window\.location\.hash/);
  assert.match(showcase, /scrollTop = 0/);
  assert.match(demo, /getLandingExperiences/);
  assert.match(english, /getLandingExperiences/);
  assert.match(landing, /<LandingHero[\s\S]*<LandingComparisonSection[\s\S]*<LandingValueSection[\s\S]*<LandingExperienceSection/);
});

test("landing stable UI readiness accepts only confirmed public built-in fallbacks or published configs", async () => {
  const { resolveStablePublicMenuUiConfigReadiness } = await import(
    "../lib/menu/publicMenuStableUiConfig.ts"
  );

  const canonicalBuiltIn = {
    persisted: false,
    dataSource: "default",
    status: "draft"
  };
  const persistedDraft = {
    persisted: true,
    dataSource: "supabase",
    status: "draft"
  };
  const published = {
    persisted: true,
    dataSource: "supabase",
    status: "published"
  };

  for (const experienceKind of ["maison-elyse", "trouvable"]) {
    assert.deepEqual(
      resolveStablePublicMenuUiConfigReadiness({
        configRecord: canonicalBuiltIn,
        experienceKind,
        readState: "not-found"
      }),
      { ready: true, source: "canonical-built-in" }
    );
    assert.deepEqual(
      resolveStablePublicMenuUiConfigReadiness({
        configRecord: canonicalBuiltIn,
        experienceKind,
        readState: "unavailable"
      }),
      { ready: false, source: "unavailable" }
    );
    assert.deepEqual(
      resolveStablePublicMenuUiConfigReadiness({
        configRecord: persistedDraft,
        experienceKind,
        readState: "not-found"
      }),
      { ready: false, source: "unavailable" }
    );
  }

  assert.deepEqual(
    resolveStablePublicMenuUiConfigReadiness({
      configRecord: canonicalBuiltIn,
      experienceKind: "unique-registered",
      readState: "not-found"
    }),
    { ready: false, source: "unavailable" }
  );
  assert.deepEqual(
    resolveStablePublicMenuUiConfigReadiness({
      configRecord: published,
      experienceKind: "unique-registered",
      readState: "published"
    }),
    { ready: true, source: "published" }
  );
  assert.deepEqual(
    resolveStablePublicMenuUiConfigReadiness({
      configRecord: published,
      experienceKind: "unique-registered",
      readState: "unavailable"
    }),
    { ready: false, source: "unavailable" }
  );
});

test("landing stable render context derives the legacy readiness gate from a confirmed public UI config read", async () => {
  const [renderContext, landingData] = await Promise.all([
    source("lib/menu/publicMenuRenderContext.ts"),
    source("lib/landing/menuExperiences.ts")
  ]);

  assert.match(renderContext, /resolveStablePublicMenuUiConfigReadiness/);
  assert.match(renderContext, /getPublishedMenuUiConfigForRestaurantWithReadState/);
  assert.match(renderContext, /readState:\s*configLoad\.readState/);
  assert.match(
    renderContext,
    /publishedUiConfig:\s*stablePublicUiConfig\.ready/
  );
  assert.match(landingData, /stableCacheReadiness\.publishedUiConfig/);
  assert.match(
    renderContext,
    /eq\(["']status["'],\s*["']published["']\)/
  );
  assert.match(renderContext, /readState:\s*["']not-found["']/);
  assert.match(renderContext, /readState:\s*["']unavailable["']/);
});

test("Vistaire UI production-readiness contracts stay explicit across public and owner surfaces", async () => {
  const [
    hero,
    categoryTabs,
    searchBar,
    filterBar,
    detailsSheet,
    detailsSheetStyles,
    photoUploader,
    qrTargetSwitcher,
    pricingPreview
  ] = await Promise.all([
    source("components/landing/LandingHeroMedia.tsx"),
    source("components/menu/CategoryTabs.tsx"),
    source("components/menu/MenuSearchBar.tsx"),
    source("components/menu/MenuFilterBar.tsx"),
    source("components/menu/PremiumDishDetailsSheet.tsx"),
    source("components/menu/PremiumDishDetailsSheet.module.css"),
    source("components/owner/OwnerDishPhotoUploader.tsx"),
    source("components/owner/OwnerRestaurantQrTargetSwitcher.tsx"),
    source("components/vistaire-preview/VistairePricingPreview.tsx")
  ]);

  assert.match(hero, /autoPlay/);
  assert.match(hero, /loop/);
  assert.match(hero, /muted/);
  assert.match(hero, /playsInline/);
  assert.match(hero, /video\.play\(\)/);
  assert.doesNotMatch(hero, /addEventListener\("scroll"/);
  assert.doesNotMatch(hero, /\.currentTime\s*=/);
  assert.doesNotMatch(hero, /syncVideoToScroll|scrollFrameRef|clamp01/);
  assert.doesNotMatch(hero, /saveData|effectiveType|prefers-reduced-motion/);

  assert.doesNotMatch(categoryTabs, /min-h-\[34px\]/);
  assert.match(categoryTabs, /min-h-11/);
  assert.match(categoryTabs, /motion-reduce:transition-none/);

  assert.doesNotMatch(searchBar, /min-h-\[42px\]/);
  assert.match(searchBar, /min-h-11/);
  assert.match(searchBar, /min-w-11/);

  assert.doesNotMatch(filterBar, /min-h-\[40px\]/);
  assert.match(filterBar, /min-h-11/);

  assert.match(detailsSheet, /data-sheet-handle/);
  assert.doesNotMatch(detailsSheetStyles, /width:\s*36px/);
  assert.doesNotMatch(detailsSheetStyles, /height:\s*36px/);

  assert.match(photoUploader, /aria-live="polite"/);
  assert.match(photoUploader, /aria-busy=\{isUploading\}/);
  assert.match(photoUploader, /aria-describedby=/);

  assert.match(qrTargetSwitcher, /role="radiogroup"/);
  assert.match(qrTargetSwitcher, /role="radio"/);
  assert.match(qrTargetSwitcher, /aria-checked=/);

  assert.match(pricingPreview, /Données de démonstration/);
  assert.match(pricingPreview, /Demo data/);
  assert.doesNotMatch(pricingPreview, /Aperçu du vrai dashboard Vistaire/);
});
