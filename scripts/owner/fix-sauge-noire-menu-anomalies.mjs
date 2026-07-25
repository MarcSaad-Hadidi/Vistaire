import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  canonicalDishDisplayOrder,
  loadLocalEnv,
  normalizeKey
} from "./sync-sauge-noire-menu.mjs";

export const EXPECTED_RESTAURANT_ID = "86c56c72-d63c-4077-b79b-73e810236033";
export const EXPECTED_MENU_ID = "a2a18e67-817b-40e7-8092-7e68269c67b5";
export const EXPECTED_DESIGN_ID = "073bd2ca-56f9-46ee-bd7c-38ab22f01c9a";
export const EXPECTED_SLUG = "sauge-noire";

export const REQUESTED_MODIFICATIONS_DISCLAIMER = {
  fr: "Les modifications demandées ne garantissent pas l’absence d’allergènes ou de contamination croisée. Veuillez confirmer toute allergie avec notre équipe.",
  en: "Requested modifications do not guarantee the absence of allergens or cross-contamination. Please confirm any allergy with our team."
};

const NUIT_D_AMBRE_DESCRIPTION = "Le cocktail Nuit d’ambre marie du rhum brun, du café, du cacao et de l’orange brûlée.";
const OLD_BŒUF_SLUG = "buf-cru-au-couteau";
const NEW_BŒUF_SLUG = "boeuf-cru-au-couteau";

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function dishKey(name) {
  return normalizeKey(name);
}

function copyWithoutOrderMetadata(value) {
  const metadata = { ...jsonObject(value) };
  delete metadata.displayOrder;
  delete metadata.display_order;
  return metadata;
}

function copyWithoutLocalizedUiCopy(value) {
  const config = { ...jsonObject(value) };
  delete config.localizedUiCopy;
  return config;
}

function stable(value) {
  return JSON.stringify(value ?? null);
}

function capitalizeListItem(value) {
  const item = String(value ?? "").trim();
  if (!item) return "";
  const firstLetterIndex = item.search(/\p{L}/u);
  if (firstLetterIndex < 0) return item;
  return item.slice(0, firstLetterIndex) + item[firstLetterIndex].toLocaleUpperCase("fr-CA") + item.slice(firstLetterIndex + 1);
}

function capitalizeListItems(items) {
  return Array.isArray(items) ? items.map(capitalizeListItem) : items;
}

function dishProtectedFingerprint(row) {
  return stable({
    id: row.id,
    name: row.name,
    category_id: row.category_id,
    price_cents: row.price_cents,
    currency: row.currency,
    image_url: row.image_url,
    is_available: row.is_available,
    is_signature: row.is_signature,
    is_recommended: row.is_recommended,
    has_immersive_view: row.has_immersive_view,
    allergens: row.allergens,
    allergen_declarations: row.allergen_declarations,
    metadata: copyWithoutOrderMetadata(row.metadata)
  });
}

function configProtectedFingerprint(row) {
  return stable({
    id: row.id,
    status: row.status,
    config_json: copyWithoutLocalizedUiCopy(row.config_json)
  });
}

function orderValue(row) {
  const rowOrder = Number(row.display_order ?? 0);
  if (Number.isFinite(rowOrder) && rowOrder > 0) return rowOrder;
  const metadata = jsonObject(row.metadata);
  const metadataOrder = Number(metadata.displayOrder ?? metadata.display_order ?? 0);
  return Number.isFinite(metadataOrder) ? metadataOrder : 0;
}

function identityErrors(snapshot) {
  const errors = [];
  if (snapshot.restaurant?.id !== EXPECTED_RESTAURANT_ID) errors.push("restaurantId mismatch");
  if (snapshot.restaurant?.slug !== EXPECTED_SLUG) errors.push("restaurant slug mismatch");
  if (snapshot.menu?.id !== EXPECTED_MENU_ID) errors.push("menuId mismatch");
  if (snapshot.publicMenuStyle !== "unique") errors.push("publicMenuStyle is not unique");
  if (snapshot.uiConfigs.length === 0) errors.push("unique UI configs missing");
  for (const row of snapshot.uiConfigs) {
    const design = jsonObject(row.config_json).uniqueDesign;
    if (design.designId !== EXPECTED_DESIGN_ID) errors.push(`${row.status}: designId mismatch`);
    if (design.status !== "pending") errors.push(`${row.status}: unique design status changed`);
    if (design.version !== 1) errors.push(`${row.status}: unique design version changed`);
    if (design.rendererKey !== null) errors.push(`${row.status}: rendererKey changed`);
    if (design.rendererVersion !== null) errors.push(`${row.status}: rendererVersion changed`);
  }
  return errors;
}

