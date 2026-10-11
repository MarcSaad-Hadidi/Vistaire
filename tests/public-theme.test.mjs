import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

async function themeModule(storage) {
  const source = await readFile("lib/publicTheme.ts", "utf8");
  const attributes = {};
  const context = { exports: {}, document: { documentElement: {
    setAttribute: (key, value) => { attributes[key] = value; },
    getAttribute: (key) => attributes[key],
  } }, localStorage: storage, window: { dispatchEvent() {} }, Event };
  vm.runInNewContext(stripTypeScriptTypes(source).replaceAll("export ", "") + ";Object.assign(exports, { PUBLIC_THEME_BOOTSTRAP, getPublicTheme, setPublicTheme });", context);
  return { ...context, attributes };
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
