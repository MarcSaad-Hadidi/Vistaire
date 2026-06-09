import type { Locale } from "./i18n.ts";

export type CurrencyCode = "CAD" | "EUR" | "USD";

export type Allergen =
  | "gluten"
  | "dairy"
  | "nuts"
  | "shellfish"
  | "eggs"
  | "sesame"
  | "soy"
  | "fish";

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  location: string;
  cuisineType: string;
  coverImage: string | null;
  logoMonogram: string;
  currency: CurrencyCode;
  /** Court texte d’ambiance (sans promesse de service à table). */
  contextLine: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  order: number;
};

export type Dish = {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  price: number;
  image: string | null;
  /** Valeur CSS `object-position` pour les vignettes du menu (cartes). */
  imageObjectPosition?: string;
  /** `object-position` pour le hero photo de la fiche plat (`/demo/dishes/[slug]`). */
  imageObjectPositionDetail?: string;
  ingredients: string[];
  allergens: Allergen[];
  options: string[];
  sides: string[];
  chefRecommendation: string;
  isSignature: boolean;
  isRecommended: boolean;
  isAvailable: boolean;
  preparationTime: string;
  model3dUrl: string;
  webModel3dUrl?: string;
  arModel3dUrl?: string;
  usdzUrl: string;
  arUsdzUrl?: string;
};

const RESTAURANT: Restaurant = {
  id: "maison-elyse",
  name: "Maison Élyse",
  slug: "maison-elyse",
  tagline: "Cuisine française contemporaine au cœur du Vieux-Montréal.",
  description:
    "Une cuisine de produits d’ici et d’ailleurs, précise et saisonnière, dans un cadre intimiste du Vieux-Montréal : une carte pensée pour un menu digital à la hauteur de votre table.",
  location: "Vieux-Montréal · Montréal, Québec",
  cuisineType: "Française contemporaine montréalaise",
  coverImage: null,
  logoMonogram: "MÉ",
  currency: "CAD",
  contextLine:
    "Saisonnalité, produits du marché et créations de la maison."
};

const CATEGORIES: Category[] = [
  {
    id: "cat-entrees",
    slug: "entrees",
    name: "Entrées",
    description: "Ouvertures fines, textures contrastées, saisonnalité.",
    order: 1
  },
  {
    id: "cat-signatures",
    slug: "plats-signatures",
    name: "Plats signatures",
    description: "Les signatures du chef, pensées pour marquer les esprits.",
    order: 2
  },
  {
    id: "cat-desserts",
    slug: "desserts",
    name: "Desserts",
    description: "Finitions délicates, cacao grand cru, fruits au fil des saisons.",
    order: 3
  },
  {
    id: "cat-cocktails",
    slug: "cocktails",
    name: "Cocktails",
    description: "Classiques maison, infusions et spiritueux d’exception.",
    order: 4
  }
];

const DEFAULT_IMAGE_FOCUS: Record<string, string> = {
  entrees: "center 50%",
  "plats-signatures": "center 46%",
  desserts: "center 44%",
  cocktails: "center 32%"
};

/** Cadrage vignettes du menu exemple. */
export function getDishCardImageObjectPosition(dish: Dish): string {
  return (
    dish.imageObjectPosition ??
    DEFAULT_IMAGE_FOCUS[dish.categorySlug] ??
    "center 48%"
  );
}

/** Cadrage hero fiche plat. */
export function getDishDetailImageObjectPosition(dish: Dish): string {
  return (
    dish.imageObjectPositionDetail ??
    dish.imageObjectPosition ??
    DEFAULT_IMAGE_FOCUS[dish.categorySlug] ??
    "center 44%"
  );
}

