import test from "node:test";
import assert from "node:assert/strict";

import {
  filterPublicMenuSettingsForReadyTranslations,
  publicMenuDishTranslationFields,
  publicMenuTranslationStatusesForRows,
  storedTranslationRowMatchesFields
} from "../lib/menu/publicMenuTranslationReadiness.ts";
import {
  fieldHashesFor,
  sourceHashFor
} from "../lib/translation/menuTranslationModel.ts";
import {
  registerPublicMenuDishTranslationSourceLists
} from "../lib/menu/publicMenuCore.ts";
import { getTrouvableReadyLanguageOptions } from "../components/menu/trouvableMenuControls.ts";

const settings = {
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "en-CA"],
  baseCurrency: "CAD",
  defaultCurrency: "CAD",
  supportedCurrencies: ["CAD"],
  publicMenuStyle: "trouvable",
  timezone: "America/Toronto",
  defaultThemeMode: "dark",
  allowThemeToggle: true,
  allowCurrencySelector: true,
  allowLanguageSelector: true,
  taxIncluded: true,
  priceDisplayMode: "auto"
};

const baseDish = {
  id: "dish-1",
  slug: "dish-1",
  name: "Plat source",
  description: "Description source suffisamment distincte.",
  categoryId: "category-1",
  category: "Plats",
  categoryDescription: "La sélection maison",
  priceLabel: "$20",
  priceCents: 2_000,
  priceCurrency: "CAD",
  baseCurrency: "CAD",
  displayPriceMode: "auto",
  imageUrl: "",
  thumbnailUrl: "",
  hasPhoto: false,
  photoStatus: "missing",
  hasImmersive: false,
  has3d: false,
  hasAr: false,
  hasIosAr: false,
  hasAndroidAr: false,
  model3dUrl: "",
  webModel3dUrl: "",
  webModel3dBytes: 0,
  arModel3dUrl: "",
  arModel3dBytes: 0,
  usdzUrl: "",
  arUsdzUrl: "",
  arUsdzBytes: 0,
  posterUrl: "",
  modelStatus: "missing",
  available: true,
  ingredients: ["Poulet mariné", "Riz", "Légumes", "Sauce maison"],
  allergens: ["Gluten"],
  options: ["Extra fromage"],
  houseNote: "Une note maison.",
  tags: ["Maison"]
};

function buildMenu(dish = baseDish) {
  return {
    restaurantId: "restaurant-1",
    menuId: "menu-1",
    slug: "trouvable",
    name: "Trouvable",
    location: "Montreal",
    cuisineType: "Cuisine maison",
    googleReview: { enabled: false, googleReviewUrl: "" },
    settings,
    source: "supabase",
    dishes: [dish]
  };
}

function translatedContent(fields, overrides = {}) {
  return {
    description: "Chicken with rice and vegetables.",
    ingredients: ["Chicken", "Rice", "Vegetables", "House sauce"],
    allergens: ["Gluten"],
    options: ["Extra cheese"],
    houseNote: "A house note.",
    tags: ["House"],
    ...overrides,
    // Keep the fixture honest when a test adds an item to the source fields.
    ...(Array.isArray(fields.ingredients) && !("ingredients" in overrides)
      ? { ingredients: fields.ingredients.map((_item, index) => `Ingredient ${index + 1}`) }
      : {}),
    ...(Array.isArray(fields.options) && !("options" in overrides)
      ? { options: fields.options.map((_item, index) => `Option ${index + 1}`) }
      : {})
  };
}

function rowFor(locale, idField, id, fields, content, overrides = {}) {
  return {
    locale,
    [idField]: id,
    translation_status: "up_to_date",
    source_hash: sourceHashFor(fields),
    field_hashes: fieldHashesFor(fields),
    content,
    manual_overrides: {},
    ...overrides
  };
}

