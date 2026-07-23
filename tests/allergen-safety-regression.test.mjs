import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRenderers = [
  "components/menu/MaisonElyseQrMenu.tsx",
  "components/menu/PublicMenuRenderer.tsx",
  "components/menu/TrouvablePremiumMenuExperience.tsx"
];

test("all public filter implementations use the fail-closed shared matcher", async () => {
  const sources = await Promise.all(publicRenderers.map((file) => readFile(file, "utf8")));

  for (const source of sources) {
    assert.match(source, /matchesConfirmedFree/);
    assert.doesNotMatch(source, /ALLERGEN_FILTER_TERMS/);
  }
});

test("public mapping reads structured declarations before legacy allergens", async () => {
  const source = await readFile("lib/menu/publicMenuCore.ts", "utf8");

  assert.match(source, /allergen_declarations/);
  assert.match(source, /allergenData\.declarations/);
  assert.match(source, /getAllergenDeclarationSource\(row, metadata/);
});

test("migration is additive, idempotent, and never backfills confirmed-free", async () => {
  const source = await readFile(
    "supabase/migrations/20260723120000_allergen_declarations_safety.sql",
    "utf8"
  );
  const backfill = source.slice(0, source.indexOf("create or replace function public.validate_allergen_declarations"));

  assert.match(source, /add column if not exists allergen_declarations jsonb/);
  assert.match(source, /where dish\.allergen_declarations is null/);
  assert.match(source, /allergen_declarations_array_check/);
  assert.match(source, /insert into public\.menus[\s\S]*settings_json/);
  assert.match(source, /notify pgrst, 'reload schema'/);
  const executableBackfill = backfill.replace(/--[^\r\n]*/g, "");
  assert.doesNotMatch(executableBackfill, /confirmed_free/);
  assert.doesNotMatch(executableBackfill, /set\s+allergens\s*=/i);
  assert.match(source, /validate_allergen_declarations/);
  assert.match(source, /unknown allergen id/);
  assert.match(source, /unknown allergen status/);
  assert.match(source, /duplicate allergen declaration/);
});

test("owner UI defaults every declaration to unknown and sends the structured payload", async () => {
  const [manager, wizard, mutations] = await Promise.all([
    readFile("components/owner/OwnerRestaurantMenuManager.tsx", "utf8"),
    readFile("components/owner/RestaurantCreateForm.tsx", "utf8"),
    readFile("lib/owner/menuMutations.ts", "utf8")
  ]);

  assert.match(manager, /status: "unknown"/);
  assert.match(manager, /allergenDeclarations: dishDraft\.allergenDeclarations/);
  assert.match(wizard, /status: "unknown"/);
  assert.match(wizard, /onAllergenStatusChange/);
  assert.match(mutations, /validateAllergenDeclarations/);
  assert.match(mutations, /allergen_declarations/);
  assert.doesNotMatch(manager, /allergensText/);
});