const DISHES: Dish[] = [
  {
    id: "dish-1",
    slug: "ravioles-romarin",
    name: "Ravioles de chèvre frais & miel de Montérégie",
    categorySlug: "entrees",
    shortDescription: "Beurre noisette, romarin brûlé, fleur de sel.",
    description:
      "Des ravioles fines abritant une farce de chèvre frais et de miel québécois, habillées d’un beurre noisette chantilly et d’une poussière de romarin brûlé. Un équilibre sucré-salé maîtrisé.",
    price: 34,
    image: "/images/demo/dishes/ravioles-chevre-miel-monteregie.png",
    imageObjectPosition: "center 48%",
    imageObjectPositionDetail: "center 46%",
    ingredients: [
      "Chèvre frais fermier",
      "Miel de Montérégie",
      "Pâte raviole maison",
      "Beurre AOP",
      "Romarin",
      "Fleur de sel de Guérande"
    ],
    allergens: ["gluten", "dairy"],
    options: ["Sans gluten possible sur demande (selon disponibilité)"],
    sides: [],
    chefRecommendation:
      "Accord parfait avec un mousseux québécois brut ou un blanc mineral sur lie.",
    isSignature: false,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "12 min",
    model3dUrl: "/models/demo/ravioles-chevre-miel-meshy.glb",
    webModel3dUrl: "/models/demo/ravioles-chevre-miel-meshopt-8a28933e.glb",
    arModel3dUrl: "/models/demo/ar-lite/ravioles-chevre-miel-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/ravioles-chevre-miel-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-2",
    slug: "tartare-saumon",
    name: "Tartare de saumon Label Rouge",
    categorySlug: "entrees",
    shortDescription: "Agrumes confits, huile d’olive verte, chips de sarrasin.",
    description:
      "Saumon issu de filière responsable, taillé au couteau minute, relevé d’agrumes confits maison et d’une pointe d’aneth. Les chips de sarrasin apportent le croquant final.",
    price: 42,
    image: "/images/demo/dishes/tartare-saumon-label-rouge.png",
    imageObjectPosition: "center 52%",
    imageObjectPositionDetail: "center 50%",
    ingredients: [
      "Saumon Label Rouge",
      "Citron caviar",
      "Orange sanguine",
      "Aneth frais",
      "Huile d’olive verte",
      "Sarrasin"
    ],
    allergens: ["fish"],
    options: ["Sans agrumes sur demande (remplacement citron confit)"],
    sides: [],
    chefRecommendation:
      "Servi légèrement frais, idéal avant une assise plus corsée.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "10 min",
    model3dUrl: "/models/demo/tartare-saumon-meshy.glb",
    webModel3dUrl: "/models/demo/tartare-saumon-meshopt-4b0b610c.glb",
    arModel3dUrl: "/models/demo/ar-lite/tartare-saumon-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/tartare-saumon-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-3",
    slug: "homard-bisque",
    name: "Homard bleu, bisque corsée & fenouil",
    categorySlug: "plats-signatures",
    shortDescription: "Mijoté lent, carottes fanes, pastis en finition.",
    description:
      "Un homard nacré, servi avec une bisque réduite au fumet corsé et des légumes de garde-manger glacés. La lichette de pastis révèle le fenouil confit sans masquer la mer.",
    price: 104,
    image: "/images/demo/dishes/homard-bleu-bisque-fenouil.png",
    imageObjectPosition: "center 43%",
    imageObjectPositionDetail: "center 41%",
    ingredients: [
      "Homard des Îles",
      "Carotte fanes",
      "Fenouil confit",
      "Bisque maison",
      "Cognac VSOP",
      "Pastis artisanal"
    ],
    allergens: ["shellfish", "fish"],
    options: ["Remplacement possible : lotte rôtie (supplément selon marché)"],
    sides: ["Pain brioché toasté au beurre salé (supplément 6 $)"],
    chefRecommendation:
      "Notre signature marine, à associer à un Meursault ou à un blanc du Rhône sur tension minérale.",
    isSignature: true,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "28 min",
    model3dUrl: "/models/demo/homard-bisque-meshy.glb",
    webModel3dUrl: "/models/demo/homard-bisque-meshopt-ee44bc60.glb",
    arModel3dUrl: "/models/demo/ar-lite/homard-bisque-ar-lite-meshy.glb",
    usdzUrl: "/models/demo/homard-bisque.usdz",
    arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-4",
    slug: "canette-aux-figues",
    name: "Canette rôtie aux figues & épices douces",
    categorySlug: "plats-signatures",
    shortDescription: "Jus corsé, polenta crémeuse, jus réduit au Porto rouge.",
    description:
      "Canette fermière rôtie entière, nappée d’un jus corsé aux figues fraîches et épices douces. Polenta crémeuse au Parmesan, pointe d’amertume équilibrée par le Porto réduit.",
    price: 96,
    image: "/images/demo/dishes/canette-rotie-figues-epices.png",
    imageObjectPosition: "center 46%",
    imageObjectPositionDetail: "center 44%",
    ingredients: [
      "Canette fermière",
      "Figues de Provence",
      "Polenta fiorentina",
      "Parmesan 36 mois",
      "Porto rouge",
      "Épices ras-el-hanout maison"
    ],
    allergens: ["dairy"],
    options: ["Cuisson rosée possible sous 48 h"],
    sides: ["Suggestion pour deux convives (format sur réservation)"],
    chefRecommendation:
      "Le plat de la maison pour un dîner à deux, à partager ou en solo gourmand.",
    isSignature: true,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "42 min",
    model3dUrl: "/models/demo/canette-aux-figues-meshy.glb",
    webModel3dUrl: "/models/demo/canette-aux-figues-meshopt-d54f097e.glb",
    arModel3dUrl: "/models/demo/ar-lite/canette-aux-figues-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/canette-aux-figues-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-5",
    slug: "risotto-cepe",
    name: "Risotto aux cèpes & parmesan Reggiano",
    categorySlug: "plats-signatures",
    shortDescription: "Onctueux, jus de veau court, huile de persil plat.",
    description:
      "Risotto crémeux au parmesan Reggiano 36 mois, cèpes de saison sautés au beurre clarifié. Lié au jus de veau court, huile de persil plat en dernier mouvement.",
    price: 54,
    image: "/images/demo/dishes/risotto-cepes-parmesan.png",
    imageObjectPosition: "center 47%",
    imageObjectPositionDetail: "center 45%",
    ingredients: [
      "Riz arborio",
      "Cèpes",
      "Parmesan Reggiano",
      "Jus de veau court",
      "Persil plat",
      "Beurre clarifié"
    ],
    allergens: ["dairy"],
    options: ["Version végétarienne : jus aux champignons séchés"],
    sides: [],
    chefRecommendation: "Une assiette réconfortante, idéale avec un rouge du Piémont ou un Chablis premier cru.",
    isSignature: true,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "22 min",
    model3dUrl: "",
    usdzUrl: ""
  },
  {
    id: "dish-6",
    slug: "bar-ligne",
    name: "Bar de ligne, artichaut poivrade, émulsion citron beldi",
    categorySlug: "plats-signatures",
    shortDescription: "Peau croustillante, artichaut braisé au vin blanc.",
    description:
      "Filet de bar de ligne doré à la poêle, peau croustillante. Artichaut poivrade braisé au vin blanc, émulsion citron beldi et ail vert. Fraîcheur et précision du produit.",
    price: 62,
    image: "/images/demo/dishes/bar-de-ligne-artichaut-citron.png",
    imageObjectPosition: "center 45%",
    imageObjectPositionDetail: "center 43%",
    ingredients: [
      "Bar de ligne",
      "Artichaut poivrade",
      "Citron beldi",
      "Vin blanc sec",
      "Ail vert",
      "Huile d’olive fruitée"
    ],
    allergens: ["fish"],
    options: ["Artichaut remplacé par fenouil sur demande"],
    sides: [],
    chefRecommendation: "Favoriser un verre de Sauvignon de Loire ou un Bandol rosé structure.",
    isSignature: false,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "18 min",
    model3dUrl: "/models/demo/bar-de-ligne-meshy.glb",
    webModel3dUrl: "/models/demo/bar-de-ligne-meshopt-e67c9019.glb",
    arModel3dUrl: "/models/demo/ar-lite/bar-de-ligne-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/bar-de-ligne-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-7",
    slug: "pave-boeuf",
    name: "Pavé de bœuf maturé, purée Ratte & jus Bordelaise",
    categorySlug: "plats-signatures",
    shortDescription: "Maturation 28 j., purée onctueuse, jus corsé.",
    description:
      "Pavé maturé 28 jours, saisi à la braise, purée Ratte à la crème crue et jus Bordelaise au Pinot. Les saveurs intenses d’un grand classique de brasserie.",
    price: 72,
    image: "/images/demo/dishes/pave-boeuf-mature-bordelaise.png",
    imageObjectPosition: "center 48%",
    imageObjectPositionDetail: "center 46%",
    ingredients: [
      "Pavé de bœuf maturé",
      "Pomme de terre Ratte",
      "Crème crue",
      "Jus Bordelaise",
      "Pinot noir de réduction",
      "Thym citron"
    ],
    allergens: ["dairy"],
    options: ["Cuisson à préciser : saignant, à point ou bien cuit."],
    sides: ["Frites maison au beurre clarifié (supplément 8 $)"],
    chefRecommendation: "Un Margaux ou un Saint-Émilion grand cru accompagnent la maturation du produit.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "24 min",
    model3dUrl: "/models/demo/pave-boeuf-meshy.glb",
    webModel3dUrl: "/models/demo/pave-boeuf-meshopt-9e10c3a6.glb",
    arModel3dUrl: "/models/demo/ar-lite/pave-boeuf-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/pave-boeuf-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-8",
    slug: "souffle-chocolat",
    name: "Soufflé tiède au chocolat grand cru",
    categorySlug: "desserts",
    shortDescription: "Cœur coulant, glace vanille Tonka, poudre de cacao.",
    description:
      "Soufflé monté minute, chocolat grand cru Madagascar, glace vanille Tonka et tuile cacao. Timing parfait entre chaleur du four et fraîcheur de la glace.",
    price: 28,
    image: "/images/demo/dishes/souffle-chocolat-grand-cru.png",
    imageObjectPosition: "center 36%",
    imageObjectPositionDetail: "center 38%",
    ingredients: [
      "Chocolat grand cru 70 %",
      "Œufs fermiers",
      "Beurre AOP",
      "Vanille Tonka",
      "Crème fleurette",
      "Cacao en poudre"
    ],
    allergens: ["eggs", "dairy"],
    options: ["Cuisson allégée sur demande"],
    sides: [],
    chefRecommendation: "Accord iconique avec un Banyuls rouge ou un café serré maison.",
    isSignature: false,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "16 min",
    model3dUrl: "/models/demo/souffle-chocolat-meshy.glb",
    webModel3dUrl: "/models/demo/souffle-chocolat-meshopt-0ad050af.glb",
    arModel3dUrl: "/models/demo/ar-lite/souffle-chocolat-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/souffle-chocolat-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-9",
    slug: "tarte-citron-basilic",
    name: "Tarte citron confit & basilic pourpre",
    categorySlug: "desserts",
    shortDescription: "Meringue italienne, shortbread sablé, infusion citron vert.",
    description:
      "Citron confit maison, crémeux basilic pourpre, meringue italienne légère. Shortbread sablé au beurre salé pour la base : acidité maîtrisée, finition herbacée.",
    price: 24,
    image: "/images/demo/dishes/tarte-citron-basilic-pourpre.png",
    imageObjectPosition: "center 46%",
    imageObjectPositionDetail: "center 44%",
    ingredients: [
      "Citron bio",
      "Basilic pourpre",
      "Beurre salé",
      "Œufs",
      "Sucre de canne",
      "Crème citron vert infusée"
    ],
    allergens: ["gluten", "eggs", "dairy"],
    options: [],
    sides: [],
    chefRecommendation: "À marier avec un Limoncello artisanal ou une coupe de Clairette de Die.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "12 min",
    model3dUrl: "/models/demo/tarte-citron-basilic-meshy.glb",
    webModel3dUrl: "/models/demo/tarte-citron-basilic-meshopt-2ab5b779.glb",
    arModel3dUrl: "/models/demo/ar-lite/tarte-citron-basilic-ar-lite-meshy.glb",
    usdzUrl: "",
    arUsdzUrl: "/models/demo/ar-lite/tarte-citron-basilic-ios-quicklook-meshy.usdz"
  },
  {
    id: "dish-10",
    slug: "cocktail-maison-elyse",
    name: "Maison Élyse N°1",
    categorySlug: "cocktails",
    shortDescription: "Champagne rosé, infusion verveine, eau de rose.",
    description:
      "Assemblage maison sur base de Champagne rosé, infusion fraîche de verveine du jardin et toucher d’eau de rose discrète. Bulles fines, bouquet floral.",
    price: 28,
    image: "/images/demo/dishes/maison-elyse-n1.png",
    imageObjectPosition: "center 32%",
    imageObjectPositionDetail: "center 30%",
    ingredients: [
      "Champagne rosé",
      "Verveine fraîche",
      "Eau de rose alimentaire",
      "Sirop de sucre de canne léger"
    ],
    allergens: [],
    options: ["Version sans alcool : bulles d’eau pétillante & cordial maison"],
    sides: [],
    chefRecommendation:
      "Parfait en apéritif ou pour ouvrir le repas sur des bulles fines.",
    isSignature: false,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "5 min",
    model3dUrl: "/models/demo/maison-elyse-n1.glb",
    usdzUrl: "/models/demo/maison-elyse-n1.usdz"
  },
  {
    id: "dish-11",
    slug: "negroni-fut",
    name: "Negroni vieilli en fût",
    categorySlug: "cocktails",
    shortDescription: "Gin london dry, vermouth rouge, Campari, bois toasté.",
    description:
      "Negroni affiné en petit fût de chêne, gin london dry, vermouth rouge maison et Campari. Glace sculptée, zest d’orange brûlé au binchotan.",
    price: 26,
    image: "/images/demo/dishes/negroni-vieilli-fut.png",
    imageObjectPosition: "center 34%",
    imageObjectPositionDetail: "center 32%",
    ingredients: [
      "Gin london dry",
      "Vermouth rouge maison",
      "Campari",
      "Orange amère",
      "Glace sculptée"
    ],
    allergens: [],
    options: [],
    sides: [],
    chefRecommendation:
      "À savourer en ouverture : équilibre amer / sucré maîtrisé.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "8 min",
    model3dUrl: "",
    usdzUrl: ""
  },
  {
    id: "dish-12",
    slug: "mocktail-bergamote",
    name: "Élixir bergamote & thé Earl Grey",
    categorySlug: "cocktails",
    shortDescription: "Infusion froide, jus de raisin blanc, mousse d’agrumes.",
    description:
      "Mocktail premium sans alcool : infusion Earl Grey glacée, jus de raisin blanc pressé, zestes d’agrumes confits et mousse légère bergamote. Rafraîchissant et gastronomique.",
    price: 18,
    image: "/images/demo/dishes/elixir-bergamote-earl-grey.png",
    imageObjectPosition: "center 31%",
    imageObjectPositionDetail: "center 29%",
    ingredients: [
      "Thé Earl Grey",
      "Bergamote confite",
      "Jus de raisin blanc",
      "Mousse d’agrumes",
      "Eau de fleur d’oranger"
    ],
    allergens: [],
    options: [],
    sides: [],
    chefRecommendation:
      "Rafraîchissant et fin, parfait sans alcool lorsque vous préférez un dîner léger.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "6 min",
    model3dUrl: "",
    usdzUrl: ""
  }
];

