import {
  convertMenuPriceCents,
  formatMenuPrice,
  formatMenuPriceCents,
  type MenuExchangeRates
} from "../../lib/currency/formatMenuPrice.ts";
import {
  getGreetingForTime,
  getGreetingPeriodForTime
} from "../../lib/menu/greeting.ts";
import type { PublicMenuDish } from "../../lib/menu/publicMenuCore.ts";
import {
  normalizePublicMenuLocale,
  normalizePublicMenuCurrencyPreference,
  normalizePublicMenuLocalePreference,
  normalizePublicMenuThemePreference,
  PUBLIC_MENU_LOCALE_OPTIONS,
  type PublicMenuCurrency,
  type PublicMenuLocale,
  type PublicMenuSettings
} from "../../lib/menu/publicMenuSettings.ts";

export type TrouvableLocale = PublicMenuLocale;
export type TrouvableCurrency = PublicMenuCurrency;
export type TrouvableTheme = "dark" | "light";
export type TrouvableGreetingPeriod = "morning" | "afternoon" | "evening" | "night";
type TrouvableCopyLocale = "fr" | "en" | "es" | "it" | "ar";

const TROUVABLE_COPY_LOCALES = ["fr", "en", "es", "it", "ar"] as const;
const TROUVABLE_COPY_LOCALE_SET = new Set<string>(TROUVABLE_COPY_LOCALES);
const TROUVABLE_FALLBACK_COPY_LOCALE: TrouvableCopyLocale = "en";
const RTL_LANGUAGE_CODES = new Set(["ar", "fa", "he", "ur"]);

export const TROUVABLE_LOCALE_STORAGE_KEY = "vistaire:trouvable-menu-locale";
export const TROUVABLE_CURRENCY_STORAGE_KEY = "vistaire:trouvable-menu-currency";
export const TROUVABLE_THEME_STORAGE_KEY = "vistaire:trouvable-menu-theme";

export const TROUVABLE_CURRENCY_OPTIONS: Array<{
  code: TrouvableCurrency;
  label: Partial<Record<TrouvableCopyLocale, string>>;
  symbol: string;
}> = [
  {
    code: "CAD",
    label: { en: "Canadian dollar", fr: "Dollar canadien" },
    symbol: "$"
  },
  {
    code: "USD",
    label: { en: "US dollar", fr: "Dollar américain" },
    symbol: "$"
  },
  { code: "EUR", label: { en: "Euro", fr: "Euro" }, symbol: "€" }
];

export const TROUVABLE_STATIC_CAD_RATES: Partial<Record<TrouvableCurrency, number>> = {
  CAD: 1,
  USD: 0.73,
  EUR: 0.68
};

const TROUVABLE_GOOGLE_REVIEW_COPY = {
  fr: {
    action: "Laisser un avis Google",
    fallbackRestaurant: "le restaurant",
    metaLabel: "Résumé Google",
    note:
      "Aucun avantage n'est offert en échange d'un avis. Votre avis doit refléter votre expérience réelle.",
    presentationRatingLabel: "Aperçu Google : {rating}/5",
    presentationReviewCountLabel: "Aperçu : {count} avis",
    ratingLabel: "{rating}/5 sur Google",
    reviewCountLabel: "{count} avis Google",
    text:
      "Partagez votre expérience chez {restaurantName}. Votre avis Google aide l'équipe à mieux comprendre chaque visite et à se faire découvrir.",
    title: "Votre expérience compte"
  },
  en: {
    action: "Leave a Google review",
    fallbackRestaurant: "the restaurant",
    metaLabel: "Google summary",
    note:
      "No benefit is offered in exchange for a review. Your review should reflect your real experience.",
    presentationRatingLabel: "Google preview: {rating}/5",
    presentationReviewCountLabel: "Preview: {count} reviews",
    ratingLabel: "{rating}/5 on Google",
    reviewCountLabel: "{count} Google reviews",
    text:
      "Share your experience at {restaurantName}. Your Google review helps the team understand each visit and be discovered.",
    title: "Your experience matters"
  },
  es: {
    action: "Dejar una reseña en Google",
    fallbackRestaurant: "el restaurante",
    metaLabel: "Resumen de Google",
    note:
      "No se ofrece ningún beneficio a cambio de una reseña. Tu reseña debe reflejar tu experiencia real.",
    presentationRatingLabel: "Vista previa de Google: {rating}/5",
    presentationReviewCountLabel: "Vista previa: {count} reseñas",
    ratingLabel: "{rating}/5 en Google",
    reviewCountLabel: "{count} reseñas de Google",
    text:
      "Comparte tu experiencia en {restaurantName}. Tu reseña de Google ayuda al equipo a entender cada visita y a ser descubierto.",
    title: "Tu experiencia cuenta"
  },
  it: {
    action: "Lascia una recensione Google",
    fallbackRestaurant: "il ristorante",
    metaLabel: "Riepilogo Google",
    note:
      "Non viene offerto alcun vantaggio in cambio di una recensione. La recensione deve riflettere la tua esperienza reale.",
    presentationRatingLabel: "Anteprima Google: {rating}/5",
    presentationReviewCountLabel: "Anteprima: {count} recensioni",
    ratingLabel: "{rating}/5 su Google",
    reviewCountLabel: "{count} recensioni Google",
    text:
      "Condividi la tua esperienza da {restaurantName}. La tua recensione Google aiuta il team a capire ogni visita e a farsi scoprire.",
    title: "La tua esperienza conta"
  },
  ar: {
    action: "اترك تقييما على Google",
    fallbackRestaurant: "المطعم",
    metaLabel: "ملخص Google",
    note:
      "لا يتم تقديم أي منفعة مقابل التقييم. يجب أن يعكس تقييمك تجربتك الحقيقية.",
    presentationRatingLabel: "معاينة Google: {rating}/5",
    presentationReviewCountLabel: "معاينة: {count} تقييم",
    ratingLabel: "{rating}/5 على Google",
    reviewCountLabel: "{count} تقييم Google",
    text:
      "شارك تجربتك لدى {restaurantName}. يساعد تقييمك على Google الفريق على فهم كل زيارة والوصول إلى ضيوف جدد.",
    title: "تجربتك مهمة"
  }
} as const;

const CATEGORY_TRANSLATIONS: Record<string, Partial<Record<TrouvableCopyLocale, string>>> = {
  "bols & salades": { en: "Bowls & salads" },
  boissons: { en: "Drinks" },
  burgers: { en: "Burgers" },
  desserts: { en: "Desserts" },
  entrees: { en: "Starters" },
  "entrées": { en: "Starters" },
  pizzas: { en: "Pizzas" },
  plats: { en: "Dishes" },
  "plats maison": { en: "House dishes" },
  salades: { en: "Salads" },
  seafood: { fr: "Fruits de mer" },
  signatures: { en: "Signatures" }
};