function rowsForDish(dish, storedFields, content, rowOverrides = {}) {
  const categoryFields = {
    name: dish.category,
    description: dish.categoryDescription
  };
  return {
    menuRows: [],
    categoryRows: [
      rowFor("en-CA", "category_id", dish.categoryId, categoryFields, {
        name: "Dishes",
        description: "House selection"
      })
    ],
    dishRows: [
      rowFor("en-CA", "dish_id", dish.id, storedFields, content, rowOverrides)
    ]
  };
}

function statusForDish(dish, storedFields, content, rowOverrides = {}) {
  return publicMenuTranslationStatusesForRows(
    buildMenu(dish),
    rowsForDish(dish, storedFields, content, rowOverrides)
  ).find((status) => status.locale === "en-CA");
}

test("legacy capitalization-only list hashes remain ready after the compatibility fix", () => {
  const fields = publicMenuDishTranslationFields(baseDish);
  const legacyFields = {
    ...fields,
    ingredients: ["Poulet mariné", "riz", "légumes", "sauce maison"],
    options: ["extra fromage"]
  };
  const row = rowFor(
    "en-CA",
    "dish_id",
    baseDish.id,
    legacyFields,
    translatedContent(fields)
  );

  assert.equal(storedTranslationRowMatchesFields(row, fields), true);
  assert.equal(statusForDish(baseDish, legacyFields, row.content)?.status, "up_to_date");
  assert.deepEqual(
    filterPublicMenuSettingsForReadyTranslations(
      settings,
      [
        { locale: "fr-CA", status: "source" },
        statusForDish(baseDish, legacyFields, row.content)
      ]
    ).supportedLocales,
    ["fr-CA", "en-CA"]
  );
});

test("a semantic list change remains stale", () => {
  const historicalDish = baseDish;
  const currentDish = {
    ...baseDish,
    ingredients: ["Bœuf", "Riz", "Légumes", "Sauce maison"]
  };
  const historicalFields = publicMenuDishTranslationFields(historicalDish);
  const status = statusForDish(
    currentDish,
    historicalFields,
    translatedContent(publicMenuDishTranslationFields(currentDish))
  );

  assert.equal(status?.status, "stale");
  assert.equal(status?.reason, "source hash mismatch");
});

test("a newly added list item remains stale even when the old translation is complete", () => {
  const currentDish = {
    ...baseDish,
    options: ["Extra fromage", "Extra sauce"]
  };
  const historicalFields = publicMenuDishTranslationFields(baseDish);
  const currentFields = publicMenuDishTranslationFields(currentDish);
  const status = statusForDish(
    currentDish,
    historicalFields,
    translatedContent(currentFields, { options: ["Extra cheese"] })
  );

  assert.equal(status?.status, "stale");
  assert.match(status?.reason ?? "", /missing translated content|source hash mismatch/);
});

test("list order remains part of the source contract", () => {
  const currentDish = {
    ...baseDish,
    ingredients: ["Riz", "Poulet mariné", "Légumes", "Sauce maison"]
  };
  const historicalFields = publicMenuDishTranslationFields(baseDish);
  const status = statusForDish(
    currentDish,
    historicalFields,
    translatedContent(publicMenuDishTranslationFields(currentDish))
  );

  assert.equal(status?.status, "stale");
});

test("whitespace-only source edits use the trimmed canonical representation", () => {
  const whitespaceDish = {
    ...baseDish,
    ingredients: ["  Poulet mariné  ", "Riz", "Légumes", "Sauce maison"],
    options: [" Extra fromage "]
  };
  const fields = publicMenuDishTranslationFields(whitespaceDish);
  const row = rowFor(
    "en-CA",
    "dish_id",
    whitespaceDish.id,
    fields,
    translatedContent(fields)
  );

  assert.equal(statusForDish(whitespaceDish, fields, row.content)?.status, "up_to_date");
});

test("accent and Unicode changes are not globally folded into a matching hash", () => {
  const currentDish = {
    ...baseDish,
    ingredients: ["Bœuf", "Ρύζι", "خضار", "Sauce maison"]
  };
  const historicalDish = {
    ...baseDish,
    ingredients: ["boeuf", "Ρύζι", "خضار", "Sauce maison"]
  };
  const historicalFields = publicMenuDishTranslationFields(historicalDish);
  const currentFields = publicMenuDishTranslationFields(currentDish);
  const status = statusForDish(
    currentDish,
    historicalFields,
    translatedContent(currentFields, {
      ingredients: ["Beef", "Rice", "Vegetables", "House sauce"]
    })
  );

  assert.equal(status?.status, "stale");
});