const RESTAURANT_EN: Restaurant = {
  ...RESTAURANT,
  tagline: "Contemporary French cuisine in the heart of Old Montreal.",
  description:
    "A seasonal, precise menu shaped around local and international ingredients in an intimate Old Montreal dining room: a sample menu designed to show what a premium mobile restaurant menu can feel like.",
  location: "Old Montreal, Montreal, Quebec",
  cuisineType: "Contemporary Montreal French cuisine",
  contextLine:
    "Seasonality, market ingredients and house creations."
};

const CATEGORY_TRANSLATIONS_EN: Record<
  string,
  Pick<Category, "name" | "description">
> = {
  entrees: {
    name: "Starters",
    description: "Refined openings, contrast in texture and seasonal details."
  },
  "plats-signatures": {
    name: "Signature dishes",
    description: "Chef signatures designed to stay in memory."
  },
  desserts: {
    name: "Desserts",
    description: "Delicate finishes, grand cru chocolate and seasonal fruit."
  },
  cocktails: {
    name: "Cocktails",
    description: "House classics, infusions and exceptional spirits."
  }
};

const DISH_TRANSLATIONS_EN: Record<
  string,
  Partial<
    Pick<
      Dish,
      | "name"
      | "shortDescription"
      | "description"
      | "ingredients"
      | "options"
      | "sides"
      | "chefRecommendation"
      | "preparationTime"
    >
  >