async function readSnapshot(client) {
  const restaurantResult = await client
    .from("restaurants")
    .select("id,name,slug,status")
    .eq("id", EXPECTED_RESTAURANT_ID)
    .maybeSingle();
  if (restaurantResult.error) throw restaurantResult.error;

  const [menuResult, categoriesResult, dishesResult, configsResult] = await Promise.all([
    client.from("menus").select("*").eq("id", EXPECTED_MENU_ID).eq("restaurant_id", EXPECTED_RESTAURANT_ID).maybeSingle(),
    client.from("menu_categories").select("*").eq("menu_id", EXPECTED_MENU_ID).eq("restaurant_id", EXPECTED_RESTAURANT_ID),
    client.from("menu_dishes").select("*").eq("menu_id", EXPECTED_MENU_ID).eq("restaurant_id", EXPECTED_RESTAURANT_ID),
    client.from("menu_ui_configs").select("*").eq("restaurant_id", EXPECTED_RESTAURANT_ID)
  ]);
  for (const result of [menuResult, categoriesResult, dishesResult, configsResult]) {
    if (result.error) throw result.error;
  }

  const menu = menuResult.data;
  const uiConfigs = (configsResult.data ?? []).filter((row) => row.status === "draft" || row.status === "published");
  const publicMenuStyle = jsonObject(menu?.settings_json).publicMenuStyle ??
    uiConfigs.find((row) => row.status === "published")?.config_json?.publicMenuStyle ?? "";
  return {
    restaurant: restaurantResult.data,
    menu,
    categories: categoriesResult.data ?? [],
    dishes: dishesResult.data ?? [],
    uiConfigs,
    publicMenuStyle,
    supportsDisplayOrderColumn: Object.prototype.hasOwnProperty.call(dishesResult.data?.[0] ?? {}, "display_order")
  };
}

function validateMenuShape(snapshot, { strict = true } = {}) {
  const errors = [...identityErrors(snapshot)];
  if (!snapshot.menu || snapshot.menu.status === "archived" || snapshot.menu.is_primary !== true) errors.push("primary menu is invalid");
  if (snapshot.categories.length !== 7) errors.push(`expected 7 sections, got ${snapshot.categories.length}`);
  if (snapshot.dishes.length !== 36) errors.push(`expected 36 dishes, got ${snapshot.dishes.length}`);
  if (new Set(snapshot.dishes.map((row) => row.id)).size !== 36) errors.push("dish IDs are not unique");
  if (new Set(snapshot.dishes.map((row) => dishKey(row.name))).size !== 36) errors.push("dish names are not unique");

  const sectionsByKey = new Map(snapshot.categories.map((row) => [dishKey(row.name), row]));
  for (const [index, section] of CANONICAL_SECTIONS.entries()) {
    const row = sectionsByKey.get(dishKey(section.name));
    if (!row) {
      errors.push(`missing section: ${section.name}`);
    } else if (Number(row.display_order) !== index + 1) {
      errors.push(`section order mismatch: ${section.name}`);
    }
  }

  const dishesByKey = new Map(snapshot.dishes.map((row) => [dishKey(row.name), row]));
  for (const item of CANONICAL_DISHES) {
    const row = dishesByKey.get(dishKey(item.name));
    if (!row) {
      errors.push(`missing dish: ${item.name}`);
      continue;
    }
    if (row.is_available !== true) errors.push(`${item.name}: unavailable`);
    if (row.image_url) errors.push(`${item.name}: unexpected photo`);
    if (jsonObject(row.metadata).photoStatus !== "planned") errors.push(`${item.name}: photoStatus is not planned`);
    if (strict && orderValue(row) !== canonicalDishDisplayOrder(item)) errors.push(`${item.name}: dish order mismatch`);
    if (strict && item.name === "Nuit d’ambre" && (row.short_description !== NUIT_D_AMBRE_DESCRIPTION || row.description !== NUIT_D_AMBRE_DESCRIPTION)) errors.push("Nuit d’ambre description mismatch");
    if (strict && item.name === "Bœuf cru au couteau" && row.slug !== NEW_BŒUF_SLUG) errors.push("Bœuf slug mismatch");
  }

  return errors;
}

function validateSameSnapshot(before, current) {
  if (before.menu?.id !== current.menu?.id) throw new Error("menu snapshot changed before apply");
  if (stable(before.categories.map((row) => row.id).sort()) !== stable(current.categories.map((row) => row.id).sort())) throw new Error("section snapshot changed before apply");
  if (stable(before.dishes.map((row) => row.id).sort()) !== stable(current.dishes.map((row) => row.id).sort())) throw new Error("dish snapshot changed before apply");
  for (const row of before.dishes) {
    const currentRow = current.dishes.find((candidate) => candidate.id === row.id);
    if (!currentRow || dishProtectedFingerprint(row) !== dishProtectedFingerprint(currentRow)) throw new Error(`dish ${row.id} changed before apply`);
  }
  for (const row of before.uiConfigs) {
    const currentRow = current.uiConfigs.find((candidate) => candidate.id === row.id);
    if (!currentRow || configProtectedFingerprint(row) !== configProtectedFingerprint(currentRow)) throw new Error(`UI config ${row.id} changed before apply`);
  }
}

function localizedUiCopyWithDisclaimer(configJson) {
  const config = jsonObject(configJson);
  const localizedUiCopy = jsonObject(config.localizedUiCopy);
  const allergensCopy = jsonObject(localizedUiCopy.allergens);
  return {
    ...config,
    localizedUiCopy: {
      ...localizedUiCopy,
      allergens: {
        ...allergensCopy,
        requestedModificationsDisclaimer: REQUESTED_MODIFICATIONS_DISCLAIMER
      }
    }
  };
}

