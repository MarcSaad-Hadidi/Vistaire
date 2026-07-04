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

const settings = {
  defaultLocale: "fr-CA",
  supportedLocales: ["fr-CA", "de-DE", "el-GR"],
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

const dish = {
  id: "dish-smoked-meat",
  slug: "smoked-meat-saint-laurent",
  name: "Smoked meat Saint-Laurent",
  description:
    "Pain de seigle garni de smoked meat montrealais, moutarde classique et accompagnement maison.",
  categoryId: "sandwichs",
  category: "Sandwichs",
  categoryDescription: "Classiques chauds",
  priceLabel: "$22",
  priceCents: 2200,
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
  ingredients: ["Smoked meat", "Pain de seigle", "Moutarde"],
  allergens: ["Ble/seigle", "Moutarde"],
  options: ["Extra smoked meat", "Moutarde a part"],
  houseNote:
    "Un clin d'oeil direct aux classiques montrealais, servi chaud et tranche genereusement.",
  tags: ["Signature", "Accompagnement maison"]
};

const menu = {
  restaurantId: "restaurant-1",
  menuId: "menu-1",
  slug: "trouvable",
  name: "Trouvable",
  location: "Montreal",
  cuisineType: "Brunch premium",
  googleReview: { enabled: false, googleReviewUrl: "" },
  settings,
  source: "supabase",
  dishes: [dish]
};

function rowFor(locale, idField, id, fields, content, overrides = {}) {
  return {
    locale,
    [idField]: id,
    translation_status: "up_to_date",
    source_hash: sourceHashFor(fields),
    field_hashes: fieldHashesFor(fields),
    content,
    ...overrides
  };
}

const categoryFields = {
  name: dish.category,
  description: dish.categoryDescription
};

const dishFields = {
  description: dish.description,
  ingredients: dish.ingredients,
  allergens: dish.allergens,
  options: dish.options,
  houseNote: dish.houseNote,
  tags: dish.tags
};

test("public menu readiness only exposes locales with complete stored menu content", () => {
  const statuses = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    categoryRows: [
      rowFor("de-DE", "category_id", "sandwichs", categoryFields, {
        name: "Sandwiches",
        description: "Warme Klassiker"
      }),
      rowFor("el-GR", "category_id", "sandwichs", categoryFields, {
        name: "Σάντουιτς",
        description: "Ζεστά κλασικά"
      })
    ],
    dishRows: [
      rowFor("de-DE", "dish_id", dish.id, dishFields, {
        description:
          "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
        ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
        allergens: ["Weizen/Roggen", "Senf"],
        options: ["Extra Smoked Meat", "Senf separat"],
        houseNote:
          "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
        tags: ["Empfehlung", "Hausbeilage"]
      })
    ]
  });

  assert.deepEqual(
    statuses.map(({ locale, status }) => ({ locale, status })),
    [
      { locale: "fr-CA", status: "source" },
      { locale: "de-DE", status: "up_to_date" },
      { locale: "el-GR", status: "missing" }
    ]
  );
  assert.deepEqual(
    filterPublicMenuSettingsForReadyTranslations(settings, statuses).supportedLocales,
    ["fr-CA", "de-DE"]
  );
  assert.deepEqual(
    statuses.find((status) => status.locale === "el-GR"),
    {
      locale: "el-GR",
      status: "missing",
      reason: "missing row",
      entityType: "dish",
      entityId: dish.id,
      entityLabel: dish.name,
      field: "description"
    }
  );
});

test("stored translation rows require translated content for every source field", () => {
  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor("de-DE", "dish_id", dish.id, dishFields, {
        description: "",
        ingredients: ["Smoked Meat"],
        allergens: ["Senf"],
        options: ["Senf separat"],
        houseNote: "",
        tags: ["Empfehlung"]
      }),
      dishFields
    ),
    false
  );

  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor("de-DE", "dish_id", dish.id, dishFields, {
        description:
          "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
        ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
        allergens: ["Weizen/Roggen", "Senf"],
        options: ["Extra Smoked Meat", "Senf separat"],
        houseNote:
          "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
        tags: ["Empfehlung", "Hausbeilage"]
      }),
      dishFields
    ),
    true
  );
});

test("public readiness accepts field-complete rows with stale aggregate hashes only", () => {
  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor(
        "de-DE",
        "dish_id",
        dish.id,
        dishFields,
        {
          description:
            "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
          ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
          allergens: ["Weizen/Roggen", "Senf"],
          options: ["Extra Smoked Meat", "Senf separat"],
          houseNote:
            "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
          tags: ["Empfehlung", "Hausbeilage"]
        },
        {
          source_hash: "legacy-aggregate-hash"
        }
      ),
      dishFields
    ),
    true
  );

  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor(
        "de-DE",
        "dish_id",
        dish.id,
        dishFields,
        {
          description:
            "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
          ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
          allergens: ["Weizen/Roggen", "Senf"],
          options: ["Extra Smoked Meat", "Senf separat"],
          houseNote:
            "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
          tags: ["Empfehlung", "Hausbeilage"]
        },
        {
          translation_status: "pending",
          source_hash: "legacy-aggregate-hash"
        }
      ),
      dishFields
    ),
    false
  );
});

test("derived recommended tags do not block stored content readiness", () => {
  const recommendedDish = {
    ...dish,
    isRecommended: true,
    tags: [...dish.tags, "Recommande"]
  };
  const recommendedMenu = {
    ...menu,
    dishes: [recommendedDish]
  };

  assert.deepEqual(
    publicMenuDishTranslationFields(recommendedDish).tags,
    dish.tags
  );

  const statuses = publicMenuTranslationStatusesForRows(recommendedMenu, {
    menuRows: [],
    categoryRows: [
      rowFor("de-DE", "category_id", "sandwichs", categoryFields, {
        name: "Sandwiches",
        description: "Warme Klassiker"
      })
    ],
    dishRows: [
      rowFor("de-DE", "dish_id", dish.id, dishFields, {
        description:
          "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
        ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
        allergens: ["Weizen/Roggen", "Senf"],
        options: ["Extra Smoked Meat", "Senf separat"],
        houseNote:
          "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
        tags: ["Empfehlung", "Hausbeilage"]
      })
    ]
  });

  assert.deepEqual(
    statuses.find((status) => status.locale === "de-DE"),
    { locale: "de-DE", status: "up_to_date" }
  );
});