export const TROUVABLE_COPY = {
  fr: {
    activeCategoryAll: "La carte",
    add: "Ajouter",
    addToSelection: "Ajouter à ma sélection",
    all: "Tout",
    activeFilterPrefix: "Filtre actif",
    activeFilters: (count: number) => `${count} filtres`,
    allergens: "Allergènes",
    allergenTitlePrefix: "Allergène",
    askWaiter: "Demander au serveur",
    available: "Disponible",
    backToMenu: "Retour au menu",
    categories: "CATÉGORIES",
    categoryAria: "Catégories",
    clearSearch: "Effacer",
    close: "Fermer",
    closeFilters: "Fermer les filtres",
    closeDetail: "Fermer le détail",
    closeLanguage: "Fermer le choix de langue",
    closeSelection: "Fermer la sélection",
    closeWaiter: "Fermer la demande serveur",
    currencyAria: "Choisir la devise du menu",
    currencyCopy: "Les prix sont convertis localement à partir du prix CAD du menu.",
    currencyKicker: "Devise",
    currencyTitle: "Devise du menu",
    details: "Détails",
    emptySelectionBody: "Ajoutez un plat pour préparer une demande au serveur.",
    emptySelectionTitle: "Votre sélection est vide.",
    estimatedTotal: "Total estimé",
    filterAllAria: "Afficher tous les plats",
    filterAvailableAria: "Filtrer les plats disponibles",
    filterImmersiveAria: "Filtrer les plats avec expérience 3D ou AR",
    filterNonVegAria: "Filtrer les plats non végétariens détectés",
    filterRecommendedAria: "Filtrer les plats signatures ou recommandés",
    filterVegAria: "Filtrer les plats végétariens détectés",
    filterApply: "Appliquer",
    filterButton: "Filtrer",
    filterFallback: "Filtre",
    filterGroupLabel: "Filtres",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Filtres",
    filtersAria: "Filtres rapides",
    dairyFree: "Sans lactose",
    eggFree: "Sans oeufs",
    fishFree: "Sans poisson",
    glutenFree: "Sans gluten",
    nutFree: "Sans fruits \u00e0 coque",
    gridAria: "Afficher en grille",
    greeting: {
      afternoon: "Bienvenue",
      evening: "Bonsoir",
      morning: "Bonjour",
      night: "Bonsoir"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.fr,
    heroAction: "Voir la carte",
    heroBlurb: "Cuisine maison, accents chaleureux et service à table.",
    houseNote: "Note maison",
    immersiveUnavailable: "Vue 3D non disponible pour ce plat.",
    ingredients: "Ingrédients",
    ingredientsCount: (count: number) =>
      `${count} ingrédient${count > 1 ? "s" : ""}`,
    languageActive: "Actif",
    languageAria: "Choisir la langue du menu",
    languageKicker: "Langue",
    languageSubtitle: "Consultez la carte dans la langue qui vous convient.",
    languageTitle: "Langue du menu",
    listAria: "Afficher en liste",
    localOrderHint:
      "Aucune commande n'est envoyée automatiquement. Montrez cette demande à l'équipe.",
    menuAria: "Carte Trouvable",
    menuContextFallback: "Menu à table",
    modelPreparing: "Préparation de la vue immersive...",
    modelUnavailable: "Vue 3D temporairement indisponible.",
    arBrowserHelp:
      "Si \"Afficher devant moi\" ne s'ouvre pas, ouvrez cette fiche dans Safari ou Chrome, puis relancez la 3D.",
    arBrowserLink: "Ouvrir dans le navigateur",
    moreDetails: "Voir détails",
    viewDetails: "Voir détails",
    detailCompositionLabel: "Dans l'assiette",
    detailAllergensLabel: "À surveiller",
    detailOptionsLabel: "Personnaliser",
    detailHouseNoteLabel: "Note maison",
    detailFallback: "Aucun détail supplémentaire pour ce plat.",
    cardOptionsLabel: "Options disponibles",
    nextDish: "Plat suivant",
    nonVeg: "Non-végé",
    noResultsBody: "Essayez une autre recherche ou retirez un filtre.",
    noResultsTitle: "Aucun plat ne correspond.",
    options: "Options",
    popular: "Populaire",
    previousDish: "Plat précédent",
    priceToConfirm: "Prix à confirmer",
    prepareRequest: "Préparer la demande",
    quantityDecrease: (name: string) => `Diminuer la quantité de ${name}`,
    quantityIncrease: (name: string) => `Augmenter la quantité de ${name}`,
    quantityLabel: (name: string) => `Quantité de ${name}`,
    recommendation: "Recommandé",
    reset: "Réinitialiser",
    resetFilters: "R\u00e9initialiser les filtres",
    resultStatus: (view: string, count: number) =>
      `Vue ${view}, ${count} plat${count > 1 ? "s" : ""} affiché${count > 1 ? "s" : ""}`,
    review: "LAISSER UN AVIS",
    reviewClose: "Fermer l'avis",
    reviewComment: "Votre commentaire",
    reviewExperiencePlaceholder: "Comment s'est passée votre visite ?",
    reviewExperienceStars: "Note de l'expérience",
    reviewExperienceTitle: "Noter votre expérience",
    reviewMissing: "Lien Google Review non configuré pour ce restaurant.",
    reviewOpened: "Google Review ouvert dans un nouvel onglet.",
    reviewPlaceholder: "Comment était le goût ?",
    reviewPost: "Publier l'avis",
    reviewStars: "Note du plat",
    reviewTitle: "Noter ce plat",
    searchLabel: "Recherche",
    searchPlaceholder: "Rechercher un plat, ingrédient, tag...",
    selection: "Sélection",
    selectionKicker: "Sélection locale",
    selectionTitle: "Votre sélection",
    server: "Serveur",
    sesameFree: "Sans s\u00e9same",
    shellfishFree: "Sans crustac\u00e9s",
    signature: "Signature",
    soyFree: "Sans soja",
    soldOut: "Indispo",
    tags: "Tags",
    spicy: "Plat épicé",
    swipeAria: "Balayer pour changer de catégorie",
    swipeLabel: "Balayer",
    tableLabel: "Table",
    tablePlaceholder: "Ex. 12",
    tableToConfirm: "Table à confirmer",
    themeDarkAria: "Activer le mode sombre",
    themeLightAria: "Activer le mode clair",
    threeD: "VOIR EN 3D",
    toConfirm: "À confirmer",
    viewAr: "Voir devant moi",
    viewGrid: "grille",
    viewList: "liste",
    viewModeAria: "Mode d'affichage",
    waiterKicker: "Service à table",
    waiterReady: (table: string) => `${table} - demande prête localement.`,
    waiterTitle: "Demander au serveur",
    waiterTopic: "Objet de la demande",
    waiterTopics: {
      allergen: "Question allergène",
      recommendation: "Demander une recommandation",
      selection: "Demander ma sélection"
    },
    veg: "Végé"
  },
  en: {
    activeCategoryAll: "Menu",
    add: "Add",
    addToSelection: "Add to selection",
    all: "All",
    activeFilterPrefix: "Active filter",
    activeFilters: (count: number) => `${count} filters`,
    allergens: "Allergens",
    allergenTitlePrefix: "Allergen",
    askWaiter: "Ask waiter",
    available: "Available",
    backToMenu: "Back to menu",
    categories: "CATEGORIES",
    categoryAria: "Categories",
    clearSearch: "Clear",
    close: "Close",
    closeFilters: "Close filters",
    closeDetail: "Close details",
    closeLanguage: "Close language chooser",
    closeSelection: "Close selection",
    closeWaiter: "Close waiter request",
    currencyAria: "Choose menu currency",
    currencyCopy: "Prices are converted locally from the CAD menu price.",
    currencyKicker: "Currency",
    currencyTitle: "Menu currency",
    details: "Details",
    emptySelectionBody: "Add a dish to prepare a waiter request.",
    emptySelectionTitle: "Your selection is empty.",
    estimatedTotal: "Estimated total",
    filterAllAria: "Show all dishes",
    filterAvailableAria: "Filter available dishes",
    filterImmersiveAria: "Filter dishes with 3D or AR",
    filterNonVegAria: "Filter detected non-vegetarian dishes",
    filterRecommendedAria: "Filter signature or recommended dishes",
    filterVegAria: "Filter detected vegetarian dishes",
    filterApply: "Apply",
    filterButton: "Filter",
    filterFallback: "Filter",
    filterGroupLabel: "Filters",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Filters",
    filtersAria: "Quick filters",
    dairyFree: "Dairy-free",
    eggFree: "Egg-free",
    fishFree: "Fish-free",
    glutenFree: "Gluten-free",
    nutFree: "Nut-free",
    gridAria: "Show grid view",
    greeting: {
      afternoon: "Welcome",
      evening: "Good evening",
      morning: "Good morning",
      night: "Good evening"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.en,
    heroAction: "View menu",
    heroBlurb: "House cooking, warm accents and table service.",
    houseNote: "House note",
    immersiveUnavailable: "3D view is not available for this dish.",
    ingredients: "Ingredients",
    ingredientsCount: (count: number) =>
      `${count} ingredient${count > 1 ? "s" : ""}`,
    languageActive: "Active",
    languageAria: "Choose menu language",
    languageKicker: "Language",
    languageSubtitle: "Browse the menu in the language that suits you.",
    languageTitle: "Menu language",
    listAria: "Show list view",
    localOrderHint:
      "No order is sent automatically. Show this request to the team.",
    menuAria: "Trouvable menu",
    menuContextFallback: "Table menu",
    modelPreparing: "Preparing the immersive view...",
    modelUnavailable: "3D view is temporarily unavailable.",
    arBrowserHelp:
      "If \"View in my space\" does not open, open this dish in Safari or Chrome, then launch 3D again.",
    arBrowserLink: "Open in browser",
    moreDetails: "View details",
    viewDetails: "View details",
    detailCompositionLabel: "In the dish",
    detailAllergensLabel: "Allergens to note",
    detailOptionsLabel: "Customize",
    detailHouseNoteLabel: "House note",
    detailFallback: "No additional details for this dish.",
    cardOptionsLabel: "Available options",
    nextDish: "Next dish",
    nonVeg: "Non-veg",
    noResultsBody: "Try another search or remove a filter.",
    noResultsTitle: "No dish matches.",
    options: "Options",
    popular: "Popular",
    previousDish: "Previous dish",
    priceToConfirm: "Price to confirm",
    prepareRequest: "Prepare request",
    quantityDecrease: (name: string) => `Decrease quantity of ${name}`,
    quantityIncrease: (name: string) => `Increase quantity of ${name}`,
    quantityLabel: (name: string) => `Quantity of ${name}`,
    recommendation: "Recommended",
    reset: "Reset",
    resetFilters: "Reset filters",
    resultStatus: (view: string, count: number) =>
      `${view} view, ${count} dish${count > 1 ? "es" : ""} shown`,
    review: "TAP TO REVIEW",
    reviewClose: "Close review",
    reviewComment: "Your comment",
    reviewExperiencePlaceholder: "How was your visit?",
    reviewExperienceStars: "Experience rating",
    reviewExperienceTitle: "Rate your experience",
    reviewMissing: "Google Review link is not configured for this restaurant.",
    reviewOpened: "Google Review opened in a new tab.",
    reviewPlaceholder: "How was the taste?",
    reviewPost: "POST REVIEW",
    reviewStars: "Dish rating",
    reviewTitle: "Rate this Dish",
    searchLabel: "Search",
    searchPlaceholder: "Search dish, ingredient, tag...",
    selection: "Selection",
    selectionKicker: "Local selection",
    selectionTitle: "Your selection",
    server: "Waiter",
    sesameFree: "Sesame-free",
    shellfishFree: "Shellfish-free",
    signature: "Signature",
    soyFree: "Soy-free",
    soldOut: "Sold out",
    tags: "Tags",
    spicy: "Spicy dish",
    swipeAria: "Swipe to change category",
    swipeLabel: "Swipe",
    tableLabel: "Table",
    tablePlaceholder: "E.g. 12",
    tableToConfirm: "Table to confirm",
    themeDarkAria: "Turn on dark mode",
    themeLightAria: "Turn on light mode",
    threeD: "VIEW IN 3D",
    toConfirm: "To confirm",
    viewAr: "View in my space",
    viewGrid: "grid",
    viewList: "list",
    viewModeAria: "Display mode",
    waiterKicker: "Table service",
    waiterReady: (table: string) => `${table} - request ready locally.`,
    waiterTitle: "Ask waiter",
    waiterTopic: "Request topic",
    waiterTopics: {
      allergen: "Allergen question",
      recommendation: "Ask for a recommendation",
      selection: "Ask about my selection"
    },
    veg: "Veg"
  },
  es: {
    activeCategoryAll: "La carta",
    add: "Anadir",
    addToSelection: "Anadir a mi seleccion",
    all: "Todo",
    activeFilterPrefix: "Filtro activo",
    activeFilters: (count: number) => `${count} filtros`,
    allergens: "Alergenos",
    allergenTitlePrefix: "Alergeno",
    askWaiter: "Pedir al camarero",
    available: "Disponible",
    backToMenu: "Volver al menu",
    categories: "CATEGORIAS",
    categoryAria: "Categorias",
    clearSearch: "Borrar",
    close: "Cerrar",
    closeFilters: "Cerrar filtros",
    closeDetail: "Cerrar detalles",
    closeLanguage: "Cerrar idiomas",
    closeSelection: "Cerrar seleccion",
    closeWaiter: "Cerrar solicitud",
    currencyAria: "Elegir divisa del menu",
    currencyCopy: "Los precios se convierten localmente desde el precio CAD del menu.",
    currencyKicker: "Divisa",
    currencyTitle: "Divisa del menu",
    details: "Detalles",
    emptySelectionBody: "Anade un plato para preparar una solicitud al camarero.",
    emptySelectionTitle: "Tu seleccion esta vacia.",
    estimatedTotal: "Total estimado",
    filterAllAria: "Mostrar todos los platos",
    filterAvailableAria: "Filtrar platos disponibles",
    filterImmersiveAria: "Filtrar platos con 3D o AR",
    filterNonVegAria: "Filtrar platos no vegetarianos detectados",
    filterRecommendedAria: "Filtrar platos firma o recomendados",
    filterVegAria: "Filtrar platos vegetarianos detectados",
    filterApply: "Aplicar",
    filterButton: "Filtrar",
    filterFallback: "Filtro",
    filterGroupLabel: "Filtros",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Filtros",
    filtersAria: "Filtros rapidos",
    dairyFree: "Sin lacteos",
    eggFree: "Sin huevo",
    fishFree: "Sin pescado",
    glutenFree: "Sin gluten",
    nutFree: "Sin frutos secos",
    gridAria: "Mostrar vista en cuadricula",
    greeting: {
      afternoon: "Bienvenido",
      evening: "Buenas noches",
      morning: "Buenos días",
      night: "Buenas noches"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.es,
    heroAction: "Ver la carta",
    heroBlurb: "Cocina de casa, acentos calidos y servicio en mesa.",
    houseNote: "Nota de la casa",
    immersiveUnavailable: "La vista 3D no esta disponible para este plato.",
    ingredients: "Ingredientes",
    ingredientsCount: (count: number) =>
      `${count} ingrediente${count > 1 ? "s" : ""}`,
    languageActive: "Activo",
    languageAria: "Elegir idioma del menu",
    languageKicker: "Idioma",
    languageSubtitle: "Consulte la carta en el idioma que prefiera.",
    languageTitle: "Idioma del menu",
    listAria: "Mostrar vista en lista",
    localOrderHint:
      "No se envia ningun pedido automaticamente. Muestra esta solicitud al equipo.",
    menuAria: "Menu Trouvable",
    menuContextFallback: "Menu de mesa",
    modelPreparing: "Preparando la vista inmersiva...",
    modelUnavailable: "La vista 3D no esta disponible temporalmente.",
    arBrowserHelp:
      "Si \"Ver frente a mi\" no se abre, abre esta ficha en Safari o Chrome y vuelve a lanzar el 3D.",
    arBrowserLink: "Abrir en el navegador",
    moreDetails: "Ver detalles",
    viewDetails: "Ver detalles",
    detailCompositionLabel: "En el plato",
    detailAllergensLabel: "A tener en cuenta",
    detailOptionsLabel: "Personalizar",
    detailHouseNoteLabel: "Nota de la casa",
    detailFallback: "No hay detalles adicionales para este plato.",
    cardOptionsLabel: "Opciones disponibles",
    nextDish: "Plato siguiente",
    nonVeg: "No veg",
    noResultsBody: "Prueba otra busqueda o quita un filtro.",
    noResultsTitle: "Ningun plato coincide.",
    options: "Opciones",
    popular: "Popular",
    previousDish: "Plato anterior",
    priceToConfirm: "Precio por confirmar",
    prepareRequest: "Preparar solicitud",
    quantityDecrease: (name: string) => `Disminuir cantidad de ${name}`,
    quantityIncrease: (name: string) => `Aumentar cantidad de ${name}`,
    quantityLabel: (name: string) => `Cantidad de ${name}`,
    recommendation: "Recomendado",
    reset: "Restablecer",
    resetFilters: "Restablecer filtros",
    resultStatus: (view: string, count: number) =>
      `Vista ${view}, ${count} plato${count > 1 ? "s" : ""} visible${count > 1 ? "s" : ""}`,
    review: "DEJAR RESENA",
    reviewClose: "Cerrar resena",
    reviewComment: "Tu comentario",
    reviewExperiencePlaceholder: "Como fue tu visita?",
    reviewExperienceStars: "Valoracion de la experiencia",
    reviewExperienceTitle: "Valorar tu experiencia",
    reviewMissing: "El enlace de Google Review no esta configurado para este restaurante.",
    reviewOpened: "Google Review se abrio en una nueva pestana.",
    reviewPlaceholder: "Que tal el sabor?",
    reviewPost: "Publicar resena",
    reviewStars: "Valoracion del plato",
    reviewTitle: "Valorar este plato",
    searchLabel: "Buscar",
    searchPlaceholder: "Buscar plato, ingrediente, etiqueta...",
    selection: "Seleccion",
    selectionKicker: "Seleccion local",
    selectionTitle: "Tu seleccion",
    server: "Camarero",
    sesameFree: "Sin sesamo",
    shellfishFree: "Sin mariscos",
    signature: "Firma",
    soyFree: "Sin soja",
    soldOut: "Agotado",
    tags: "Etiquetas",
    spicy: "Plato picante",
    swipeAria: "Desliza para cambiar de categoría",
    swipeLabel: "Deslizar",
    tableLabel: "Mesa",
    tablePlaceholder: "Ej. 12",
    tableToConfirm: "Mesa por confirmar",
    themeDarkAria: "Activar modo oscuro",
    themeLightAria: "Activar modo claro",
    threeD: "VER EN 3D",
    toConfirm: "Por confirmar",
    viewAr: "Ver frente a mi",
    viewGrid: "cuadricula",
    viewList: "lista",
    viewModeAria: "Modo de vista",
    waiterKicker: "Servicio en mesa",
    waiterReady: (table: string) => `${table} - solicitud lista localmente.`,
    waiterTitle: "Pedir al camarero",
    waiterTopic: "Tema de la solicitud",
    waiterTopics: {
      allergen: "Pregunta sobre alergenos",
      recommendation: "Pedir una recomendacion",
      selection: "Preguntar por mi seleccion"
    },
    veg: "Veg"
  },
  it: {
    activeCategoryAll: "Il menu",
    add: "Aggiungi",
    addToSelection: "Aggiungi alla selezione",
    all: "Tutto",
    activeFilterPrefix: "Filtro attivo",
    activeFilters: (count: number) => `${count} filtri`,
    allergens: "Allergeni",
    allergenTitlePrefix: "Allergene",
    askWaiter: "Chiedi al cameriere",
    available: "Disponibile",
    backToMenu: "Torna al menu",
    categories: "CATEGORIE",
    categoryAria: "Categorie",
    clearSearch: "Cancella",
    close: "Chiudi",
    closeFilters: "Chiudi filtri",
    closeDetail: "Chiudi dettagli",
    closeLanguage: "Chiudi lingua",
    closeSelection: "Chiudi selezione",
    closeWaiter: "Chiudi richiesta",
    currencyAria: "Scegli la valuta del menu",
    currencyCopy: "I prezzi sono convertiti localmente dal prezzo CAD del menu.",
    currencyKicker: "Valuta",
    currencyTitle: "Valuta del menu",
    details: "Dettagli",
    emptySelectionBody: "Aggiungi un piatto per preparare una richiesta al cameriere.",
    emptySelectionTitle: "La tua selezione e vuota.",
    estimatedTotal: "Totale stimato",
    filterAllAria: "Mostra tutti i piatti",
    filterAvailableAria: "Filtra i piatti disponibili",
    filterImmersiveAria: "Filtra i piatti con 3D o AR",
    filterNonVegAria: "Filtra i piatti non vegetariani rilevati",
    filterRecommendedAria: "Filtra piatti signature o consigliati",
    filterVegAria: "Filtra i piatti vegetariani rilevati",
    filterApply: "Applica",
    filterButton: "Filtra",
    filterFallback: "Filtro",
    filterGroupLabel: "Filtri",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Filtri",
    filtersAria: "Filtri rapidi",
    dairyFree: "Senza latticini",
    eggFree: "Senza uova",
    fishFree: "Senza pesce",
    glutenFree: "Senza glutine",
    nutFree: "Senza frutta a guscio",
    gridAria: "Mostra vista griglia",
    greeting: {
      afternoon: "Benvenuto",
      evening: "Buonasera",
      morning: "Buongiorno",
      night: "Buonasera"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.it,
    heroAction: "Vedi il menu",
    heroBlurb: "Cucina di casa, toni caldi e servizio al tavolo.",
    houseNote: "Nota della casa",
    immersiveUnavailable: "La vista 3D non e disponibile per questo piatto.",
    ingredients: "Ingredienti",
    ingredientsCount: (count: number) =>
      `${count} ingrediente${count > 1 ? "i" : ""}`,
    languageActive: "Attivo",
    languageAria: "Scegli la lingua del menu",
    languageKicker: "Lingua",
    languageSubtitle: "Consulta il menu nella lingua che preferisci.",
    languageTitle: "Lingua del menu",
    listAria: "Mostra vista lista",
    localOrderHint:
      "Nessun ordine viene inviato automaticamente. Mostra questa richiesta al team.",
    menuAria: "Menu Trouvable",
    menuContextFallback: "Menu al tavolo",
    modelPreparing: "Preparazione della vista immersiva...",
    modelUnavailable: "La vista 3D e temporaneamente non disponibile.",
    arBrowserHelp:
      "Se \"Vedi davanti a me\" non si apre, apri questa scheda in Safari o Chrome e rilancia il 3D.",
    arBrowserLink: "Apri nel browser",
    moreDetails: "Vedi dettagli",
    viewDetails: "Vedi dettagli",
    detailCompositionLabel: "Nel piatto",
    detailAllergensLabel: "Da segnalare",
    detailOptionsLabel: "Personalizza",
    detailHouseNoteLabel: "Nota della casa",
    detailFallback: "Nessun dettaglio aggiuntivo per questo piatto.",
    cardOptionsLabel: "Opzioni disponibili",
    nextDish: "Piatto successivo",
    nonVeg: "Non veg",
    noResultsBody: "Prova un'altra ricerca o rimuovi un filtro.",
    noResultsTitle: "Nessun piatto corrisponde.",
    options: "Opzioni",
    popular: "Popolare",
    previousDish: "Piatto precedente",
    priceToConfirm: "Prezzo da confermare",
    prepareRequest: "Prepara richiesta",
    quantityDecrease: (name: string) => `Diminuisci quantita di ${name}`,
    quantityIncrease: (name: string) => `Aumenta quantita di ${name}`,
    quantityLabel: (name: string) => `Quantita di ${name}`,
    recommendation: "Consigliato",
    reset: "Reimposta",
    resetFilters: "Reimposta filtri",
    resultStatus: (view: string, count: number) =>
      `Vista ${view}, ${count} piatt${count > 1 ? "i" : "o"} visibil${count > 1 ? "i" : "e"}`,
    review: "LASCIA RECENSIONE",
    reviewClose: "Chiudi recensione",
    reviewComment: "Il tuo commento",
    reviewExperiencePlaceholder: "Com'e stata la visita?",
    reviewExperienceStars: "Valutazione esperienza",
    reviewExperienceTitle: "Valuta la tua esperienza",
    reviewMissing: "Link Google Review non configurato per questo ristorante.",
    reviewOpened: "Google Review aperto in una nuova scheda.",
    reviewPlaceholder: "Com'era il gusto?",
    reviewPost: "Pubblica recensione",
    reviewStars: "Valutazione piatto",
    reviewTitle: "Valuta questo piatto",
    searchLabel: "Cerca",
    searchPlaceholder: "Cerca piatto, ingrediente, tag...",
    selection: "Selezione",
    selectionKicker: "Selezione locale",
    selectionTitle: "La tua selezione",
    server: "Cameriere",
    sesameFree: "Senza sesamo",
    shellfishFree: "Senza crostacei",
    signature: "Signature",
    soyFree: "Senza soia",
    soldOut: "Esaurito",
    tags: "Tag",
    spicy: "Piatto piccante",
    swipeAria: "Scorri per cambiare categoria",
    swipeLabel: "Scorri",
    tableLabel: "Tavolo",
    tablePlaceholder: "Es. 12",
    tableToConfirm: "Tavolo da confermare",
    themeDarkAria: "Attiva modalita scura",
    themeLightAria: "Attiva modalita chiara",
    threeD: "VEDI IN 3D",
    toConfirm: "Da confermare",
    viewAr: "Vedi davanti a me",
    viewGrid: "griglia",
    viewList: "lista",
    viewModeAria: "Modo vista",
    waiterKicker: "Servizio al tavolo",
    waiterReady: (table: string) => `${table} - richiesta pronta localmente.`,
    waiterTitle: "Chiedi al cameriere",
    waiterTopic: "Oggetto della richiesta",
    waiterTopics: {
      allergen: "Domanda sugli allergeni",
      recommendation: "Chiedi un consiglio",
      selection: "Chiedi della mia selezione"
    },
    veg: "Veg"
  },
  ar: {
    activeCategoryAll: "القائمة",
    add: "إضافة",
    addToSelection: "إضافة إلى اختياري",
    all: "الكل",
    activeFilterPrefix: "فلتر نشط",
    activeFilters: (count: number) => `${count} فلاتر`,
    allergens: "مسببات الحساسية",
    allergenTitlePrefix: "مسبب الحساسية",
    askWaiter: "اطلب النادل",
    available: "متاح",
    backToMenu: "العودة إلى القائمة",
    categories: "الفئات",
    categoryAria: "الفئات",
    clearSearch: "مسح",
    close: "إغلاق",
    closeFilters: "إغلاق الفلاتر",
    closeDetail: "إغلاق التفاصيل",
    closeLanguage: "إغلاق اختيار اللغة",
    closeSelection: "إغلاق الاختيار",
    closeWaiter: "إغلاق طلب النادل",
    currencyAria: "اختيار عملة القائمة",
    currencyCopy: "يتم تحويل الأسعار محليا من سعر القائمة بالدولار الكندي.",
    currencyKicker: "العملة",
    currencyTitle: "عملة القائمة",
    details: "التفاصيل",
    emptySelectionBody: "أضف طبقا لتحضير طلب للنادل.",
    emptySelectionTitle: "اختيارك فارغ.",
    estimatedTotal: "الإجمالي التقديري",
    filterAllAria: "عرض كل الأطباق",
    filterAvailableAria: "تصفية الأطباق المتاحة",
    filterImmersiveAria: "تصفية أطباق 3D أو AR",
    filterNonVegAria: "تصفية الأطباق غير النباتية",
    filterRecommendedAria: "تصفية الأطباق المميزة أو المقترحة",
    filterVegAria: "تصفية الأطباق النباتية",
    filterApply: "تطبيق",
    filterButton: "تصفية",
    filterFallback: "فلتر",
    filterGroupLabel: "الفلاتر",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "الفلاتر",
    filtersAria: "فلاتر سريعة",
    dairyFree: "بدون ألبان",
    eggFree: "بدون بيض",
    fishFree: "بدون سمك",
    glutenFree: "بدون غلوتين",
    nutFree: "بدون مكسرات",
    gridAria: "عرض الشبكة",
    greeting: {
      afternoon: "أهلاً وسهلاً",
      evening: "مساء الخير",
      morning: "صباح الخير",
      night: "مساء الخير"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.ar,
    heroAction: "عرض القائمة",
    heroBlurb: "طبخ منزلي ولمسات دافئة وخدمة على الطاولة.",
    houseNote: "ملاحظة الدار",
    immersiveUnavailable: "عرض 3D غير متاح لهذا الطبق.",
    ingredients: "المكونات",
    ingredientsCount: (count: number) => `${count} مكونات`,
    languageActive: "نشط",
    languageAria: "اختيار لغة القائمة",
    languageKicker: "اللغة",
    languageSubtitle: "تصفح القائمة باللغة التي تناسبك.",
    languageTitle: "لغة القائمة",
    listAria: "عرض القائمة",
    localOrderHint:
      "لا يتم إرسال أي طلب تلقائيا. اعرض هذا الطلب على الفريق.",
    menuAria: "قائمة Trouvable",
    menuContextFallback: "قائمة الطاولة",
    modelPreparing: "جار تحضير العرض التفاعلي...",
    modelUnavailable: "عرض 3D غير متاح مؤقتا.",
    arBrowserHelp:
      "إذا لم يفتح \"اعرض أمامي\"، افتح هذه الصفحة في Safari أو Chrome ثم شغل 3D مرة أخرى.",
    arBrowserLink: "فتح في المتصفح",
    moreDetails: "عرض التفاصيل",
    viewDetails: "عرض التفاصيل",
    detailCompositionLabel: "في الطبق",
    detailAllergensLabel: "للانتباه",
    detailOptionsLabel: "تخصيص",
    detailHouseNoteLabel: "ملاحظة الدار",
    detailFallback: "لا توجد تفاصيل إضافية لهذا الطبق.",
    cardOptionsLabel: "الخيارات المتاحة",
    nextDish: "الطبق التالي",
    nonVeg: "غير نباتي",
    noResultsBody: "جرب بحثا آخر أو أزل فلتر.",
    noResultsTitle: "لا يوجد طبق مطابق.",
    options: "الخيارات",
    popular: "شائع",
    previousDish: "الطبق السابق",
    priceToConfirm: "السعر للتأكيد",
    prepareRequest: "تحضير الطلب",
    quantityDecrease: (name: string) => `تقليل كمية ${name}`,
    quantityIncrease: (name: string) => `زيادة كمية ${name}`,
    quantityLabel: (name: string) => `كمية ${name}`,
    recommendation: "موصى به",
    reset: "إعادة ضبط",
    resetFilters: "إعادة ضبط الفلاتر",
    resultStatus: (view: string, count: number) =>
      `عرض ${view}، ${count} أطباق معروضة`,
    review: "اترك تقييما",
    reviewClose: "إغلاق التقييم",
    reviewComment: "تعليقك",
    reviewExperiencePlaceholder: "كيف كانت زيارتك؟",
    reviewExperienceStars: "تقييم التجربة",
    reviewExperienceTitle: "قيّم تجربتك",
    reviewMissing: "رابط Google Review غير معد لهذا المطعم.",
    reviewOpened: "تم فتح Google Review في تبويب جديد.",
    reviewPlaceholder: "كيف كان الطعم؟",
    reviewPost: "نشر التقييم",
    reviewStars: "تقييم الطبق",
    reviewTitle: "قيّم هذا الطبق",
    searchLabel: "بحث",
    searchPlaceholder: "ابحث عن طبق أو مكون أو وسم...",
    selection: "الاختيار",
    selectionKicker: "اختيار محلي",
    selectionTitle: "اختيارك",
    server: "النادل",
    sesameFree: "بدون سمسم",
    shellfishFree: "بدون قشريات",
    signature: "مميز",
    soyFree: "بدون صويا",
    soldOut: "غير متاح",
    tags: "وسوم",
    spicy: "طبق حار",
    swipeAria: "مرر لتغيير الفئة",
    swipeLabel: "مرر",
    tableLabel: "الطاولة",
    tablePlaceholder: "مثال 12",
    tableToConfirm: "الطاولة للتأكيد",
    themeDarkAria: "تفعيل الوضع الداكن",
    themeLightAria: "تفعيل الوضع الفاتح",
    threeD: "عرض 3D",
    toConfirm: "للتأكيد",
    viewAr: "اعرض أمامي",
    viewGrid: "شبكة",
    viewList: "قائمة",
    viewModeAria: "نمط العرض",
    waiterKicker: "خدمة الطاولة",
    waiterReady: (table: string) => `${table} - الطلب جاهز محليا.`,
    waiterTitle: "اطلب النادل",
    waiterTopic: "موضوع الطلب",
    waiterTopics: {
      allergen: "سؤال عن الحساسية",
      recommendation: "طلب توصية",
      selection: "السؤال عن اختياري"
    },
    veg: "نباتي"
  }
} as const;

type WidenTrouvableCopyValue<T> = T extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : T extends Record<string, string>
    ? { [Key in keyof T]: string }
    : T extends string
      ? string
      : T;

type TrouvableCopy = {
  [Key in keyof (typeof TROUVABLE_COPY)["en"]]: WidenTrouvableCopyValue<
    (typeof TROUVABLE_COPY)["en"][Key]
  >;
};

type LocalizedUiCopyBuckets = {
  exact: Map<string, Record<string, unknown>>;
  language: Map<string, Record<string, unknown>>;
};

type CopyLeafSpec = {
  path: string;
  key: keyof TrouvableCopy;
  nestedKey?: string;
  kind: "string" | "function-template";
};

function renderCopyTemplate(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (output, [key, value]) =>
      output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template
  );
}

const COPY_FUNCTION_TEMPLATE_BUILDERS: {
  [Key in keyof TrouvableCopy]?: (template: string) => TrouvableCopy[Key];
} = {
  activeFilters: (template) => (count: number) =>
    renderCopyTemplate(template, { count }),
  ingredientsCount: (template) => (count: number) =>
    renderCopyTemplate(template, { count }),
  quantityDecrease: (template) => (name: string) =>
    renderCopyTemplate(template, { name }),
  quantityIncrease: (template) => (name: string) =>
    renderCopyTemplate(template, { name }),
  quantityLabel: (template) => (name: string) =>
    renderCopyTemplate(template, { name }),
  resultStatus: (template) => (view: string, count: number) =>
    renderCopyTemplate(template, { view, count }),
  waiterReady: (template) => (table: string) =>
    renderCopyTemplate(template, { table })
};

function copyLeafSpecs(base: TrouvableCopy): CopyLeafSpec[] {
  const specs: CopyLeafSpec[] = [];
  for (const [rawKey, value] of Object.entries(base)) {
    const key = rawKey as keyof TrouvableCopy;
    if (typeof value === "string") {
      specs.push({ key, kind: "string", path: rawKey });
      continue;
    }
    if (typeof value === "function" && COPY_FUNCTION_TEMPLATE_BUILDERS[key]) {
      specs.push({ key, kind: "function-template", path: rawKey });
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === "string") {
          specs.push({
            key,
            kind: "string",
            nestedKey,
            path: `${rawKey}.${nestedKey}`
          });
        }
      }
    }
  }
  return specs;
}

const TROUVABLE_COPY_LEAF_SPECS = copyLeafSpecs(TROUVABLE_COPY.en);

export function normalizeTrouvableLocale(value: unknown): TrouvableLocale {
  return normalizePublicMenuLocale(value);
}

export function normalizeTrouvableLocaleForSettings(
  value: unknown,
  settings: PublicMenuSettings
): TrouvableLocale {
  return normalizePublicMenuLocalePreference(value, settings);
}

export function normalizeTrouvableCurrency(
  value: unknown,
  settings?: PublicMenuSettings
): TrouvableCurrency {
  if (settings) {
    return normalizePublicMenuCurrencyPreference(value, settings);
  }
  const currency = typeof value === "string" ? value.toUpperCase() : "";
  return /^[A-Z]{3}$/.test(currency) ? currency : "CAD";
}

export function normalizeTrouvableTheme(
  value: unknown,
  settings?: PublicMenuSettings
): TrouvableTheme {
  if (settings) return normalizePublicMenuThemePreference(value, settings);
  return value === "light" ? "light" : "dark";
}

function languageCodeForLocale(locale: unknown): string {
  const normalized = normalizePublicMenuLocale(locale);
  try {
    return new Intl.Locale(normalized).language.toLowerCase();
  } catch {
    return normalized.toLowerCase().split("-")[0] ?? "";
  }
}

function builtInCopyLocaleForPublicLocale(
  locale: TrouvableLocale
): TrouvableCopyLocale | null {
  const language = languageCodeForLocale(locale);
  return TROUVABLE_COPY_LOCALE_SET.has(language)
    ? (language as TrouvableCopyLocale)
    : null;
}

export function getTrouvableCopyLocale(locale: TrouvableLocale): TrouvableCopyLocale {
  return builtInCopyLocaleForPublicLocale(locale) ?? TROUVABLE_FALLBACK_COPY_LOCALE;
}

export function getTrouvableTextDirection(locale: TrouvableLocale): "ltr" | "rtl" {
  return RTL_LANGUAGE_CODES.has(languageCodeForLocale(locale)) ? "rtl" : "ltr";
}

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0
    )
  );
}