function changesForDish(row, supportsDisplayOrderColumn) {
  const item = CANONICAL_DISHES.find((candidate) => dishKey(candidate.name) === dishKey(row.name));
  if (!item) throw new Error(`unexpected dish: ${row.name}`);
  const displayOrder = canonicalDishDisplayOrder(item);
  const currentMetadata = jsonObject(row.metadata);
  const metadata = {
    ...currentMetadata,
    displayOrder,
    ...(Array.isArray(currentMetadata.ingredients)
      ? { ingredients: capitalizeListItems(currentMetadata.ingredients) }
      : {}),
    ...(Array.isArray(currentMetadata.options)
      ? { options: capitalizeListItems(currentMetadata.options) }
      : {})
  };
  const patch = { metadata };
  if (supportsDisplayOrderColumn) patch.display_order = displayOrder;
  if (item.name === "Nuit d’ambre") {
    patch.short_description = NUIT_D_AMBRE_DESCRIPTION;
    patch.description = NUIT_D_AMBRE_DESCRIPTION;
  }
  if (item.name === "Bœuf cru au couteau" && row.slug !== NEW_BŒUF_SLUG) {
    if (row.slug !== OLD_BŒUF_SLUG) throw new Error(`unexpected bœuf slug: ${row.slug}`);
    patch.slug = NEW_BŒUF_SLUG;
  }
  return patch;
}

async function updateRow(client, table, id, patch) {
  const result = await client.from(table).update(patch).eq("id", id).select("id").single();
  if (result.error) throw result.error;
  return result.data;
}

async function applyFixes(client, before) {
  const current = await readSnapshot(client);
  validateSameSnapshot(before, current);
  const appliedDishes = [];
  const appliedConfigs = [];
  try {
    for (const row of current.dishes) {
      const patch = changesForDish(row, current.supportsDisplayOrderColumn);
      await updateRow(client, "menu_dishes", row.id, patch);
      appliedDishes.push({ id: row.id, before: {
        metadata: row.metadata,
        ...(current.supportsDisplayOrderColumn ? { display_order: row.display_order } : {}),
        ...(patch.slug ? { slug: row.slug } : {}),
        ...(patch.description ? { description: row.description, short_description: row.short_description } : {})
      }});
    }
    for (const row of current.uiConfigs) {
      const nextConfig = localizedUiCopyWithDisclaimer(row.config_json);
      await updateRow(client, "menu_ui_configs", row.id, { config_json: nextConfig });
      appliedConfigs.push({ id: row.id, before: row.config_json });
    }
  } catch (error) {
    for (const row of appliedDishes.reverse()) {
      await client.from("menu_dishes").update(row.before).eq("id", row.id);
    }
    for (const row of appliedConfigs.reverse()) {
      await client.from("menu_ui_configs").update({ config_json: row.before }).eq("id", row.id);
    }
    throw error;
  }
  return readSnapshot(client);
}

export async function run({ apply = false, env = loadLocalEnv(), log = console.log } = {}) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "missing Supabase environment" };
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const before = await readSnapshot(client);
  const shapeErrors = validateMenuShape(before, { strict: false });
  const identity = identityErrors(before);
  log(JSON.stringify({
    target: { restaurantId: before.restaurant?.id, menuId: before.menu?.id, publicMenuStyle: before.publicMenuStyle },
    counts: { sections: before.categories.length, dishes: before.dishes.length },
    supportsDisplayOrderColumn: before.supportsDisplayOrderColumn,
    shapeErrors,
    identityErrors: identity
  }, null, 2));
  if (identity.length > 0 || shapeErrors.length > 0) return { ok: false, error: [...identity, ...shapeErrors].join(" | ") };
  if (!apply) return { ok: true, reason: "dry-run", before };

  const after = await applyFixes(client, before);
  const afterErrors = validateMenuShape(after);
  if (afterErrors.length > 0) throw new Error(`post-apply validation failed: ${afterErrors.join(" | ")}`);
  if (stable(before.uiConfigs.map(configProtectedFingerprint)) !== stable(after.uiConfigs.map(configProtectedFingerprint))) throw new Error("protected UI config changed");
  log(JSON.stringify({
    final: { sections: after.categories.length, dishes: after.dishes.length },
    designId: EXPECTED_DESIGN_ID,
    publicMenuStyle: after.publicMenuStyle,
    displayOrderStorage: after.supportsDisplayOrderColumn ? "menu_dishes.display_order + metadata.displayOrder" : "metadata.displayOrder fallback"
  }, null, 2));
  return { ok: true, reason: "applied", before, after };
}

const invokedDirectly = process.argv[1]?.endsWith("fix-sauge-noire-menu-anomalies.mjs");
if (invokedDirectly) {
  run({ apply: process.argv.includes("--apply") })
    .then((result) => {
      if (!result.ok) {
        console.error(result.error);
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error.message ?? error);
      process.exitCode = 1;
    });
}
