/**
 * Canonical relational menu projections for the currently deployed schema.
 *
 * Production menus has settings_json but does not have display_order or
 * metadata; menu_categories has display_order but does not have metadata.
 * Keep the legacy menu fallback intentionally smaller for installations that
 * predate menus.settings_json. Do not add a column here without a matching
 * production migration and schema-contract test.
 */
export const MENU_PROJECTIONS = {
  menus:
    "id,restaurant_id,name,slug,status,is_primary,settings_json,created_at,updated_at",
  menuCategories:
    "id,restaurant_id,menu_id,name,slug,description,display_order,created_at,updated_at",
  legacyMenus:
    "id,restaurant_id,name,slug,status,is_primary,created_at,updated_at"
} as const;
