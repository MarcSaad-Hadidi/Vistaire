import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

async function themeModule(storage) {
  const source = await readFile("lib/publicTheme.ts", "utf8");
  const attributes = {};
  const events = [];
  const context = { exports: {}, document: { documentElement: {
    setAttribute: (key, value) => { attributes[key] = value; },
    getAttribute: (key) => attributes[key],
    removeAttribute: (key) => { delete attributes[key]; },
  } }, localStorage: storage, window: {
    dispatchEvent(event) { events.push(event.type); },
    matchMedia: () => ({ matches: false }),
  }, Event };
  vm.runInNewContext(stripTypeScriptTypes(source).replaceAll("export ", "") + ";Object.assign(exports, { PUBLIC_THEME_BOOTSTRAP, getPublicTheme, setPublicTheme, togglePublicTheme: typeof togglePublicTheme === 'function' ? togglePublicTheme : undefined });", context);
  return { ...context, attributes, events };
}

test("prepaint public theme restores only a valid saved theme and defaults to dark", async () => {
  for (const [stored, expected] of [["light", "light"], ["dark", "dark"], ["invalid", "dark"], [null, "dark"]]) {
    const context = await themeModule({ getItem: () => stored });
    vm.runInNewContext(context.exports.PUBLIC_THEME_BOOTSTRAP, context);
    assert.equal(context.attributes["data-vistaire-theme"], expected);
    assert.equal(context.exports.getPublicTheme(), expected);
  }
});

