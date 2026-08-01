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

test("dish translation readiness keeps the source dish name out of translatable fields", () => {
  assert.deepEqual(publicMenuDishTranslationFields(dish), dishFields);
  assert.equal("name" in publicMenuDishTranslationFields(dish), false);
});

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
        name: "Montrealer Smoked-Meat-Sandwich",
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
        name: "",
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
        name: "Montrealer Smoked-Meat-Sandwich",
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

test("public readiness does not promote stale rows even when their fields are complete", () => {
  const staleRow = rowFor(
    "de-DE",
    "dish_id",
    dish.id,
    dishFields,
    {
      name: "Montrealer Smoked-Meat-Sandwich",
      description:
        "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
      ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
      allergens: ["Weizen/Roggen", "Senf"],
      options: ["Extra Smoked Meat", "Senf separat"],
      houseNote:
        "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
      tags: ["Empfehlung", "Hausbeilage"]
    },
    { translation_status: "stale" }
  );

  assert.equal(storedTranslationRowMatchesFields(staleRow, dishFields), false);

  const statuses = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    categoryRows: [
      rowFor("de-DE", "category_id", "sandwichs", categoryFields, {
        name: "Sandwiches",
        description: "Warme Klassiker"
      })
    ],
    dishRows: [staleRow]
  });

  assert.deepEqual(
    statuses.find((status) => status.locale === "de-DE"),
    {
      locale: "de-DE",
      status: "stale",
      reason: "row status stale",
      entityType: "dish",
      entityId: dish.id,
      entityLabel: dish.name,
      field: "description"
    }
  );
});

