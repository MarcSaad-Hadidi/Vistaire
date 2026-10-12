import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
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
  assert.match(discovery, /ExperienceFilms/);
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
  assert.match(walkthrough, /playLabel=\{text\.playLabel\}/);
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


// Browser launch is unavailable here; exercise the real coordinator against the
// media-event and intersection boundaries. Browser playback/layout stay in E2E.
async function filmHarness() {
  const path = "components/vistaire-preview/ExperienceFilms.tsx";
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), "the page needs an exclusive film coordinator");
  class Film extends EventTarget {
    paused = true;
    hidden = false;
    isConnected = true;
    dataset = { experienceSrc: "/videos/demo/test.mp4" };
    attributes = new Map();
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    playError = null;
    playSettlement = null;
    playCalls = 0;
    play() {
      this.playCalls += 1;
      if (this.playError) return Promise.reject(this.playError);
      this.paused = false;
      this.dispatchEvent(new Event("play"));
      return this.playSettlement ?? Promise.resolve();
    }
    pause() {
      if (this.paused) return;
      this.paused = true;
      queueMicrotask(() => this.dispatchEvent(new Event("pause")));
    }
    load() {}
  }
  const films = [new Film(), new Film(), new Film()];
  const document = Object.assign(new EventTarget(), { hidden: false });
  const motion = Object.assign(new EventTarget(), { matches: false });
  const window = Object.assign(new EventTarget(), { matchMedia: () => motion });
  let observe;
  let disconnected = false;
  class IntersectionObserver {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const exports = {};
  vm.runInNewContext(ts.transpileModule(await source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText, {
    exports, require: () => ({}), document, window, IntersectionObserver
  });
  const dispose = exports.coordinateExperienceFilms({ querySelectorAll: () => films });
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  return {
    films, document, motion, window, dispose, flush,
    get disconnected() { return disconnected; },
    intersect: async (ratios) => {
      observe(ratios.map((ratio, i) => ({ target: films[i], isIntersecting: ratio > 0, intersectionRatio: ratio })));
      await flush();
    }
  };
}

test("experience films select only one visible clip and preserve a native manual pause", async () => {
  const h = await filmHarness();
  await h.intersect([0.8, 0.6, 0]);
  assert.deepEqual(h.films.map((film) => film.paused), [false, true, true]);
  assert.equal(h.films[2].getAttribute("src"), null, "unseen clips must not load");
  await h.intersect([0.2, 0.8, 0]);
  assert.deepEqual(h.films.map((film) => film.paused), [true, false, true]);
  h.films[1].pause();
  await h.flush();
  await h.intersect([0, 0, 0]);
  await h.intersect([0, 0.9, 0]);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event("visibilitychange"));
  h.document.hidden = false;
  h.document.dispatchEvent(new Event("visibilitychange"));
  await h.flush();
  assert.ok(h.films.every((film) => film.paused), "scroll and tab return must not undo the user's pause");
  await h.films[1].play();
  await h.flush();
  assert.equal(h.films[1].paused, false, "native play can resume a paused clip");
  h.dispose();
});

test("experience films respect reduced motion, tab/offscreen pause and disposal", async () => {
  const h = await filmHarness();
  h.motion.matches = true;
  await h.intersect([0.9, 0, 0]);
  assert.ok(h.films.every((film) => film.paused));
  assert.ok(h.films[0].getAttribute("src"), "visible clips can be started with native controls in reduced motion");
  await h.films[0].play();
  await h.flush();
  assert.equal(h.films[0].paused, false);
  h.document.hidden = true;
  h.document.dispatchEvent(new Event("visibilitychange"));
  await h.flush();
  assert.ok(h.films.every((film) => film.paused));
  h.document.hidden = false;
  h.document.dispatchEvent(new Event("visibilitychange"));
  await h.flush();
  assert.equal(h.films[0].paused, true, "reduced motion does not automatically resume");
  h.motion.matches = false;
  h.motion.dispatchEvent(new Event("change"));
  await h.flush();
  assert.equal(h.films[0].paused, false);
  await h.intersect([0, 0, 0]);
  assert.ok(h.films.every((film) => film.paused));
  await h.films[2].play();
  await h.flush();
  assert.equal(h.films[2].paused, true, "late play events cannot start hidden media");
  await h.intersect([0.9, 0, 0]);
  h.window.dispatchEvent(new Event("pagehide"));
  await h.flush();
  assert.ok(h.films.every((film) => film.paused && !film.getAttribute("src")));
  h.window.dispatchEvent(new Event("pageshow"));
  await h.intersect([0.9, 0, 0]);
  assert.equal(h.films[0].paused, false, "back-forward restore can resume visible media");
  h.films[0].pause();
  await h.flush();
  h.films[2].playError = Object.assign(new Error("interrupted"), { name: "AbortError" });
  await h.intersect([0, 0, 0.9]);
  h.films[2].playError = null;
  await h.intersect([0, 0, 0.8]);
  assert.equal(h.films[2].paused, false, "an interrupted play request must not permanently block a clip");
  h.films[2].dispatchEvent(new Event("error"));
  await h.flush();
  assert.equal(h.films[2].hidden, true, "failed video yields to its static poster");
  assert.equal(h.films[2].paused, true);
  await h.intersect([0, 0, 0.9]);
  assert.equal(h.films[2].paused, true, "failed media must not restart on scroll");
  h.dispose();
  await h.flush();
  assert.equal(h.disconnected, true);
  assert.ok(h.films.every((film) => film.paused && !film.getAttribute("src")));
  h.motion.dispatchEvent(new Event("change"));
  await h.intersect([0.9, 0, 0]);
  assert.ok(h.films.every((film) => film.paused), "disposed callbacks cannot restart playback");
});


test("experience films re-evaluate one eligible update after a delayed play abort without retrying in a loop", async () => {
  const h = await filmHarness();
  const video = h.films[0];
  let rejectFirstPlay;
  video.playSettlement = new Promise((_, reject) => { rejectFirstPlay = reject; });
  await h.intersect([0.9, 0, 0]);
  assert.equal(video.playCalls, 1);
  await h.intersect([0, 0, 0]);
  await h.intersect([0.9, 0, 0]);
  assert.equal(video.paused, true);
  assert.equal(video.playCalls, 1, "the pending request must not be duplicated");
  video.playSettlement = null;
  rejectFirstPlay(Object.assign(new Error("interrupted"), { name: "AbortError" }));
  await h.flush();
  assert.equal(video.playCalls, 2, "the latest eligible visibility update must be reconsidered after settlement");
  assert.equal(video.paused, false);

  await h.intersect([0, 0, 0]);
  video.playError = Object.assign(new Error("interrupted again"), { name: "AbortError" });
  await h.intersect([0.9, 0, 0]);
  await h.flush();
  assert.equal(video.playCalls, 3, "an abort without a newer eligible update must not create a retry loop");
  assert.equal(video.paused, true);
  h.dispose();
});