function copyStringOverrides(value: unknown, base: TrouvableCopy): Partial<TrouvableCopy> {
  const overrides: Partial<TrouvableCopy> = {};
  for (const [key, text] of Object.entries(stringOverrides(value))) {
    if (typeof base[key as keyof TrouvableCopy] === "string") {
      (overrides as Record<string, unknown>)[key] = text;
    }
  }
  return overrides;
}

function copyFunctionTemplateOverrides(
  value: unknown,
  base: TrouvableCopy
): Partial<TrouvableCopy> {
  const overrides: Partial<TrouvableCopy> = {};
  for (const [key, text] of Object.entries(stringOverrides(value))) {
    const copyKey = key as keyof TrouvableCopy;
    const builder = COPY_FUNCTION_TEMPLATE_BUILDERS[copyKey];
    if (builder && typeof base[copyKey] === "function") {
      (overrides as Record<string, unknown>)[key] = builder(text);
    }
  }
  return overrides;
}

function localizedUiCopyBucketKey(value: string):
  | { normalizedKey: string; language: string }
  | null {
  const input = value.trim().replace("_", "-");
  if (!input || Object.prototype.hasOwnProperty.call(TROUVABLE_COPY.en, value)) {
    return null;
  }
  try {
    const locale = new Intl.Locale(input);
    const language = locale.language.toLowerCase();
    return language
      ? { normalizedKey: locale.toString().toLowerCase(), language }
      : null;
  } catch {
    return null;
  }
}