test("public readiness rejects rows with stale aggregate hashes", () => {
  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor(
        "de-DE",
        "dish_id",
        dish.id,
        dishFields,
        {
          name: "Montrealer Smoked-Meat-Sandwich",
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
    false
  );

  assert.equal(
    storedTranslationRowMatchesFields(
      rowFor(
        "de-DE",
        "dish_id",
        dish.id,
        dishFields,
        {
          name: "Montrealer Smoked-Meat-Sandwich",
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

test("public readiness keeps legacy dish rows valid when only identity or derived tags changed the old hash", () => {
  const legacyFields = { name: dish.name, ...dishFields };
  const legacyIdentityRow = rowFor(
    "de-DE",
    "dish_id",
    dish.id,
    legacyFields,
    completeDishContent()
  );
  assert.equal(
    storedTranslationRowMatchesFields(legacyIdentityRow, dishFields),
    true
  );

  const legacyDerivedTagFields = {
    ...legacyFields,
    tags: [...dishFields.tags, "Recommande"]
  };
  const legacyDerivedTagRow = rowFor(
    "de-DE",
    "dish_id",
    dish.id,
    legacyDerivedTagFields,
    completeDishContent()
  );
  assert.equal(
    storedTranslationRowMatchesFields(legacyDerivedTagRow, dishFields, ["Recommande"]),
    true
  );

  assert.equal(
    storedTranslationRowMatchesFields(
      legacyIdentityRow,
      { ...dishFields, description: `${dish.description} updated` }
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
        name: "Montrealer Smoked-Meat-Sandwich",
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

function completeDishContent(overrides = {}) {
  return {
    description:
      "Roggenbrot mit Montreal Smoked Meat, klassischem Senf und hausgemachter Beilage.",
    ingredients: ["Smoked Meat", "Roggenbrot", "Senf"],
    allergens: ["Weizen/Roggen", "Senf"],
    options: ["Extra Smoked Meat", "Senf separat"],
    houseNote:
      "Eine direkte Anspielung auf Montrealer Klassiker, warm serviert und grosszugig geschnitten.",
    tags: ["Empfehlung", "Hausbeilage"],
    ...overrides
  };
}

function completeRows(locale, dishContent = completeDishContent(), categoryContent = {
  name: "Sandwiches",
  description: "Warme Klassiker"
}) {
  return {
    categoryRows: [
      rowFor(locale, "category_id", "sandwichs", categoryFields, categoryContent)
    ],
    dishRows: [rowFor(locale, "dish_id", dish.id, dishFields, dishContent)]
  };
}

test("public readiness never promotes missing or non-ready row states", () => {
  const statuses = [
    {
      label: "missing",
      rows: completeRows("de-DE")
    },
    {
      label: "pending",
      rows: completeRows("de-DE", completeDishContent(), undefined)
    },
    {
      label: "in_progress",
      rows: completeRows("de-DE")
    },
    {
      label: "error",
      rows: completeRows("de-DE")
    },
    {
      label: "stale",
      rows: completeRows("de-DE")
    }
  ].map(({ label, rows }) => {
    const dishRows =
      label === "missing"
        ? []
        : rows.dishRows.map((row) => ({
            ...row,
            ...(label === "pending" || label === "in_progress" || label === "error"
              ? { translation_status: label }
              : label === "stale"
                ? { translation_status: "stale" }
                : {})
          }));
    return publicMenuTranslationStatusesForRows(
      menu,
      {
        menuRows: [],
        categoryRows: rows.categoryRows,
        dishRows
      }
    ).find((status) => status.locale === "de-DE");
  });

  assert.deepEqual(
    statuses.map((status) => status.status),
    ["missing", "pending", "in_progress", "error", "stale"]
  );
});

test("present descriptions and category descriptions must be translated", () => {
  const missingDescription = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...completeRows("de-DE", completeDishContent({ description: "" }))
  }).find((status) => status.locale === "de-DE");
  assert.equal(missingDescription?.status, "stale");
  assert.equal(missingDescription?.field, "description");

  const sourceDescription = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...completeRows("de-DE", completeDishContent({ description: dish.description }))
  }).find((status) => status.locale === "de-DE");
  assert.equal(sourceDescription?.status, "stale");
  assert.equal(sourceDescription?.reason, "source language content");

  const missingCategoryDescription = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...completeRows("de-DE", completeDishContent(), { name: "Sandwiches", description: "" })
  }).find((status) => status.locale === "de-DE");
  assert.equal(missingCategoryDescription?.status, "stale");
  assert.equal(missingCategoryDescription?.entityType, "category");
  assert.equal(missingCategoryDescription?.field, "description");
});

test("manual overrides are inspected before source-language rejection but remain fail-closed", () => {
  const identicalOverride = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...completeRows("de-DE", completeDishContent({ description: dish.description }))
  }).find((status) => status.locale === "de-DE");
  assert.equal(identicalOverride?.status, "stale");

  const identicalOverrideRows = completeRows(
    "de-DE",
    completeDishContent({ description: dish.description })
  );
  identicalOverrideRows.dishRows[0].manual_overrides = { description: true };
  assert.equal(
    publicMenuTranslationStatusesForRows(menu, {
      menuRows: [],
      ...identicalOverrideRows
    }).find((status) => status.locale === "de-DE")?.status,
    "up_to_date"
  );

  const emptyOverrideRows = completeRows("de-DE", completeDishContent({ description: "" }));
  emptyOverrideRows.dishRows[0].manual_overrides = { description: true };
  const emptyOverride = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...emptyOverrideRows
  }).find((status) => status.locale === "de-DE");
  assert.equal(emptyOverride?.status, "stale");
  assert.equal(emptyOverride?.field, "description");

  const invalidOverrideRows = completeRows("de-DE");
  invalidOverrideRows.dishRows[0].manual_overrides = { description: "yes" };
  const invalidOverride = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...invalidOverrideRows
  }).find((status) => status.locale === "de-DE");
  assert.equal(invalidOverride?.status, "stale");
  assert.equal(invalidOverride?.field, "description");

  const differentOverrideRows = completeRows(
    "de-DE",
    completeDishContent({ description: "Description conservée volontairement." })
  );
  differentOverrideRows.dishRows[0].manual_overrides = { description: true };
  assert.equal(
    publicMenuTranslationStatusesForRows(menu, {
      menuRows: [],
      ...differentOverrideRows
    }).find((status) => status.locale === "de-DE")?.status,
    "up_to_date"
  );

  const staleAggregateOverrideRows = completeRows(
    "de-DE",
    completeDishContent({ description: "Description conservée volontairement." })
  );
  staleAggregateOverrideRows.dishRows[0].manual_overrides = {
    description: true
  };
  staleAggregateOverrideRows.dishRows[0].source_hash = "stale-aggregate-hash";
  assert.equal(
    publicMenuTranslationStatusesForRows(menu, {
      menuRows: [],
      ...staleAggregateOverrideRows
    }).find((status) => status.locale === "de-DE")?.status,
    "up_to_date"
  );

  const mixedRows = completeRows(
    "de-DE",
    completeDishContent({
      description: dish.description,
      ingredients: ["Only one translated ingredient"]
    })
  );
  mixedRows.dishRows[0].manual_overrides = { description: true };
  const mixed = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...mixedRows
  }).find((status) => status.locale === "de-DE");
  assert.equal(mixed?.status, "stale");
  assert.equal(mixed?.field, "ingredients");
});

