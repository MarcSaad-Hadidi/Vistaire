import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSupabasePublicMenu,
  getPublicMenuCategoryGroups,
  getVisiblePublicMenuCategories,
  isFreshHomemadeMenu
} from "../lib/menu/publicMenuCore.ts";

const restoMarcId = "33333333-3333-4333-8333-333333333333";
const maisonElyseId = "11111111-1111-1111-1111-111111111111";

const restoMarc = {
  id: restoMarcId,
  name: "Resto Marc",
  slug: "resto-marc",
  location: "Montreal",
  cuisine_type: "Cuisine maison"
};

test("builds a Resto Marc public menu from Supabase-like rows", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "salade",
      restaurant_id: restoMarcId,
      name: "Salade fraiche maison",
      description: "Legumes croquants.",
      category_name: "Entrees",
      price: 8.99,
      sort_order: 1,
      available: true
    },
    {
      id: "bol-riz",
      restaurant_id: restoMarcId,
      name: "Bol de riz au poulet et legumes",
      description:
        "Riz chaud servi avec morceaux de poulet grille, legumes sautes, sauce maison legere et garniture fraiche.",
      category_name: "Plats",
      price: 17.99,
      sort_order: 2,
      available: true
    },
    {
      id: "maison-elyse-dish",
      restaurant_id: maisonElyseId,
      restaurant_slug: "resto-marc",
      name: "Plat Maison Elyse a ne pas afficher",
      category_name: "Plats",
      price: 99,
      sort_order: 1
    }
  ]);

  assert.equal(menu.slug, "resto-marc");
  assert.equal(menu.name, "Resto Marc");
  assert.equal(menu.source, "supabase");
  assert.equal(menu.dishes.length, 2);
  assert.equal(menu.dishes[0].name, "Salade fraiche maison");
  assert.equal(menu.dishes[1].name, "Bol de riz au poulet et legumes");
  assert.equal(menu.dishes[1].priceLabel, "17,99\u00a0$");
});

test("keeps a real restaurant with no dishes as an empty public menu", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, []);

  assert.equal(menu.slug, "resto-marc");
  assert.equal(menu.source, "supabase");
  assert.deepEqual(menu.dishes, []);
});

test("groups Resto Marc dishes into visible category cards without empty categories", () => {
  const menu = buildSupabasePublicMenu("resto-marc", restoMarc, [
    {
      id: "bol-riz",
      restaurant_id: restoMarcId,
      name: "Bol de riz au poulet et legumes",
      category_name: "Plats",
      price: 17.99,
      sort_order: 1
    },
    {
      id: "limonade",
      restaurant_id: restoMarcId,
      name: "Limonade maison",
      category_name: "Boissons",
      price: 4.49,
      sort_order: 2
    }
  ]);

  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categories = getVisiblePublicMenuCategories(menu.dishes);

  assert.deepEqual(
    categories.map((category) => category.label),
    ["Plats", "Boissons"]
  );
  assert.equal(groups.get("Plats")?.[0]?.name, "Bol de riz au poulet et legumes");
  assert.equal(groups.has("Entrees"), false);
  assert.equal(isFreshHomemadeMenu(menu), true);
});