function localizedUiCopyBuckets(uiCopy: unknown): LocalizedUiCopyBuckets {
  const source = objectInput(uiCopy);
  const exact = new Map<string, Record<string, unknown>>();
  const language = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(source)) {
    const localeKey = localizedUiCopyBucketKey(key);
    if (!localeKey) continue;
    const bucket = objectInput(value);
    if (Object.keys(bucket).length === 0) continue;
    exact.set(localeKey.normalizedKey, bucket);
    if (localeKey.normalizedKey === localeKey.language) {
      language.set(localeKey.language, bucket);
    }
  }
  return { exact, language };
}

function copyOverrideDiagnostics(value: unknown): {
  coveredPaths: Set<string>;
  ignoredKeys: Set<string>;
} {
  const input = objectInput(value);
  const coveredPaths = new Set<string>();
  const ignoredKeys = new Set<string>();

  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey as keyof TrouvableCopy;
    const baseValue = TROUVABLE_COPY.en[key];
    if (baseValue === undefined) {
      if (!localizedUiCopyBucketKey(rawKey)) ignoredKeys.add(rawKey);
      continue;
    }

    if (typeof baseValue === "string") {
      if (typeof rawValue === "string" && rawValue.trim()) {
        coveredPaths.add(rawKey);
      } else {
        ignoredKeys.add(rawKey);
      }
      continue;
    }

    if (typeof baseValue === "function") {
      if (
        COPY_FUNCTION_TEMPLATE_BUILDERS[key] &&
        typeof rawValue === "string" &&
        rawValue.trim()
      ) {
        coveredPaths.add(rawKey);
      } else {
        ignoredKeys.add(rawKey);
      }
      continue;
    }

    if (baseValue && typeof baseValue === "object" && !Array.isArray(baseValue)) {
      const nestedInput = objectInput(rawValue);
      if (Object.keys(nestedInput).length === 0) {
        ignoredKeys.add(rawKey);
        continue;
      }
      for (const [nestedKey, nestedValue] of Object.entries(nestedInput)) {
        const nestedPath = `${rawKey}.${nestedKey}`;
        if (
          Object.prototype.hasOwnProperty.call(baseValue, nestedKey) &&
          typeof nestedValue === "string" &&
          nestedValue.trim()
        ) {
          coveredPaths.add(nestedPath);
        } else {
          ignoredKeys.add(nestedPath);
        }
      }
      continue;
    }

    ignoredKeys.add(rawKey);
  }

  return { coveredPaths, ignoredKeys };
}

