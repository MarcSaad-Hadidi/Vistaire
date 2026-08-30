import { createHash } from "node:crypto";
import {
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  CANONICAL_ENGLISH_DISH_NAMES,
  CANONICAL_ENGLISH_SECTIONS,
  canonicalDishDisplayOrder,
  canonicalDishSlug
} from "../../scripts/owner/sync-sauge-noire-menu.mjs";
import { fixtureDishSha256 } from "./fixture-dish-images.mjs";

const restaurantId = "11111111-1111-4111-8111-111111111111";
const menuId = "22222222-2222-4222-8222-222222222222";
export const maisonRestaurantId = "11111111-1111-4111-8111-111111111112";
const maisonMenuId = "22222222-2222-4222-8222-222222222223";
const maisonCategoryId = "33333333-3333-4333-8333-333333333308";
const maisonDishId = "44444444-4444-4444-8444-999999999999";
const maisonPhotoStoragePath =
  `restaurants/${maisonRestaurantId}/photos/originals/${maisonDishId}.png`;
const trouvableRestaurantId = "11111111-1111-4111-8111-111111111113";
const trouvableMenuId = "22222222-2222-4222-8222-222222222224";
const trouvableCategoryId = "33333333-3333-4333-8333-333333333309";
const trouvableDishId = "44444444-4444-4444-8444-999999999998";
const trouvablePhotoStoragePath =
  `restaurants/${trouvableRestaurantId}/photos/originals/${trouvableDishId}.png`;

const legacyCategoryNames = [
  ["33333333-3333-4333-8333-333333333301", "Amuse-bouches", "Ouvertures de saison"],
  ["33333333-3333-4333-8333-333333333302", "Cru & frais", "Fraîcheur, acidité, texture"],
  ["33333333-3333-4333-8333-333333333303", "Canard & braise", "Le feu en profondeur"],
  ["33333333-3333-4333-8333-333333333304", "Poissons", "Marées du Saint-Laurent"],
  ["33333333-3333-4333-8333-333333333305", "Végétal", "Le jardin en mouvement"],
  ["33333333-3333-4333-8333-333333333306", "Cocktails signature", "Infusions, amers et botanicals"],
  ["33333333-3333-4333-8333-333333333307", "Douceurs", "Finir doucement"]
];

const categoryNames = CANONICAL_SECTIONS.map((section, index) => [
  legacyCategoryNames[index][0],
  section.name,
  section.description
]);

const dish = ({
  id,
  slug,
  name,
  categoryIndex,
  displayOrder,
  price,
  description,
  isSignature = false,
  webModel3dUrl = "",
  imageUrl = "",
  metadata = {},
  ingredients = ["Produit de saison", "Herbes fraîches"],
  allergens = [],
  options = ["À confirmer avec l'équipe en salle"],
  houseNote = ""
}) => ({
  id,
  restaurant_id: restaurantId,
  menu_id: menuId,
  category_id: categoryNames[categoryIndex][0],
  slug,
  name,
  description,
  display_order: displayOrder,
  price,
  price_currency: "CAD",
  base_currency: "CAD",
  is_available: true,
  is_signature: isSignature,
  ingredients,
  allergens,
  options,
  house_note: houseNote,
  tags: isSignature ? ["Signature"] : [],
  image_url: imageUrl,
  metadata,
  web_model_3d_url: webModel3dUrl,
  model_3d_url: webModel3dUrl,
  ar_model_3d_url: webModel3dUrl
    ? "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb"
    : "",
  ar_usdz_url: ""
});

const categoryIndexByName = new Map(
  CANONICAL_SECTIONS.map((section, index) => [section.name, index])
);

const canonicalDishes = CANONICAL_DISHES.map((item, index) => {
  const id = `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`;
  const photoStoragePath =
    `restaurants/${restaurantId}/photos/originals/${id}.png`;
  const photoSha256 = fixtureDishSha256({
    dishName: item.name,
    restaurantName: "Sauge Noire",
    sourceKey: photoStoragePath
  });
  return dish({
    id,
    slug: canonicalDishSlug(item),
    name: item.name,
    categoryIndex: categoryIndexByName.get(item.section) ?? 0,
    displayOrder: canonicalDishDisplayOrder(item),
    price: item.price,
    description: item.description,
    imageUrl: `/api/public/menu-dishes/${id}/photo`,
    metadata: {
      photoSha256,
      photoStatus: "ready",
      photoStorageBucket: "vistaire-media",
      photoStoragePath
    },
    ...(index === 1
      ? {
          ingredients: item.ingredients,
          allergens: item.allergensContains,
          options: item.options,
          houseNote: item.chefNote
        }
      : {}),
    isSignature: item.badges.includes("Signature"),
    webModel3dUrl:
      index === 5 ? "/models/demo/maison-elyse-n1.glb" : ""
  });
});