test("rows with missing or stale hashes are never promoted", () => {
  const completeLegacyDish = rowFor(
    "de-DE",
    "dish_id",
    dish.id,
    dishFields,
    completeDishContent(),
    { source_hash: "legacy-source", field_hashes: {} }
  );
  const completeLegacy = publicMenuTranslationStatusesForRows(
    menu,
    {
      menuRows: [],
      categoryRows: completeRows("de-DE").categoryRows,
      dishRows: [completeLegacyDish]
    }
  ).find((status) => status.locale === "de-DE");
  assert.equal(completeLegacy?.status, "stale");
  assert.equal(completeLegacy?.reason, "source hash mismatch");

  const emptyFieldHashes = publicMenuTranslationStatusesForRows(
    menu,
    {
      menuRows: [],
      categoryRows: completeRows("de-DE").categoryRows,
      dishRows: [
        rowFor(
          "de-DE",
          "dish_id",
          dish.id,
          dishFields,
          completeDishContent(),
          { source_hash: sourceHashFor(dishFields), field_hashes: {} }
        )
      ]
    }
  ).find((status) => status.locale === "de-DE");
  assert.equal(emptyFieldHashes?.status, "stale");
  assert.equal(emptyFieldHashes?.reason, "field hash mismatch");

  const incompleteLegacy = publicMenuTranslationStatusesForRows(
    menu,
    {
      menuRows: [],
      categoryRows: completeRows("de-DE").categoryRows,
      dishRows: [
        {
          ...completeLegacyDish,
          content: completeDishContent({ description: "" })
        }
      ]
    }
  ).find((status) => status.locale === "de-DE");
  assert.equal(incompleteLegacy?.status, "stale");
  assert.equal(incompleteLegacy?.field, "description");

  const pendingLegacy = publicMenuTranslationStatusesForRows(
    menu,
    {
      menuRows: [],
      categoryRows: completeRows("de-DE").categoryRows,
      dishRows: [{ ...completeLegacyDish, translation_status: "pending" }]
    }
  ).find((status) => status.locale === "de-DE");
  assert.equal(pendingLegacy?.status, "pending");
});

test("French dish names remain allowed because dish names are source identity", () => {
  const status = publicMenuTranslationStatusesForRows(menu, {
    menuRows: [],
    ...completeRows("de-DE", {
      ...completeDishContent(),
      name: dish.name
    })
  }).find((candidate) => candidate.locale === "de-DE");

  assert.deepEqual(status, { locale: "de-DE", status: "up_to_date" });
});

test("UI copy readiness also gates the public locale list", () => {
  const uiMenu = {
    ...menu,
    settings: {
      ...settings,
      supportedLocales: ["fr-CA", "de-DE", "ja-JP"]
    }
  };
  const deRows = completeRows("de-DE");
  const jaRows = completeRows("ja-JP");
  const statuses = publicMenuTranslationStatusesForRows(uiMenu, {
    menuRows: [],
    categoryRows: [...deRows.categoryRows, ...jaRows.categoryRows],
    dishRows: [...deRows.dishRows, ...jaRows.dishRows]
  });

  assert.equal(statuses.find((status) => status.locale === "de-DE")?.status, "up_to_date");
  assert.equal(statuses.find((status) => status.locale === "ja-JP")?.status, "missing");
  assert.equal(statuses.find((status) => status.locale === "ja-JP")?.field, "uiCopy");
  assert.deepEqual(
    filterPublicMenuSettingsForReadyTranslations(uiMenu.settings, statuses)
      .supportedLocales,
    ["fr-CA", "de-DE"]
  );
});
