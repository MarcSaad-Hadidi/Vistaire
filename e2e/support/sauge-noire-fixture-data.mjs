import {
  CANONICAL_DISHES,
  CANONICAL_SECTIONS,
  canonicalDishDisplayOrder,
  canonicalDishSlug
} from "../../scripts/owner/sync-sauge-noire-menu.mjs";

const restaurantId = "11111111-1111-4111-8111-111111111111";
const menuId = "22222222-2222-4222-8222-222222222222";

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
  imageUrl = ""
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
  web_model_3d_url: webModel3dUrl,
  model_3d_url: webModel3dUrl,
  ar_model_3d_url: "",
  ar_usdz_url: ""
});

const fixtureImageUrls = [
  "/images/demo/dishes/maison-elyse-n1.png",
  "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
  "/images/demo/dishes/tartare-saumon-label-rouge.png",
  "/images/demo/dishes/canette-rotie-figues-epices.png",
  "/images/demo/dishes/risotto-cepes-parmesan.png",
  "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
  "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
  "/images/demo/dishes/negroni-vieilli-fut.png",
  "/images/demo/dishes/elixir-bergamote-earl-grey.png",
  "/images/demo/dishes/souffle-chocolat-grand-cru.png"
];

const categoryIndexByName = new Map(
  CANONICAL_SECTIONS.map((section, index) => [section.name, index])
);

const canonicalDishes = CANONICAL_DISHES.map((item, index) =>
  dish({
    id: `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
    slug: canonicalDishSlug(item),
    name: item.name,
    categoryIndex: categoryIndexByName.get(item.section) ?? 0,
    displayOrder: canonicalDishDisplayOrder(item),
    price: item.price,
    description: item.description,
    imageUrl: fixtureImageUrls[index % fixtureImageUrls.length],
    isSignature: item.badges.includes("Signature"),
    webModel3dUrl: item.name === "Truite des Laurentides"
      ? "/models/demo/maison-elyse-n1.glb"
      : ""
  })
);

const rows = {
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

export { restaurantId, rows };
