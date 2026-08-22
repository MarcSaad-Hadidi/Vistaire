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

/**
 * Public menu projections are deliberately kept separate from owner/admin
 * projections.  The public renderer still needs the media delivery metadata
 * (for immutable photo/3D URLs), but it must not fall back to `*` and pull
 * encrypted QR material or unrelated owner columns into the menu payload.
 *
 * Keep this list in lock-step with the public menu schema contract tests.
 */
export const PUBLIC_MENU_PROJECTIONS = {
  restaurants:
    "id,name,slug,location,cuisine_type,status,public_menu_url,google_review_enabled,google_review_url,created_at,updated_at",
  restaurantsFallback:
    "id,name,slug,location,cuisine_type,status,public_menu_url,created_at,updated_at",
  dishes:
    "id,restaurant_id,menu_id,category_id,slug,name,short_description,description,price_cents,currency,image_url,is_available,is_signature,is_recommended,has_immersive_view,allergens,allergen_declarations,metadata,created_at,updated_at,display_order",
  dishesFallback:
    "id,restaurant_id,menu_id,category_id,slug,name,short_description,description,price_cents,currency,image_url,is_available,is_signature,is_recommended,has_immersive_view,allergens,metadata,created_at,updated_at",
  uiConfigs:
    "id,restaurant_id,theme,config_json,status,created_at,updated_at"
} as const;