function sortTranslationValue(value) {
  if (Array.isArray(value)) return value.map(sortTranslationValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortTranslationValue(child)])
  );
}

function hashTranslationValue(value) {
  return createHash("sha256")
    .update(JSON.stringify(sortTranslationValue(value)))
    .digest("hex");
}

function fieldHashesFor(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [
      field,
      hashTranslationValue(value)
    ])
  );
}

function sourceHashFor(fields) {
  return hashTranslationValue(fields);
}

function capitalizeFixtureListItems(items) {
  return items.map((value) => {
    const item = value.trim();
    const firstLetterIndex = item.search(/\p{L}/u);
    if (firstLetterIndex < 0) return item;
    return (
      item.slice(0, firstLetterIndex) +
      item[firstLetterIndex].toLocaleUpperCase("fr-CA") +
      item.slice(firstLetterIndex + 1)
    );
  });
}

function fixtureDishTranslationFields(dishRow) {
  return {
    // Dish names stay French source identity and are intentionally not
    // included in translated content or freshness hashes. Legacy rows may
    // still preserve content.name, but runtime ignores it.
    ...(dishRow.description ? { description: dishRow.description } : {}),
    ...(dishRow.ingredients?.length
      ? { ingredients: capitalizeFixtureListItems(dishRow.ingredients) }
      : {}),
    ...(dishRow.allergens?.length ? { allergens: dishRow.allergens } : {}),
    ...(dishRow.options?.length
      ? { options: capitalizeFixtureListItems(dishRow.options) }
      : {}),
    ...(dishRow.house_note ? { houseNote: dishRow.house_note } : {})
  };
}

function storedTranslationBase(fields, content) {
  return {
    locale: "en-CA",
    translation_status: "up_to_date",
    source_hash: sourceHashFor(fields),
    field_hashes: fieldHashesFor(fields),
    content
  };
}

function buildEnglishTranslationTables({
  menu,
  categories,
  dishes,
  menuName,
  categoryCopy,
  dishCopy
}) {
  const menuFields = { menuName: menu.name };
  return {
    menu_translations: [
      {
        menu_id: menu.id,
        restaurant_id: menu.restaurant_id,
        ...storedTranslationBase(menuFields, { menuName })
      }
    ],
    menu_category_translations: categories.map((category, index) => {
      const fields = {
        name: category.name,
        ...(category.description
          ? { description: category.description }
          : {})
      };
      return {
        menu_id: menu.id,
        restaurant_id: menu.restaurant_id,
        category_id: category.id,
        ...storedTranslationBase(fields, categoryCopy(category, index))
      };
    }),
    menu_dish_translations: dishes.map((dishRow, index) => {
      const fields = fixtureDishTranslationFields(dishRow);
      return {
        menu_id: menu.id,
        restaurant_id: menu.restaurant_id,
        dish_id: dishRow.id,
        ...storedTranslationBase(fields, dishCopy(dishRow, index))
      };
    })
  };
}

const maisonRestaurant = {
  id: maisonRestaurantId,
  name: "Maison Elyse",
  slug: "maison-elyse",
  location: "Montreal",
  cuisine_type: "Cuisine francaise gastronomique",
  status: "active"
};

const maisonMenu = {
  id: maisonMenuId,
  restaurant_id: maisonRestaurantId,
  name: "La Carte",
  slug: "principal",
  status: "published",
  is_primary: true,
  settings_json: {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA"],
    baseCurrency: "CAD",
    defaultCurrency: "CAD",
    supportedCurrencies: ["CAD"],
    publicMenuStyle: "maison-elyse",
    timezone: "America/Toronto",
    allowCurrencySelector: false,
    allowLanguageSelector: true,
    taxIncluded: true
  }
};

const maisonCategory = {
  id: maisonCategoryId,
  restaurant_id: maisonRestaurantId,
  menu_id: maisonMenuId,
  name: "Entrees",
  slug: "entrees",
  description: "La carte actuelle de Maison Elyse",
  display_order: 1
};

