import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const pagePath = "app/menu/[slug]/page.tsx";
const componentPath = "components/menu/PublicMenuExperience.tsx";
const cssPath = "components/menu/PublicMenuExperience.module.css";

test("public menu page delegates Resto Marc to the Fresh Homemade experience", async () => {
  const source = await readFile(pagePath, "utf8");

  assert.match(source, /PublicMenuExperience/);
  assert.match(source, /isFreshHomemadeMenu/);
});

test("Fresh Homemade experience includes welcome, category, dish, and return states", async () => {
  const source = await readFile(componentPath, "utf8");

  assert.match(source, /"use client"/);
  assert.match(source, /Bienvenue chez Resto Marc/);
  assert.match(source, /Cuisine maison fraîche et généreuse/);
  assert.match(source, /Retour aux catégories/);
  assert.match(source, /ALL_TAB_ID/);
  assert.match(source, /setActiveTab\(ALL_TAB_ID\)/);
  assert.match(source, /Tout le menu/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /aria-selected/);
  assert.match(source, /Entrées/);
  assert.match(source, /href=\{`\/menu\/\$\{menu\.slug\}\/dishes\/\$\{dish\.slug\}`\}/);
  assert.match(source, /bol de riz au poulet/i);
  assert.match(source, /aria-live="polite"/);
});

test("Fresh Homemade styles use the required palette and reduced motion guard", async () => {
  const source = await readFile(cssPath, "utf8");

  for (const color of [
    "#FFFDF6",
    "#17324D",
    "#F6C453",
    "#E85D3F",
    "#2FA866"
  ]) {
    assert.match(source, new RegExp(color, "i"));
  }
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /390px/);
  assert.doesNotMatch(source, /#0d0805|#e8cf9b/i);
});
