import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const localizationPath = "lib/menu/maisonElyseLocalization.ts";
const menuPath = "components/menu/MaisonElyseQrMenu.tsx";

test("Maison Elyse language options use configured ready locales only", async () => {
  const [localization, menu] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile(menuPath, "utf8")
  ]);

  assert.match(localization, /getMaisonElyseLanguageOptions/);
  assert.match(localization, /status === "up_to_date"/);
  assert.match(localization, /status === "source"/);
  assert.match(menu, /getMaisonElyseLanguageOptions\(/);
  assert.doesNotMatch(menu, /const LANGUAGE_OPTIONS\s*=/);
});

test("Maison Elyse UI copy resolves exact/base/pack sources with diagnostics", async () => {
  const [source, resolverSource] = await Promise.all([
    readFile(localizationPath, "utf8"),
    readFile("components/menu/trouvableMenuControls.ts", "utf8")
  ]);

  assert.match(source, /resolveTrouvableCopy/);
  assert.match(resolverSource, /requestedLocale/);
  assert.match(resolverSource, /dynamicSource/);
  assert.match(resolverSource, /usedNeutralFallback/);
});

test("Arabic text direction is scoped to text zones, not the menu root", async () => {
  const source = await readFile(menuPath, "utf8");

  assert.match(source, /data-text-direction=\{textDirection\}/);
  assert.match(source, /dir="ltr"/);
  assert.match(source, /dir=\{textDirection\}/);
});
