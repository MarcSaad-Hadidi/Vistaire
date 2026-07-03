import test from "node:test";
import assert from "node:assert/strict";
import {
  assignPremiumTagAccents,
  assignPremiumTagAccentsGlobally,
  countUniqueAccents,
  getPremiumTagAccent,
  minHueSeparation
} from "../components/menu/premiumTagColors.ts";

test("each section keeps unique accents inside the group", () => {
  const labels = [
    "Romaine",
    "Cucumber",
    "Cherry tomato",
    "Red onion",
    "Parmesan",
    "Lemon-herb vinaigrette"
  ];
  const accents = assignPremiumTagAccents(labels, "ingredient");

  assert.equal(countUniqueAccents(accents), labels.length);
  assert.deepEqual(assignPremiumTagAccents(labels, "ingredient"), accents);
  assert.ok(minHueSeparation(accents) >= 30);
});

test("fish fry sections stay distinct inside each block", () => {
  const plate = assignPremiumTagAccents(
    ["Poisson blanc", "Panure", "Frites", "Citron", "Sauce tartare"],
    "ingredient"
  );
  const allergens = assignPremiumTagAccents(
    ["Poisson", "Blé", "Œufs possible", "Lait possible", "Moutarde possible"],
    "allergen"
  );
  const options = assignPremiumTagAccents(
    ["Sauce tartare extra", "Salade de chou", "Frites extra", "Citron extra"],
    "option"
  );

  assert.equal(countUniqueAccents(plate), 5);
  assert.equal(countUniqueAccents(allergens), 5);
  assert.equal(countUniqueAccents(options), 4);
  assert.ok(minHueSeparation(plate) >= 40);
  assert.ok(minHueSeparation(allergens) >= 40);
  assert.ok(minHueSeparation(options) >= 40);
});

test("colors may repeat across sections but not inside one section", () => {
  const groups = assignPremiumTagAccentsGlobally([
    ["Smoked meat", "Pain de seigle", "Moutarde", "Cornichon", "Accompagnement maison"],
    ["Blé/seigle", "Moutarde", "Sulfites possibles"],
    ["Extra smoked meat", "Moutarde à part", "Cornichon extra", "Frites", "Salade de chou"]
  ]);

  for (const accents of groups) {
    assert.equal(countUniqueAccents(accents), accents.length);
  }

  const flat = groups.flat();
  assert.ok(countUniqueAccents(flat) < flat.length);
});

test("single-tag lookup stays stable", () => {
  const first = getPremiumTagAccent("Romaine", "ingredient", 0);
  const second = getPremiumTagAccent("Romaine", "ingredient", 0);

  assert.deepEqual(first, second);
});
