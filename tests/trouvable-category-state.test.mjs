import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories
} from "../lib/menu/publicMenuCore.ts";

function dish(id, categoryId, category) {
  return {
    id,
    slug: id,
    name: id,
    description: "",
    categoryId,
    category,
    priceLabel: "10 $",
    priceCents: 1000,
    priceCurrency: "CAD",
    baseCurrency: "CAD",
    displayPriceMode: "auto",
    imageUrl: "",
    thumbnailUrl: "",
    hasPhoto: false,
    photoStatus: "missing",
    hasImmersive: false,
    has3d: false,
    hasAr: false,
    hasIosAr: false,
    hasAndroidAr: false,
    model3dUrl: "",
    webModel3dUrl: "",
    webModel3dBytes: 0,
    arModel3dUrl: "",
    arModel3dBytes: 0,
    usdzUrl: "",
    arUsdzUrl: "",
    arUsdzBytes: 0,
    posterUrl: "",
    preparedGlbJobId: "",
    preparedGlbStoragePath: "",
    modelStatus: "missing",
    available: true,
    ingredients: [],
    allergens: [],
    options: [],
    houseNote: "",
    tags: []
  };
}

test("FR -> AR -> EN -> ES -> IT category labels do not duplicate stable categories", () => {
  const dishes = [
    dish("starter-fr", "starter", "Entrees"),
    dish("starter-ar", "starter", "المقبلات"),
    dish("starter-en", "starter", "Starters"),
    dish("starter-es", "starter", "Entrantes"),
    dish("starter-it", "starter", "Antipasti"),
    dish("main-fr", "main", "Plats"),
    dish("main-ar", "main", "الأطباق الرئيسية"),
    dish("main-en", "main", "Mains"),
    dish("main-es", "main", "Platos"),
    dish("main-it", "main", "Piatti")
  ];

  const categories = getVisiblePublicMenuCategories(dishes);
  const groups = getPublicMenuCategoryGroups(dishes);

  assert.deepEqual(
    categories.map((category) => category.id),
    ["starter", "main"]
  );
  assert.equal(categories.length, 2);
  assert.deepEqual([...groups.keys()], ["starter", "main"]);
  assert.equal(groups.get("starter")?.length, 5);
  assert.equal(groups.get("main")?.length, 5);
});

test("Trouvable Arabic keeps the same LTR public UI layout", async () => {
  const menuSource = await readFile(
    "components/menu/TrouvablePremiumMenuExperience.tsx",
    "utf8"
  );
  const detailSource = await readFile(
    "components/menu/TrouvableDishDetailExperience.tsx",
    "utf8"
  );
  const menuMain = menuSource.match(/<main[\s\S]*?>/)?.[0] ?? "";
  const detailMain = detailSource.match(/<main[\s\S]*?>/)?.[0] ?? "";

  assert.doesNotMatch(menuMain, /dir=\{textDirection\}/);
  assert.doesNotMatch(detailMain, /dir=\{textDirection\}/);
  assert.match(menuMain, /data-text-direction=\{textDirection\}/);
  assert.match(detailMain, /data-text-direction=\{textDirection\}/);
  assert.match(menuSource, /dir=\{textDirection\}/);
  assert.match(detailSource, /dir=\{textDirection\}/);
});
