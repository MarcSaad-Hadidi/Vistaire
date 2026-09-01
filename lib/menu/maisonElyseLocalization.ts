import {
  getTrouvableCopy,
  getTrouvableLanguagePresentation,
  getTrouvableLanguageShortCode,
  resolveTrouvableCopy
} from "@/components/menu/trouvableMenuControls";
import {
  normalizePublicMenuLocale,
  type PublicMenuSettings,
  type PublicMenuLocale
} from "@/lib/menu/publicMenuSettings";
import type {
  PublicMenu,
  PublicMenuDish,
  PublicMenuTranslationStatus
} from "@/lib/menu/publicMenuCore";

/** The public-menu locale registry is intentionally independent from marketing locales. */
export type MaisonElyseLocale = PublicMenuLocale;

export type MaisonElyseCategoryKind =
  | "starter"
  | "signature"
  | "dessert"
  | "cocktail"
  | "drink";

type MaisonElyseCopyLocale = "fr" | "en" | "es" | "it" | "de" | "el" | "ar";

type MaisonElyseCategoryIdentity =
  | string
  | {
      label: string;
      slug?: string | null;
    };

type MaisonElyseCategoryEditorial = {
  kicker: string;
  title: string;
  description: string;
};

export type MaisonElyseEditorialCopy = {
  allMenu: string;
  bottomMenu: string;
  collectionBody: string;
  collectionKicker: string;
  collectionTitle: string;
  detailBackToMenu: string;
  filterDialogLabel: string;
  menuDialogLabel: string;
  menuToggleAria: string;
  navAria: string;
  genericDescription: string;
  categories: Record<MaisonElyseCategoryKind, MaisonElyseCategoryEditorial>;
};

const MAISON_ELYSE_COPY_LOCALES = new Set<string>([
  "fr",
  "en",
  "es",
  "it",
  "de",
  "el",
  "ar"
]);

const MAISON_ELYSE_CATEGORY_ALIASES: Record<
  MaisonElyseCategoryKind,
  ReadonlySet<string>
> = {
  starter: new Set([
    "entree",
    "entrees",
    "inputs",
    "starter",
    "starters"
  ]),
  signature: new Set([
    "plat",
    "plats",
    "plat-signature",
    "plats-signatures",
    "plat signature",
    "plats signatures",
    "signatures",
    "signature dish",
    "signature dishes",
    "main",
    "mains",
    "main course",
    "main courses"
  ]),
  dessert: new Set(["dessert", "desserts"]),
  cocktail: new Set([
    "cocktail",
    "cocktails",
    "cocktails-signatures",
    "cocktails signatures"
  ]),
  drink: new Set(["boisson", "boissons", "drink", "drinks"])
};

const MAISON_ELYSE_CATEGORY_LABELS: Record<
  MaisonElyseCopyLocale,
  Record<MaisonElyseCategoryKind, string>
> = {
  fr: {
    starter: "Entrées",
    signature: "Plats signatures",
    dessert: "Desserts",
    cocktail: "Cocktails",
    drink: "Boissons"
  },
  en: {
    starter: "Starters",
    signature: "Signature dishes",
    dessert: "Desserts",
    cocktail: "Cocktails",
    drink: "Drinks"
  },
  es: {
    starter: "Entradas",
    signature: "Platos de autor",
    dessert: "Postres",
    cocktail: "Cócteles",
    drink: "Bebidas"
  },
  it: {
    starter: "Antipasti",
    signature: "Piatti d'autore",
    dessert: "Dolci",
    cocktail: "Cocktail",
    drink: "Bevande"
  },
  de: {
    starter: "Vorspeisen",
    signature: "Signature-Gerichte",
    dessert: "Desserts",
    cocktail: "Cocktails",
    drink: "Getränke"
  },
  el: {
    starter: "Ορεκτικά",
    signature: "Πιάτα υπογραφής",
    dessert: "Επιδόρπια",
    cocktail: "Κοκτέιλ",
    drink: "Ποτά"
  },
  ar: {
    starter: "المقبلات",
    signature: "الأطباق المميزة",
    dessert: "الحلويات",
    cocktail: "الكوكتيلات",
    drink: "المشروبات"
  }
};

const MAISON_ELYSE_EDITORIAL_COPY: Record<
  MaisonElyseCopyLocale,
  MaisonElyseEditorialCopy
