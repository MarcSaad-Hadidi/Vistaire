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
