import {
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  canonicalDishDisplayOrder,
  canonicalDishSlug
} from "../../scripts/owner/sync-sauge-noire-menu.mjs";
import { fixtureDishSha256 } from "./fixture-dish-images.mjs";

const restaurantId = "11111111-1111-4111-8111-111111111111";
const menuId = "22222222-2222-4222-8222-222222222222";
const maisonRestaurantId = "11111111-1111-4111-8111-111111111112";
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
  metadata = {}
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
  ingredients: ["Produit de saison", "Herbes fraîches"],
  options: ["À confirmer avec l'équipe en salle"],
  tags: isSignature ? ["Signature"] : [],
  image_url: imageUrl,
  metadata,
  web_model_3d_url: webModel3dUrl,
  model_3d_url: webModel3dUrl,
  ar_model_3d_url: "",
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
    isSignature: item.badges.includes("Signature"),
    webModel3dUrl: ""
  });
});

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
  options: [],
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

const trouvableRestaurant = {
  id: trouvableRestaurantId,
  name: "Trouvable",
  slug: "trouvable",
  location: "Montreal",
  cuisine_type: "Bistro moderne",
  status: "active"
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
  options: [],
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
  menu_ui_configs: []
};

const trouvableFixture = {
  restaurants: [trouvableRestaurant],
  menus: [trouvableMenu],
  menu_categories: [trouvableCategory],
  menu_dishes: [trouvableDish],
  menu_ui_configs: []
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

export {
  maisonFixture,
  restaurantId,
  rows,
  saugeNoireFixture,
  trouvableFixture
};