> = {
  fr: {
    allMenu: "Toute la carte",
    bottomMenu: "La carte",
    collectionKicker: "LA COLLECTION",
    collectionTitle: "LA CARTE",
    collectionBody:
      "Une sélection de créations servies par section, pensées pour être explorées directement à table.",
    detailBackToMenu: "Retour à la carte",
    filterDialogLabel: "Filtrer la carte",
    menuDialogLabel: "La carte",
    menuToggleAria: "Ouvrir la navigation de la carte",
    navAria: "Navigation carte et filtres",
    genericDescription: "La sélection du moment.",
    categories: {
      starter: {
        kicker: "POUR COMMENCER",
        title: "Entrées",
        description: "Les premières assiettes de la maison, précises et généreuses."
      },
      signature: {
        kicker: "LA SIGNATURE",
        title: "Plats signatures",
        description: "Les créations emblématiques de Maison Élyse."
      },
      dessert: {
        kicker: "LA DOUCEUR",
        title: "Desserts",
        description: "Une dernière note pâtissière, fraîche et élégante."
      },
      cocktail: {
        kicker: "LE BAR",
        title: "Cocktails",
        description: "Cocktails et boissons pensés pour accompagner la carte."
      },
      drink: {
        kicker: "LE BAR",
        title: "Boissons",
        description: "Cocktails et boissons pensés pour accompagner la carte."
      }
    }
  },
  en: {
    allMenu: "Full menu",
    bottomMenu: "Menu",
    collectionKicker: "THE COLLECTION",
    collectionTitle: "THE MENU",
    collectionBody:
      "A section-by-section selection of house creations designed to be explored at the table.",
    detailBackToMenu: "Back to menu",
    filterDialogLabel: "Filter the menu",
    menuDialogLabel: "Menu",
    menuToggleAria: "Open menu navigation",
    navAria: "Menu and filter navigation",
    genericDescription: "The selection of the moment.",
    categories: {
      starter: {
        kicker: "TO START",
        title: "Starters",
        description: "The first house plates: precise, generous and seasonal."
      },
      signature: {
        kicker: "SIGNATURE",
        title: "Signature dishes",
        description: "The emblematic Maison Élyse creations."
      },
      dessert: {
        kicker: "SWEET FINISH",
        title: "Desserts",
        description: "A final pastry note: fresh, delicate and elegant."
      },
      cocktail: {
        kicker: "THE BAR",
        title: "Cocktails",
        description: "Cocktails and drinks designed to pair with the menu."
      },
      drink: {
        kicker: "THE BAR",
        title: "Drinks",
        description: "Cocktails and drinks designed to pair with the menu."
      }
    }
  },
  es: {
    allMenu: "Toda la carta",
    bottomMenu: "La carta",
    collectionKicker: "LA COLECCIÓN",
    collectionTitle: "LA CARTA",
    collectionBody:
      "Una selección de creaciones servidas por sección, pensadas para explorarse directamente en la mesa.",
    detailBackToMenu: "Volver a la carta",
    filterDialogLabel: "Filtrar la carta",
    menuDialogLabel: "La carta",
    menuToggleAria: "Abrir la navegación de la carta",
    navAria: "Navegación de carta y filtros",
    genericDescription: "La selección del momento.",
    categories: {
      starter: {
        kicker: "PARA EMPEZAR",
        title: "Entradas",
        description: "Los primeros platos de la casa, precisos, generosos y de temporada."
      },
      signature: {
        kicker: "LA FIRMA",
        title: "Platos de autor",
        description: "Las creaciones emblemáticas de Maison Élyse."
      },
      dessert: {
        kicker: "EL DULCE",
        title: "Postres",
        description: "Una última nota de pastelería, fresca, delicada y elegante."
      },
      cocktail: {
        kicker: "EL BAR",
        title: "Cócteles",
        description: "Cócteles y bebidas pensados para acompañar la carta."
      },
      drink: {
        kicker: "EL BAR",
        title: "Bebidas",
        description: "Cócteles y bebidas pensados para acompañar la carta."
      }
    }
  },
  it: {
    allMenu: "Tutta la carta",
    bottomMenu: "La carta",
    collectionKicker: "LA COLLEZIONE",
    collectionTitle: "LA CARTA",
    collectionBody:
      "Una selezione di creazioni servite per sezione, pensate per essere esplorate direttamente a tavola.",
    detailBackToMenu: "Torna alla carta",
    filterDialogLabel: "Filtra la carta",
    menuDialogLabel: "La carta",
    menuToggleAria: "Apri la navigazione della carta",
    navAria: "Navigazione carta e filtri",
    genericDescription: "La selezione del momento.",
    categories: {
      starter: {
        kicker: "PER INIZIARE",
        title: "Antipasti",
        description: "I primi piatti della casa, precisi, generosi e stagionali."
      },
      signature: {
        kicker: "LA FIRMA",
        title: "Piatti d'autore",
        description: "Le creazioni emblematiche di Maison Élyse."
      },
      dessert: {
        kicker: "LA DOLCEZZA",
        title: "Dolci",
        description: "Un'ultima nota di pasticceria, fresca, delicata ed elegante."
      },
      cocktail: {
        kicker: "IL BAR",
        title: "Cocktail",
        description: "Cocktail e bevande pensati per accompagnare la carta."
      },
      drink: {
        kicker: "IL BAR",
        title: "Bevande",
        description: "Cocktail e bevande pensati per accompagnare la carta."
      }
    }
  },
  de: {
    allMenu: "Gesamte Karte",
    bottomMenu: "Die Karte",
    collectionKicker: "DIE KOLLEKTION",
    collectionTitle: "DIE KARTE",
    collectionBody:
      "Eine Auswahl an Kreationen, nach Bereichen serviert und dafür gedacht, direkt am Tisch entdeckt zu werden.",
    detailBackToMenu: "Zurück zur Speisekarte",
    filterDialogLabel: "Speisekarte filtern",
    menuDialogLabel: "Die Karte",
    menuToggleAria: "Navigation der Speisekarte öffnen",
    navAria: "Navigation und Filter der Speisekarte",
    genericDescription: "Die Auswahl des Augenblicks.",
    categories: {
      starter: {
        kicker: "ZUM START",
        title: "Vorspeisen",
        description: "Die ersten Teller des Hauses: präzise, großzügig und saisonal."
      },
      signature: {
        kicker: "SIGNATURE",
        title: "Signature-Gerichte",
        description: "Die emblematischen Kreationen von Maison Élyse."
      },
      dessert: {
        kicker: "SÜSSER ABSCHLUSS",
        title: "Desserts",
        description: "Eine letzte Patisserie-Note: frisch, fein und elegant."
      },
      cocktail: {
        kicker: "DIE BAR",
        title: "Cocktails",
        description: "Cocktails und Getränke, die auf die Speisekarte abgestimmt sind."
      },
      drink: {
        kicker: "DIE BAR",
        title: "Getränke",
        description: "Cocktails und Getränke, die auf die Speisekarte abgestimmt sind."
      }
    }
  },
  el: {
    allMenu: "Ολόκληρο το μενού",
    bottomMenu: "Το μενού",
    collectionKicker: "Η ΣΥΛΛΟΓΗ",
    collectionTitle: "ΤΟ ΜΕΝΟΥ",
    collectionBody:
      "Μια επιλογή δημιουργιών ανά ενότητα, σχεδιασμένη για να την ανακαλύψετε απευθείας στο τραπέζι.",
    detailBackToMenu: "Επιστροφή στο μενού",
    filterDialogLabel: "Φιλτράρισμα μενού",
    menuDialogLabel: "Το μενού",
    menuToggleAria: "Άνοιγμα πλοήγησης μενού",
    navAria: "Πλοήγηση μενού και φίλτρα",
    genericDescription: "Η επιλογή της στιγμής.",
    categories: {
      starter: {
        kicker: "ΓΙΑ ΑΡΧΗ",
        title: "Ορεκτικά",
        description: "Τα πρώτα πιάτα του οίκου, ακριβή, γενναιόδωρα και εποχικά."
      },
      signature: {
        kicker: "ΥΠΟΓΡΑΦΗ",
        title: "Πιάτα υπογραφής",
        description: "Οι εμβληματικές δημιουργίες του Maison Élyse."
      },
      dessert: {
        kicker: "ΓΛΥΚΟ ΤΕΛΟΣ",
        title: "Επιδόρπια",
        description: "Μια τελευταία νότα ζαχαροπλαστικής, φρέσκια, λεπτή και κομψή."
      },
      cocktail: {
        kicker: "ΤΟ ΜΠΑΡ",
        title: "Κοκτέιλ",
        description: "Κοκτέιλ και ποτά σχεδιασμένα για να συνοδεύουν το μενού."
      },
      drink: {
        kicker: "ΤΟ ΜΠΑΡ",
        title: "Ποτά",
        description: "Κοκτέιλ και ποτά σχεδιασμένα για να συνοδεύουν το μενού."
      }
    }
  },
  ar: {
    allMenu: "القائمة كاملة",
    bottomMenu: "القائمة",
    collectionKicker: "المجموعة",
    collectionTitle: "القائمة",
    collectionBody:
      "مجموعة من إبداعات الدار مرتبة حسب الأقسام، صُممت لاكتشافها مباشرة على الطاولة.",
    detailBackToMenu: "العودة إلى القائمة",
    filterDialogLabel: "تصفية القائمة",
    menuDialogLabel: "القائمة",
    menuToggleAria: "فتح تنقل القائمة",
    navAria: "تنقل القائمة والفلاتر",
    genericDescription: "اختيار اللحظة.",
    categories: {
      starter: {
        kicker: "للبداية",
        title: "المقبلات",
        description: "أولى أطباق الدار، دقيقة وسخية وموسمية."
      },
      signature: {
        kicker: "التوقيع",
        title: "الأطباق المميزة",
        description: "إبداعات Maison Élyse المميزة."
      },
      dessert: {
        kicker: "اللمسة الحلوة",
        title: "الحلويات",
        description: "لمسة أخيرة من الحلويات، طازجة ورقيقة وأنيقة."
      },
      cocktail: {
        kicker: "البار",
        title: "الكوكتيلات",
        description: "كوكتيلات ومشروبات صُممت لترافق القائمة."
      },
      drink: {
        kicker: "البار",
        title: "المشروبات",
        description: "كوكتيلات ومشروبات صُممت لترافق القائمة."
      }
    }
  }
};