> = {
  "ravioles-romarin": {
    name: "Fresh goat cheese ravioli & Monteregie honey",
    shortDescription: "Brown butter, burned rosemary, fleur de sel.",
    description:
      "Fine ravioli filled with fresh goat cheese and Quebec honey, finished with whipped brown butter and a trace of burned rosemary. A controlled sweet-savoury balance.",
    ingredients: [
      "Farm fresh goat cheese",
      "Monteregie honey",
      "House ravioli dough",
      "AOP butter",
      "Rosemary",
      "Guerande fleur de sel"
    ],
    options: ["Gluten-free adaptation possible on request, subject to availability."],
    chefRecommendation:
      "Pairs beautifully with a brut Quebec sparkling wine or a mineral white aged on lees."
  },
  "tartare-saumon": {
    name: "Label Rouge salmon tartare",
    shortDescription: "Candied citrus, green olive oil, buckwheat crisps.",
    description:
      "Responsibly sourced salmon, hand-cut to order, lifted with house candied citrus and fresh dill. Buckwheat crisps bring the final texture.",
    ingredients: [
      "Label Rouge salmon",
      "Finger lime",
      "Blood orange",
      "Fresh dill",
      "Green olive oil",
      "Buckwheat"
    ],
    options: ["Prepared without citrus on request, with candied lemon instead."],
    chefRecommendation:
      "Served lightly chilled, ideal before a richer main course."
  },
  "homard-bisque": {
    name: "Blue lobster, deep bisque & fennel",
    shortDescription: "Slow reduction, young carrots, pastis finish.",
    description:
      "Pearled lobster served with a reduced shellfish bisque and glazed pantry vegetables. A final touch of pastis reveals the confit fennel without masking the sea.",
    ingredients: [
      "Island lobster",
      "Young carrots",
      "Confit fennel",
      "House bisque",
      "VSOP cognac",
      "Artisanal pastis"
    ],
    options: ["Possible replacement: roasted monkfish, supplement based on market."],
    sides: ["Toasted brioche with salted butter, 6 dollar supplement."],
    chefRecommendation:
      "Our marine signature, best with Meursault or a mineral white from the Rhone."
  },
  "canette-aux-figues": {
    name: "Roasted duckling with figs & warm spices",
    shortDescription: "Deep jus, creamy polenta, red Porto reduction.",
    description:
      "Whole roasted farm duckling with a concentrated fig jus and gentle spices. Creamy Parmesan polenta balances the bitterness of a red Porto reduction.",
    ingredients: [
      "Farm duckling",
      "Provence figs",
      "Fiorentina polenta",
      "36-month Parmesan",
      "Red Porto",
      "House ras el hanout"
    ],
    options: ["Rosy cooking available with 48 hours notice."],
    sides: ["Suggested for two guests, reserved format available."],
    chefRecommendation:
      "The house dish for dinner for two, generous enough to share and elegant solo."
  },
  "risotto-cepe": {
    name: "Cep mushroom risotto & Reggiano Parmesan",
    shortDescription: "Creamy rice, short veal jus, flat parsley oil.",
    description:
      "Creamy risotto with 36-month Reggiano Parmesan and seasonal cep mushrooms sauteed in clarified butter. Finished with short veal jus and flat parsley oil.",
    ingredients: [
      "Arborio rice",
      "Cep mushrooms",
      "Reggiano Parmesan",
      "Short veal jus",
      "Flat parsley",
      "Clarified butter"
    ],
    options: ["Vegetarian version with dried mushroom jus."],
    chefRecommendation:
      "A comforting plate, ideal with Piedmont red wine or premier cru Chablis."
  },
  "bar-ligne": {
    name: "Line-caught sea bass, artichoke, beldi lemon emulsion",
    shortDescription: "Crisp skin, white-wine-braised artichoke.",
    description:
      "Pan-seared line-caught sea bass with crisp skin. Poivrade artichoke braised in white wine, beldi lemon emulsion and green garlic for freshness and precision.",
    ingredients: [
      "Line-caught sea bass",
      "Poivrade artichoke",
      "Beldi lemon",
      "Dry white wine",
      "Green garlic",
      "Fruity olive oil"
    ],
    options: ["Artichoke can be replaced with fennel on request."],
    chefRecommendation:
      "Choose a Loire Sauvignon or a structured Bandol rose."
  },
  "pave-boeuf": {
    name: "Aged beef pave, Ratte puree & Bordelaise jus",
    shortDescription: "28-day ageing, silky puree, concentrated jus.",
    description:
      "Twenty-eight-day aged beef seared over embers, served with Ratte potato puree enriched with raw cream and Pinot Bordelaise jus.",
    ingredients: [
      "Aged beef pave",
      "Ratte potatoes",
      "Raw cream",
      "Bordelaise jus",
      "Pinot reduction",
      "Lemon thyme"
    ],
    options: ["Cooking preference: rare, medium or well done."],
    sides: ["House fries in clarified butter, 8 dollar supplement."],
    chefRecommendation:
      "Margaux or Saint-Emilion Grand Cru supports the depth of the ageing."
  },
  "souffle-chocolat": {
    name: "Warm grand cru chocolate souffle",
    shortDescription: "Soft centre, Tonka vanilla ice cream, cocoa powder.",
    description:
      "Souffle baked to order with Madagascar grand cru chocolate, Tonka vanilla ice cream and cocoa tuile. The timing balances oven warmth with a cool finish.",
    ingredients: [
      "70 percent grand cru chocolate",
      "Farm eggs",
      "AOP butter",
      "Tonka vanilla",
      "Cream",
      "Cocoa powder"
    ],
    options: ["Lighter baking available on request."],
    chefRecommendation:
      "Iconic with red Banyuls or a short house espresso."
  },
  "tarte-citron-basilic": {
    name: "Candied lemon tart & purple basil",
    shortDescription: "Italian meringue, salted shortbread, lime infusion.",
    description:
      "House candied lemon, purple basil cream and light Italian meringue on salted butter shortbread. Precise acidity with an herbal finish.",
    ingredients: [
      "Organic lemon",
      "Purple basil",
      "Salted butter",
      "Eggs",
      "Cane sugar",
      "Infused lime cream"
    ],
    chefRecommendation:
      "Pair with artisanal limoncello or a glass of Clairette de Die."
  },
  "cocktail-maison-elyse": {
    name: "Maison Elyse No. 1",
    shortDescription: "Rose Champagne, verbena infusion, rose water.",
    description:
      "A house blend built on rose Champagne, fresh garden verbena infusion and a discreet touch of rose water. Fine bubbles and a floral bouquet.",
    ingredients: [
      "Rose Champagne",
      "Fresh verbena",
      "Food-grade rose water",
      "Light cane sugar syrup"
    ],
    options: ["Alcohol-free version with sparkling water and house cordial."],
    chefRecommendation:
      "Perfect as an aperitif or to open dinner with fine bubbles."
  },
  "negroni-fut": {
    name: "Barrel-aged Negroni",
    shortDescription: "London dry gin, red vermouth, Campari, toasted wood.",
    description:
      "Negroni refined in a small oak barrel, with London dry gin, house red vermouth and Campari. Sculpted ice and burned orange zest.",
    ingredients: [
      "London dry gin",
      "House red vermouth",
      "Campari",
      "Bitter orange",
      "Sculpted ice"
    ],
    chefRecommendation:
      "Best at the opening of the meal: bitter and sweet in balance."
  },
  "mocktail-bergamote": {
    name: "Bergamot & Earl Grey elixir",
    shortDescription: "Cold infusion, white grape juice, citrus foam.",
    description:
      "Premium alcohol-free mocktail with iced Earl Grey, pressed white grape juice, candied citrus zest and light bergamot foam.",
    ingredients: [
      "Earl Grey tea",
      "Candied bergamot",
      "White grape juice",
      "Citrus foam",
      "Orange blossom water"
    ],
    chefRecommendation:
      "Refreshing and precise, ideal for a lighter dinner without alcohol."
  }
};