test("acronym casing changes remain a source change", () => {
  const currentDish = {
    ...baseDish,
    ingredients: ["BBQ", "Riz", "Légumes", "Sauce maison"]
  };
  const historicalDish = {
    ...baseDish,
    ingredients: ["bbq", "Riz", "Légumes", "Sauce maison"]
  };
  const historicalFields = publicMenuDishTranslationFields(historicalDish);
  const currentFields = publicMenuDishTranslationFields(currentDish);
  const status = statusForDish(
    currentDish,
    historicalFields,
    translatedContent(currentFields)
  );

  assert.equal(status?.status, "stale");
});

test("production dishes use their exact raw lists without a variant-size cap", () => {
  const currentIngredients = Array.from(
    { length: 80 },
    (_value, index) => `Ingredient ${index + 1}`
  );
  const legacyIngredients = currentIngredients.map((value, index) =>
    index % 2 === 0 ? value : value[0].toLowerCase() + value.slice(1)
  );
  const currentDish = {
    ...baseDish,
    ingredients: currentIngredients
  };
  registerPublicMenuDishTranslationSourceLists(currentDish, {
    ingredients: legacyIngredients,
    options: baseDish.options
  });
  const fields = publicMenuDishTranslationFields(currentDish);
  const legacyFields = { ...fields, ingredients: legacyIngredients };
  const row = rowFor(
    "en-CA",
    "dish_id",
    currentDish.id,
    legacyFields,
    translatedContent(fields)
  );

  assert.equal(statusForDish(currentDish, legacyFields, row.content)?.status, "up_to_date");
});

test("manual overrides remain authoritative only when their content is usable", () => {
  const fields = publicMenuDishTranslationFields(baseDish);
  const manualRow = rowFor(
    "en-CA",
    "dish_id",
    baseDish.id,
    { ...fields, ingredients: ["Poulet mariné", "riz", "légumes", "sauce maison"] },
    translatedContent(fields, { ingredients: ["Texte éditorial conservé"] }),
    { manual_overrides: { ingredients: true } }
  );

  assert.equal(
    statusForDish(baseDish, fields, manualRow.content, {
      field_hashes: manualRow.field_hashes,
      source_hash: manualRow.source_hash,
      manual_overrides: manualRow.manual_overrides
    })?.status,
    "up_to_date"
  );

  const emptyOverride = statusForDish(
    baseDish,
    fields,
    translatedContent(fields, { ingredients: [] }),
    { manual_overrides: { ingredients: true } }
  );
  assert.equal(emptyOverride?.status, "stale");
});

test("a translated list with too few items never becomes ready", () => {
  const fields = publicMenuDishTranslationFields(baseDish);
  const status = statusForDish(
    baseDish,
    fields,
    translatedContent(fields, { ingredients: ["Chicken", "Rice"] })
  );

  assert.equal(status?.status, "stale");
  assert.match(status?.reason ?? "", /missing translated content/);
});

test("the selector contract exposes multiple ready locales and stays disabled for one", () => {
  const twoLocaleSettings = {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA"]
  };
  const oneLocaleSettings = {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA"]
  };

  const readyOptions = getTrouvableReadyLanguageOptions(twoLocaleSettings, "fr-CA");
  const sourceOnlyOptions = getTrouvableReadyLanguageOptions(oneLocaleSettings, "fr-CA");

  assert.equal(readyOptions.length, 2);
  assert.equal(twoLocaleSettings.supportedLocales.length > 1 && readyOptions.length > 1, true);
  assert.equal(sourceOnlyOptions.length, 1);
  assert.equal(oneLocaleSettings.supportedLocales.length > 1 && sourceOnlyOptions.length > 1, false);
});