function copyCoverageFor(overrides: unknown[]): {
  coveredPaths: Set<string>;
  ignoredKeys: string[];
} {
  const coveredPaths = new Set<string>();
  const ignoredKeys = new Set<string>();
  for (const override of overrides) {
    const diagnostics = copyOverrideDiagnostics(override);
    for (const path of diagnostics.coveredPaths) coveredPaths.add(path);
    for (const key of diagnostics.ignoredKeys) ignoredKeys.add(key);
  }
  return {
    coveredPaths,
    ignoredKeys: Array.from(ignoredKeys).sort()
  };
}

function hasFlatCopyOverride(uiCopy: unknown): boolean {
  return copyOverrideDiagnostics(uiCopy).coveredPaths.size > 0;
}

function copyNestedOverrides(value: unknown, base: TrouvableCopy): Partial<TrouvableCopy> {
  const input = objectInput(value);
  const overrides: Partial<TrouvableCopy> = {};
  for (const [rawKey, baseValue] of Object.entries(base)) {
    if (!baseValue || typeof baseValue !== "object" || Array.isArray(baseValue)) {
      continue;
    }
    const nestedOverrides = stringOverrides(input[rawKey]);
    if (Object.keys(nestedOverrides).length === 0) continue;
    (overrides as Record<string, unknown>)[rawKey] = {
      ...baseValue,
      ...nestedOverrides
    };
  }
  return overrides;
}