test("blocked storage never breaks prepaint or a user's immediate theme choice", async () => {
  const context = await themeModule({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
  vm.runInNewContext(context.exports.PUBLIC_THEME_BOOTSTRAP, context);
  assert.equal(context.attributes["data-vistaire-theme"], "dark");
  context.exports.setPublicTheme("light");
  assert.equal(context.attributes["data-vistaire-theme"], "light");
});

test("BeUI blinds changes the existing public theme once and guards rapid activations", async () => {
  const saved = [];
  const context = await themeModule({ setItem: (...args) => saved.push(args) });
  assert.equal(typeof context.exports.togglePublicTheme, "function");
  let update;
  const finished = Promise.withResolvers();
  let starts = 0;
  context.document.startViewTransition = (callback) => {
    starts += 1;
    update = callback;
    return { ready: Promise.resolve(), updateCallbackDone: Promise.resolve(), finished: finished.promise };
  };
  const pending = context.exports.togglePublicTheme();
  assert.equal(context.attributes["data-vistaire-theme-transition"], "blinds");
  await context.exports.togglePublicTheme();
  assert.equal(starts, 1);
  update();
  assert.equal(context.exports.getPublicTheme(), "light");
  assert.deepEqual(saved, [["vistaire-public-theme", "light"]]);
  assert.deepEqual(context.events, ["vistaire-public-theme-change"]);
  finished.resolve();
  await pending;
  assert.equal(context.attributes["data-vistaire-theme-transition"], undefined);
  const second = context.exports.togglePublicTheme();
  update();
  await second;
  assert.equal(context.exports.getPublicTheme(), "dark");
  assert.equal(starts, 2);
});

test("theme animation degrades to an immediate choice and cleans up failed transitions", async () => {
  for (const scenario of ["unsupported", "reduced", "throw", "reject"]) {
    const context = await themeModule({ setItem() { throw new Error("blocked"); } });
    assert.equal(typeof context.exports.togglePublicTheme, "function");
    context.window.matchMedia = () => ({ matches: scenario === "reduced" });
    let starts = 0;
    if (scenario !== "unsupported") context.document.startViewTransition = () => {
      starts += 1;
      if (scenario === "throw") throw new Error("Cannot capture");
      return {
        ready: Promise.reject(new Error("Skipped")),
        updateCallbackDone: Promise.reject(new Error("Failed update")),
        finished: Promise.reject(new Error("Failed update")),
      };
    };
    const pending = context.exports.togglePublicTheme();
    if (scenario !== "reject") assert.equal(context.exports.getPublicTheme(), "light");
    await pending;
    assert.equal(starts, scenario === "unsupported" || scenario === "reduced" ? 0 : 1, scenario);
    assert.equal(context.exports.getPublicTheme(), "light", scenario);
    assert.equal(context.attributes["data-vistaire-theme-transition"], undefined, scenario);
    assert.deepEqual(context.events, ["vistaire-public-theme-change"], scenario);
    delete context.document.startViewTransition;
    await context.exports.togglePublicTheme();
    assert.equal(context.exports.getPublicTheme(), "dark", `${scenario} releases the guard`);
  }
});

test("public subpages keep the landing Menu drawer on desktop and mobile", async () => {
  const css = await readFile("components/vistaire-preview/VistairePreviewChrome.module.css", "utf8");
  const base = css.split("@media (max-width: 1100px)")[0];
  assert.match(base, /\.menuToggle\s*\{[^}]*display: flex/s);
  assert.match(base, /\.menuPanel\s*\{[^}]*position: fixed[^}]*width: min\(90vw, 440px\)/s);
  assert.match(base, /top: var\(--menu-top\)/);
  assert.match(base, /height: calc\(100dvh - var\(--menu-top\) - var\(--menu-bottom\)\)/);
  assert.match(base, /overflow-y: auto/);
  assert.match(base, /\.menuPanel\s*\{[^}]*transform: translateX\(101%\)/s);
  assert.match(base, /\.menuPanelOpen\s*\{[^}]*transform: translateX\(0\)/s);
  assert.match(base, /\.menuPageLinks\s*\{[^}]*grid-template-columns: 1fr 1fr/s);
  const navigation = await readFile("components/vistaire-preview/PublicNavigation.tsx", "utf8");
  assert.doesNotMatch(navigation, /<details|<summary/);
  assert.match(navigation, /aria-expanded=\{menuOpen\}/);
  assert.match(navigation, /inert=\{!menuOpen/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /event\.key === "Tab"/);
  assert.match(navigation, /addEventListener\("popstate", close\)/);
  assert.match(navigation, /bindPublicMenuViewport\(header\.current!, panel\.current!\)/);
  assert.match(navigation, /\[navigationOpen, setNavigationOpen\] = useState\(false\)/);
  assert.match(navigation, /inert=\{!navigationOpen/);
  assert.match(navigation, /data-public-navigation-open=\{navigationOpen\}/);
  assert.match(navigation, /<PublicNavigationTab/);
  assert.match(base, /\.previewNav\[data-public-navigation-open="false"\]\s*\{[^}]*visibility: hidden[^}]*pointer-events: none/s);
  const tab = await readFile("components/vistaire-preview/PublicNavigationTab.tsx", "utf8");
  assert.match(tab, /data-public-navigation-toggle/);
  assert.match(tab, /aria-expanded=\{expanded\}/);
  assert.match(tab, /aria-label=\{label\}/);
  assert.match(tab, /expanded \? "M6 6l12 12M6 18 18 6" : "M5 6h14M5 12h14M5 18h14"/);
  assert.doesNotMatch(tab, /<span>Navigation<\/span>/);
  const launcher = base.match(/\.navigationTab\s*\{([^}]+)\}/)?.[1];
  assert.ok(launcher);
  assert.match(launcher, /top: calc\(env\(safe-area-inset-top, 0px\) \+ 12px\)/);
  assert.match(launcher, /right: calc\(env\(safe-area-inset-right, 0px\) \+ 12px\)/);
  assert.match(launcher, /width: 44px/);
  assert.match(launcher, /height: 44px/);
  assert.match(launcher, /border-radius: 50%/);
  assert.match(launcher, /background: #000/);
  assert.match(launcher, /color: #fff/);
  const landingCss = await readFile("components/immersive/styles.css", "utf8");
  for (const [css, selector] of [[base, /\.previewNav\[data-public-navigation-open\]/], [landingCss, /\.site-header\[data-public-navigation-open\]/]]) {
    const headerRule = css.slice(css.search(selector)).match(/\{([^}]+)\}/)?.[1];
    assert.match(headerRule, /top: calc\(env\(safe-area-inset-top, 0px\) \+ 68px\)/, "the fixed header reserves a clear row beneath the launcher");
  }
  const sharedMenuRules = landingCss.split("/* Public Vistaire routes share")[1];
  assert.match(sharedMenuRules, /top: var\(--menu-top\)/);
  assert.match(sharedMenuRules, /height: calc\(100dvh - var\(--menu-top\) - var\(--menu-bottom\)\)/);
  assert.match(sharedMenuRules, /overflow-y: auto/);
  const chrome = await readFile("components/vistaire-preview/VistairePreviewChrome.tsx", "utf8");
  assert.match(chrome, /href: routes\.pdfVsDigital/);
});
