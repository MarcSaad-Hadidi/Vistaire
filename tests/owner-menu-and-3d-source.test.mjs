import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("owner Carte & plats page uses the interactive menu manager", async () => {
  const page = await source("app/owner/restaurants/[restaurantId]/menu/page.tsx");
  const manager = await source("components/owner/OwnerRestaurantMenuManager.tsx");

  assert.match(page, /OwnerRestaurantMenuManager/);
  assert.doesNotMatch(page, /Ajouter plat .*brancher/i);
  assert.match(manager, /Ajouter section/);
  assert.match(manager, /Ajouter plat/);
  assert.match(manager, /submitJson/);
});

test("owner 3D page renders one selected comparison instead of a cascade", async () => {
  const page = await source("app/owner/restaurants/[restaurantId]/3d/page.tsx");
  const manager = await source("components/owner/OwnerRestaurant3dManager.tsx");

  assert.match(page, /OwnerRestaurant3dManager/);
  assert.doesNotMatch(page, /visualDishes\.map/);
  assert.match(manager, /selectedDishId/);
  assert.match(manager, /Selectionnez un plat pour comparer son GLB et son USDZ/);
  assert.match(manager, /key=\{selectedDish\.id\}/);
});

test("owner menu mutation routes require owner auth and same-origin", async () => {
  const categoriesRoute = await source(
    "app/api/owner/restaurants/[restaurantId]/menu/categories/route.ts"
  );
  const dishesRoute = await source(
    "app/api/owner/restaurants/[restaurantId]/menu/dishes/route.ts"
  );

  for (const route of [categoriesRoute, dishesRoute]) {
    assert.match(route, /requireVistaireOwnerApi/);
    assert.match(route, /requireSameOriginOwnerMutation/);
    assert.match(route, /getSupabaseAdminClient/);
  }
});