function mergeCopy(base: TrouvableCopy, ...overrides: unknown[]): TrouvableCopy {
  return overrides.reduce<TrouvableCopy>(
    (current, override) => ({
      ...current,
      ...copyStringOverrides(override, current),
      ...copyFunctionTemplateOverrides(override, current),
      ...copyNestedOverrides(override, current)
    }),
    base
  );
}

export function resolveTrouvableCopy(
  locale: TrouvableLocale,
  localizedUiCopy?: Record<string, unknown>
): {
  copy: TrouvableCopy;
  resolution: {
    requestedLocale: string;
    requestedLanguage: string;
    dynamicSource: "exact" | "language" | "legacy-flat" | "none";
    builtInLocale: TrouvableCopyLocale;
    usedNeutralFallback: boolean;
    uiCopyComplete: boolean;
    missingKeys: string[];
    ignoredKeys: string[];
  };
} {
  const requestedLocale = normalizePublicMenuLocale(locale);
  const requestedLanguage = languageCodeForLocale(requestedLocale);
  const builtInLocale =
    builtInCopyLocaleForPublicLocale(requestedLocale) ?? TROUVABLE_FALLBACK_COPY_LOCALE;
  const buckets = localizedUiCopyBuckets(localizedUiCopy);
  const exactOverride = buckets.exact.get(requestedLocale.toLowerCase());
  const languageOverride = buckets.language.get(requestedLanguage);
  const legacyFlatOverride =
    localizedUiCopy && hasFlatCopyOverride(localizedUiCopy)
      ? localizedUiCopy
      : undefined;
  const dynamicSource = exactOverride
    ? "exact"
    : languageOverride
      ? "language"
      : legacyFlatOverride
        ? "legacy-flat"
        : "none";
  const dynamicOverrides = [legacyFlatOverride, languageOverride, exactOverride].filter(
    Boolean
  );
  const dynamicCoverage = copyCoverageFor(dynamicOverrides);
  const hasBuiltInCompleteCopy = builtInLocale !== TROUVABLE_FALLBACK_COPY_LOCALE ||
    requestedLanguage === TROUVABLE_FALLBACK_COPY_LOCALE;
  const missingKeys = hasBuiltInCompleteCopy
    ? []
    : TROUVABLE_COPY_LEAF_SPECS
        .map((spec) => spec.path)
        .filter((path) => !dynamicCoverage.coveredPaths.has(path));
  const uiCopyComplete = missingKeys.length === 0;

  return {
    copy: mergeCopy(
      TROUVABLE_COPY[builtInLocale],
      legacyFlatOverride,
      languageOverride,
      exactOverride
    ),
    resolution: {
      requestedLocale,
      requestedLanguage,
      dynamicSource,
      builtInLocale,
      usedNeutralFallback:
        builtInLocale === TROUVABLE_FALLBACK_COPY_LOCALE &&
        requestedLanguage !== TROUVABLE_FALLBACK_COPY_LOCALE &&
        !uiCopyComplete,
      uiCopyComplete,
      missingKeys,
      ignoredKeys: dynamicCoverage.ignoredKeys
    }
  };
}

