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
  const [renderContext, landingData, configStore] = await Promise.all([
    source("lib/menu/publicMenuRenderContext.ts"),
    source("lib/landing/menuExperiences.ts"),
    source("lib/owner/menuUiConfigStore.ts")
  ]);

  assert.match(renderContext, /resolveStablePublicMenuUiConfigReadiness/);
  assert.match(renderContext, /loadPublishedMenuUiConfigForRestaurant/);
  assert.match(renderContext, /readState:\s*configLoad\.readState/);
  assert.match(
    renderContext,
    /publishedUiConfig:\s*stablePublicUiConfig\.ready/
  );
  assert.match(landingData, /stableCacheReadiness\.publishedUiConfig/);
  assert.match(
    configStore,
    /eq\(["']status["'],\s*["']published["']\)/
  );
  assert.match(configStore, /readState:\s*["']not-found["']/);
  assert.match(configStore, /readState:\s*["']unavailable["']/);
});
