import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getCategories, getDishBySlug, getRestaurant } from "../lib/demoMenuData.ts";
import {
  fieldHashesFor,
  hashTranslationValue,
  objectInput,
  sourceHashFor,
  stringListInput,
  stableJson
} from "../lib/translation/menuTranslationModel.ts";
import {
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  TARGET_NAME as SAUGE_NOIRE_NAME,
  TARGET_SLUG as SAUGE_NOIRE_SLUG,
  canonicalDishSlug
} from "./owner/sync-sauge-noire-menu.mjs";

export const SCRIPT_NAME = "backfill-menu-translations";
export const DEFAULT_LOCALE = "en-CA";
export const TARGET_SLUGS = ["maison-elyse", "trouvable", "sauge-noire"];
export const MAISON_ELYSE_SLUG = "maison-elyse";
export const MAISON_ELYSE_SOURCE_LOCALE = "fr-CA";
export const MAISON_ELYSE_TRANSLATION_LOCALE = "en-CA";
export const TRANSLATION_TABLES = {
  menu: "menu_translations",
  category: "menu_category_translations",
  dish: "menu_dish_translations"
};

// This is intentionally explicit instead of deriving English from the source
// name. These are the real Trouvable slugs supplied for the production menu.
// A missing slug is a hard error, never a French-name fallback.
export const TROUVABLE_CANONICAL_NAMES = Object.freeze({
  menu: { fr: "Trouvable", en: "Trouvable" },
  categories: {
    "classiques-reinventes": { fr: "Classiques réinventés", en: "Reinvented Classics" },
    "ouverture-de-table": { fr: "Ouverture de table", en: "Table Openers" },
    "feu-assiettes-maison": { fr: "Feu & assiettes maison", en: "Fire & House Plates" },
    "voyage-a-l-assiette": { fr: "Voyage à l'assiette", en: "Around the World" },
    "forno-pasta": { fr: "Forno & pasta", en: "Forno & Pasta" },
    "matin-dore": { fr: "Matin doré", en: "Golden Morning" },
    "derniere-note": { fr: "Dernière note", en: "Final Note" },
    "fraicheur-maison": { fr: "Fraîcheur maison", en: "House Refreshments" },
    "verres-bulles": { fr: "Verres & bulles", en: "Glasses & Bubbles" }
  },
  dishes: {
    "poulet-maison-sur-riz-parfume": { fr: "Poulet maison sur riz parfumé", en: "House Chicken with Fragrant Rice" },
    "orange-pressee-soleil": { fr: "Orange pressée soleil", en: "Sun-Pressed Orange" },
    "rouge-selection-maison": { fr: "Sélection rouge maison", en: "House Red Selection" },
    "rosee-maison": { fr: "Rosé maison", en: "House Rosé" },
    "crepes-nuage-aux-fruits": { fr: "Crêpes nuage aux fruits", en: "Cloud Crepes with Fresh Fruit" },
    "pesto-burrata-verde": { fr: "Pesto burrata verde", en: "Green Pesto Burrata" },
    "bol-fraicheur-verger": { fr: "Bol fraîcheur verger", en: "Orchard Fruit Bowl" },
    "dejeuner-du-marche": { fr: "Déjeuner du marché", en: "Market Breakfast" },
    "smoothie-fraise-banane": { fr: "Smoothie fraise-banane", en: "Strawberry-Banana Smoothie" },
    "smoked-meat-saint-laurent": { fr: "Smoked Meat Saint-Laurent", en: "Smoked Meat Saint-Laurent" },
    "ailes-bbq-caramelisees": { fr: "Ailes BBQ caramélisées", en: "Caramelized BBQ Wings" },
    "pepperoni-classico": { fr: "Pepperoni Classico", en: "Pepperoni Classico" },
    "saumon-des-saisons": { fr: "Saumon des saisons", en: "Seasonal Salmon" },
    "fish-chips-du-quai": { fr: "Fish & chips du quai", en: "Quayside Fish & Chips" },
    "cesar-grillee-au-poulet": { fr: "César grillée au poulet", en: "Grilled Chicken Caesar" },
    "steak-frites-au-feu": { fr: "Steak-frites au feu", en: "Fire-Grilled Steak Frites" },
    "plateau-sushi-horizon": { fr: "Plateau sushi horizon", en: "Horizon Sushi Platter" },
    "lasagne-gratina": { fr: "Lasagne Gratina", en: "Gratina Lasagna" },
    "burrata-prosciutto-royale": { fr: "Burrata Prosciutto Royale", en: "Burrata Prosciutto Royale" },
    "carbonara-romaine": { fr: "Carbonara romaine", en: "Roman Carbonara" },
    "poutine-du-vieux-montreal": { fr: "Poutine du Vieux-Montréal", en: "Old Montreal Poutine" },
    "mac-cremeux-trois-fromages": { fr: "Mac crémeux trois fromages", en: "Creamy Three-Cheese Mac" },
    "bol-teriyaki-tokyo": { fr: "Bol teriyaki Tokyo", en: "Tokyo Teriyaki Bowl" },
    "margherita-basilico": { fr: "Margherita Basilico", en: "Basilico Margherita" },
    "tiramisu-milano": { fr: "Tiramisu Milano", en: "Tiramisu Milano" },
    "quesadilla-fondante": { fr: "Quesadilla fondante", en: "Melty Quesadilla" },
    "spritz-riviera": { fr: "Spritz Riviera", en: "Spritz Riviera" },
    "tacos-de-b-uf-el-fuego": { fr: "Tacos de bœuf El Fuego", en: "El Fuego Beef Tacos" },
    "alfredo-velours": { fr: "Alfredo velours", en: "Velvet Alfredo" },
    "fondant-chocolat-noir": { fr: "Fondant chocolat noir", en: "Dark Chocolate Fondant" },
    "ipa-boreale": { fr: "IPA boréale", en: "Boreal IPA" },
    "nachos-dores-du-comptoir": { fr: "Nachos dorés du comptoir", en: "Golden Counter Nachos" },
    "panna-cotta-vanille-coulis": { fr: "Panna cotta vanille coulis", en: "Vanilla Panna Cotta & Coulis" },
    "coupe-elegance": { fr: "Coupe élégance", en: "Elegance Coupe" },
    "chocolat-chaud-velours": { fr: "Chocolat chaud velours", en: "Velvet Hot Chocolate" },
    "burger-signature-maison": { fr: "Burger signature maison", en: "House Signature Burger" }
  }
});