export function getTrouvableCopy(
  locale: TrouvableLocale,
  uiCopy?: Record<string, unknown>
) {
  return resolveTrouvableCopy(locale, uiCopy).copy;
}

export function getTrouvableCurrencyOption(currency: TrouvableCurrency) {
  const option = TROUVABLE_CURRENCY_OPTIONS.find((item) => item.code === currency);
  if (option) return option;
  let symbol = currency;
  try {
    const parts = new Intl.NumberFormat("fr-CA", {
      currency,
      style: "currency"
    }).formatToParts(1);
    symbol = parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    symbol = currency;
  }
  return {
    code: currency,
    label: { en: currency, fr: currency },
    symbol
  };
}

export function getTrouvableCurrencyOptions(settings: PublicMenuSettings) {
  return settings.supportedCurrencies.map(getTrouvableCurrencyOption);
}

function intlDisplayName(
  locale: TrouvableLocale,
  type: "currency" | "language",
  code: string
): string {
  try {
    return new Intl.DisplayNames([normalizePublicMenuLocale(locale)], { type }).of(code) ?? "";
  } catch {
    return "";
  }
}

export function getTrouvableCurrencyOptionLabel(
  option: ReturnType<typeof getTrouvableCurrencyOption>,
  locale: TrouvableLocale
) {
  return (
    intlDisplayName(locale, "currency", option.code) ||
    option.label[getTrouvableCopyLocale(locale)] ||
    option.code
  );
}

function formatPublicLocaleLabel(
  locale: string,
  displayLocale?: TrouvableLocale
): string {
  const presentation = getTrouvableLanguagePresentation(locale);
  if (displayLocale) {
    const localized = intlDisplayName(displayLocale, "language", locale);
    if (localized) return `${localized} (${locale})`;
  }
  return `${presentation.nativeName} · ${presentation.region} (${presentation.code})`;
}

const LANGUAGE_PRESENTATION: Record<
  string,
  { nativeName: string; region: string; code: string }
