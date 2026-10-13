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

test("dashboard presentation uses an accessible recorded walkthrough without changing pricing or menu playback", async () => {
  const [presentation, player, pricing, layout, walkthrough] = await Promise.all([
    source("components/vistaire-preview/VistaireRestaurateurDashboardPreview.tsx"),
    source("components/vistaire-preview/DemoWalkthroughVideo.tsx"),
    source("components/vistaire-preview/VistairePricingPreview.tsx"),
    source("components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css"),
    source("components/vistaire-preview/DashboardWalkthrough.tsx")
  ]);
  assert.doesNotMatch(presentation, /RestaurateurDashboardDemo|AdminStudio/);
  assert.match(presentation, /DashboardWalkthrough/);
  assert.match(walkthrough, /\sautoPlay\s/);
  assert.doesNotMatch(walkthrough, /autoPlay=\{false\}/);
  assert.doesNotMatch(walkthrough, /playLabel|figcaption|<details|\scontrols(?:\s|=)/);
  assert.match(walkthrough, /className=\{styles\.dashboardScreen\} inert/);
  assert.match(player, /controls = false/);
  assert.match(player, /autoPlay = true/);
  assert.match(player, /controls=\{controls\}/);
  assert.match(player, /video\.autoplay = autoPlay && !controls && !motion\.matches/);
  assert.doesNotMatch(player, /autoPlay=\{autoPlay\}/);
  assert.match(player, /autoPlay && !motion\.matches && !userPaused/);
  assert.match(player, /document\.hidden/);
  assert.match(player, /visibilitychange/);
  assert.match(player, /data-video-play-fallback/);
  assert.match(player, /playLabel/);
  assert.match(player, /addEventListener\("pause",/);
  assert.ok(presentation.indexOf("<DashboardWalkthrough") < presentation.indexOf("copy.lead"));
  assert.match(layout, /\.dashboardFilm\s*\{[^}]*100svh[^}]*margin:\s*0 auto/s);
  assert.match(player, /rootMargin: controls \? "0px" : "200px 0px"/);
  assert.match(player, /video\.pause\(\)/);
  assert.match(pricing, /RestaurateurDashboardDemo/);
});

