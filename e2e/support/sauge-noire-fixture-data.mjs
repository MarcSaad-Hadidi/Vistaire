const restaurantId = "11111111-1111-4111-8111-111111111111";
const menuId = "22222222-2222-4222-8222-222222222222";

const categoryNames = [
  ["33333333-3333-4333-8333-333333333301", "Amuse-bouches", "Ouvertures de saison"],
  ["33333333-3333-4333-8333-333333333302", "Cru & frais", "Fraîcheur, acidité, texture"],
  ["33333333-3333-4333-8333-333333333303", "Canard & braise", "Le feu en profondeur"],
  ["33333333-3333-4333-8333-333333333304", "Poissons", "Marées du Saint-Laurent"],
  ["33333333-3333-4333-8333-333333333305", "Végétal", "Le jardin en mouvement"],
  ["33333333-3333-4333-8333-333333333306", "Cocktails signature", "Infusions, amers et botanicals"],
  ["33333333-3333-4333-8333-333333333307", "Douceurs", "Finir doucement"]
];

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
      supportedCurrencies: ["CAD", "USD"],
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
  menu_dishes: [
    dish({ id: "44444444-4444-4444-8444-444444444400", slug: "mise-en-bouche-sureau", name: "Mise en bouche au sureau", categoryIndex: 0, displayOrder: 1, price: 9, description: "Sureau, radis et huile de livèche." }),
    dish({ id: "44444444-4444-4444-8444-444444444401", slug: "truite-des-laurentides", name: "Truite des Laurentides", categoryIndex: 1, displayOrder: 1, price: 28, description: "Truite fumée, oseille et pomme verte.", webModel3dUrl: "/models/demo/maison-elyse-n1.glb" }),
    dish({ id: "44444444-4444-4444-8444-444444444409", slug: "hamachi-a-la-verveine", name: "Hamachi à la verveine", categoryIndex: 1, displayOrder: 2, price: 31, description: "Hamachi, verveine et agrumes du Québec." }),
    dish({ id: "44444444-4444-4444-8444-444444444402", slug: "canard-a-l-erable-noir", name: "Canard à l'érable noir", categoryIndex: 2, displayOrder: 1, price: 34, description: "Canard rôti, érable noir et jus de braise.", isSignature: true }),
    dish({ id: "44444444-4444-4444-8444-444444444403", slug: "racines-braises", name: "Racines braisées", categoryIndex: 2, displayOrder: 2, price: 19, description: "Racines, cendre douce et crème de tournesol." }),
    dish({ id: "44444444-4444-4444-8444-444444444404", slug: "homard-des-cantons", name: "Homard des Cantons", categoryIndex: 3, displayOrder: 1, price: 32, description: "Homard, beurre noisette et verveine." }),
    dish({ id: "44444444-4444-4444-8444-444444444405", slug: "poireau-brule", name: "Poireau brûlé", categoryIndex: 4, displayOrder: 1, price: 17, description: "Poireau, huile de sapin et graines torréfiées." }),
    dish({ id: "44444444-4444-4444-8444-444444444406", slug: "cendre-rose", name: "Cendre Rose", categoryIndex: 5, displayOrder: 1, price: 16, description: "Gin, rose sauvage, cassis et amers botaniques.", isSignature: true }),
    dish({ id: "44444444-4444-4444-8444-444444444407", slug: "flamme-verte", name: "Flamme verte", categoryIndex: 5, displayOrder: 2, price: 15, description: "Rhubarbe, thé vert et poivre des dunes." }),
    dish({ id: "44444444-4444-4444-8444-444444444408", slug: "sarrasin-fume", name: "Sarrasin fumé", categoryIndex: 6, displayOrder: 1, price: 12, description: "Sarrasin, chocolat blanc et fleur de sel." })
  ],
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