const maisonDish = {
  id: maisonDishId,
  restaurant_id: maisonRestaurantId,
  menu_id: maisonMenuId,
  category_id: maisonCategoryId,
  slug: "ravioles-de-chevre-frais-miel-de-monteregie",
  name: "Ravioles de chevre frais et miel de Monteregie",
  description: "Beurre noisette, citron confit et herbes du jardin.",
  display_order: 1,
  price: 24,
  price_currency: "CAD",
  base_currency: "CAD",
  is_available: true,
  is_signature: true,
  ingredients: ["Chevre frais", "Miel", "Herbes"],
  allergens: ["Produits laitiers", "Gluten"],
  options: ["Beurre noisette a part"],
  house_note: "Une entree delicate aux saveurs de la Monteregie.",
  tags: ["Signature"],
  image_url: `/api/public/menu-dishes/${maisonDishId}/photo`,
  metadata: {
    photoSha256: fixtureDishSha256({
      dishName: "Ravioles de chevre frais et miel de Monteregie",
      restaurantName: "Maison Elyse",
      sourceKey: maisonPhotoStoragePath
    }),
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: maisonPhotoStoragePath
  },
  web_model_3d_url: "",
  model_3d_url: "",
  ar_model_3d_url: "",
  ar_usdz_url: ""
};

const TROUVABLE_GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJTrouvableDemoVistaire";

const trouvableRestaurant = {
  id: trouvableRestaurantId,
  name: "Trouvable",
  slug: "trouvable",
  location: "Montreal",
  cuisine_type: "Bistro moderne",
  status: "active",
  google_review_enabled: true,
  google_review_url: TROUVABLE_GOOGLE_REVIEW_URL
};

const trouvableMenu = {
  id: trouvableMenuId,
  restaurant_id: trouvableRestaurantId,
  name: "La Carte",
  slug: "principal",
  status: "published",
  is_primary: true,
  settings_json: {
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA"],
    baseCurrency: "CAD",
    defaultCurrency: "CAD",
    supportedCurrencies: ["CAD", "USD", "EUR"],
    publicMenuStyle: "trouvable",
    defaultThemeMode: "dark",
    allowThemeToggle: true,
    allowCurrencySelector: true,
    allowLanguageSelector: true,
    taxIncluded: true
  }
};

const trouvableCategory = {
  id: trouvableCategoryId,
  restaurant_id: trouvableRestaurantId,
  menu_id: trouvableMenuId,
  name: "Plats",
  slug: "plats",
  description: "La carte actuelle de Trouvable",
  display_order: 1
};

const trouvableDish = {
  id: trouvableDishId,
  restaurant_id: trouvableRestaurantId,
  menu_id: trouvableMenuId,
  category_id: trouvableCategoryId,
  slug: "pesto-burrata-verde",
  name: "Pesto Burrata Verde",
  description: "Burrata, pesto vert et herbes fraiches.",
  display_order: 1,
  price: 22,
  price_currency: "CAD",
  base_currency: "CAD",
  is_available: true,
  is_signature: true,
  ingredients: ["Burrata", "Pesto", "Herbes"],
  allergens: ["Produits laitiers", "Fruits a coque"],
  options: ["Pesto a part"],
  house_note: "Une assiette fraiche et genereuse a partager.",
  tags: ["Signature"],
  image_url: `/api/public/menu-dishes/${trouvableDishId}/photo`,
  metadata: {
    photoSha256: fixtureDishSha256({
      dishName: "Pesto Burrata Verde",
      restaurantName: "Trouvable",
      sourceKey: trouvablePhotoStoragePath
    }),
    photoStatus: "ready",
    photoStorageBucket: "vistaire-media",
    photoStoragePath: trouvablePhotoStoragePath
  },
  web_model_3d_url: "",
  model_3d_url: "",
  ar_model_3d_url: "",
  ar_usdz_url: ""
};

const maisonFixture = {
  restaurants: [maisonRestaurant],
  menus: [maisonMenu],
  menu_categories: [maisonCategory],
  menu_dishes: [maisonDish],
  menu_ui_configs: [
    {
      id: "55555555-5555-4555-8555-555555555552",
      restaurant_id: maisonRestaurantId,
      status: "published",
      theme: "premium-gastronomic",
      updated_at: "2026-07-27T12:00:00.000Z",
      config_json: { schemaVersion: 2, theme: "premium-gastronomic" }
    }
  ]
};

