import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

test("owner live dish editor sends public menu badge and filter fields", async () => {
  const source = await readFile("components/owner/OwnerRestaurantMenuManager.tsx", "utf8");

  for (const field of [
    "ingredientsText",
    "allergensText",
    "tagsText",
    "optionsText",
    "chefNote"
  ]) {
    assert.match(source, new RegExp(field));
  }

  assert.match(source, /extras.*accompagnements/i);
  assert.match(source, /ingredients:\s*splitDishList\(dishDraft\.ingredientsText\)/);
  assert.match(source, /allergens:\s*splitDishList\(dishDraft\.allergensText\)/);
  assert.match(source, /tags:\s*splitDishList\(dishDraft\.tagsText\)/);
  assert.match(source, /options:\s*splitDishList\(dishDraft\.optionsText\)/);
  assert.match(source, /chefNote:\s*dishDraft\.chefNote\.trim\(\)/);
  assert.doesNotMatch(source, /manualAr|fakeAr|hasAr:\s*dishDraft/i);
});

test("owner menu mutations preserve real asset metadata while storing dish detail fields", async () => {
  const mutations = await readFile("lib/owner/menuMutations.ts", "utf8");
  const publicCore = await readFile("lib/menu/publicMenuCore.ts", "utf8");

  assert.match(mutations, /function stringListInput/);
  assert.match(mutations, /dishMetadata\(existing.*candidate/s);
  assert.match(mutations, /ingredients/);
  assert.match(mutations, /allergens/);
  assert.match(mutations, /tags/);
  assert.match(mutations, /options/);
  assert.match(mutations, /chefNote/);
  assert.match(
    mutations,
    /metadata:\s*dishMetadata\(\{ photoStatus: "planned" \}, parsedPrice, candidate\)/
  );
  assert.match(
    mutations,
    /metadata:\s*dishMetadata\(existing\.data\.metadata, parsedPrice, candidate\)/
  );
  assert.match(publicCore, /PUBLIC_MENU_OPTION_FIELD_KEYS/);
  assert.match(publicCore, /"extras"/);
  assert.match(publicCore, /"accompaniments"/);
});
