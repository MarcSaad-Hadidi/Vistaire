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
type TrouvableCopyLocale = "fr" | "en" | "es" | "it" | "de" | "el" | "ar";

const TROUVABLE_COPY_LOCALES = ["fr", "en", "es", "it", "de", "el", "ar"] as const;
const TROUVABLE_COPY_LOCALE_SET = new Set<string>(TROUVABLE_COPY_LOCALES);
const TROUVABLE_FALLBACK_COPY_LOCALE: TrouvableCopyLocale = "en";

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
  de: {
    action: "Google-Bewertung abgeben",
    fallbackRestaurant: "das Restaurant",
    metaLabel: "Google-Zusammenfassung",
    note:
      "Es wird kein Vorteil im Austausch für eine Bewertung angeboten. Ihre Bewertung sollte Ihre echte Erfahrung widerspiegeln.",
    presentationRatingLabel: "Google-Vorschau: {rating}/5",
    presentationReviewCountLabel: "Vorschau: {count} Bewertungen",
    ratingLabel: "{rating}/5 bei Google",
    reviewCountLabel: "{count} Google-Bewertungen",
    text:
      "Teilen Sie Ihre Erfahrung bei {restaurantName}. Ihre Google-Bewertung hilft dem Team, jeden Besuch besser zu verstehen und leichter entdeckt zu werden.",
    title: "Ihre Erfahrung zählt"
  },
  el: {
    action: "Αφήστε αξιολόγηση Google",
    fallbackRestaurant: "το εστιατόριο",
    metaLabel: "Σύνοψη Google",
    note:
      "Δεν προσφέρεται κανένα όφελος ως αντάλλαγμα για αξιολόγηση. Η αξιολόγησή σας πρέπει να αντικατοπτρίζει την πραγματική εμπειρία σας.",
    presentationRatingLabel: "Προεπισκόπηση Google: {rating}/5",
    presentationReviewCountLabel: "Προεπισκόπηση: {count} αξιολογήσεις",
    ratingLabel: "{rating}/5 στο Google",
    reviewCountLabel: "{count} αξιολογήσεις Google",
    text:
      "Μοιραστείτε την εμπειρία σας στο {restaurantName}. Η αξιολόγησή σας στο Google βοηθά την ομάδα να κατανοεί κάθε επίσκεψη και να γίνεται πιο εύκολα ανακαλύψιμη.",
    title: "Η εμπειρία σας μετράει"
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
    backToTop: "Retour en haut",
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
    dairyFree: "Déclaré sans produits laitiers",
    eggFree: "Déclaré sans œufs",
    fishFree: "Déclaré sans poisson",
    glutenFree: "Déclaré sans gluten",
    nutFree: "Déclaré sans fruits à coque",
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
    modelAlt: (name: string) => `Vue du plat : ${name}`,
    modelViewer: {
      loadingBody: "Quelques secondes peuvent être nécessaires selon le réseau.",
      arHelp:
        "Faites tourner le plat en 3D. En AR, placez-le une fois : il reste fixe à cet endroit (sans rotation automatique ni redimensionnement).",
      quickLookCta: "Afficher devant moi",
      shareText: "Découvrez ce plat en 3D.",
      sizeDisclaimer:
        "Visuel indicatif : la taille 3D peut différer de la taille réelle du plat.",
      loadFailureTitle: "La vue 3D n'a pas pu être chargée pour le moment.",
      loadFailureBodyWithAr:
        "Vous pouvez réessayer la 3D ou placer le plat devant vous depuis Safari.",
      loadFailureBody:
        "Vous pouvez réessayer maintenant ou revenir à la fiche du plat.",
      retry: "Réessayer",
      close: "Fermer",
      returnToDish: "Revenir à la fiche du plat",
      slowNetworkTitle: "Réseau lent détecté : charger la vue 3D ?",
      slowNetworkBody:
        "La photo du plat reste disponible, et la vue 3D peut être lancée quand vous le souhaitez.",
      slowNetworkCta: "Charger la vue 3D",
      noModelQuiet: "Vue 3D indisponible pour le moment.",
      noModelIos:
        "La vue 3D sera bientôt disponible ici. Vous pouvez déjà placer le plat devant vous dans Safari.",
      noModelIosHandoff:
        "La vue 3D sera bientôt disponible ici. Pour placer le plat devant vous, ouvrez cette fiche dans Safari.",
      noModelSoon: "Ce plat sera bientôt disponible en 3D.",
      safariTitle: "Réalité augmentée disponible dans Safari",
      copyLink: "Copier le lien",
      linkCopied: "Lien copié",
      share: "Partager",
      iosUsdzMissing: "Pour activer l'AR iPhone, ajoutez un fichier USDZ à ce plat.",
      desktopArHint:
        "La réalité augmentée se lance depuis un téléphone compatible.",
      arAndroidBrowser:
        "Votre navigateur ne permet pas la réalité augmentée ici. Vous pouvez quand même faire tourner le plat en 3D.",
      arIosHandoff:
        "Pour placer le plat devant vous, ouvrez cette fiche dans Safari sur iPhone."
    },
    modelUnavailable: "Vue 3D temporairement indisponible.",
    arBrowserFallback: {
      ios: {
        title: "Ouvrez cette fiche dans Safari",
        body:
          "Ce navigateur intégré ne peut pas lancer la réalité augmentée. Copiez le lien de cette fiche, ouvrez Safari, puis collez-le dans la barre d'adresse.",
        action: "Copier le lien pour Safari",
        success: "Lien copié. Ouvrez Safari, puis collez-le dans la barre d'adresse."
      },
      android: {
        title: "Ouvrez cette fiche dans Chrome",
        body:
          "Ce navigateur intégré ne peut pas lancer la réalité augmentée. Copiez le lien de cette fiche, ouvrez Chrome, puis collez-le dans la barre d'adresse.",
        action: "Copier le lien pour Chrome",
        success: "Lien copié. Ouvrez Chrome, puis collez-le dans la barre d'adresse."
      },
      other: {
        title: "Réalité augmentée indisponible dans ce navigateur",
        body:
          "Copiez le lien de cette fiche, puis ouvrez-le dans le navigateur principal de votre appareil.",
        action: "Copier le lien de la fiche",
        success:
          "Lien copié. Ouvrez votre navigateur principal, puis collez-le dans la barre d'adresse."
      },
      copyError:
        "La copie automatique a échoué. Sélectionnez le lien ci-dessous et copiez-le manuellement.",
      manualCopyLabel: "Lien de la fiche",
      selectLink: "Sélectionner le lien"
    },
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
    sesameFree: "Déclaré sans sésame",
    shellfishFree: "Déclaré sans crustacés ni mollusques",
    signature: "Signature",
    soyFree: "Déclaré sans soja",
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
    backToTop: "Back to top",
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
    dairyFree: "Declared dairy-free",
    eggFree: "Declared egg-free",
    fishFree: "Declared fish-free",
    glutenFree: "Declared gluten-free",
    nutFree: "Declared tree-nut-free",
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
    modelAlt: (name: string) => `Dish view: ${name}`,
    modelViewer: {
      loadingBody: "A few seconds may be needed depending on the network.",
      arHelp:
        "Rotate the dish in 3D. In AR, place it once: it stays fixed there, without automatic rotation or resizing.",
      quickLookCta: "View in my space",
      shareText: "Explore this dish in 3D.",
      sizeDisclaimer:
        "Indicative visual: the 3D size may differ from the dish's real size.",
      loadFailureTitle: "The 3D view could not be loaded right now.",
      loadFailureBodyWithAr:
        "You can retry 3D or place the dish in your space from Safari.",
      loadFailureBody:
        "You can try again now or return to the dish details.",
      retry: "Try again",
      close: "Close",
      returnToDish: "Return to dish details",
      slowNetworkTitle: "Slow network detected: load 3D view?",
      slowNetworkBody:
        "The dish photo remains available, and the 3D view can be launched whenever you like.",
      slowNetworkCta: "Load 3D view",
      noModelQuiet: "3D view is unavailable for now.",
      noModelIos:
        "The 3D view will be available here soon. You can already place the dish in your space in Safari.",
      noModelIosHandoff:
        "The 3D view will be available here soon. To place the dish in your space, open this dish page in Safari.",
      noModelSoon: "This dish will be available in 3D soon.",
      safariTitle: "Augmented reality available in Safari",
      copyLink: "Copy link",
      linkCopied: "Link copied",
      share: "Share",
      iosUsdzMissing: "To enable iPhone AR, add a USDZ file to this dish.",
      desktopArHint: "Augmented reality launches from a compatible phone.",
      arAndroidBrowser:
        "Your browser does not allow augmented reality here. You can still rotate the dish in 3D.",
      arIosHandoff:
        "To place the dish in your space, open this dish page in Safari on iPhone."
    },
    modelUnavailable: "3D view is temporarily unavailable.",
    arBrowserFallback: {
      ios: {
        title: "Open this dish page in Safari",
        body:
          "This in-app browser cannot launch augmented reality. Copy this dish page link, open Safari, then paste it into the address bar.",
        action: "Copy link for Safari",
        success: "Link copied. Open Safari, then paste it into the address bar."
      },
      android: {
        title: "Open this dish page in Chrome",
        body:
          "This in-app browser cannot launch augmented reality. Copy this dish page link, open Chrome, then paste it into the address bar.",
        action: "Copy link for Chrome",
        success: "Link copied. Open Chrome, then paste it into the address bar."
      },
      other: {
        title: "Augmented reality unavailable in this browser",
        body:
          "Copy this dish page link, then open it in your device's main browser.",
        action: "Copy dish page link",
        success:
          "Link copied. Open your main browser, then paste it into the address bar."
      },
      copyError:
        "Automatic copying failed. Select the link below and copy it manually.",
      manualCopyLabel: "Dish page link",
      selectLink: "Select link"
    },
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
    sesameFree: "Declared sesame-free",
    shellfishFree: "Declared shellfish-free",
    signature: "Signature",
    soyFree: "Declared soy-free",
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
    backToTop: "Volver arriba",
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
    dairyFree: "Declarado sin lácteos",
    eggFree: "Declarado sin huevo",
    fishFree: "Declarado sin pescado",
    glutenFree: "Declarado sin gluten",
    nutFree: "Declarado sin frutos secos",
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
    modelAlt: (name: string) => `Vista del plato: ${name}`,
    modelViewer: {
      loadingBody: "Pueden hacer falta unos segundos segun la red.",
      arHelp:
        "Gira el plato en 3D. En RA, colocalo una vez: queda fijo en ese lugar, sin rotacion automatica ni cambio de tamano.",
      quickLookCta: "Ver frente a mi",
      shareText: "Descubre este plato en 3D.",
      sizeDisclaimer:
        "Visual indicativo: el tamaño 3D puede diferir del tamaño real del plato.",
      loadFailureTitle: "La vista 3D no se pudo cargar por ahora.",
      loadFailureBodyWithAr:
        "Puedes volver a intentar el 3D o colocar el plato delante de ti desde Safari.",
      loadFailureBody:
        "Puedes intentarlo de nuevo ahora o volver a la ficha del plato.",
      retry: "Reintentar",
      close: "Cerrar",
      returnToDish: "Volver a la ficha del plato",
      slowNetworkTitle: "Red lenta detectada: cargar la vista 3D?",
      slowNetworkBody:
        "La foto del plato sigue disponible, y la vista 3D se puede abrir cuando quieras.",
      slowNetworkCta: "Cargar vista 3D",
      noModelQuiet: "Vista 3D no disponible por ahora.",
      noModelIos:
        "La vista 3D estara disponible aqui pronto. Ya puedes colocar el plato delante de ti en Safari.",
      noModelIosHandoff:
        "La vista 3D estara disponible aqui pronto. Para colocar el plato delante de ti, abre esta ficha en Safari.",
      noModelSoon: "Este plato estara disponible en 3D pronto.",
      safariTitle: "Realidad aumentada disponible en Safari",
      copyLink: "Copiar enlace",
      linkCopied: "Enlace copiado",
      share: "Compartir",
      iosUsdzMissing: "Para activar la RA en iPhone, anade un archivo USDZ a este plato.",
      desktopArHint:
        "La realidad aumentada se abre desde un telefono compatible.",
      arAndroidBrowser:
        "Tu navegador no permite la realidad aumentada aqui. Aun asi puedes girar el plato en 3D.",
      arIosHandoff:
        "Para colocar el plato delante de ti, abre esta ficha en Safari en iPhone."
    },
    modelUnavailable: "La vista 3D no esta disponible temporalmente.",
    arBrowserFallback: {
      ios: {
        title: "Abre esta ficha en Safari",
        body:
          "Este navegador integrado no puede iniciar la realidad aumentada. Copia el enlace de esta ficha, abre Safari y pégalo en la barra de direcciones.",
        action: "Copiar enlace para Safari",
        success: "Enlace copiado. Abre Safari y pégalo en la barra de direcciones."
      },
      android: {
        title: "Abre esta ficha en Chrome",
        body:
          "Este navegador integrado no puede iniciar la realidad aumentada. Copia el enlace de esta ficha, abre Chrome y pégalo en la barra de direcciones.",
        action: "Copiar enlace para Chrome",
        success: "Enlace copiado. Abre Chrome y pégalo en la barra de direcciones."
      },
      other: {
        title: "Realidad aumentada no disponible en este navegador",
        body:
          "Copia el enlace de esta ficha y ábrelo en el navegador principal de tu dispositivo.",
        action: "Copiar enlace de la ficha",
        success:
          "Enlace copiado. Abre tu navegador principal y pégalo en la barra de direcciones."
      },
      copyError:
        "La copia automática ha fallado. Selecciona el enlace de abajo y cópialo manualmente.",
      manualCopyLabel: "Enlace de la ficha",
      selectLink: "Seleccionar enlace"
    },
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
    sesameFree: "Declarado sin sésamo",
    shellfishFree: "Declarado sin mariscos",
    signature: "Firma",
    soyFree: "Declarado sin soja",
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
    backToTop: "Torna in alto",
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
    dairyFree: "Dichiarato senza latticini",
    eggFree: "Dichiarato senza uova",
    fishFree: "Dichiarato senza pesce",
    glutenFree: "Dichiarato senza glutine",
    nutFree: "Dichiarato senza frutta a guscio",
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
    modelAlt: (name: string) => `Vista del piatto: ${name}`,
    modelViewer: {
      loadingBody: "Potrebbero servire alcuni secondi a seconda della rete.",
      arHelp:
        "Ruota il piatto in 3D. In AR, posizionalo una sola volta: resta fisso in quel punto, senza rotazione automatica o ridimensionamento.",
      quickLookCta: "Vedi davanti a me",
      shareText: "Scopri questo piatto in 3D.",
      sizeDisclaimer:
        "Visuale indicativa: la dimensione 3D può differire dalla dimensione reale del piatto.",
      loadFailureTitle: "La vista 3D non puo essere caricata al momento.",
      loadFailureBodyWithAr:
        "Puoi riprovare il 3D o posizionare il piatto davanti a te da Safari.",
      loadFailureBody:
        "Puoi riprovare ora o tornare alla scheda del piatto.",
      retry: "Riprova",
      close: "Chiudi",
      returnToDish: "Torna alla scheda del piatto",
      slowNetworkTitle: "Rete lenta rilevata: caricare la vista 3D?",
      slowNetworkBody:
        "La foto del piatto resta disponibile e la vista 3D puo essere avviata quando vuoi.",
      slowNetworkCta: "Carica vista 3D",
      noModelQuiet: "Vista 3D non disponibile per il momento.",
      noModelIos:
        "La vista 3D sara presto disponibile qui. Puoi gia posizionare il piatto davanti a te in Safari.",
      noModelIosHandoff:
        "La vista 3D sara presto disponibile qui. Per posizionare il piatto davanti a te, apri questa scheda in Safari.",
      noModelSoon: "Questo piatto sara presto disponibile in 3D.",
      safariTitle: "Realta aumentata disponibile in Safari",
      copyLink: "Copia link",
      linkCopied: "Link copiato",
      share: "Condividi",
      iosUsdzMissing: "Per attivare l'AR su iPhone, aggiungi un file USDZ a questo piatto.",
      desktopArHint:
        "La realta aumentata si avvia da un telefono compatibile.",
      arAndroidBrowser:
        "Il tuo browser non consente la realta aumentata qui. Puoi comunque ruotare il piatto in 3D.",
      arIosHandoff:
        "Per posizionare il piatto davanti a te, apri questa scheda in Safari su iPhone."
    },
    modelUnavailable: "La vista 3D e temporaneamente non disponibile.",
    arBrowserFallback: {
      ios: {
        title: "Apri questa scheda in Safari",
        body:
          "Questo browser integrato non può avviare la realtà aumentata. Copia il link di questa scheda, apri Safari e incollalo nella barra degli indirizzi.",
        action: "Copia il link per Safari",
        success: "Link copiato. Apri Safari e incollalo nella barra degli indirizzi."
      },
      android: {
        title: "Apri questa scheda in Chrome",
        body:
          "Questo browser integrato non può avviare la realtà aumentata. Copia il link di questa scheda, apri Chrome e incollalo nella barra degli indirizzi.",
        action: "Copia il link per Chrome",
        success: "Link copiato. Apri Chrome e incollalo nella barra degli indirizzi."
      },
      other: {
        title: "Realtà aumentata non disponibile in questo browser",
        body:
          "Copia il link di questa scheda e aprilo nel browser principale del tuo dispositivo.",
        action: "Copia il link della scheda",
        success:
          "Link copiato. Apri il browser principale e incollalo nella barra degli indirizzi."
      },
      copyError:
        "La copia automatica non è riuscita. Seleziona il link qui sotto e copialo manualmente.",
      manualCopyLabel: "Link della scheda",
      selectLink: "Seleziona link"
    },
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
    sesameFree: "Dichiarato senza sesamo",
    shellfishFree: "Dichiarato senza crostacei",
    signature: "Signature",
    soyFree: "Dichiarato senza soia",
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
  de: {
    activeCategoryAll: "Menü",
    add: "Hinzufügen",
    addToSelection: "Zur Auswahl hinzufügen",
    all: "Alle",
    activeFilterPrefix: "Aktiver Filter",
    activeFilters: (count: number) => `${count} Filter`,
    allergens: "Allergene",
    allergenTitlePrefix: "Allergen",
    askWaiter: "Service fragen",
    available: "Verfügbar",
    backToMenu: "Zurück zum Menü",
    backToTop: "Nach oben",
    categories: "KATEGORIEN",
    categoryAria: "Kategorien",
    clearSearch: "Löschen",
    close: "Schließen",
    closeFilters: "Filter schließen",
    closeDetail: "Details schließen",
    closeLanguage: "Sprachauswahl schließen",
    closeSelection: "Auswahl schließen",
    closeWaiter: "Serviceanfrage schließen",
    currencyAria: "Menüwährung wählen",
    currencyCopy: "Preise werden lokal vom CAD-Menüpreis umgerechnet.",
    currencyKicker: "Währung",
    currencyTitle: "Menüwährung",
    details: "Details",
    emptySelectionBody: "Fügen Sie ein Gericht hinzu, um eine Serviceanfrage vorzubereiten.",
    emptySelectionTitle: "Ihre Auswahl ist leer.",
    estimatedTotal: "Geschätzte Summe",
    filterAllAria: "Alle Gerichte anzeigen",
    filterAvailableAria: "Verfügbare Gerichte filtern",
    filterImmersiveAria: "Gerichte mit 3D oder AR filtern",
    filterNonVegAria: "Erkannte nicht-vegetarische Gerichte filtern",
    filterRecommendedAria: "Empfohlene Gerichte filtern",
    filterVegAria: "Erkannte vegetarische Gerichte filtern",
    filterApply: "Anwenden",
    filterButton: "Filtern",
    filterFallback: "Filter",
    filterGroupLabel: "Filter",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Filter",
    filtersAria: "Schnellfilter",
    dairyFree: "Als milchfrei deklariert",
    eggFree: "Als eifrei deklariert",
    fishFree: "Als fischfrei deklariert",
    glutenFree: "Als glutenfrei deklariert",
    nutFree: "Als nussfrei deklariert",
    gridAria: "Rasteransicht anzeigen",
    greeting: {
      afternoon: "Willkommen",
      evening: "Guten Abend",
      morning: "Guten Morgen",
      night: "Guten Abend"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.de,
    heroAction: "Menü ansehen",
    heroBlurb: "Hausgemachte Küche, warme Akzente und Service am Tisch.",
    houseNote: "Küchennotiz",
    immersiveUnavailable: "Die 3D-Ansicht ist für dieses Gericht nicht verfügbar.",
    ingredients: "Zutaten",
    ingredientsCount: (count: number) =>
      `${count} ${count === 1 ? "Zutat" : "Zutaten"}`,
    languageActive: "Aktiv",
    languageAria: "Menüsprache wählen",
    languageKicker: "Sprache",
    languageSubtitle: "Lesen Sie das Menü in der Sprache, die zu Ihnen passt.",
    languageTitle: "Menüsprache",
    listAria: "Listenansicht anzeigen",
    localOrderHint:
      "Es wird keine Bestellung automatisch gesendet. Zeigen Sie diese Anfrage dem Team.",
    menuAria: "Trouvable-Menü",
    menuContextFallback: "Tischmenü",
    modelPreparing: "Interaktive Ansicht wird vorbereitet...",
    modelAlt: (name: string) => `Ansicht des Gerichts: ${name}`,
    modelViewer: {
      loadingBody: "Je nach Verbindung kann es einige Sekunden dauern.",
      arHelp:
        "Drehen Sie das Gericht in 3D. In AR platzieren Sie es einmal: Es bleibt dort fixiert, ohne automatische Drehung oder Größenänderung.",
      quickLookCta: "In meinem Raum ansehen",
      shareText: "Dieses Gericht in 3D ansehen.",
      sizeDisclaimer:
        "Hinweis: Die 3D-Größe kann von der tatsächlichen Größe des Gerichts abweichen.",
      loadFailureTitle: "Die 3D-Ansicht konnte momentan nicht geladen werden.",
      loadFailureBodyWithAr:
        "Sie können 3D erneut versuchen oder das Gericht in Safari vor sich platzieren.",
      loadFailureBody:
        "Sie können es jetzt erneut versuchen oder zu den Details des Gerichts zurückkehren.",
      retry: "Erneut versuchen",
      close: "Schließen",
      returnToDish: "Zurück zu den Details des Gerichts",
      slowNetworkTitle: "Langsames Netzwerk erkannt: 3D-Ansicht laden?",
      slowNetworkBody:
        "Das Foto des Gerichts bleibt verfügbar, und die 3D-Ansicht kann jederzeit geöffnet werden.",
      slowNetworkCta: "3D-Ansicht laden",
      noModelQuiet: "3D-Ansicht derzeit nicht verfügbar.",
      noModelIos:
        "Die 3D-Ansicht wird hier bald verfügbar sein. Sie können das Gericht bereits in Safari vor sich platzieren.",
      noModelIosHandoff:
        "Die 3D-Ansicht wird hier bald verfügbar sein. Um das Gericht vor sich zu platzieren, öffnen Sie diese Gerichtseite in Safari.",
      noModelSoon: "Dieses Gericht wird bald in 3D verfügbar sein.",
      safariTitle: "Augmented Reality in Safari verfügbar",
      copyLink: "Link kopieren",
      linkCopied: "Link kopiert",
      share: "Teilen",
      iosUsdzMissing: "Um iPhone-AR zu aktivieren, fügen Sie diesem Gericht eine USDZ-Datei hinzu.",
      desktopArHint:
        "Augmented Reality startet von einem kompatiblen Telefon.",
      arAndroidBrowser:
        "Ihr Browser erlaubt hier keine Augmented Reality. Sie können das Gericht trotzdem in 3D drehen.",
      arIosHandoff:
        "Um das Gericht vor sich zu platzieren, öffnen Sie diese Gerichtseite in Safari auf dem iPhone."
    },
    modelUnavailable: "Die 3D-Ansicht ist vorübergehend nicht verfügbar.",
    arBrowserFallback: {
      ios: {
        title: "Diese Gerichtseite in Safari öffnen",
        body:
          "Dieser integrierte Browser kann Augmented Reality nicht starten. Kopieren Sie den Link dieser Gerichtseite, öffnen Sie Safari und fügen Sie ihn in die Adresszeile ein.",
        action: "Link für Safari kopieren",
        success: "Link kopiert. Öffnen Sie Safari und fügen Sie ihn in die Adresszeile ein."
      },
      android: {
        title: "Diese Gerichtseite in Chrome öffnen",
        body:
          "Dieser integrierte Browser kann Augmented Reality nicht starten. Kopieren Sie den Link dieser Gerichtseite, öffnen Sie Chrome und fügen Sie ihn in die Adresszeile ein.",
        action: "Link für Chrome kopieren",
        success: "Link kopiert. Öffnen Sie Chrome und fügen Sie ihn in die Adresszeile ein."
      },
      other: {
        title: "Augmented Reality in diesem Browser nicht verfügbar",
        body:
          "Kopieren Sie den Link dieser Gerichtseite und öffnen Sie ihn im Hauptbrowser Ihres Geräts.",
        action: "Link der Gerichtseite kopieren",
        success:
          "Link kopiert. Öffnen Sie Ihren Hauptbrowser und fügen Sie ihn in die Adresszeile ein."
      },
      copyError:
        "Das automatische Kopieren ist fehlgeschlagen. Wählen Sie den Link unten aus und kopieren Sie ihn manuell.",
      manualCopyLabel: "Link der Gerichtseite",
      selectLink: "Link auswählen"
    },
    moreDetails: "Details ansehen",
    viewDetails: "Details ansehen",
    detailCompositionLabel: "Im Gericht",
    detailAllergensLabel: "Allergene beachten",
    detailOptionsLabel: "Anpassen",
    detailHouseNoteLabel: "Küchennotiz",
    detailFallback: "Für dieses Gericht gibt es keine weiteren Details.",
    cardOptionsLabel: "Verfügbare Optionen",
    nextDish: "Nächstes Gericht",
    nonVeg: "Nicht vegetarisch",
    noResultsBody: "Versuchen Sie eine andere Suche oder entfernen Sie einen Filter.",
    noResultsTitle: "Kein Gericht passt.",
    options: "Optionen",
    popular: "Beliebt",
    previousDish: "Vorheriges Gericht",
    priceToConfirm: "Preis zu bestätigen",
    prepareRequest: "Anfrage vorbereiten",
    quantityDecrease: (name: string) => `Menge von ${name} verringern`,
    quantityIncrease: (name: string) => `Menge von ${name} erhöhen`,
    quantityLabel: (name: string) => `Menge von ${name}`,
    recommendation: "Empfohlen",
    reset: "Zurücksetzen",
    resetFilters: "Filter zurücksetzen",
    resultStatus: (view: string, count: number) =>
      `${view}-Ansicht, ${count} ${count === 1 ? "Gericht" : "Gerichte"} angezeigt`,
    review: "BEWERTEN",
    reviewClose: "Bewertung schließen",
    reviewComment: "Ihr Kommentar",
    reviewExperiencePlaceholder: "Wie war Ihr Besuch?",
    reviewExperienceStars: "Erlebnisbewertung",
    reviewExperienceTitle: "Bewerten Sie Ihre Erfahrung",
    reviewMissing: "Der Google-Review-Link ist für dieses Restaurant nicht konfiguriert.",
    reviewOpened: "Google Review wurde in einem neuen Tab geöffnet.",
    reviewPlaceholder: "Wie war der Geschmack?",
    reviewPost: "BEWERTUNG SENDEN",
    reviewStars: "Gerichtbewertung",
    reviewTitle: "Dieses Gericht bewerten",
    searchLabel: "Suche",
    searchPlaceholder: "Gericht, Zutat, Tag suchen...",
    selection: "Auswahl",
    selectionKicker: "Lokale Auswahl",
    selectionTitle: "Ihre Auswahl",
    server: "Service",
    sesameFree: "Als sesamfrei deklariert",
    shellfishFree: "Als schalentierfrei deklariert",
    signature: "Empfehlung",
    soyFree: "Als sojafrei deklariert",
    soldOut: "Ausverkauft",
    tags: "Tags",
    spicy: "Scharfes Gericht",
    swipeAria: "Wischen, um die Kategorie zu wechseln",
    swipeLabel: "Wischen",
    tableLabel: "Tisch",
    tablePlaceholder: "z. B. 12",
    tableToConfirm: "Tisch zu bestätigen",
    themeDarkAria: "Dunklen Modus aktivieren",
    themeLightAria: "Hellen Modus aktivieren",
    threeD: "IN 3D ANSEHEN",
    toConfirm: "Zu bestätigen",
    viewAr: "In meinem Raum ansehen",
    viewGrid: "Raster",
    viewList: "Liste",
    viewModeAria: "Ansichtsmodus",
    waiterKicker: "Tischservice",
    waiterReady: (table: string) => `${table} - Anfrage lokal bereit.`,
    waiterTitle: "Service fragen",
    waiterTopic: "Anfragethema",
    waiterTopics: {
      allergen: "Frage zu Allergenen",
      recommendation: "Empfehlung erfragen",
      selection: "Zu meiner Auswahl fragen"
    },
    veg: "Vegetarisch"
  },
  el: {
    activeCategoryAll: "Μενού",
    add: "Προσθήκη",
    addToSelection: "Προσθήκη στην επιλογή μου",
    all: "Όλα",
    activeFilterPrefix: "Ενεργό φίλτρο",
    activeFilters: (count: number) => `${count} φίλτρα`,
    allergens: "Αλλεργιογόνα",
    allergenTitlePrefix: "Αλλεργιογόνο",
    askWaiter: "Ρωτήστε τον σερβιτόρο",
    available: "Διαθέσιμο",
    backToMenu: "Επιστροφή στο μενού",
    backToTop: "Επιστροφή στην κορυφή",
    categories: "ΚΑΤΗΓΟΡΙΕΣ",
    categoryAria: "Κατηγορίες",
    clearSearch: "Καθαρισμός",
    close: "Κλείσιμο",
    closeFilters: "Κλείσιμο φίλτρων",
    closeDetail: "Κλείσιμο λεπτομερειών",
    closeLanguage: "Κλείσιμο επιλογής γλώσσας",
    closeSelection: "Κλείσιμο επιλογής",
    closeWaiter: "Κλείσιμο αιτήματος σερβιτόρου",
    currencyAria: "Επιλέξτε νόμισμα μενού",
    currencyCopy: "Οι τιμές μετατρέπονται τοπικά από την τιμή CAD του μενού.",
    currencyKicker: "Νόμισμα",
    currencyTitle: "Νόμισμα μενού",
    details: "Λεπτομέρειες",
    emptySelectionBody: "Προσθέστε ένα πιάτο για να ετοιμάσετε αίτημα προς τον σερβιτόρο.",
    emptySelectionTitle: "Η επιλογή σας είναι κενή.",
    estimatedTotal: "Εκτιμώμενο σύνολο",
    filterAllAria: "Εμφάνιση όλων των πιάτων",
    filterAvailableAria: "Φιλτράρισμα διαθέσιμων πιάτων",
    filterImmersiveAria: "Φιλτράρισμα πιάτων με 3D ή AR",
    filterNonVegAria: "Φιλτράρισμα μη χορτοφαγικών πιάτων",
    filterRecommendedAria: "Φιλτράρισμα προτεινόμενων πιάτων",
    filterVegAria: "Φιλτράρισμα χορτοφαγικών πιάτων",
    filterApply: "Εφαρμογή",
    filterButton: "Φίλτρα",
    filterFallback: "Φίλτρο",
    filterGroupLabel: "Φίλτρα",
    immersiveFilterLabel: "3D / AR",
    filterKicker: "Trouvable",
    filterTitle: "Φίλτρα",
    filtersAria: "Γρήγορα φίλτρα",
    dairyFree: "Δηλωμένο χωρίς γαλακτοκομικά",
    eggFree: "Δηλωμένο χωρίς αυγά",
    fishFree: "Δηλωμένο χωρίς ψάρι",
    glutenFree: "Δηλωμένο χωρίς γλουτένη",
    nutFree: "Δηλωμένο χωρίς ξηρούς καρπούς",
    gridAria: "Εμφάνιση σε πλέγμα",
    greeting: {
      afternoon: "Καλώς ήρθατε",
      evening: "Καλησπέρα",
      morning: "Καλημέρα",
      night: "Καλησπέρα"
    },
    googleReview: TROUVABLE_GOOGLE_REVIEW_COPY.el,
    heroAction: "Δείτε το μενού",
    heroBlurb: "Σπιτική κουζίνα, ζεστές πινελιές και εξυπηρέτηση στο τραπέζι.",
    houseNote: "Σημείωση κουζίνας",
    immersiveUnavailable: "Η προβολή 3D δεν είναι διαθέσιμη για αυτό το πιάτο.",
    ingredients: "Υλικά",
    ingredientsCount: (count: number) =>
      `${count} ${count === 1 ? "υλικό" : "υλικά"}`,
    languageActive: "Ενεργό",
    languageAria: "Επιλέξτε γλώσσα μενού",
    languageKicker: "Γλώσσα",
    languageSubtitle: "Περιηγηθείτε στο μενού στη γλώσσα που σας ταιριάζει.",
    languageTitle: "Γλώσσα μενού",
    listAria: "Εμφάνιση σε λίστα",
    localOrderHint:
      "Καμία παραγγελία δεν αποστέλλεται αυτόματα. Δείξτε αυτό το αίτημα στην ομάδα.",
    menuAria: "Μενού Trouvable",
    menuContextFallback: "Μενού τραπεζιού",
    modelPreparing: "Προετοιμασία της καθηλωτικής προβολής...",
    modelAlt: (name: string) => `Προβολή πιάτου: ${name}`,
    modelViewer: {
      loadingBody: "Μπορεί να χρειαστούν λίγα δευτερόλεπτα ανάλογα με το δίκτυο.",
      arHelp:
        "Περιστρέψτε το πιάτο σε 3D. Σε AR, τοποθετήστε το μία φορά: παραμένει σταθερό εκεί, χωρίς αυτόματη περιστροφή ή αλλαγή μεγέθους.",
      quickLookCta: "Προβολή μπροστά μου",
      shareText: "Δείτε αυτό το πιάτο σε 3D.",
      sizeDisclaimer:
        "Ενδεικτική απεικόνιση: το μέγεθος 3D μπορεί να διαφέρει από το πραγματικό μέγεθος του πιάτου.",
      loadFailureTitle: "Η προβολή 3D δεν μπόρεσε να φορτωθεί προς το παρόν.",
      loadFailureBodyWithAr:
        "Μπορείτε να δοκιμάσετε ξανά την 3D προβολή ή να τοποθετήσετε το πιάτο μπροστά σας από το Safari.",
      loadFailureBody:
        "Μπορείτε να δοκιμάσετε ξανά τώρα ή να επιστρέψετε στις λεπτομέρειες του πιάτου.",
      retry: "Δοκιμή ξανά",
      close: "Κλείσιμο",
      returnToDish: "Επιστροφή στις λεπτομέρειες του πιάτου",
      slowNetworkTitle: "Εντοπίστηκε αργό δίκτυο: να φορτωθεί η προβολή 3D;",
      slowNetworkBody:
        "Η φωτογραφία του πιάτου παραμένει διαθέσιμη και η προβολή 3D μπορεί να ανοίξει όποτε θέλετε.",
      slowNetworkCta: "Φόρτωση προβολής 3D",
      noModelQuiet: "Η προβολή 3D δεν είναι διαθέσιμη προς το παρόν.",
      noModelIos:
        "Η προβολή 3D θα είναι σύντομα διαθέσιμη εδώ. Μπορείτε ήδη να τοποθετήσετε το πιάτο μπροστά σας στο Safari.",
      noModelIosHandoff:
        "Η προβολή 3D θα είναι σύντομα διαθέσιμη εδώ. Για να τοποθετήσετε το πιάτο μπροστά σας, ανοίξτε αυτή την καρτέλα στο Safari.",
      noModelSoon: "Αυτό το πιάτο θα είναι σύντομα διαθέσιμο σε 3D.",
      safariTitle: "Η επαυξημένη πραγματικότητα είναι διαθέσιμη στο Safari",
      copyLink: "Αντιγραφή συνδέσμου",
      linkCopied: "Ο σύνδεσμος αντιγράφηκε",
      share: "Κοινοποίηση",
      iosUsdzMissing: "Για να ενεργοποιηθεί το AR στο iPhone, προσθέστε ένα αρχείο USDZ σε αυτό το πιάτο.",
      desktopArHint:
        "Η επαυξημένη πραγματικότητα ξεκινά από συμβατό τηλέφωνο.",
      arAndroidBrowser:
        "Το πρόγραμμα περιήγησής σας δεν επιτρέπει επαυξημένη πραγματικότητα εδώ. Μπορείτε όμως να περιστρέψετε το πιάτο σε 3D.",
      arIosHandoff:
        "Για να τοποθετήσετε το πιάτο μπροστά σας, ανοίξτε αυτή την καρτέλα στο Safari σε iPhone."
    },
    modelUnavailable: "Η προβολή 3D είναι προσωρινά μη διαθέσιμη.",
    arBrowserFallback: {
      ios: {
        title: "Ανοίξτε αυτή την καρτέλα στο Safari",
        body:
          "Αυτό το ενσωματωμένο πρόγραμμα περιήγησης δεν μπορεί να ξεκινήσει την επαυξημένη πραγματικότητα. Αντιγράψτε τον σύνδεσμο, ανοίξτε το Safari και επικολλήστε τον στη γραμμή διεύθυνσης.",
        action: "Αντιγραφή συνδέσμου για Safari",
        success: "Ο σύνδεσμος αντιγράφηκε. Ανοίξτε το Safari και επικολλήστε τον στη γραμμή διεύθυνσης."
      },
      android: {
        title: "Ανοίξτε αυτή την καρτέλα στο Chrome",
        body:
          "Αυτό το ενσωματωμένο πρόγραμμα περιήγησης δεν μπορεί να ξεκινήσει την επαυξημένη πραγματικότητα. Αντιγράψτε τον σύνδεσμο, ανοίξτε το Chrome και επικολλήστε τον στη γραμμή διεύθυνσης.",
        action: "Αντιγραφή συνδέσμου για Chrome",
        success: "Ο σύνδεσμος αντιγράφηκε. Ανοίξτε το Chrome και επικολλήστε τον στη γραμμή διεύθυνσης."
      },
      other: {
        title: "Η επαυξημένη πραγματικότητα δεν είναι διαθέσιμη σε αυτό το πρόγραμμα περιήγησης",
        body:
          "Αντιγράψτε τον σύνδεσμο και ανοίξτε τον στο κύριο πρόγραμμα περιήγησης της συσκευής σας.",
        action: "Αντιγραφή συνδέσμου πιάτου",
        success:
          "Ο σύνδεσμος αντιγράφηκε. Ανοίξτε το κύριο πρόγραμμα περιήγησης και επικολλήστε τον στη γραμμή διεύθυνσης."
      },
      copyError:
        "Η αυτόματη αντιγραφή απέτυχε. Επιλέξτε τον σύνδεσμο παρακάτω και αντιγράψτε τον χειροκίνητα.",
      manualCopyLabel: "Σύνδεσμος πιάτου",
      selectLink: "Επιλογή συνδέσμου"
    },
    moreDetails: "Δείτε λεπτομέρειες",
    viewDetails: "Δείτε λεπτομέρειες",
    detailCompositionLabel: "Στο πιάτο",
    detailAllergensLabel: "Αλλεργιογόνα προς προσοχή",
    detailOptionsLabel: "Προσαρμογή",
    detailHouseNoteLabel: "Σημείωση κουζίνας",
    detailFallback: "Δεν υπάρχουν επιπλέον λεπτομέρειες για αυτό το πιάτο.",
    cardOptionsLabel: "Διαθέσιμες επιλογές",
    nextDish: "Επόμενο πιάτο",
    nonVeg: "Μη χορτοφαγικό",
    noResultsBody: "Δοκιμάστε άλλη αναζήτηση ή αφαιρέστε ένα φίλτρο.",
    noResultsTitle: "Δεν βρέθηκε αντίστοιχο πιάτο.",
    options: "Επιλογές",
    popular: "Δημοφιλές",
    previousDish: "Προηγούμενο πιάτο",
    priceToConfirm: "Τιμή προς επιβεβαίωση",
    prepareRequest: "Προετοιμασία αιτήματος",
    quantityDecrease: (name: string) => `Μείωση ποσότητας για ${name}`,
    quantityIncrease: (name: string) => `Αύξηση ποσότητας για ${name}`,
    quantityLabel: (name: string) => `Ποσότητα για ${name}`,
    recommendation: "Προτεινόμενο",
    reset: "Επαναφορά",
    resetFilters: "Επαναφορά φίλτρων",
    resultStatus: (view: string, count: number) =>
      `Προβολή ${view}, εμφανίζονται ${count} ${count === 1 ? "πιάτο" : "πιάτα"}`,
    review: "ΑΞΙΟΛΟΓΗΣΗ",
    reviewClose: "Κλείσιμο αξιολόγησης",
    reviewComment: "Το σχόλιό σας",
    reviewExperiencePlaceholder: "Πώς ήταν η επίσκεψή σας;",
    reviewExperienceStars: "Βαθμολογία εμπειρίας",
    reviewExperienceTitle: "Αξιολογήστε την εμπειρία σας",
    reviewMissing: "Ο σύνδεσμος αξιολόγησης Google δεν έχει ρυθμιστεί για αυτό το εστιατόριο.",
    reviewOpened: "Η αξιολόγηση Google άνοιξε σε νέα καρτέλα.",
    reviewPlaceholder: "Πώς ήταν η γεύση;",
    reviewPost: "ΔΗΜΟΣΙΕΥΣΗ ΑΞΙΟΛΟΓΗΣΗΣ",
    reviewStars: "Βαθμολογία πιάτου",
    reviewTitle: "Αξιολογήστε αυτό το πιάτο",
    searchLabel: "Αναζήτηση",
    searchPlaceholder: "Αναζήτηση πιάτου, υλικού, ετικέτας...",
    selection: "Επιλογή",
    selectionKicker: "Τοπική επιλογή",
    selectionTitle: "Η επιλογή σας",
    server: "Σερβιτόρος",
    sesameFree: "Δηλωμένο χωρίς σουσάμι",
    shellfishFree: "Δηλωμένο χωρίς οστρακοειδή",
    signature: "Πρόταση",
    soyFree: "Δηλωμένο χωρίς σόγια",
    soldOut: "Εξαντλήθηκε",
    tags: "Ετικέτες",
    spicy: "Πικάντικο πιάτο",
    swipeAria: "Σύρετε για αλλαγή κατηγορίας",
    swipeLabel: "Σύρετε",
    tableLabel: "Τραπέζι",
    tablePlaceholder: "π.χ. 12",
    tableToConfirm: "Τραπέζι προς επιβεβαίωση",
    themeDarkAria: "Ενεργοποίηση σκοτεινής λειτουργίας",
    themeLightAria: "Ενεργοποίηση φωτεινής λειτουργίας",
    threeD: "ΠΡΟΒΟΛΗ ΣΕ 3D",
    toConfirm: "Προς επιβεβαίωση",
    viewAr: "Προβολή στον χώρο μου",
    viewGrid: "πλέγματος",
    viewList: "λίστας",
    viewModeAria: "Τρόπος εμφάνισης",
    waiterKicker: "Εξυπηρέτηση τραπεζιού",
    waiterReady: (table: string) => `${table} - το αίτημα είναι έτοιμο τοπικά.`,
    waiterTitle: "Ρωτήστε τον σερβιτόρο",
    waiterTopic: "Θέμα αιτήματος",
    waiterTopics: {
      allergen: "Ερώτηση για αλλεργιογόνα",
      recommendation: "Ζητήστε πρόταση",
      selection: "Ρωτήστε για την επιλογή μου"
    },
    veg: "Χορτοφαγικό"
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
    backToTop: "العودة إلى الأعلى",
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
    dairyFree: "معلن خلوه من الألبان",
    eggFree: "معلن خلوه من البيض",
    fishFree: "معلن خلوه من السمك",
    glutenFree: "معلن خلوه من الغلوتين",
    nutFree: "معلن خلوه من المكسرات",
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
    modelAlt: (name: string) => `عرض الطبق: ${name}`,
    modelViewer: {
      loadingBody: "قد يستغرق الأمر بضع ثوان حسب الشبكة.",
      arHelp:
        "حرّك الطبق في 3D. في AR، ضعه مرة واحدة: يبقى ثابتاً في ذلك المكان من دون تدوير تلقائي أو تغيير حجم.",
      quickLookCta: "اعرضه أمامي",
      shareText: "شاهد هذا الطبق بتقنية 3D.",
      sizeDisclaimer:
        "عرض إرشادي: قد يختلف حجم 3D عن الحجم الحقيقي للطبق.",
      loadFailureTitle: "تعذر تحميل عرض 3D حالياً.",
      loadFailureBodyWithAr:
        "يمكنك إعادة محاولة عرض 3D أو وضع الطبق أمامك من Safari.",
      loadFailureBody:
        "يمكنك المحاولة مرة أخرى الآن أو الرجوع إلى تفاصيل الطبق.",
      retry: "إعادة المحاولة",
      close: "إغلاق",
      returnToDish: "الرجوع إلى تفاصيل الطبق",
      slowNetworkTitle: "تم اكتشاف شبكة بطيئة: هل تريد تحميل عرض 3D؟",
      slowNetworkBody:
        "تبقى صورة الطبق متاحة، ويمكن فتح عرض 3D عندما تريد.",
      slowNetworkCta: "تحميل عرض 3D",
      noModelQuiet: "عرض 3D غير متاح حالياً.",
      noModelIos:
        "سيصبح عرض 3D متاحاً هنا قريباً. يمكنك حالياً وضع الطبق أمامك في Safari.",
      noModelIosHandoff:
        "سيصبح عرض 3D متاحاً هنا قريباً. لوضع الطبق أمامك، افتح هذه الصفحة في Safari.",
      noModelSoon: "سيصبح هذا الطبق متاحاً بتقنية 3D قريباً.",
      safariTitle: "الواقع المعزز متاح في Safari",
      copyLink: "نسخ الرابط",
      linkCopied: "تم نسخ الرابط",
      share: "مشاركة",
      iosUsdzMissing: "لتفعيل AR على iPhone، أضف ملف USDZ إلى هذا الطبق.",
      desktopArHint: "يتم تشغيل الواقع المعزز من هاتف متوافق.",
      arAndroidBrowser:
        "متصفحك لا يسمح بالواقع المعزز هنا. يمكنك مع ذلك تدوير الطبق في 3D.",
      arIosHandoff:
        "لوضع الطبق أمامك، افتح هذه الصفحة في Safari على iPhone."
    },
    modelUnavailable: "عرض 3D غير متاح مؤقتا.",
    arBrowserFallback: {
      ios: {
        title: "افتح صفحة هذا الطبق في Safari",
        body:
          "لا يمكن لهذا المتصفح المضمّن تشغيل الواقع المعزز. انسخ رابط هذه الصفحة، وافتح Safari، ثم الصقه في شريط العنوان.",
        action: "نسخ الرابط لـ Safari",
        success: "تم نسخ الرابط. افتح Safari ثم الصقه في شريط العنوان."
      },
      android: {
        title: "افتح صفحة هذا الطبق في Chrome",
        body:
          "لا يمكن لهذا المتصفح المضمّن تشغيل الواقع المعزز. انسخ رابط هذه الصفحة، وافتح Chrome، ثم الصقه في شريط العنوان.",
        action: "نسخ الرابط لـ Chrome",
        success: "تم نسخ الرابط. افتح Chrome ثم الصقه في شريط العنوان."
      },
      other: {
        title: "الواقع المعزز غير متاح في هذا المتصفح",
        body:
          "انسخ رابط هذه الصفحة، ثم افتحه في المتصفح الرئيسي لجهازك.",
        action: "نسخ رابط صفحة الطبق",
        success:
          "تم نسخ الرابط. افتح المتصفح الرئيسي ثم الصقه في شريط العنوان."
      },
      copyError:
        "تعذر النسخ التلقائي. حدد الرابط أدناه وانسخه يدويا.",
      manualCopyLabel: "رابط صفحة الطبق",
      selectLink: "تحديد الرابط"
    },
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
    sesameFree: "معلن خلوه من السمسم",
    shellfishFree: "معلن خلوه من القشريات والمحار",
    signature: "مميز",
    soyFree: "معلن خلوه من الصويا",
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
  : T extends string
    ? string
    : T extends Record<string, unknown>
      ? { [Key in keyof T]: WidenTrouvableCopyValue<T[Key]> }
      : T;

export type TrouvableCopy = {
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
  kind: "string" | "function-template";
};

export type TrouvableUiCopyTranslationEntry = {
  path: string;
  text: string;
  kind: CopyLeafSpec["kind"];
  placeholders: string[];
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
  modelAlt: (template) => (name: string) =>
    renderCopyTemplate(template, { name }),
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

const COPY_FUNCTION_TEMPLATE_PLACEHOLDERS: {
  [Key in keyof TrouvableCopy]?: string[];
} = {
  activeFilters: ["count"],
  ingredientsCount: ["count"],
  modelAlt: ["name"],
  quantityDecrease: ["name"],
  quantityIncrease: ["name"],
  quantityLabel: ["name"],
  resultStatus: ["view", "count"],
  waiterReady: ["table"]
};

function copyLeafSpecs(base: TrouvableCopy): CopyLeafSpec[] {
  const specs: CopyLeafSpec[] = [];

  function visit(value: unknown, path: string, key: keyof TrouvableCopy) {
    if (typeof value === "string") {
      specs.push({ key, kind: "string", path });
      return;
    }
    if (typeof value === "function" && path === key && COPY_FUNCTION_TEMPLATE_BUILDERS[key]) {
      specs.push({ key, kind: "function-template", path });
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;

    for (const [childKey, childValue] of Object.entries(value)) {
      visit(childValue, `${path}.${childKey}`, key);
    }
  }

  for (const [rawKey, value] of Object.entries(base)) {
    visit(value, rawKey, rawKey as keyof TrouvableCopy);
  }

  return specs;
}

const TROUVABLE_COPY_LEAF_SPECS = copyLeafSpecs(TROUVABLE_COPY.en);
const TROUVABLE_COPY_OPTIONAL_READINESS_PATHS = new Set([
  "modelViewer.sizeDisclaimer"
]);
const TROUVABLE_COPY_REQUIRED_LEAF_SPECS = TROUVABLE_COPY_LEAF_SPECS.filter(
  (spec) => !TROUVABLE_COPY_OPTIONAL_READINESS_PATHS.has(spec.path)
);

function sourceTemplateForCopyFunction(
  key: keyof TrouvableCopy,
  value: TrouvableCopy[keyof TrouvableCopy]
): string {
  if (typeof value !== "function") return "";
  switch (key) {
    case "activeFilters":
    case "ingredientsCount":
      return (value as (count: string) => string)("{count}");
    case "modelAlt":
    case "quantityDecrease":
    case "quantityIncrease":
    case "quantityLabel":
      return (value as (name: string) => string)("{name}");
    case "resultStatus":
      return (value as (view: string, count: string) => string)("{view}", "{count}");
    case "waiterReady":
      return (value as (table: string) => string)("{table}");
    default:
      return "";
  }
}

function getCopyPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function setCopyPackPath(
  target: Record<string, unknown>,
  path: string,
  value: string
) {
  const [head, ...tail] = path.split(".");
  if (tail.length === 0) {
    target[head] = value;
    return;
  }

  const parent = { ...objectInput(target[head]) };
  setCopyPackPath(parent, tail.join("."), value);
  target[head] = {
    ...parent
  };
}

function ensureTemplatePlaceholders(text: string, placeholders: string[]): string {
  let output = text.trim();
  for (const placeholder of placeholders) {
    const token = `{${placeholder}}`;
    if (!output.includes(token)) output = `${output} ${token}`.trim();
  }
  return output;
}

export function getTrouvableUiCopyTranslationEntries(
  sourceLocale: TrouvableLocale = "fr-CA"
): TrouvableUiCopyTranslationEntry[] {
  const sourceCopyLocale =
    builtInCopyLocaleForPublicLocale(normalizePublicMenuLocale(sourceLocale)) ??
    TROUVABLE_FALLBACK_COPY_LOCALE;
  const sourceCopy = TROUVABLE_COPY[sourceCopyLocale];

  return TROUVABLE_COPY_LEAF_SPECS.map((spec) => {
    const value = getCopyPath(sourceCopy, spec.path);
    const placeholders =
      spec.kind === "function-template"
        ? COPY_FUNCTION_TEMPLATE_PLACEHOLDERS[spec.key] ?? []
        : [];
    return {
      path: spec.path,
      text:
        spec.kind === "function-template"
          ? sourceTemplateForCopyFunction(spec.key, value as TrouvableCopy[keyof TrouvableCopy])
          : typeof value === "string"
            ? value
            : "",
      kind: spec.kind,
      placeholders
    };
  }).filter((entry) => entry.text.trim().length > 0);
}

export function buildTrouvableLocalizedUiCopyPack(
  entries: TrouvableUiCopyTranslationEntry[],
  translations: string[]
): Record<string, unknown> {
  const pack: Record<string, unknown> = {};
  entries.forEach((entry, index) => {
    const rawText = translations[index] ?? entry.text;
    const text =
      entry.kind === "function-template"
        ? ensureTemplatePlaceholders(rawText, entry.placeholders)
        : rawText.trim();
    if (!text) return;
    setCopyPackPath(pack, entry.path, text);
  });
  return pack;
}

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

const TROUVABLE_GREETING_BRIDGES: Record<
  TrouvableCopyLocale,
  Record<TrouvableGreetingPeriod, string>
> = {
  fr: {
    morning: "et bienvenue chez",
    afternoon: "chez",
    evening: "et bienvenue chez",
    night: "et bienvenue chez"
  },
  en: {
    morning: "and welcome to",
    afternoon: "to",
    evening: "and welcome to",
    night: "and welcome to"
  },
  es: {
    morning: "y bienvenido a",
    afternoon: "a",
    evening: "y bienvenido a",
    night: "y bienvenido a"
  },
  it: {
    morning: "e benvenuto da",
    afternoon: "da",
    evening: "e benvenuto da",
    night: "e benvenuto da"
  },
  de: {
    morning: "und willkommen bei",
    afternoon: "bei",
    evening: "und willkommen bei",
    night: "und willkommen bei"
  },
  el: {
    morning: "και καλώς ήρθατε στο",
    afternoon: "στο",
    evening: "και καλώς ήρθατε στο",
    night: "και καλώς ήρθατε στο"
  },
  ar: {
    morning: "وأهلاً بكم في",
    afternoon: "في",
    evening: "وأهلاً بكم في",
    night: "وأهلاً بكم في"
  }
};

export function getTrouvableGreetingPeriodForDate(
  date: Date = new Date(),
  timezone?: string
): TrouvableGreetingPeriod {
  return getGreetingPeriodForTime(date, timezone);
}

export function formatTrouvableGreetingLead(
  greeting: string,
  locale: TrouvableLocale,
  period: TrouvableGreetingPeriod
): string {
  const bridge = TROUVABLE_GREETING_BRIDGES[getTrouvableCopyLocale(locale)][period];
  return `${greeting} ${bridge}`;
}

export function getTrouvableTextDirection(_locale: TrouvableLocale): "ltr" | "rtl" {
  void _locale;
  // Vistaire keeps the public menu chrome in the same visual order for every locale.
  // The locale still drives translated copy and lang attributes, but it must not
  // mirror controls, rails, sheets, or immersive UI for RTL languages.
  return "ltr";
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

  function visit(
    rawValue: unknown,
    baseValue: unknown,
    path: string,
    isRoot: boolean
  ) {
    if (!baseValue || typeof baseValue !== "object" || Array.isArray(baseValue)) {
      return;
    }

    const rawObject = objectInput(rawValue);
    for (const [rawKey, nestedValue] of Object.entries(rawObject)) {
      const nestedPath = path ? `${path}.${rawKey}` : rawKey;
      const expectedValue = (baseValue as Record<string, unknown>)[rawKey];

      if (expectedValue === undefined) {
        if (!(isRoot && localizedUiCopyBucketKey(rawKey))) {
          ignoredKeys.add(nestedPath);
        }
        continue;
      }

      if (typeof expectedValue === "string") {
        if (typeof nestedValue === "string" && nestedValue.trim()) {
          coveredPaths.add(nestedPath);
        } else {
          ignoredKeys.add(nestedPath);
        }
        continue;
      }

      if (typeof expectedValue === "function") {
        const key = rawKey as keyof TrouvableCopy;
        if (
          isRoot &&
          COPY_FUNCTION_TEMPLATE_BUILDERS[key] &&
          typeof nestedValue === "string" &&
          nestedValue.trim()
        ) {
          coveredPaths.add(nestedPath);
        } else {
          ignoredKeys.add(nestedPath);
        }
        continue;
      }

      if (expectedValue && typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
        if (!nestedValue || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
          ignoredKeys.add(nestedPath);
          continue;
        }
        visit(nestedValue, expectedValue, nestedPath, false);
        continue;
      }

      ignoredKeys.add(nestedPath);
    }
  }

  visit(input, TROUVABLE_COPY.en, "", true);

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
  function mergeNestedObject(
    rawValue: unknown,
    baseValue: unknown
  ): Record<string, unknown> {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      return {};
    }

    const input = objectInput(rawValue);
    if (!baseValue || typeof baseValue !== "object" || Array.isArray(baseValue)) {
      return {};
    }

    const merged: Record<string, unknown> = {
      ...(baseValue as Record<string, unknown>)
    };
    for (const [rawKey, nextValue] of Object.entries(input)) {
      const expectedValue = (baseValue as Record<string, unknown>)[rawKey];
      if (expectedValue === undefined) continue;
      if (typeof expectedValue === "string") {
        if (typeof nextValue === "string" && nextValue.trim()) {
          merged[rawKey] = nextValue;
        }
        continue;
      }
      if (expectedValue && typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
        const nested = mergeNestedObject(nextValue, expectedValue);
        if (Object.keys(nested).length > 0) merged[rawKey] = nested;
      }
    }
    return merged;
  }

  const input = objectInput(value);
  const baseObject = base as Record<string, unknown>;
  const overrides: Record<string, unknown> = {};
  for (const [rawKey, nextValue] of Object.entries(input)) {
    const expectedValue = baseObject[rawKey];
    if (expectedValue && typeof expectedValue === "object" && !Array.isArray(expectedValue)) {
      const nested = mergeNestedObject(nextValue, expectedValue);
      if (Object.keys(nested).length > 0) overrides[rawKey] = nested;
    }
  }

  return overrides as Partial<TrouvableCopy>;
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
    : TROUVABLE_COPY_REQUIRED_LEAF_SPECS
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
  "el-GR": { nativeName: "Ελληνικά", region: "Ελλάδα", code: "EL-GR" },
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

type TrouvableLanguageOption = {
  locale: TrouvableLocale;
  publicLocale: string;
  label: string;
  nativeName: string;
  region: string;
  code: string;
  shortCode: string;
  isReady: boolean;
  missingCopyKeys: string[];
  ignoredCopyKeys: string[];
  copyDynamicSource: ReturnType<typeof resolveTrouvableCopy>["resolution"]["dynamicSource"];
  copyNeutralFallback: boolean;
};

function normalizeTrouvableLocaleForPublicSettings(
  value: unknown,
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">
): TrouvableLocale {
  const fallback = settings.defaultLocale ?? settings.supportedLocales[0] ?? "fr-CA";
  const locale = normalizePublicMenuLocale(value, fallback);
  if (settings.supportedLocales.includes(locale)) return locale;
  const shortLocale = locale.toLowerCase().startsWith("fr") ? "fr" : "en";
  return (
    settings.supportedLocales.find((supportedLocale) =>
      supportedLocale.toLowerCase().startsWith(shortLocale)
    ) ??
    settings.supportedLocales[0] ??
    fallback
  );
}

export function isTrouvableLocalePublicReady(
  locale: TrouvableLocale,
  localizedUiCopy?: Record<string, unknown>
): boolean {
  const { resolution } = resolveTrouvableCopy(locale, localizedUiCopy);
  return resolution.uiCopyComplete && !resolution.usedNeutralFallback;
}

export function getTrouvableLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  displayLocale?: TrouvableLocale,
  localizedUiCopy?: Record<string, unknown>
): TrouvableLanguageOption[] {
  const options: TrouvableLanguageOption[] = [];
  for (const publicLocale of settings.supportedLocales) {
    const presentation = getTrouvableLanguagePresentation(publicLocale);
    const { resolution } = resolveTrouvableCopy(publicLocale, localizedUiCopy);
    options.push({
      locale: publicLocale,
      publicLocale,
      nativeName: presentation.nativeName,
      region: presentation.region,
      code: presentation.code,
      shortCode: getTrouvableLanguageShortCode(publicLocale),
      label: formatPublicLocaleLabel(publicLocale, displayLocale),
      isReady: resolution.uiCopyComplete && !resolution.usedNeutralFallback,
      missingCopyKeys: resolution.missingKeys,
      ignoredCopyKeys: resolution.ignoredKeys,
      copyDynamicSource: resolution.dynamicSource,
      copyNeutralFallback: resolution.usedNeutralFallback
    });
  }
  return options;
}

export function getTrouvableReadyLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  displayLocale?: TrouvableLocale,
  localizedUiCopy?: Record<string, unknown>
): TrouvableLanguageOption[] {
  return getTrouvableLanguageOptions(
    settings,
    displayLocale,
    localizedUiCopy
  ).filter((option) => option.isReady);
}

export function normalizeTrouvableReadyLocaleForSettings(
  value: unknown,
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  localizedUiCopy?: Record<string, unknown>
): TrouvableLocale {
  const candidate = normalizeTrouvableLocaleForPublicSettings(value, settings);
  if (isTrouvableLocalePublicReady(candidate, localizedUiCopy)) return candidate;

  const defaultLocale = normalizeTrouvableLocaleForPublicSettings(
    undefined,
    settings
  );
  if (isTrouvableLocalePublicReady(defaultLocale, localizedUiCopy)) {
    return defaultLocale;
  }

  return (
    getTrouvableReadyLanguageOptions(settings, defaultLocale, localizedUiCopy)[0]
      ?.locale ?? defaultLocale
  );
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
  if (
    resolved.resolution.uiCopyComplete &&
    !resolved.resolution.usedNeutralFallback
  ) {
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
