import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const componentPath = "components/menu/PublicMenuRenderer.tsx";
const cssPath = "components/menu/PublicMenuRenderer.module.css";

test("public menu page delegates to the shared configurable renderer", async () => {
  const [source, renderContext] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile("lib/menu/publicMenuRenderContext.ts", "utf8")
  ]);

  assert.match(source, /PublicMenuRenderer/);
  assert.match(source, /resolvePublicMenuRenderContext/);
  assert.match(renderContext, /getPublishedMenuUiConfigForRestaurant/);
});

test("shared menu renderer includes welcome, category, dish, and detail states", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /"use client"/);
  assert.match(source, /welcomeTitle/);
  assert.match(source, /welcomeSubtitle/);
  assert.match(source, /Retour aux categories/);
  assert.match(source, /ALL_TAB_ID/);
  assert.match(source, /setActiveTab\(ALL_TAB_ID\)/);
  assert.match(source, /Tout le menu/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-selected/);
  assert.match(source, /getVisiblePublicMenuCategories/);
  assert.match(source, /selectedDish/);
  assert.match(source, /aria-live="polite"/);
});

test("shared menu renderer styles keep fresh palette, premium palette, and reduced motion guard", async () => {
  const source = await readFile(cssPath, "utf8");

  for (const color of [
    "#FFFDF6",
    "#17324D",
    "#F6C453",
    "#E85D3F",
    "#2FA866",
    "#0D0805",
    "#E8CF9B"
  ]) {
    assert.match(source, new RegExp(color, "i"));
  }
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /390px/);
});

