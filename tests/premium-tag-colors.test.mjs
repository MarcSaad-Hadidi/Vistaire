import test from "node:test";
import assert from "node:assert/strict";
import {
  assignPremiumTagAccents,
  assignPremiumTagAccentsGlobally,
  countUniqueAccents,
  getPremiumTagAccent,
  hexToHue
} from "../components/menu/premiumTagColors.ts";

function assertHueNear(actual, expected, tolerance, label) {
  const delta = Math.abs(actual - expected);
  const wrapped = Math.min(delta, 360 - delta);
  assert.ok(
    wrapped <= tolerance,
    `${label} hue ${actual} should stay within ${tolerance}deg of ${expected}`
  );
}

test("each dish metadata section uses one coherent semantic accent", () => {
  const labels = [
    "Romaine",
    "Cucumber",
    "Cherry tomato",
    "Red onion",
    "Parmesan",
    "Lemon-herb vinaigrette"
  ];
  const accents = assignPremiumTagAccents(labels, "ingredient");

  assert.equal(countUniqueAccents(accents), 1);
  assert.deepEqual(assignPremiumTagAccents(labels, "ingredient"), accents);
  assertHueNear(hexToHue(accents[0].border), 92, 18, "ingredient");
});

test("fish fry sections map ingredients, allergens and options to distinct families", () => {
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

  assert.equal(countUniqueAccents(plate), 1);
  assert.equal(countUniqueAccents(allergens), 1);
  assert.equal(countUniqueAccents(options), 1);
  assertHueNear(hexToHue(plate[0].border), 92, 18, "ingredient");
  assertHueNear(hexToHue(allergens[0].border), 358, 18, "allergen");
  assertHueNear(hexToHue(options[0].border), 43, 18, "option");
  assert.notEqual(plate[0].border, allergens[0].border);
  assert.notEqual(allergens[0].border, options[0].border);
  assert.notEqual(options[0].border, plate[0].border);
});

test("global assignment preserves one family per section", () => {
  const groups = assignPremiumTagAccentsGlobally([
    ["Smoked meat", "Pain de seigle", "Moutarde", "Cornichon", "Accompagnement maison"],
    ["Blé/seigle", "Moutarde", "Sulfites possibles"],
    ["Extra smoked meat", "Moutarde à part", "Cornichon extra", "Frites", "Salade de chou"]
  ]);

  for (const accents of groups) {
    assert.equal(countUniqueAccents(accents), 1);
  }

  const flat = groups.flat();
  assert.ok(countUniqueAccents(flat) < flat.length);
  assertHueNear(hexToHue(groups[0][0].border), 92, 18, "global ingredient");
  assertHueNear(hexToHue(groups[1][0].border), 358, 18, "global allergen");
  assertHueNear(hexToHue(groups[2][0].border), 43, 18, "global option");
});

test("single-tag lookup stays stable", () => {
  const first = getPremiumTagAccent("Romaine", "ingredient", 0);
  const second = getPremiumTagAccent("Romaine", "ingredient", 0);

  assert.deepEqual(first, second);
});
