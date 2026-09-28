import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { MENU_PROJECTIONS } from "../lib/menu/menuSchemaProjections.ts";

const liveSchema = {
  menus: new Set([
    "id",
    "restaurant_id",
    "name",
    "slug",
    "status",
    "is_primary",
    "settings_json",
    "created_at",
    "updated_at"
  ]),
  menu_categories: new Set([
    "id",
    "restaurant_id",
    "menu_id",
    "name",
    "slug",
    "description",
    "display_order",
    "created_at",
    "updated_at"
  ])
};

function columns(value) {
  return value.split(",").map((column) => column.trim()).filter(Boolean);
}

function assertLiveProjection(table, projection, label) {
  for (const column of columns(projection)) {
    assert.equal(
      liveSchema[table].has(column),
      true,
      `${label} requests missing ${table}.${column}`
    );
  }
}

test("canonical menu projections match the deployed menus and menu_categories schema", () => {
  assertLiveProjection("menus", MENU_PROJECTIONS.menus, "menu projection");
  assertLiveProjection(
    "menu_categories",
    MENU_PROJECTIONS.menuCategories,
    "category projection"
  );
  assert.equal(columns(MENU_PROJECTIONS.menus).includes("display_order"), false);
  assert.equal(columns(MENU_PROJECTIONS.menus).includes("metadata"), false);
  assert.equal(columns(MENU_PROJECTIONS.menuCategories).includes("metadata"), false);
});

test("owner and public loaders both consume the shared canonical menu projections", async () => {
  const [publicSource, ownerSource] = await Promise.all([
    readFile("lib/menu/publicMenu.ts", "utf8"),
    readFile("lib/owner/menuData.ts", "utf8")
  ]);

  assert.match(publicSource, /MENU_PROJECTIONS\.menus/);
  assert.match(publicSource, /MENU_PROJECTIONS\.menuCategories/);
  assert.match(ownerSource, /MENU_PROJECTIONS\.menus/);
  assert.match(ownerSource, /MENU_PROJECTIONS\.menuCategories/);
});

test("owner restaurant projection preserves the Google Reviews CTA fields", async () => {
  const ownerSource = await readFile("lib/owner/menuData.ts", "utf8");

  assert.match(ownerSource, /OWNER_RESTAURANT_COLUMNS[\s\S]*google_review_enabled/);
  assert.match(ownerSource, /OWNER_RESTAURANT_COLUMNS[\s\S]*google_review_url/);
});