const PROJECT_REF = /^[a-z0-9]{8,64}$/;
const ENVIRONMENTS = new Set(["local", "preview", "production", "test"]);
const VALID_STATUSES = new Set([
  "source",
  "missing",
  "pending",
  "in_progress",
  "up_to_date",
  "stale",
  "error"
]);
const PLACEHOLDER_NAME = /^(?:tbd|todo|test|placeholder|sample|example|dish(?:[-_ ]?\d+)?|item(?:[-_ ]?\d+)?|plat(?:[-_ ]?\d+)?|untitled|sans nom|nom du plat)$/i;
const STANDARD_TAGS = new Map([
  ["recommande", "Recommended"],
  ["recommandé", "Recommended"],
  ["recommandée", "Recommended"],
  ["vegetarien", "Vegetarian"],
  ["végétarien", "Vegetarian"],
  ["vegetarienne", "Vegetarian"],
  ["végétarienne", "Vegetarian"],
  ["sans gluten", "Gluten-free"],
  ["nouveau", "New"],
  ["populaire", "Popular"],
  ["maison", "House"],
  ["signature", "Signature"]
]);

function fail(message) {
  throw new Error(message);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function nonEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nonEmptyList(value) {
  return stringListInput(value);
}

function mergeLists(...values) {
  return Array.from(new Set(values.flatMap(nonEmptyList)));
}

function addField(fields, key, value) {
  const valid = Array.isArray(value)
    ? value.some((item) => nonEmpty(item))
    : nonEmpty(value).length > 0;
  if (!valid) return;
  fields[key] = Array.isArray(value)
    ? value.map(nonEmpty).filter(Boolean)
    : nonEmpty(value);
}

export function projectRefFromUrl(value) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  const match = url.hostname.match(/^([a-z0-9]{8,64})\.supabase\.co$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function redactError(error) {
  const message = String(error?.message ?? error ?? "unknown error");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(apikey|authorization|service_role|secret|token)[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]");
}

export function parseArgs(argv = []) {
  const args = {
    apply: false,
    environment: "",
    projectRef: "",
    allowedProjectRefs: [],
    restaurants: [...TARGET_SLUGS],
    locale: DEFAULT_LOCALE,
    reportPath: "",
    authorizeProduction: false,
    productionBinding: "",
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = () => {
      const result = argv[index + 1];
      if (!result || result.startsWith("--")) fail(`${value} requires a value`);
      index += 1;
      return result;
    };
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--apply") args.apply = true;
    else if (value === "--environment") args.environment = next().toLowerCase();
    else if (value === "--project-ref") args.projectRef = next().toLowerCase();
    else if (value === "--allow-project-ref") args.allowedProjectRefs.push(next().toLowerCase());
    else if (value === "--restaurant") args.restaurants = [next().toLowerCase()];
    else if (value === "--locale") args.locale = next();
    else if (value === "--report") args.reportPath = next();
    else if (value === "--authorize-production") args.authorizeProduction = true;
    else if (value === "--production-binding") args.productionBinding = next().toLowerCase();
    else fail(`unknown option: ${value}`);
  }

  return args;
}

export function validateArgs(args) {
  const errors = [];
  if (!ENVIRONMENTS.has(args.environment)) {
    errors.push("--environment must be one of local, preview, production, or test");
  }
  if (!PROJECT_REF.test(args.projectRef)) {
    errors.push("--project-ref is required and must be a Supabase project ref");
  }
  if (args.allowedProjectRefs.length === 0) {
    errors.push("at least one --allow-project-ref is required; no ref is trusted implicitly");
  }
  if (!args.allowedProjectRefs.includes(args.projectRef)) {
    errors.push("--project-ref is not present in the explicit --allow-project-ref allowlist");
  }
  if (!args.restaurants.length || args.restaurants.some((slug) => !TARGET_SLUGS.includes(slug))) {
    errors.push(`--restaurant must be one of: ${TARGET_SLUGS.join(", ")}`);
  }
  if (!args.locale.trim()) errors.push("--locale cannot be empty");
  if (args.apply && args.environment === "production") {
    if (!args.authorizeProduction) {
      errors.push("production apply requires --authorize-production");
    }
    if (args.productionBinding !== args.projectRef) {
      errors.push("production apply requires --production-binding equal to --project-ref");
    }
  }
  return errors;
}

export function assertExplicitBinding({ args, url, env = process.env }) {
  const errors = validateArgs(args);
  const actualRef = projectRefFromUrl(url);
  if (!actualRef) errors.push("NEXT_PUBLIC_SUPABASE_URL must be an https Supabase project URL");
  if (actualRef && actualRef !== args.projectRef) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL project ref does not match --project-ref");
  }
  if (actualRef && !args.allowedProjectRefs.includes(actualRef)) {
    errors.push("resolved Supabase project ref is not explicitly authorized");
  }
  if (args.apply && args.environment === "production") {
    if (env.VERCEL_ENV !== "production") errors.push("production apply requires VERCEL_ENV=production");
    if (env.VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF !== args.projectRef) {
      errors.push("production apply requires VISTAIRE_EXPECTED_SUPABASE_PROJECT_REF equal to --project-ref");
    }
  }
  if (errors.length) fail(errors.join("; "));
  return {
    environment: args.environment,
    expectedProjectRef: args.projectRef,
    actualProjectRef: actualRef,
    proof: args.apply && args.environment === "production"
      ? { vercelEnvironment: env.VERCEL_ENV, expectedRefEnvironmentVariable: true }
      : { vercelEnvironment: env.VERCEL_ENV ?? null, expectedRefEnvironmentVariable: false }
  };
}

function sourceMenuFields(menu) {
  const fields = {};
  addField(fields, "menuName", menu.name);
  return fields;
}

function sourceCategoryFields(category) {
  const fields = {};
  addField(fields, "name", category.name);
  addField(fields, "description", category.description);
  return fields;
}

export function sourceDishFields(dish) {
  const metadata = asObject(dish.metadata);
  const fields = {};
  addField(fields, "name", dish.name ?? dish.dish_name ?? dish.title);
  addField(fields, "description", dish.short_description ?? dish.shortDescription ?? dish.description);
  addField(fields, "ingredients", mergeLists(metadata.ingredients, metadata.ingredient_list, dish.ingredients));
  addField(fields, "allergens", mergeLists(dish.allergens, metadata.allergens, metadata.allergenes, metadata.allergen_list));
  addField(fields, "options", mergeLists(metadata.options, metadata.option_list, metadata.extras, metadata.accompaniments));
  addField(fields, "houseNote", metadata.chefNote ?? metadata.chef_note ?? metadata.houseNote ?? metadata.house_note);
  addField(fields, "tags", mergeLists(metadata.tags, metadata.labels, metadata.badges));
  return fields;
}

export function sourceFieldsFor(entityType, row) {
  if (entityType === "menu") return sourceMenuFields(row);
  if (entityType === "category") return sourceCategoryFields(row);
  if (entityType === "dish") return sourceDishFields(row);
  fail(`unsupported translation entity type: ${entityType}`);
}

export function buildMenuSettingsPlan(snapshot) {
  const current = objectInput(snapshot.menu.settings_json);
  const desired = { ...current };
  if (snapshot.targetSlug === MAISON_ELYSE_SLUG) {
    desired.defaultLocale = "fr-CA";
    desired.supportedLocales = Array.from(new Set([
      ...stringListInput(current.supportedLocales),
      "fr-CA",
      "en-CA"
    ]));
  }
  const changedFields = Object.keys({ ...current, ...desired }).filter(
    (field) => stableJson(current[field]) !== stableJson(desired[field])
  );
  return {
    changed: changedFields.length > 0,
    changedFields,
    current,
    desired,
    currentHash: hashTranslationValue(current),
    desiredHash: hashTranslationValue(desired)
  };
}

function entityKey(type, id) {
  return `${type}:${id}`;
}

export function buildEntities(snapshot) {
  return [
    {
      type: "menu",
      id: snapshot.menu.id,
      slug: snapshot.menu.slug,
      label: snapshot.menu.name,
      fields: sourceFieldsFor("menu", snapshot.menu)
    },
    ...snapshot.categories.map((row) => ({
      type: "category",
      id: row.id,
      slug: row.slug,
      label: row.name,
      fields: sourceFieldsFor("category", row)
    })),
    ...snapshot.dishes.map((row) => ({
      type: "dish",
      id: row.id,
      slug: row.slug,
      label: row.name,
      fields: sourceFieldsFor("dish", row)
    }))
  ];
}

function isUsableValue(value) {
  return Array.isArray(value)
    ? value.length > 0 && value.every((item) => nonEmpty(item))
    : Boolean(nonEmpty(value));
}

function hasAllFields(content, fields) {
  return Object.entries(fields).every(([field, value]) => {
    const translated = content[field];
    if (Array.isArray(value)) return Array.isArray(translated) && translated.length >= value.length && translated.every((item) => nonEmpty(item));
    return isUsableValue(translated);
  });
}

function isPlaceholderName(value) {
  return !nonEmpty(value) || PLACEHOLDER_NAME.test(nonEmpty(value));
}

function normalizeKey(value) {
  return nonEmpty(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function canonicalSaugeName(entity) {
  if (entity.type === "category") {
    return CANONICAL_SECTIONS.find((item) => normalizeKey(item.name) === normalizeKey(entity.slug ?? entity.label))?.name;
  }
  if (entity.type === "dish") {
    return CANONICAL_DISHES.find((item) => canonicalDishSlug(item) === entity.slug)?.name;
  }
  if (entity.type === "menu") return SAUGE_NOIRE_NAME;
  return undefined;
}

function canonicalTrouvableName(entity) {
  if (entity.type === "menu") return TROUVABLE_CANONICAL_NAMES.menu.en;
  if (entity.type === "category") {
    const key = normalizeKey(entity.slug ?? entity.label);
    return TROUVABLE_CANONICAL_NAMES.categories[key]?.en;
  }
  return TROUVABLE_CANONICAL_NAMES.dishes[entity.slug]?.en;
}

function canonicalNameForTarget(entity, snapshot) {
  if (snapshot.targetSlug === "trouvable") {
    const canonical = entity.type === "menu"
      ? TROUVABLE_CANONICAL_NAMES.menu
      : entity.type === "category"
        ? TROUVABLE_CANONICAL_NAMES.categories[normalizeKey(entity.slug ?? entity.label)]
        : TROUVABLE_CANONICAL_NAMES.dishes[entity.slug];
    if (!canonical?.en) fail(`Trouvable canonical English name is unavailable for ${entity.type} ${entity.slug}`);
    if (isPlaceholderName(entity.label)) fail(`Trouvable source name is empty or placeholder for ${entity.slug}`);
    if (normalizeKey(entity.label) !== normalizeKey(canonical.fr)) {
      fail(`Trouvable source name diverges from canonical French label for ${entity.slug}`);
    }
    return canonical.en;
  }
  const canonical = canonicalSaugeName(entity);
  if (!canonical) fail(`Sauge Noire canonical name is unavailable for ${entity.type} ${entity.slug}`);
  if (normalizeKey(entity.label) !== normalizeKey(canonical)) {
    fail(`Sauge Noire source name diverges from its canonical dataset for ${entity.slug}`);
  }
  return canonical;
}

function canonicalMappingAvailable(entity, targetSlug) {
  if (targetSlug === "trouvable") {
    if (entity.type === "menu") return Boolean(TROUVABLE_CANONICAL_NAMES.menu);
    if (entity.type === "category") return Boolean(TROUVABLE_CANONICAL_NAMES.categories[normalizeKey(entity.slug ?? entity.label)]);
    return Boolean(TROUVABLE_CANONICAL_NAMES.dishes[entity.slug]);
  }
  if (targetSlug === MAISON_ELYSE_SLUG) {
    if (entity.type === "menu") return true;
    if (entity.type === "category") return Boolean(getCategories("en").find((item) => item.slug === entity.slug));
    return Boolean(getDishBySlug(entity.slug, "en"));
  }
  if (entity.type === "menu") return true;
  if (entity.type === "category") return Boolean(canonicalSaugeName(entity));
  return Boolean(canonicalSaugeName(entity));
}

function canonicalCoverage(entities, targetSlug) {
  const missing = entities
    .filter((entity) => !canonicalMappingAvailable(entity, targetSlug))
    .map((entity) => `${entity.type}:${entity.slug}`);
  const mapped = entities.length - missing.length;
  return {
    mapped,
    required: entities.length,
    complete: missing.length === 0,
    missing
  };
}

function canonicalMaisonFields(entity, snapshot) {
  const sourceLocale = snapshot.sourceLocale;
  const sourceRestaurant = getRestaurant(sourceLocale === "en-CA" ? "en" : "fr");
  const englishRestaurant = getRestaurant("en");
  if (entity.type === "menu") {
    if (normalizeKey(snapshot.menu.name) !== normalizeKey(sourceRestaurant.name)) {
      fail(`Maison Élyse menu name diverges from the repository source: ${snapshot.menu.name}`);
    }
    return { menuName: englishRestaurant.name };
  }
  if (entity.type === "category") {
    const source = getCategories("fr").find((item) => item.slug === entity.slug);
    const english = getCategories("en").find((item) => item.slug === entity.slug);
    if (!source || !english) fail(`Maison Élyse category slug is not in the canonical dataset: ${entity.slug}`);
    if (normalizeKey(entity.label) !== normalizeKey(source.name)) {
      fail(`Maison Élyse category diverges from canonical source: ${entity.slug}`);
    }
    const result = { name: english.name };
    if (entity.fields.description) result.description = english.description;
    return result;
  }
  const source = getDishBySlug(entity.slug, "fr");
  const english = getDishBySlug(entity.slug, "en");
  if (!source || !english) fail(`Maison Élyse dish slug is not in the canonical dataset: ${entity.slug}`);
  if (normalizeKey(entity.label) !== normalizeKey(source.name)) {
    fail(`Maison Élyse dish name diverges from canonical source: ${entity.slug}`);
  }
  const result = {};
  for (const field of Object.keys(entity.fields)) {
    if (field === "name") result.name = english.name;
    else if (field === "description") {
      const sourceValue = entity.fields[field];
      if (sourceValue === source.shortDescription) result.description = english.shortDescription;
      else if (sourceValue === source.description) result.description = english.description;
      else fail(`Maison Élyse source description diverges from canonical source: ${entity.slug}`);
    } else if (field === "ingredients") result.ingredients = english.ingredients;
    else if (field === "options") result.options = english.options;
    else if (field === "houseNote") result.houseNote = english.chefRecommendation;
    else if (field === "allergens") result.allergens = english.allergens;
    else if (field === "tags") {
      result.tags = entity.fields.tags.map((tag) => STANDARD_TAGS.get(normalizeKey(tag)) ?? tag);
    }
  }
  return result;
}

function canonicalContentFor(entity, snapshot, existingRow) {
  const existingContent = objectInput(existingRow?.content);
  const overrides = objectInput(existingRow?.manual_overrides);
  const target = snapshot.targetSlug;
  const canonical = target === MAISON_ELYSE_SLUG
    ? canonicalMaisonFields(entity, snapshot)
    : entity.type === "menu"
      ? { menuName: canonicalNameForTarget(entity, snapshot) }
      : { name: canonicalNameForTarget(entity, snapshot) };
  const canonicalName = canonical.name ?? canonical.menuName;
  if (isPlaceholderName(canonicalName)) fail(`${target} canonical name is empty or placeholder for ${entity.slug}`);

  const content = { ...existingContent };
  const requiredFields = target === MAISON_ELYSE_SLUG
    ? Object.keys(entity.fields)
    : entity.type === "menu" ? ["menuName"] : ["name"];
  for (const field of requiredFields) {
    if (overrides[field] === true) {
      if (!isUsableValue(existingContent[field])) {
        fail(`${target} manual override for ${entity.slug}.${field} has no usable content`);
      }
      continue;
    }
    if (!isUsableValue(canonical[field])) {
      fail(`${target} canonical content is incomplete for ${entity.slug}.${field}`);
    }
    content[field] = canonical[field];
  }
  return { content, overrides, requiredFields };
}

export function validateSnapshot(snapshot) {
  const errors = [];
  if (!snapshot.restaurant || snapshot.restaurant.slug !== snapshot.targetSlug) {
    errors.push("restaurant identity does not match the requested slug");
  }
  if (!snapshot.menu || snapshot.menu.restaurant_id !== snapshot.restaurant?.id) {
    errors.push("menu restaurant relation is invalid");
  }
  if (!snapshot.menu?.id || !snapshot.menu.slug) errors.push("primary menu id/slug is missing");
  if (
    snapshot.targetSlug !== MAISON_ELYSE_SLUG &&
    snapshot.defaultLocale !== "fr-CA"
  ) {
    errors.push(`default locale must be fr-CA, got ${snapshot.defaultLocale || "missing"}`);
  }
  if (
    snapshot.targetSlug === MAISON_ELYSE_SLUG &&
    snapshot.defaultLocale &&
    snapshot.defaultLocale !== "fr-CA"
  ) {
    errors.push(`Maison Élyse default locale must be fr-CA, got ${snapshot.defaultLocale}`);
  }
  for (const row of snapshot.categories ?? []) {
    if (row.restaurant_id !== snapshot.restaurant?.id || row.menu_id !== snapshot.menu?.id) errors.push(`category relation is invalid: ${row.slug || row.id}`);
    if (!row.slug || isPlaceholderName(row.name)) errors.push(`category name/slug is invalid: ${row.slug || row.id}`);
  }
  for (const row of snapshot.dishes ?? []) {
    if (row.restaurant_id !== snapshot.restaurant?.id || row.menu_id !== snapshot.menu?.id) errors.push(`dish relation is invalid: ${row.slug || row.id}`);
    if (!row.slug || isPlaceholderName(row.name)) errors.push(`dish name/slug is invalid: ${row.slug || row.id}`);
  }
  return errors;
}

function rowIdColumn(type) {
  if (type === "menu") return "menu_id";
  if (type === "category") return "category_id";
  return "dish_id";
}

function rowFromMap(rowsByKey, entity) {
  return rowsByKey.get(entityKey(entity.type, entity.id));
}

function diffFields(before, after) {
  const changes = [];
  for (const key of ["translation_status", "provider", "source_hash", "field_hashes", "content", "manual_overrides"]) {
    if (stableJson(before?.[key]) !== stableJson(after[key])) changes.push(key);
  }
  return changes;
}

function missingFields(content, fields, requiredFields) {
  return requiredFields.filter((field) => !isUsableValue(content[field]) || !(field in fields));
}

export function buildPlan(snapshot, { now = "2026-01-01T00:00:00.000Z" } = {}) {
  const errors = validateSnapshot(snapshot);
  const entities = buildEntities(snapshot);
  const menuSettings = buildMenuSettingsPlan(snapshot);
  const coverage = canonicalCoverage(entities, snapshot.targetSlug);
  if (!coverage.complete) {
    errors.push(
      `${snapshot.targetSlug} canonical English name mapping is incomplete: ` +
      `${coverage.mapped}/${coverage.required} entities mapped; missing ${coverage.missing.join(", ")}`
    );
  }
  const rowsByKey = new Map((snapshot.rows ?? []).map((row) => [entityKey(row.entityType, row.entityId), row]));
  const operations = [];

  for (const entity of coverage.complete ? entities : []) {
    const existing = rowFromMap(rowsByKey, entity);
    const { content, overrides, requiredFields } = canonicalContentFor(entity, snapshot, existing);
    const hashes = {
      source_hash: sourceHashFor(entity.fields),
      field_hashes: fieldHashesFor(entity.fields)
    };
    const existingFieldHashes = objectInput(existing?.field_hashes);
    const preservedFieldsProven = Object.keys(entity.fields)
      .filter((field) => !["name", "menuName"].includes(field) && overrides[field] !== true)
      .every((field) => existingFieldHashes[field] === hashes.field_hashes[field]);
    const complete = hasAllFields(content, entity.fields) &&
      (snapshot.targetSlug === MAISON_ELYSE_SLUG || preservedFieldsProven);
    const status = snapshot.targetSlug === MAISON_ELYSE_SLUG
      ? complete ? "up_to_date" : "missing"
      : complete ? "up_to_date" : "stale";
    const patch = {
      ...(existing?.id ? { id: existing.id } : {}),
      restaurant_id: snapshot.restaurant.id,
      menu_id: snapshot.menu.id,
      [rowIdColumn(entity.type)]: entity.id,
      locale: snapshot.locale,
      translation_status: status,
      provider: existing?.provider ?? "canonical-backfill",
      ...hashes,
      content,
      manual_overrides: overrides,
      error_message: null,
      translated_at: now,
      updated_at: now
    };
    const changed = diffFields(existing, patch);
    operations.push({
      entityType: entity.type,
      entityId: entity.id,
      slug: entity.slug,
      label: entity.label,
      existing,
      patch,
      requiredFields,
      missingFields: missingFields(content, entity.fields, requiredFields),
      changed,
      action: existing ? (changed.length ? "update" : "noop") : "insert"
    });
  }

  const incomplete = operations.filter((operation) => operation.patch.translation_status === "missing");
  if (incomplete.length > 0) {
    errors.push(`translation content is incomplete for ${incomplete.length} Maison Élyse entities; no apply is permitted`);
  }
  return {
    ok: errors.length === 0,
    errors,
    target: {
      slug: snapshot.targetSlug,
      restaurantId: snapshot.restaurant.id,
      restaurantName: snapshot.restaurant.name,
      menuId: snapshot.menu.id,
      menuSlug: snapshot.menu.slug,
      defaultLocale: snapshot.defaultLocale,
      locale: snapshot.locale,
      canonicalCoverage: coverage,
      menuSettings
    },
    counts: {
      categories: snapshot.categories.length,
      dishes: snapshot.dishes.length,
      entities: entities.length,
      existingRows: snapshot.rows.length,
      translations: snapshot.translationRows ?? {
        menu: snapshot.rows.filter((row) => row.entityType === "menu").length,
        categories: snapshot.rows.filter((row) => row.entityType === "category").length,
        dishes: snapshot.rows.filter((row) => row.entityType === "dish").length
      },
      inserts: operations.filter((item) => item.action === "insert").length,
      updates: operations.filter((item) => item.action === "update").length,
      noops: operations.filter((item) => item.action === "noop").length
    },
    canonicalCoverage: coverage,
    menuSettings,
    operations
  };
}

function selectedColumns(entityType) {
  const identity = entityType === "menu" ? "" : entityType === "category" ? ",category_id" : ",dish_id";
  return `id,restaurant_id,menu_id${identity},locale,translation_status,provider,source_hash,field_hashes,content,manual_overrides,error_message,translated_at,updated_at`;
}

async function readRows(client, table, query) {
  let request = client.from(table).select(query.columns ?? "*");
  for (const [key, value] of Object.entries(query.filters ?? {})) request = request.eq(key, value);
  if (query.orderBy) request = request.order(query.orderBy, { ascending: true });
  const result = await request;
  if (result.error) fail(`${table} read failed: ${result.error.message}`);
  return result.data ?? [];
}

function choosePrimaryMenu(rows, slug) {
  const scoped = rows.filter((row) => row.slug === slug || row.slug === "principal");
  return scoped.find((row) => row.is_primary === true && row.status === "published")
    ?? scoped.find((row) => row.is_primary === true)
    ?? scoped.find((row) => row.slug === "principal")
    ?? rows.find((row) => row.status !== "archived")
    ?? null;
}

export async function readSnapshot(client, targetSlug, locale) {
  const restaurants = await readRows(client, "restaurants", {
    columns: "id,name,slug,status",
    filters: { slug: targetSlug }
  });
  if (restaurants.length !== 1) fail(`${targetSlug}: expected exactly one restaurant row for the exact slug, got ${restaurants.length}`);
  const restaurant = restaurants[0];
  const menus = await readRows(client, "menus", {
    columns: "id,restaurant_id,name,slug,status,is_primary,settings_json",
    filters: { restaurant_id: restaurant.id },
    orderBy: "display_order"
  });
  const menu = choosePrimaryMenu(menus, targetSlug === "maison-elyse" ? "principal" : "principal");
  if (!menu) fail(`${targetSlug}: no non-archived primary menu was found`);
  const [categories, dishes, menuRows, categoryRows, dishRows] = await Promise.all([
    readRows(client, "menu_categories", { columns: "id,restaurant_id,menu_id,name,slug,description,display_order", filters: { restaurant_id: restaurant.id, menu_id: menu.id }, orderBy: "display_order" }),
    readRows(client, "menu_dishes", { columns: "id,restaurant_id,menu_id,category_id,slug,name,short_description,description,allergens,metadata,display_order", filters: { restaurant_id: restaurant.id, menu_id: menu.id }, orderBy: "display_order" }),
    readRows(client, TRANSLATION_TABLES.menu, { columns: selectedColumns("menu"), filters: { menu_id: menu.id, locale } }),
    readRows(client, TRANSLATION_TABLES.category, { columns: selectedColumns("category"), filters: { menu_id: menu.id, locale } }),
    readRows(client, TRANSLATION_TABLES.dish, { columns: selectedColumns("dish"), filters: { menu_id: menu.id, locale } })
  ]);
  const settings = objectInput(menu.settings_json);
  const rows = [
    ...menuRows.map((row) => ({ ...row, entityType: "menu", entityId: menu.id })),
    ...categoryRows.map((row) => ({ ...row, entityType: "category", entityId: row.category_id })),
    ...dishRows.map((row) => ({ ...row, entityType: "dish", entityId: row.dish_id }))
  ];
  return {
    targetSlug,
    restaurant,
    menu,
    categories,
    dishes,
    rows,
    translationRows: {
      menu: menuRows.length,
      categories: categoryRows.length,
      dishes: dishRows.length
    },
    defaultLocale: nonEmpty(settings.defaultLocale) || "",
    locale,
    sourceLocale: nonEmpty(settings.defaultLocale) || ""
  };
}

function reportOperation(operation) {
  const currentFieldHashes = objectInput(operation.existing?.field_hashes);
  const hashDivergences = {};
  if ((operation.existing?.source_hash ?? null) !== operation.patch.source_hash) {
    hashDivergences.source_hash = {
      current: operation.existing?.source_hash ?? null,
      desired: operation.patch.source_hash
    };
  }
  for (const [field, desired] of Object.entries(operation.patch.field_hashes)) {
    const current = currentFieldHashes[field] ?? null;
    if (current !== desired) hashDivergences[field] = { current, desired };
  }
  return {
    entityType: operation.entityType,
    entityId: operation.entityId,
    slug: operation.slug,
    label: operation.label,
    action: operation.action,
    changed: operation.changed,
    requiredFields: operation.requiredFields,
    missingFields: operation.missingFields,
    current_source_hash: operation.existing?.source_hash ?? null,
    source_hash: operation.patch.source_hash,
    current_field_hashes: currentFieldHashes,
    field_hashes: operation.patch.field_hashes,
    hash_divergences: hashDivergences,
    translation_status: operation.patch.translation_status
  };
}

function reportMenuSettings(settings) {
  return {
    changed: settings.changed,
    changedFields: settings.changedFields,
    currentHash: settings.currentHash,
    desiredHash: settings.desiredHash,
    desiredDefaultLocale: settings.desired.defaultLocale ?? null,
    desiredSupportedLocales: settings.desired.supportedLocales ?? []
  };
}

async function applyPlan(client, plan) {
  if (!plan.ok) fail(`refusing to apply an invalid plan: ${plan.errors.join(" | ")}`);
  const byTable = new Map();
  const applied = [];
  if (plan.menuSettings.changed) {
    const currentResult = await client
      .from("menus")
      .select("settings_json")
      .eq("id", plan.target.menuId)
      .eq("restaurant_id", plan.target.restaurantId)
      .single();
    if (currentResult.error) fail(`menus settings guard read failed: ${currentResult.error.message}`);
    const currentHash = hashTranslationValue(objectInput(currentResult.data?.settings_json));
    if (currentHash !== plan.menuSettings.currentHash) {
      fail("menus.settings_json changed after the dry-run snapshot; refusing to overwrite concurrent settings");
    }
    const updateResult = await client
      .from("menus")
      .update({ settings_json: plan.menuSettings.desired })
      .eq("id", plan.target.menuId)
      .eq("restaurant_id", plan.target.restaurantId);
    if (updateResult.error) fail(`menus settings apply failed: ${updateResult.error.message}`);
    applied.push({ table: "menus", rows: 1, changedFields: plan.menuSettings.changedFields });
  }
  for (const operation of plan.operations) {
    if (operation.action === "noop") continue;
    const table = TRANSLATION_TABLES[operation.entityType];
    byTable.set(table, [...(byTable.get(table) ?? []), operation.patch]);
  }
  for (const [table, rows] of byTable) {
    const conflict = table === TRANSLATION_TABLES.menu ? "menu_id,locale" : table === TRANSLATION_TABLES.category ? "category_id,locale" : "dish_id,locale";
    const result = await client.from(table).upsert(rows, { onConflict: conflict });
    if (result.error) fail(`${table} apply failed: ${result.error.message}`);
    applied.push({ table, rows: rows.length });
  }
  return applied;
}

function safeWriteReport(path, report) {
  if (!path) return;
  if (existsSync(path)) fail(`report path already exists; refusing to overwrite: ${path}`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export async function run({ args, env = process.env, log = console.log, clientFactory } = {}) {
  const report = {
    script: SCRIPT_NAME,
    mode: args.apply ? "apply" : "dry-run",
    binding: {
      environment: args.environment || null,
      expectedProjectRef: args.projectRef || null,
      explicitlyAllowedProjectRefs: args.allowedProjectRefs
    },
    targets: [],
    ok: false,
    applied: []
  };
  const argumentErrors = validateArgs(args);
  if (argumentErrors.length) {
    report.errors = argumentErrors;
    log(JSON.stringify(report, null, 2));
    safeWriteReport(args.reportPath, report);
    return report;
  }
  try {
    const binding = assertExplicitBinding({ args, url: env.NEXT_PUBLIC_SUPABASE_URL, env });
    report.binding = { ...report.binding, ...binding };
    if (!env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is unavailable; no live Supabase read/apply was attempted");
    const factory = clientFactory ?? (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
    });
    const client = await factory();
    const plans = [];
    const planningErrors = [];
    for (const slug of args.restaurants) {
      try {
        const snapshot = await readSnapshot(client, slug, args.locale);
        const plan = buildPlan(snapshot);
        plans.push(plan);
        report.targets.push({
          ...plan.target,
          menuSettings: reportMenuSettings(plan.menuSettings),
          ok: plan.ok,
          errors: plan.errors,
          counts: plan.counts,
          operations: plan.operations.map(reportOperation)
        });
        if (!plan.ok) planningErrors.push(`${slug}: ${plan.errors.join(" | ")}`);
      } catch (error) {
        const message = redactError(error);
        report.targets.push({ slug, ok: false, errors: [message] });
        planningErrors.push(`${slug}: ${message}`);
      }
    }
    if (planningErrors.length) fail(planningErrors.join(" | "));
    if (args.apply) {
      for (const plan of plans) report.applied.push(...await applyPlan(client, plan));
    }
    report.ok = true;
    report.note = args.apply ? "apply completed" : "dry-run completed; no rows were written";
  } catch (error) {
    report.errors = [...(report.errors ?? []), redactError(error)];
  }
  log(JSON.stringify(report, null, 2));
  safeWriteReport(args.reportPath, report);
  return report;
}

function printHelp() {
  console.log(`Usage: node scripts/backfill-menu-translations.mjs --environment <local|preview|production|test> --project-ref <ref> --allow-project-ref <ref> [options]\n\nDry-run is the default. Writes require --apply. Production additionally requires --authorize-production --production-binding <same-ref>.\nOptions: --restaurant <slug> --locale <locale> --report <new-json-path>`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) printHelp();
  else {
    const result = await run({ args });
    if (!result.ok) process.exitCode = 2;
  }
}
