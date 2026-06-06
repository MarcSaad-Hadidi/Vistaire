import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const seedPath = "supabase/seeds/resto-marc-public-menu.sql";

test("Resto Marc manual seed links the required test menu to the real slug", async () => {
  const source = await readFile(seedPath, "utf8");

  assert.match(source, /slug = 'resto-marc'/);
  assert.match(source, /restaurant_id/);
  assert.match(source, /restaurant_slug/);
  assert.match(source, /Bol de riz au poulet et légumes/);
  assert.match(source, /Riz chaud servi avec morceaux de poulet grillé/);
  assert.match(source, /17\.99/);
  assert.doesNotMatch(source, /Maison Élyse|maison-elyse/i);
});
