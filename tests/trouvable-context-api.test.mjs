import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Trouvable detail surfaces receive explicit standalone and integrated context", async () => {
  const [surface, standalone, integrated] = await Promise.all([
    readFile("components/menu/TrouvableDishDetailSurface.tsx", "utf8"),
    readFile("components/menu/TrouvableDishDetailExperience.tsx", "utf8"),
    readFile("components/menu/TrouvablePremiumMenuExperience.tsx", "utf8")
  ]);

  assert.match(surface, /eyebrow: string;/);
  assert.match(surface, /secondaryEyebrow\?: string;/);
  assert.match(surface, /<p>\{eyebrow\}<\/p>/);
  assert.match(surface, /\{secondaryEyebrow \? \(/);
  assert.doesNotMatch(surface, /<p>\{dish\.category\}<\/p>/);

  assert.match(standalone, /eyebrow=\{context \|\| menu\.name\}/);
  assert.match(standalone, /secondaryEyebrow=\{activeDish\.category\}/);

  assert.match(integrated, /eyebrow=\{selectedDish\.category\}/);
  assert.doesNotMatch(integrated, /secondaryEyebrow=/);
  assert.match(integrated, /context \|\| menu\.name/);
});