const trouvableFixture = {
  restaurants: [trouvableRestaurant],
  menus: [trouvableMenu],
  menu_categories: [trouvableCategory],
  menu_dishes: [trouvableDish],
  menu_ui_configs: [
    {
      id: "55555555-5555-4555-8555-555555555553",
      restaurant_id: trouvableRestaurantId,
      status: "published",
      theme: "fresh-homemade",
      updated_at: "2026-07-27T12:00:00.000Z",
      config_json: { schemaVersion: 2, theme: "fresh-homemade" }
    }
  ]
};

const saugeNoireFixture = {
  restaurants: [{
    id: restaurantId,
    name: "Sauge Noire",
    slug: "sauge-noire",
    location: "Montréal",
    cuisine_type: "Cuisine au feu et botanique",
    status: "active"
  }],
  menus: [{
    id: menuId,
    restaurant_id: restaurantId,
    name: "La Carte",
    slug: "principal",
    status: "published",
    is_primary: true,
    settings_json: {
      defaultLocale: "fr-CA",
      supportedLocales: ["fr-CA", "en-CA"],
      baseCurrency: "CAD",
      defaultCurrency: "CAD",
      supportedCurrencies: ["CAD", "USD", "EUR"],
      publicMenuStyle: "unique",
      timezone: "America/Toronto",
      allowCurrencySelector: true,
      allowLanguageSelector: true,
      taxIncluded: true
    }
  }],
  menu_categories: categoryNames.map(([id, name, description], index) => ({
    id,
    restaurant_id: restaurantId,
    menu_id: menuId,
    name,
    slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    description,
    display_order: index + 1
  })),
  menu_dishes: canonicalDishes,
  menu_ui_configs: [{
    id: "55555555-5555-4555-8555-555555555551",
    restaurant_id: restaurantId,
    status: "published",
    theme: "fresh-homemade",
    updated_at: "2026-07-27T12:00:00.000Z",
    config_json: {
      schemaVersion: 2,
      theme: "fresh-homemade",
      uniqueDesign: {
        mode: "unique",
        designId: "073bd2ca-56f9-46ee-bd7c-38ab22f01c9a",
        status: "published",
        rendererKey: "sauge-noire-book-v1",
        version: 1,
        rendererVersion: 1,
        createdAt: "2026-07-27T12:00:00.000Z",
        updatedAt: "2026-07-27T12:00:00.000Z"
      }
    }
  }]
};

function completeEnglishDishCopy(fields, englishName, overrides = {}) {
  return {
    name: englishName,
    ...(fields.description
      ? {
          description:
            overrides.description ??
            `A complete English description of ${englishName}.`
        }
      : {}),
    ...(fields.ingredients
      ? {
          ingredients:
            overrides.ingredients ??
            fields.ingredients.map((_, index) => `English ingredient ${index + 1}`)
        }
      : {}),
    ...(fields.allergens
      ? {
          allergens:
            overrides.allergens ??
            fields.allergens.map((_, index) => `English allergen ${index + 1}`)
        }
      : {}),
    ...(fields.options
      ? {
          options:
            overrides.options ??
            fields.options.map((_, index) => `English option ${index + 1}`)
        }
      : {}),
    ...(fields.houseNote
      ? {
          houseNote:
            overrides.houseNote ?? `The chef's note for ${englishName}.`
        }
      : {})
  };
}

Object.assign(
  maisonFixture,
  buildEnglishTranslationTables({
    menu: maisonMenu,
    categories: maisonFixture.menu_categories,
    dishes: maisonFixture.menu_dishes,
    menuName: "The Menu",
    categoryCopy: () => ({
      name: "Starters",
      description: "Maison Elyse's current menu."
    }),
    dishCopy: (dishRow) =>
      completeEnglishDishCopy(
        fixtureDishTranslationFields(dishRow),
        "Fresh goat cheese ravioli with Monteregie honey",
        {
          description:
            "Brown butter, preserved lemon, and garden herbs.",
          ingredients: ["Fresh goat cheese", "Honey", "Herbs"],
          allergens: ["Dairy", "Gluten"],
          options: ["Brown butter on the side"],
          houseNote:
            "A delicate starter inspired by the flavors of Monteregie."
        }
      )
  })
);

Object.assign(
  trouvableFixture,
  buildEnglishTranslationTables({
    menu: trouvableMenu,
    categories: trouvableFixture.menu_categories,
    dishes: trouvableFixture.menu_dishes,
    menuName: "The Menu",
    categoryCopy: () => ({
      name: "Mains",
      description: "Trouvable's current menu."
    }),
    dishCopy: (dishRow) =>
      completeEnglishDishCopy(
        fixtureDishTranslationFields(dishRow),
        "Green pesto burrata",
        {
          description: "Burrata, green pesto, and fresh herbs.",
          ingredients: ["Burrata", "Pesto", "Herbs"],
          allergens: ["Dairy", "Tree nuts"],
          options: ["Pesto on the side"],
          houseNote: "A fresh, generous plate made for sharing."
        }
      )
  })
);

