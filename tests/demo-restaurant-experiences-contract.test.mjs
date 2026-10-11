import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("demo videos retain their decoded frame while temporarily buffering", async () => {
  const video = await source("components/vistaire-preview/DemoWalkthroughVideo.tsx");

  assert.match(video, /onLoadedData=\{\(\) => setDecoded\(true\)\}/);
  assert.match(video, /onPlaying=\{\(\) => setDecoded\(true\)\}/);
  assert.match(video, /onError=\{\(\) => setDecoded\(false\)\}/);
  assert.doesNotMatch(video, /onWaiting=\{\(\) => setDecoded\(false\)\}/);
});

test("French and English discovery share real public links and the same restaurant design", async () => {
  const [discovery, demo, demoLayout, english, landing] = await Promise.all([
    source("components/vistaire-preview/RestaurantExperiences.tsx"),
    source("app/(fr)/demo/page.tsx"),
    source("app/(fr)/demo/layout.tsx"),
    source("app/(en)/en/vistaire-menu/page.tsx"),
    source("components/landing/VistaireLanding.tsx")
  ]);

  assert.match(demo, /<RestaurantExperiences currentPath=\{canonicalPath\} locale="fr"/);
  assert.match(english, /<RestaurantExperiences currentPath=\{canonicalPath\} locale="en"/);
  assert.match(discovery, /getLandingExperiences\(locale\)/);
  assert.match(discovery, /href=\{experience\.publicMenuHref\}/);
  assert.match(discovery, /id="carte"/);
  assert.match(discovery, /DemoWalkthroughVideo/);
  for (const route of [demo, english, discovery]) {
    assert.doesNotMatch(route, /"use client"|DemoPhoneShowcase|ActiveRestaurantMenuPreview|RestaurantExperienceTabs|DishModelViewer/);
  }
  assert.doesNotMatch(demoLayout, /SmoothScrollProvider|Maison Élyse/);
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