function normalizeMaisonElyseCategory(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function maisonElyseCopyLocale(locale: string): MaisonElyseCopyLocale {
  const normalized = normalizeMaisonElyseLocale(locale);
  let language = "";
  try {
    language = new Intl.Locale(normalized).language.toLowerCase();
  } catch {
    language = normalized.toLowerCase().split("-")[0] ?? "";
  }
  return MAISON_ELYSE_COPY_LOCALES.has(language)
    ? (language as MaisonElyseCopyLocale)
    : "en";
}

export function hasMaisonElyseEditorialCopy(locale: string): boolean {
  const normalized = normalizeMaisonElyseLocale(locale);
  try {
    return MAISON_ELYSE_COPY_LOCALES.has(
      new Intl.Locale(normalized).language.toLowerCase()
    );
  } catch {
    return MAISON_ELYSE_COPY_LOCALES.has(
      normalized.toLowerCase().split("-")[0] ?? ""
    );
  }
}

export function getMaisonElyseEditorialCopy(
  locale: string
): MaisonElyseEditorialCopy {
  return MAISON_ELYSE_EDITORIAL_COPY[maisonElyseCopyLocale(locale)];
}

function categoryIdentityCandidates(identity: MaisonElyseCategoryIdentity): string[] {
  if (typeof identity === "string") return [identity];
  return [identity.slug ?? "", identity.label].filter(Boolean);
}

export function resolveMaisonElyseCategoryDescription(
  dishes: ReadonlyArray<Pick<PublicMenuDish, "categoryDescription">>,
  localizedFallback: string
): string {
  for (let index = dishes.length - 1; index >= 0; index -= 1) {
    const description = dishes[index]?.categoryDescription?.trim();
    if (description) return description;
  }
  return localizedFallback;
}

export function getMaisonElyseCategoryKind(
  identity: MaisonElyseCategoryIdentity
): MaisonElyseCategoryKind | null {
  for (const candidate of categoryIdentityCandidates(identity)) {
    const normalized = normalizeMaisonElyseCategory(candidate);
    const kind = Object.entries(MAISON_ELYSE_CATEGORY_ALIASES).find(
      ([, aliases]) => aliases.has(normalized)
    )?.[0] as MaisonElyseCategoryKind | undefined;
    if (kind) return kind;
  }
  return null;
}

export function getMaisonElyseCategoryLabel(
  identity: MaisonElyseCategoryIdentity,
  locale: PublicMenuLocale
): string {
  const kind = getMaisonElyseCategoryKind(identity);
  const rawLabel = typeof identity === "string" ? identity : identity.label;
  if (!kind) return rawLabel;
  return MAISON_ELYSE_CATEGORY_LABELS[maisonElyseCopyLocale(locale)][kind];
}

export function getMaisonElyseCategoryEditorial(
  identity: MaisonElyseCategoryIdentity,
  locale: PublicMenuLocale
): MaisonElyseCategoryEditorial {
  const copy = getMaisonElyseEditorialCopy(locale);
  const kind = getMaisonElyseCategoryKind(identity);
  if (!kind) {
    return {
      kicker: "Maison Élyse",
      title: typeof identity === "string" ? identity : identity.label,
      description: copy.genericDescription
    };
  }
  return copy.categories[kind];
}

export function normalizeMaisonElyseLocale(value: unknown, fallback = "fr-CA") {
  return normalizePublicMenuLocale(value, fallback);
}

export function getMaisonElyseLanguagePresentation(locale: string) {
  return {
    ...getTrouvableLanguagePresentation(locale),
    shortCode: getTrouvableLanguageShortCode(locale)
  };
}

export type MaisonElyseLanguageOption = {
  id: PublicMenuLocale;
  label: string;
  shortLabel: string;
};

type MaisonElyseLocalizedMenuInput = {
  fallbackLocale: PublicMenuLocale;
  fallbackMenu: PublicMenu;
  localizedMenus?: Partial<Record<PublicMenuLocale, PublicMenu>>;
  requestedLocale: unknown;
};

export type MaisonElyseLocalizedMenuResolution = {
  locale: PublicMenuLocale;
  menu: PublicMenu;
};

function canonicalMenuLocale(
  menu: PublicMenu,
  fallbackLocale?: PublicMenuLocale
): PublicMenuLocale | null {
  if (!menu.activeLocale && !fallbackLocale) return null;
  return normalizeMaisonElyseLocale(menu.activeLocale ?? fallbackLocale);
}

/** Keep the locale used for UI copy paired with a menu resolved for that locale. */
export function resolveMaisonElyseLocalizedMenu({
  fallbackLocale,
  fallbackMenu,
  localizedMenus = {},
  requestedLocale
}: MaisonElyseLocalizedMenuInput): MaisonElyseLocalizedMenuResolution {
  const requested = normalizeMaisonElyseLocale(requestedLocale, fallbackLocale);
  const requestedMenu = Object.entries(localizedMenus).find(
    ([locale, menu]) =>
      Boolean(menu) &&
      normalizeMaisonElyseLocale(locale, fallbackLocale) === requested &&
      canonicalMenuLocale(menu as PublicMenu) === requested
  )?.[1];

  if (requestedMenu) {
    return { locale: requested, menu: requestedMenu };
  }

  const fallbackActiveLocale = canonicalMenuLocale(fallbackMenu, fallbackLocale);
  if (fallbackActiveLocale) {
    return { locale: fallbackActiveLocale, menu: fallbackMenu };
  }

  return {
    locale: normalizeMaisonElyseLocale(fallbackLocale),
    menu: fallbackMenu
  };
}

/** Return only configured locales whose menu translation and Maison UI pack are public-ready. */
export function getMaisonElyseLanguageOptions(
  settings: Pick<PublicMenuSettings, "defaultLocale" | "supportedLocales">,
  translationLocales: PublicMenuTranslationStatus[] = []
): MaisonElyseLanguageOption[] {
  const statuses = new Map(
    translationLocales.map((status) => [status.locale, status.status])
  );
  const readyLocales = settings.supportedLocales.filter((candidate) => {
    const status = statuses.get(candidate);
    return (
      hasMaisonElyseEditorialCopy(candidate) &&
      (candidate === settings.defaultLocale ||
        status === "source" ||
        status === "up_to_date")
    );
  });
  const locales = readyLocales.length ? readyLocales : [settings.defaultLocale];

  return locales.map((candidate) => {
    const presentation = getMaisonElyseLanguagePresentation(candidate);
    return {
      id: candidate,
      label: presentation.nativeName || candidate,
      shortLabel: presentation.shortCode
    };
  });
}

/** Text direction only. Public menu chrome/layout must remain LTR. */
export function getMaisonElyseTextDirection(locale: string): "ltr" | "rtl" {
  const normalized = normalizeMaisonElyseLocale(locale);
  try {
    return new Intl.Locale(normalized).language.toLowerCase() === "ar"
      ? "rtl"
      : "ltr";
  } catch {
    return normalized.toLowerCase().startsWith("ar") ? "rtl" : "ltr";
  }
}

/**
 * Maison Élyse uses the shared public UI-copy contract. Exact and base-language
 * persisted buckets, then the verified built-in pack, are resolved by the
 * central resolver; callers can expose its diagnostics for QA.
 */
export function resolveMaisonElyseCopy(
  locale: string,
  localizedUiCopy?: Record<string, unknown>
) {
  return resolveTrouvableCopy(
    normalizeMaisonElyseLocale(locale),
    localizedUiCopy
  );
}

export type MaisonElyseCopy = ReturnType<typeof getTrouvableCopy>;