> = {
  ar: { nativeName: "العربية", region: "عربي", code: "AR" },
  "de-DE": { nativeName: "Deutsch", region: "Deutschland", code: "DE-DE" },
  "en-CA": { nativeName: "English", region: "Canada", code: "EN-CA" },
  "en-GB": { nativeName: "English", region: "United Kingdom", code: "EN-GB" },
  "en-US": { nativeName: "English", region: "United States", code: "EN-US" },
  "es-ES": { nativeName: "Español", region: "España", code: "ES-ES" },
  "es-MX": { nativeName: "Español", region: "México", code: "ES-MX" },
  "fr-CA": { nativeName: "Français", region: "Canada", code: "FR-CA" },
  "fr-FR": { nativeName: "Français", region: "France", code: "FR-FR" },
  "it-IT": { nativeName: "Italiano", region: "Italia", code: "IT-IT" },
  "pt-BR": { nativeName: "Português", region: "Brasil", code: "PT-BR" },
  "pt-PT": { nativeName: "Português", region: "Portugal", code: "PT-PT" }
};

function formatLocaleCode(publicLocale: string): string {
  const normalized = normalizePublicMenuLocale(publicLocale);
  if (normalized === "ar") return "AR";
  return normalized.toUpperCase();
}

export function getTrouvableLanguageShortCode(publicLocale: string): string {
  const normalized = normalizePublicMenuLocale(publicLocale);
  const [languagePart] = normalized.split("-");
  return (languagePart || normalized).toUpperCase();
}

export function getTrouvableLanguagePresentation(publicLocale: string): {
  nativeName: string;
  region: string;
  code: string;
} {
  const normalized = normalizePublicMenuLocale(publicLocale);
  const preset = LANGUAGE_PRESENTATION[normalized];
  if (preset) return preset;

  const option = PUBLIC_MENU_LOCALE_OPTIONS.find((item) => item.value === normalized);
  let nativeName = option?.label ?? normalized;
  let region = "";

  try {
    const intlLocale = new Intl.Locale(normalized);
    const languageDisplay = new Intl.DisplayNames([normalized], { type: "language" }).of(
      intlLocale.language
    );
    if (languageDisplay) nativeName = languageDisplay;
    if (intlLocale.region) {
      region =
        new Intl.DisplayNames([normalized], { type: "region" }).of(intlLocale.region) ??
        intlLocale.region;
    }
  } catch {
    const parenMatch = option?.label.match(/^(.+?)\s*\((.+)\)$/);
    if (parenMatch) {
      nativeName = parenMatch[1]?.trim() ?? nativeName;
      region = parenMatch[2]?.trim() ?? region;
    }
  }

  return {
    nativeName,
    region: region || normalized,
    code: formatLocaleCode(normalized)
  };
}

export function getTrouvableLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  displayLocale?: TrouvableLocale
): Array<{
  locale: TrouvableLocale;
  publicLocale: string;
  label: string;
  nativeName: string;
  region: string;
  code: string;
  shortCode: string;
}> {
  const options: Array<{
    locale: TrouvableLocale;
    publicLocale: string;
    label: string;
    nativeName: string;
    region: string;
    code: string;
    shortCode: string;
  }> = [];
  for (const publicLocale of settings.supportedLocales) {
    const presentation = getTrouvableLanguagePresentation(publicLocale);
    options.push({
      locale: publicLocale,
      publicLocale,
      nativeName: presentation.nativeName,
      region: presentation.region,
      code: presentation.code,
      shortCode: getTrouvableLanguageShortCode(publicLocale),
      label: formatPublicLocaleLabel(publicLocale, displayLocale)
    });
  }
  return options;
}

export function isTrouvableLocaleSupported(
  locale: TrouvableLocale,
  settings: PublicMenuSettings
): boolean {
  return settings.supportedLocales.includes(
    normalizePublicMenuLocalePreference(locale, settings)
  );
}

export function getTrouvableLocalePublicTag(
  locale: TrouvableLocale,
  settings: PublicMenuSettings
): string {
  return normalizePublicMenuLocalePreference(locale, settings);
}

export function parseTrouvablePriceLabel(priceLabel: string): number | null {
  const match = priceLabel.match(/-?\d[\d\s.,]*/);
  if (!match) return null;

  let value = match[0].replace(/\s/g, "");
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    value = value.replace(",", ".");
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatTrouvableAmount(
  cadAmount: number,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  if (exchangeRates) {
    return formatMenuPrice({
      priceCents: Math.round(cadAmount * 100),
      sourceCurrency: exchangeRates.base,
      targetCurrency: currency,
      locale,
      rates: exchangeRates.rates,
      baseCurrency: exchangeRates.base,
      fallbackLabel: formatMenuPriceCents({
        priceCents: Math.round(cadAmount * 100),
        currency: exchangeRates.base,
        locale
      })
    });
  }

  return new Intl.NumberFormat(normalizePublicMenuLocale(locale), {
    currency,
    style: "currency"
  }).format(cadAmount * (TROUVABLE_STATIC_CAD_RATES[currency] ?? 1));
}

export function formatTrouvablePriceLabel(
  priceLabel: string,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  const cadAmount = parseTrouvablePriceLabel(priceLabel);
  return cadAmount === null
    ? priceLabel
    : formatTrouvableAmount(cadAmount, currency, locale, exchangeRates);
}

export function getTrouvableDishConvertedPriceCents(
  dish: PublicMenuDish,
  currency: TrouvableCurrency,
  exchangeRates?: MenuExchangeRates
): number | null {
  const baseCurrency = exchangeRates?.base ?? dish.baseCurrency;
  const rates = exchangeRates?.rates;
  return convertMenuPriceCents({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    baseCurrency,
    rates
  });
}

export function formatTrouvableDishPrice(
  dish: PublicMenuDish,
  currency: TrouvableCurrency,
  locale: TrouvableLocale,
  exchangeRates?: MenuExchangeRates
): string {
  return formatMenuPrice({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    locale,
    rates: exchangeRates?.rates,
    baseCurrency: exchangeRates?.base ?? dish.baseCurrency,
    displayPriceMode: dish.displayPriceMode,
    fallbackLabel: dish.priceLabel
  });
}

export function formatTrouvablePriceCents(
  priceCents: number,
  currency: TrouvableCurrency,
  locale: TrouvableLocale
): string {
  return formatMenuPriceCents({ priceCents, currency, locale });
}

export function getTrouvableGreetingPeriod(
  date: Date = new Date()
): TrouvableGreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getTrouvableGreeting(
  locale: TrouvableLocale,
  period: TrouvableGreetingPeriod
): string {
  return TROUVABLE_COPY[getTrouvableCopyLocale(locale)].greeting[period];
}

export function getTrouvableGreetingForDate(
  locale: TrouvableLocale,
  timezone: string,
  date: Date = new Date(),
  localizedUiCopy?: Record<string, unknown>
): string {
  const resolved = resolveTrouvableCopy(locale, localizedUiCopy);
  if (resolved.resolution.dynamicSource !== "none") {
    const period = getGreetingPeriodForTime(date, timezone);
    return resolved.copy.greeting[period];
  }
  return getGreetingForTime(date, normalizePublicMenuLocale(locale), timezone);
}

export function translateTrouvableCategoryLabel(
  label: string,
  locale: TrouvableLocale
): string {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return CATEGORY_TRANSLATIONS[normalized]?.[getTrouvableCopyLocale(locale)] ?? label;
}

export function buildNavigableMenuSections(
  allCategoryId: string,
  categoryLabels: readonly string[]
): string[] {
  const sections = [allCategoryId];
  const seen = new Set(sections);

  for (const label of categoryLabels) {
    if (seen.has(label)) continue;
    seen.add(label);
    sections.push(label);
  }

  return sections;
}

export function getAdjacentMenuSection(
  sections: readonly string[],
  currentSection: string,
  direction: 1 | -1
): string | null {
  if (sections.length <= 1) return null;
  const currentIndex = sections.indexOf(currentSection);
  if (currentIndex < 0) return null;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= sections.length) return null;
  return sections[nextIndex] ?? null;
}