function localizeCategory(category: Category, locale: Locale): Category {
  if (locale !== "en") return category;
  return {
    ...category,
    ...(CATEGORY_TRANSLATIONS_EN[category.slug] ?? {})
  };
}

function localizeDish(dish: Dish, locale: Locale): Dish {
  if (locale !== "en") return dish;
  return {
    ...dish,
    ...(DISH_TRANSLATIONS_EN[dish.slug] ?? {})
  };
}

export function getRestaurant(locale: Locale = "fr"): Restaurant {
  return locale === "en" ? RESTAURANT_EN : RESTAURANT;
}

export function getCategories(locale: Locale = "fr"): Category[] {
  return [...CATEGORIES]
    .sort((a, b) => a.order - b.order)
    .map((category) => localizeCategory(category, locale));
}

export function getAllDishes(locale: Locale = "fr"): Dish[] {
  return DISHES.map((dish) => localizeDish(dish, locale));
}

export function getDishBySlug(slug: string, locale: Locale = "fr"): Dish | undefined {
  const dish = DISHES.find((candidate) => candidate.slug === slug);
  return dish ? localizeDish(dish, locale) : undefined;
}

export function getDishesByCategorySlug(
  categorySlug: string,
  locale: Locale = "fr"
): Dish[] {
  return DISHES.filter((dish) => dish.categorySlug === categorySlug).map((dish) =>
    localizeDish(dish, locale)
  );
}

export function getSignatureDishes(locale: Locale = "fr"): Dish[] {
  return DISHES.filter((dish) => dish.isSignature).map((dish) =>
    localizeDish(dish, locale)
  );
}

export function getCategoryBySlug(
  slug: string,
  locale: Locale = "fr"
): Category | undefined {
  const category = CATEGORIES.find((candidate) => candidate.slug === slug);
  return category ? localizeCategory(category, locale) : undefined;
}
