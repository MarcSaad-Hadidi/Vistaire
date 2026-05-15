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
    "Une cuisine de produits d’ici et d’ailleurs, précise et saisonnière, dans un cadre intimiste du Vieux-Montréal — une carte pensée pour un menu digital à la hauteur de votre table.",
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
    model3dUrl: "/models/demo/ravioles-chevre-miel.glb",
    webModel3dUrl: "/models/demo/ravioles-chevre-miel-meshopt-6b812a04.glb",
    usdzUrl: "/models/demo/ravioles-chevre-miel.usdz"
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
      "Servi légèrement frais — idéal avant une assise plus corsée.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "10 min",
    model3dUrl: "",
    usdzUrl: ""
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
      "Notre signature marine — à associer à un Meursault ou à un blanc du Rhône sur tension minérale.",
    isSignature: true,
    isRecommended: true,
    isAvailable: true,
    preparationTime: "28 min",
    model3dUrl: "/models/demo/homard-bisque.glb",
    webModel3dUrl: "/models/demo/homard-bisque-meshopt-73be7175.glb",
    arModel3dUrl: "/models/demo/ar-lite/homard-bisque-ar-lite.glb",
    usdzUrl: "/models/demo/homard-bisque.usdz",
    arUsdzUrl: "/models/demo/ar-lite/homard-bisque-ios-quicklook-ultra.usdz"
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
      "Le plat de la maison pour un dîner à deux — à partager ou en solo gourmand.",
    isSignature: true,
    isRecommended: true,
    isAvailable: false,
    preparationTime: "42 min",
    model3dUrl: "",
    usdzUrl: ""
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
    model3dUrl: "",
    usdzUrl: ""
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
    model3dUrl: "",
    usdzUrl: ""
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
    model3dUrl: "/models/demo/souffle-chocolat.glb",
    webModel3dUrl: "/models/demo/souffle-chocolat-meshopt-76eb0faa.glb",
    usdzUrl: "/models/demo/souffle-chocolat.usdz?v=plate-source-20260511",
    arUsdzUrl: "/models/demo/ar-lite/souffle-chocolat-ios-quicklook-ultra.usdz"
  },
  {
    id: "dish-9",
    slug: "tarte-citron-basilic",
    name: "Tarte citron confit & basilic pourpre",
    categorySlug: "desserts",
    shortDescription: "Meringue italienne, shortbread sablé, infusion citron vert.",
    description:
      "Citron confit maison, crémeux basilic pourpre, meringue italienne légère. Shortbread sablé au beurre salé pour la base — acidité maîtrisée, finition herbacée.",
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
    model3dUrl: "",
    usdzUrl: ""
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
      "À savourer en ouverture — équilibre amer / sucré maîtrisé.",
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
      "Rafraîchissant et fin — parfait sans alcool lorsque vous préférez un dîner léger.",
    isSignature: false,
    isRecommended: false,
    isAvailable: true,
    preparationTime: "6 min",
    model3dUrl: "",
    usdzUrl: ""
  }
];

export function getRestaurant(): Restaurant {
  return RESTAURANT;
}

export function getCategories(): Category[] {
  return [...CATEGORIES].sort((a, b) => a.order - b.order);
}

export function getAllDishes(): Dish[] {
  return [...DISHES];
}

export function getDishBySlug(slug: string): Dish | undefined {
  return DISHES.find((dish) => dish.slug === slug);
}

export function getDishesByCategorySlug(categorySlug: string): Dish[] {
  return DISHES.filter((dish) => dish.categorySlug === categorySlug);
}

export function getSignatureDishes(): Dish[] {
  return DISHES.filter((dish) => dish.isSignature);
}

export function getCategoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