Object.assign(
  saugeNoireFixture,
  buildEnglishTranslationTables({
    menu: saugeNoireFixture.menus[0],
    categories: saugeNoireFixture.menu_categories,
    dishes: saugeNoireFixture.menu_dishes,
    menuName: "The Menu",
    categoryCopy: (_category, index) => CANONICAL_ENGLISH_SECTIONS[index],
    dishCopy: (dishRow, index) => {
      const fields = fixtureDishTranslationFields(dishRow);
      if (dishRow.slug === "betterave-sous-la-cendre") {
        return completeEnglishDishCopy(fields, "Beetroot under ash", {
          description:
            "Ash-roasted beetroot with smoked labneh, blackcurrant, pistachio, and raspberry vinegar.",
          ingredients: [
            "Beetroot",
            "Labneh",
            "Blackcurrant",
            "Pistachio",
            "Raspberry vinegar"
          ],
          allergens: ["Dairy", "Tree nuts"],
          options: ["Labneh on the side", "Without pistachio"],
          houseNote:
            "Cooking under ash concentrates the beetroot's flavor and adds a delicate smoky note."
        });
      }
      return completeEnglishDishCopy(
        fields,
        CANONICAL_ENGLISH_DISH_NAMES[index]
      );
    }
  })
);

const rows = Object.fromEntries(
  Object.keys(saugeNoireFixture).map((table) => [
    table,
    [
      ...(maisonFixture[table] ?? []),
      ...(trouvableFixture[table] ?? []),
      ...(saugeNoireFixture[table] ?? [])
    ]
  ])
);

// The production landing intentionally keeps the real public fallback photo
// URLs. Keep those UUIDs resolvable in CI without adding the aliases to any
// restaurant menu, which would change the menu-rendering fixtures themselves.
const landingFallbackPhotoAliases = [
  {
    id: "fd64dc12-8bd2-4669-be63-51cf0d50b839",
    name: "Ravioles de chèvre frais & miel de Montérégie",
    photoSha256:
      "a4ab316568668db121d32130ba53e60f2093872faaf106cbd4ceede879ec1f1f",
    restaurantId: "11111111-1111-4111-8111-111111111114"
  },
  {
    id: "7a312411-975a-4a12-9e74-d435a7c83406",
    name: "Pesto Burrata Verde",
    photoSha256:
      "8701433fa5746feec3c320d717f3aea74980e9db52715ad9d0109ff7dd3d3d29",
    restaurantId: "11111111-1111-4111-8111-111111111115"
  },
  {
    id: "cb7121a7-a8df-4650-8453-df83135defeb",
    name: "Betterave sous la cendre",
    photoSha256:
      "bd0c28bbf0139fcccb7c224c20c5770292b856213f316702737dc1e97a21a894",
    restaurantId: "11111111-1111-4111-8111-111111111116"
  }
].map((alias) => {
  const photoStoragePath =
    `restaurants/${alias.restaurantId}/photos/originals/${alias.id}.png`;
  return {
    id: alias.id,
    restaurant_id: alias.restaurantId,
    menu_id: "22222222-2222-4222-8222-222222222225",
    category_id: "33333333-3333-4333-8333-333333333310",
    slug: alias.id,
    name: alias.name,
    description: "Landing fallback photo fixture.",
    display_order: 1,
    price: 0,
    price_currency: "CAD",
    base_currency: "CAD",
    is_available: true,
    is_signature: false,
    ingredients: [],
    allergens: [],
    options: [],
    house_note: "",
    tags: [],
    image_url: `/api/public/menu-dishes/${alias.id}/photo`,
    metadata: {
      photoSha256: alias.photoSha256,
      photoStatus: "ready",
      photoStorageBucket: "vistaire-media",
      photoStoragePath
    },
    web_model_3d_url: "",
    model_3d_url: "",
    ar_model_3d_url: "",
    ar_usdz_url: ""
  };
});

rows.menu_dishes.push(...landingFallbackPhotoAliases);

export {
  maisonFixture,
  restaurantId,
  rows,
  saugeNoireFixture,
  trouvableFixture
};
