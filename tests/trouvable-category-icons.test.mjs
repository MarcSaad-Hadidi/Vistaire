import test from "node:test";
import assert from "node:assert/strict";

import {
  getTrouvableCategoryIconKind,
  TROUVABLE_CATEGORY_ICON_FALLBACKS
} from "../lib/menu/trouvableCategoryIcons.ts";

test("known Trouvable category labels map to distinct semantic SVG icon kinds", () => {
  const labels = [
    "Classiques reinventes",
    "Ouverture de table",
    "Feu & assiettes maison",
    "Voyage a l'assiette",
    "Forno & pasta",
    "Matin dore",
    "Derniere note",
    "Fraicheur maison",
    "Verres & bulles"
  ];

  const kinds = labels.map(getTrouvableCategoryIconKind);

  assert.equal(new Set(kinds).size, labels.length);
  assert.equal(kinds.includes("spark"), false);
});

test("unknown Trouvable categories use a deterministic non-spark fallback family", () => {
  const first = getTrouvableCategoryIconKind("Inspiration du marche");
  const second = getTrouvableCategoryIconKind("Inspiration du marche");

  assert.equal(first, second);
  assert.equal(TROUVABLE_CATEGORY_ICON_FALLBACKS.includes(first), true);
  assert.notEqual(first, "spark");
});
