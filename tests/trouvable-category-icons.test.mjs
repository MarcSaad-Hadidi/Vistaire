import test from "node:test";
import assert from "node:assert/strict";

import {
  getTrouvableCategoryIconKind,
  getTrouvableCategoryIconKindForCategory,
  getTrouvableCategorySortPriority,
  sortTrouvablePublicMenuCategories,
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
  assert.equal(kinds[0], "classic");
  assert.equal(kinds[1], "starter");
});

test("Ouverture appears before Classique after Trouvable category sort", () => {
  const categories = sortTrouvablePublicMenuCategories([
    { id: "classique", label: "Classiques reinventes", description: "", tone: "green", count: 3 },
    { id: "ouverture", label: "Ouverture de table", description: "", tone: "blue", count: 2 },
    { id: "feu", label: "Feu & assiettes maison", description: "", tone: "red", count: 4 }
  ]);

  assert.deepEqual(
    categories.map((category) => category.label),
    ["Ouverture de table", "Classiques reinventes", "Feu & assiettes maison"]
  );
});

test("Matin appears right after Ouverture in premium category order", () => {
  const categories = sortTrouvablePublicMenuCategories([
    { id: "classique", label: "Classiques reinventes", description: "", tone: "green", count: 3 },
    { id: "matin", label: "Matin dore", description: "", tone: "yellow", count: 2 },
    { id: "ouverture", label: "Ouverture de table", description: "", tone: "blue", count: 2 }
  ]);

  assert.deepEqual(
    categories.map((category) => category.label),
    ["Ouverture de table", "Matin dore", "Classiques reinventes"]
  );
});

test("category icon kind stays stable across translated labels", () => {
  const locales = [
    { id: "ouverture", label: "Ouverture de table" },
    { id: "ouverture-en", label: "Table opening" },
    { id: "ouverture-es", label: "Entradas de mesa" },
    { id: "ouverture-de", label: "Vorspeisen" },
    { id: "ouverture-ar", label: "مقبلات" }
  ];

  const kinds = locales.map((category) =>
    getTrouvableCategoryIconKindForCategory(category)
  );

  assert.ok(kinds.every((kind) => kind === "starter"));
});

test("sort priority keeps Ouverture before Classique in every language label", () => {
  const openingPriority = getTrouvableCategorySortPriority({
    id: "starter",
    label: "Starters"
  });
  const classicPriority = getTrouvableCategorySortPriority({
    id: "classic",
    label: "Classics"
  });

  assert.ok(openingPriority < classicPriority);
});

test("English Trouvable labels keep premium category order", () => {
  const categories = sortTrouvablePublicMenuCategories([
    { id: "classics", label: "Classics Reimagined", description: "", tone: "green", count: 3 },
    { id: "opening", label: "Table opening", description: "", tone: "blue", count: 2 },
    { id: "fire", label: "Fire & homemade plates", description: "", tone: "red", count: 4 },
    { id: "journey", label: "Journey to the plate", description: "", tone: "green", count: 2 },
    { id: "forno", label: "Forno & pasta", description: "", tone: "green", count: 2 },
    { id: "morning", label: "Golden morning", description: "", tone: "yellow", count: 2 },
    { id: "dessert", label: "Last note", description: "", tone: "yellow", count: 2 },
    { id: "fresh", label: "Homemade freshness", description: "", tone: "blue", count: 2 },
    { id: "drinks", label: "Glasses & Bubbles", description: "", tone: "red", count: 2 }
  ]);

  assert.deepEqual(
    categories.map((category) => category.label),
    [
      "Table opening",
      "Golden morning",
      "Classics Reimagined",
      "Fire & homemade plates",
      "Journey to the plate",
      "Forno & pasta",
      "Last note",
      "Homemade freshness",
      "Glasses & Bubbles"
    ]
  );
});

test("Arabic Trouvable labels keep premium category order", () => {
  const categories = sortTrouvablePublicMenuCategories([
    { id: "c1", label: "الكلاسيكيات المعاد تصورها", description: "", tone: "green", count: 3 },
    { id: "c2", label: "افتتاح الطاولة", description: "", tone: "blue", count: 2 },
    { id: "c3", label: "أطباق النار والمصنوعة يدويا", description: "", tone: "red", count: 4 }
  ]);

  assert.deepEqual(
    categories.map((category) => category.label),
    ["افتتاح الطاولة", "الكلاسيكيات المعاد تصورها", "أطباق النار والمصنوعة يدويا"]
  );
});

test("unknown Trouvable categories use a deterministic non-spark fallback family", () => {
  const first = getTrouvableCategoryIconKind("Inspiration du marche");
  const second = getTrouvableCategoryIconKind("Inspiration du marche");

  assert.equal(first, second);
  assert.equal(TROUVABLE_CATEGORY_ICON_FALLBACKS.includes(first), true);
  assert.notEqual(first, "spark");
});
