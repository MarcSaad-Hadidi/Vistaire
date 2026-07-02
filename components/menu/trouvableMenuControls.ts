import {
  convertMenuPriceCents,
  formatMenuPrice,
  formatMenuPriceCents,
  type MenuExchangeRates
} from "../../lib/currency/formatMenuPrice.ts";
import { getGreetingForTime } from "../../lib/menu/greeting.ts";
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
      afternoon: "Bon après-midi",
      evening: "Bonsoir",
      morning: "Bonjour",
      night: "Bonne nuit"
    },
    heroAction: "Voir la carte",
    heroBlurb: "Cuisine maison, accents chaleureux et service à table.",
    houseNote: "Note maison",
    immersiveUnavailable: "Vue 3D non disponible pour ce plat.",
    ingredients: "Ingrédients",
    ingredientsCount: (count: number) =>
      `${count} ingrédient${count > 1 ? "s" : ""}`,
    languageAria: "Choisir la langue du menu",
    languageCopy: "Le menu garde les noms de plats tels que fournis quand aucune traduction n'existe.",
    languageKicker: "Langue",
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
    moreDetails: "Plus de détails",
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
    swipeList: "Balayer ↔",
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
      afternoon: "Good afternoon",
      evening: "Good evening",
      morning: "Good morning",
      night: "Good night"
    },
    heroAction: "View menu",
    heroBlurb: "House cooking, warm accents and table service.",
    houseNote: "House note",
    immersiveUnavailable: "3D view is not available for this dish.",
    ingredients: "Ingredients",
    ingredientsCount: (count: number) =>
      `${count} ingredient${count > 1 ? "s" : ""}`,
    languageAria: "Choose menu language",
    languageCopy: "Dish names stay as provided when no translation exists.",
    languageKicker: "Language",
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
    moreDetails: "More details",
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
    swipeList: "Swipe List ↔",
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
      afternoon: "Buenas tardes",
      evening: "Buenas noches",
      morning: "Buenos dias",
      night: "Buenas noches"
    },
    heroAction: "Ver la carta",
    heroBlurb: "Cocina de casa, acentos calidos y servicio en mesa.",
    houseNote: "Nota de la casa",
    immersiveUnavailable: "La vista 3D no esta disponible para este plato.",
    ingredients: "Ingredientes",
    ingredientsCount: (count: number) =>
      `${count} ingrediente${count > 1 ? "s" : ""}`,
    languageAria: "Elegir idioma del menu",
    languageCopy: "Los nombres de platos se conservan si no existe traduccion.",
    languageKicker: "Idioma",
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
    moreDetails: "Mas detalles",
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
    swipeList: "Deslizar",
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
      afternoon: "Buon pomeriggio",
      evening: "Buonasera",
      morning: "Buongiorno",
      night: "Buona notte"
    },
    heroAction: "Vedi il menu",
    heroBlurb: "Cucina di casa, toni caldi e servizio al tavolo.",
    houseNote: "Nota della casa",
    immersiveUnavailable: "La vista 3D non e disponibile per questo piatto.",
    ingredients: "Ingredienti",
    ingredientsCount: (count: number) =>
      `${count} ingrediente${count > 1 ? "i" : ""}`,
    languageAria: "Scegli la lingua del menu",
    languageCopy: "I nomi dei piatti restano originali se non esiste una traduzione.",
    languageKicker: "Lingua",
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
    moreDetails: "Piu dettagli",
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
    swipeList: "Scorri",
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
      afternoon: "مساء الخير",
      evening: "مساء الخير",
      morning: "صباح الخير",
      night: "تصبح على خير"
    },
    heroAction: "عرض القائمة",
    heroBlurb: "طبخ منزلي ولمسات دافئة وخدمة على الطاولة.",
    houseNote: "ملاحظة الدار",
    immersiveUnavailable: "عرض 3D غير متاح لهذا الطبق.",
    ingredients: "المكونات",
    ingredientsCount: (count: number) => `${count} مكونات`,
    languageAria: "اختيار لغة القائمة",
    languageCopy: "تبقى أسماء الأطباق كما هي عند عدم توفر ترجمة.",
    languageKicker: "اللغة",
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
    moreDetails: "تفاصيل أكثر",
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
    swipeList: "مرر",
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

export function getTrouvableCopyLocale(locale: TrouvableLocale): TrouvableCopyLocale {
  const normalized = normalizePublicMenuLocale(locale);
  try {
    const language = new Intl.Locale(normalized).language.toLowerCase();
    return TROUVABLE_COPY_LOCALE_SET.has(language)
      ? (language as TrouvableCopyLocale)
      : "en";
  } catch {
    const language = normalized.toLowerCase().split("-")[0] ?? "";
    return TROUVABLE_COPY_LOCALE_SET.has(language)
      ? (language as TrouvableCopyLocale)
      : "en";
  }
}

function copyLocaleForPublicLocale(locale: TrouvableLocale): TrouvableCopyLocale {
  return getTrouvableCopyLocale(locale);
}

export function getTrouvableTextDirection(locale: TrouvableLocale): "ltr" | "rtl" {
  return copyLocaleForPublicLocale(locale) === "ar" ? "rtl" : "ltr";
}

function stringOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0
    )
  );
}

export function getTrouvableCopy(
  locale: TrouvableLocale,
  uiCopy?: Record<string, unknown>
) {
  const base = TROUVABLE_COPY[copyLocaleForPublicLocale(locale)];
  if (!uiCopy) return base;
  return {
    ...base,
    ...stringOverrides(uiCopy),
    greeting: {
      ...base.greeting,
      ...stringOverrides(uiCopy.greeting)
    },
    waiterTopics: {
      ...base.waiterTopics,
      ...stringOverrides(uiCopy.waiterTopics)
    }
  };
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
    option.label[copyLocaleForPublicLocale(locale)] ||
    option.code
  );
}

function formatPublicLocaleLabel(
  locale: string,
  displayLocale?: TrouvableLocale
): string {
  if (displayLocale) {
    const localized = intlDisplayName(displayLocale, "language", locale);
    if (localized) return `${localized} (${locale})`;
  }
  const option = PUBLIC_MENU_LOCALE_OPTIONS.find((item) => item.value === locale);
  return option ? `${option.label} (${locale})` : locale;
}

export function getTrouvableLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  displayLocale?: TrouvableLocale
): Array<{
  locale: TrouvableLocale;
  publicLocale: string;
  label: string;
}> {
  const options: Array<{
    locale: TrouvableLocale;
    publicLocale: string;
    label: string;
  }> = [];
  for (const publicLocale of settings.supportedLocales) {
    options.push({
      locale: publicLocale,
      publicLocale,
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
  return TROUVABLE_COPY[copyLocaleForPublicLocale(locale)].greeting[period];
}

export function getTrouvableGreetingForDate(
  locale: TrouvableLocale,
  timezone: string,
  date: Date = new Date()
): string {
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
  return CATEGORY_TRANSLATIONS[normalized]?.[copyLocaleForPublicLocale(locale)] ?? label;
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
