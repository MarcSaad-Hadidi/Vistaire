import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const read = (file) => readFileSync(`components/immersive/${file}`, "utf8");
const localeSource = read("locale.jsx");
const app = read("App.jsx");
const { collections } = await import("../components/immersive/content.js");
const EN = vm.runInNewContext(`(${localeSource.match(/const EN = (\{[\s\S]*?\n\});/)[1]})`);
const panel = app.match(/<div\s+role="tabpanel"\s+id="collection-panel"[\s\S]*?<\/Action>\s*<\/div>/)[0];
const renderPanel = ts.transpileModule(`function Panel({selected, collection, t, link, money}) { return (${panel}); }`, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("all four collection panels present translated use advice without prices or subscriptions", () => {
  assert.equal(collections.length, 4);
  for (const language of ["fr", "en"]) {
    const t = (text) => language === "en" ? EN[text] ?? text : text;
    for (const collection of collections) {
      assert.ok(collection.usage, `${collection.id} needs practical use advice`);
      assert.ok(EN[collection.usage], `${collection.id} needs English use advice`);
      assert.ok(EN[collection.description], `${collection.id} needs English presentation`);
      const context = { React, Action: ({ children, href }) => React.createElement("a", { href }, children), ArrowUpRight: () => null };
      vm.runInNewContext(`${renderPanel}; globalThis.Panel = Panel;`, context);
      const html = renderToStaticMarkup(React.createElement(context.Panel, {
        selected: { ...collection, description: t(collection.description), usage: t(collection.usage) },
        collection: collection.id, t, link: (path) => path, money: (value) => String(value),
      }));
      assert.ok(html.includes(t(collection.description)));
      assert.ok(html.includes(t(collection.usage)));
      assert.doesNotMatch(html, /CAD|\$|class="price"|class="monthly"|abonnement|subscription|\/ mois|\/ month/i);
      assert.match(html, /href="\/tarifs-menu-digital-restaurant"/);
      assert.match(html, new RegExp(`aria-labelledby="tab-${collection.id}"`));
    }
  }
  assert.equal(new Set(collections.map(({ usage }) => usage)).size, 4);
});

test("collection presentation keeps the actual offers and mobile reading copy", () => {
  assert.deepEqual(Array.from(collections, ({ price, extra }) => [price, extra]), [[2000, 40], [2050, 45], [2100, 55], [2200, 55]]);
  assert.match(app, /<Pricing collection=\{collection\} stateRef=\{stateRef\} \/>/);
  assert.match(app, /usage: t\(item.usage\)/);
  assert.doesNotMatch(read("styles.css"), /\.collection-details p\s*\{\s*display:\s*none/);
});
