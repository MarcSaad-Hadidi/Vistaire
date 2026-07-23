import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MENU_APPEARANCE_PRESETS,
  buildAccessibleMenuPalette,
  buildMenuUiConfigForRestaurant,
  contrastRatio,
  normalizeMenuAppearanceSelection
} from "../lib/menu/menuAppearance.ts";

test("builds a deterministic accessible palette from simple brand inputs", () => {
  const selection = normalizeMenuAppearanceSelection({
    template: "trouvable",
    presetId: "bordeaux-ivoire",
    primaryColor: "#9C3047",
    secondaryColor: "#DFB57F",
    themeMode: "dark"
  });
  const first = buildAccessibleMenuPalette(selection);
  const second = buildAccessibleMenuPalette(selection);

  assert.deepEqual(first, second);
  assert.equal(first.palette.accent, first.palette.accent.toLowerCase());
  assert.ok(contrastRatio(first.palette.text, first.palette.background) >= 4.5);
  assert.ok(contrastRatio(first.palette.text, first.palette.surface) >= 4.5);
  for (const accent of [first.palette.accent, first.palette.accent2, first.palette.accent3]) {
    assert.ok(contrastRatio(accent, first.palette.background) >= 3);
    assert.ok(contrastRatio(accent, first.palette.surface) >= 3);
  }
  assert.equal(Object.keys(first.palette).length, 11);
});

test("keeps every built-in accent readable on its generated surfaces", () => {
  for (const preset of MENU_APPEARANCE_PRESETS) {
    const palette = buildAccessibleMenuPalette(
      normalizeMenuAppearanceSelection({
        template: "trouvable",
        presetId: preset.id,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        themeMode: preset.themeMode
      })
    ).palette;

    for (const accent of [palette.accent, palette.accent2, palette.accent3]) {
      assert.ok(contrastRatio(accent, palette.background) >= 3, `${preset.id} accent/background`);
      assert.ok(contrastRatio(accent, palette.surface) >= 3, `${preset.id} accent/surface`);
    }
  }
});

test("does not mutate a preset and keeps restaurant configs isolated", () => {
  const preset = MENU_APPEARANCE_PRESETS.find((item) => item.id === "olive-beige");
  assert.ok(preset);
  const input = {
    template: "trouvable",
    presetId: preset.id,
    primaryColor: preset.primaryColor,
    secondaryColor: preset.secondaryColor,
    themeMode: preset.themeMode
  };
  const restaurantA = buildMenuUiConfigForRestaurant({
    name: "Bordeaux Table",
    slug: "bordeaux-table",
    appearance: normalizeMenuAppearanceSelection({ ...input, primaryColor: "#9c3047" })
  });
  const restaurantB = buildMenuUiConfigForRestaurant({
    name: "Olive Table",
    slug: "olive-table",
    appearance: normalizeMenuAppearanceSelection(input)
  });

  assert.notEqual(restaurantA.palette.accent, restaurantB.palette.accent);
  assert.match(restaurantA.welcomeTitle, /Bordeaux Table/);
  assert.match(restaurantB.welcomeTitle, /Olive Table/);
  assert.equal(preset.primaryColor, "#70804a");
});

test("stores the explicit template and palette in the creation payload contract", async () => {
  const source = await readFile("lib/owner/restaurantCreation.ts", "utf8");
  assert.match(source, /buildMenuUiConfigForRestaurant/);
  assert.match(source, /menuAppearance/);
  assert.match(source, /uiConfigPersisted/);
});
