import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentPaths = [
  "components/menu/PublicMenuExperience.tsx",
  "components/menu/PublicMenuRenderer.tsx",
  "components/menu/MaisonElyseQrMenu.tsx",
  "components/menu/TrouvablePremiumMenuExperience.tsx"
];

test("public menu components use stable category ids for group lookups and active state", async () => {
  for (const componentPath of componentPaths) {
    const source = await readFile(componentPath, "utf8");

    assert.doesNotMatch(
      source,
      /groups\.get\(category\.label\)/,
      `${componentPath} must not look up category groups by translated labels`
    );
    assert.doesNotMatch(
      source,
      /id:\s*category\.label/,
      `${componentPath} must not expose translated labels as tab identifiers`
    );
    assert.doesNotMatch(
      source,
      /setActive(?:Tab|Category)\(category\.label\)/,
      `${componentPath} must not store translated labels in active category state`
    );
    assert.doesNotMatch(
      source,
      /activeCategory === category\.label/,
      `${componentPath} must not compare active category state to translated labels`
    );
  }
});
