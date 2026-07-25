export const ALLERGEN_STATUSES = [
  "contains",
  "may_contain",
  "confirmed_free",
  "unknown"
] as const;

export type AllergenStatus = (typeof ALLERGEN_STATUSES)[number];

export const ALLERGEN_REGISTRY = [
  {
    id: "gluten",
    labels: {
      fr: "Gluten / céréales",
      en: "Gluten / cereals",
      es: "Gluten / cereales",
      it: "Glutine / cereali",
      de: "Gluten / Getreide",
      el: "Γλουτένη / δημητριακά",
      ar: "الغلوتين / الحبوب"
    },
    aliases: ["gluten", "wheat", "blé", "ble", "seigle", "rye", "weizen", "roggen"],
    legacyLabel: "gluten",
    filterable: true
  },
  {
    id: "dairy",
    labels: {
      fr: "Produits laitiers",
      en: "Dairy",
      es: "Lácteos",
      it: "Latticini",
      de: "Milchprodukte",
      el: "Γαλακτοκομικά",
      ar: "منتجات الألبان"
    },
    aliases: ["dairy", "lait", "milk", "lactose", "produits laitiers", "produits laitier"],
    legacyLabel: "dairy",
    filterable: true
  },
  {
    id: "eggs",
    labels: {
      fr: "Œufs",
      en: "Eggs",
      es: "Huevos",
      it: "Uova",
      de: "Eier",
      el: "Αυγά",
      ar: "البيض"
    },
    aliases: ["egg", "eggs", "œuf", "oeuf", "œufs", "oeufs", "huevo", "eier"],
    legacyLabel: "eggs",
    filterable: true
  },
  {
    id: "tree_nuts",
    labels: {
      fr: "Fruits à coque",
      en: "Tree nuts",
      es: "Frutos secos",
      it: "Frutta a guscio",
      de: "Schalenfrüchte",
      el: "Ξηροί καρποί",
      ar: "المكسرات"
    },
    aliases: [
      "nut",
      "nuts",
      "tree nut",
      "tree nuts",
      "noix",
      "amande",
      "amandes",
      "noisette",
      "pistache",
      "pecan",
      "fruits à coque",
      "fruits a coque"
    ],
    legacyLabel: "tree nuts",
    filterable: true
  },
  {
    id: "crustaceans",
    labels: {
      fr: "Crustacés",
      en: "Crustaceans",
      es: "Crustáceos",
      it: "Crostacei",
      de: "Krustentiere",
      el: "Καρκινοειδή",
      ar: "القشريات"
    },
    aliases: ["crustacean", "crustaceans", "crustacé", "crustaces", "homard", "lobster", "crevette", "shrimp", "crabe", "crab"],
    legacyLabel: "crustaceans",
    filterable: false
  },
  {
    id: "shellfish",
    labels: {
      fr: "Crustacés et mollusques",
      en: "Shellfish",
      es: "Mariscos",
      it: "Molluschi e crostacei",
      de: "Schalentiere",
      el: "Οστρακοειδή",
      ar: "المحار والقشريات"
    },
    aliases: ["shellfish", "fruits de mer", "seafood"],
    legacyLabel: "shellfish",
    filterable: true
  },
  {
    id: "molluscs",
    labels: {
      fr: "Mollusques",
      en: "Molluscs",
      es: "Moluscos",
      it: "Molluschi",
      de: "Weichtiere",
      el: "Μαλάκια",
      ar: "الرخويات"
    },
    aliases: ["mollusc", "molluscs", "mollusk", "mollusks", "mollusque", "mollusques", "moule", "moules", "huître", "huitre", "huitres", "oyster", "oysters"],
    legacyLabel: "molluscs",
    filterable: false
  },
  {
    id: "peanuts",
    labels: {
      fr: "Arachides",
      en: "Peanuts",
      es: "Cacahuetes",
      it: "Arachidi",
      de: "Erdnüsse",
      el: "Αράπικα φιστίκια",
      ar: "الفول السوداني"
    },
    aliases: ["peanut", "peanuts", "arachide", "arachides", "cacahuète", "cacahuetes"],
    legacyLabel: "peanuts",
    filterable: false
  },
  {
    id: "sesame",
    labels: {
      fr: "Sésame",
      en: "Sesame",
      es: "Sésamo",
      it: "Sesamo",
      de: "Sesam",
      el: "Σουσάμι",
      ar: "السمسم"
    },
    aliases: ["sesame", "sésame", "sesamo", "sesam"],
    legacyLabel: "sesame",
    filterable: true
  },
  {
    id: "soy",
    labels: {
      fr: "Soja",
      en: "Soy",
      es: "Soja",
      it: "Soia",
      de: "Soja",
      el: "Σόγια",
      ar: "الصويا"
    },
    aliases: ["soy", "soja", "soya", "soia"],
    legacyLabel: "soy",
    filterable: true
  },
  {
    id: "mustard",
    labels: {
      fr: "Moutarde",
      en: "Mustard",
      es: "Mostaza",
      it: "Senape",
      de: "Senf",
      el: "Μουστάρδα",
      ar: "الخردل"
    },
    aliases: ["mustard", "moutarde", "mostaza", "senape", "senf"],
    legacyLabel: "mustard",
    filterable: false
  },
  {
    id: "fish",
    labels: {
      fr: "Poisson",
      en: "Fish",
      es: "Pescado",
      it: "Pesce",
      de: "Fisch",
      el: "Ψάρι",
      ar: "السمك"
    },
    aliases: ["fish", "poisson", "pescado", "pesce", "fisch", "thon", "tuna", "saumon", "salmon", "bar", "cabillaud"],
    legacyLabel: "fish",
    filterable: true
  },
  {
    id: "sulfites",
    labels: {
      fr: "Sulfites",
      en: "Sulphites",
      es: "Sulfitos",
      it: "Solfiti",
      de: "Sulfite",
      el: "Θειώδη",
      ar: "الكبريتيتات"
    },
    aliases: ["sulfite", "sulfites", "sulphite", "sulphites", "sulfitos", "sulfite"],
    legacyLabel: "sulfites",
    filterable: false
  }
] as const;

export type AllergenId = (typeof ALLERGEN_REGISTRY)[number]["id"];

export type DishAllergenDeclaration = {
  allergenId: AllergenId;
  status: AllergenStatus;
};

export type NormalizedAllergenData = {
  declarations: DishAllergenDeclaration[];
  legacyValues: string[];
  source: "structured" | "legacy" | "unknown";
  reviewRequired: boolean;
};

export const ALLERGEN_FILTERS = [
  { id: "gluten-free", allergenId: "gluten", allergenIds: ["gluten"], labels: { fr: "Déclaré sans gluten", en: "Declared gluten-free" } },
  { id: "dairy-free", allergenId: "dairy", allergenIds: ["dairy"], labels: { fr: "Déclaré sans produits laitiers", en: "Declared dairy-free" } },
  { id: "nut-free", allergenId: "tree_nuts", allergenIds: ["tree_nuts"], labels: { fr: "Déclaré sans fruits à coque", en: "Declared tree-nut-free" } },
  {
    id: "shellfish-free",
    allergenId: "shellfish",
    allergenIds: ["crustaceans", "molluscs"],
    labels: { fr: "Déclaré sans crustacés ni mollusques", en: "Declared shellfish-free" }
  },
  { id: "egg-free", allergenId: "eggs", allergenIds: ["eggs"], labels: { fr: "Déclaré sans œufs", en: "Declared egg-free" } },
  { id: "sesame-free", allergenId: "sesame", allergenIds: ["sesame"], labels: { fr: "Déclaré sans sésame", en: "Declared sesame-free" } },
  { id: "soy-free", allergenId: "soy", allergenIds: ["soy"], labels: { fr: "Déclaré sans soja", en: "Declared soy-free" } },
  { id: "fish-free", allergenId: "fish", allergenIds: ["fish"], labels: { fr: "Déclaré sans poisson", en: "Declared fish-free" } }
] as const;

export type AllergenFilterId = (typeof ALLERGEN_FILTERS)[number]["id"];

export type AllergenPublicCopy = {
  warning: string;
  warningTitle: string;
  detailsTitle: string;
  contains: string;
  mayContain: string;
  confirmedFree: string;
};

const ALLERGEN_PUBLIC_COPY: Record<string, AllergenPublicCopy> = {
  fr: {
    warning: "Les informations sur les allergènes sont déclarées par le restaurant. En cas d’allergie, confirmez toujours avec le personnel avant de commander.",
    warningTitle: "Information importante sur les allergènes",
    detailsTitle: "Déclarations allergènes",
    contains: "Contient",
    mayContain: "Peut contenir",
    confirmedFree: "Déclaré sans"
  },
  en: {
    warning: "Allergen information is provided by the restaurant. If you have an allergy, always confirm with staff before ordering.",
    warningTitle: "Important allergen information",
    detailsTitle: "Allergen declarations",
    contains: "Contains",
    mayContain: "May contain",
    confirmedFree: "Declared free from"
  },
  es: {
    warning: "La información sobre alérgenos la declara el restaurante. Si tienes una alergia, confirma siempre con el personal antes de pedir.",
    warningTitle: "Información importante sobre alérgenos",
    detailsTitle: "Declaraciones de alérgenos",
    contains: "Contiene",
    mayContain: "Puede contener",
    confirmedFree: "Declarado sin"
  },
  it: {
    warning: "Le informazioni sugli allergeni sono dichiarate dal ristorante. In caso di allergia, conferma sempre con il personale prima di ordinare.",
    warningTitle: "Informazioni importanti sugli allergeni",
    detailsTitle: "Dichiarazioni sugli allergeni",
    contains: "Contiene",
    mayContain: "Può contenere",
    confirmedFree: "Dichiarato senza"
  },
  de: {
    warning: "Allergeninformationen werden vom Restaurant bereitgestellt. Bei einer Allergie bitte vor der Bestellung immer das Personal fragen.",
    warningTitle: "Wichtige Allergeninformationen",
    detailsTitle: "Allergenerklärungen",
    contains: "Enthält",
    mayContain: "Kann enthalten",
    confirmedFree: "Als frei von deklariert"
  },
  el: {
    warning: "Οι πληροφορίες για τα αλλεργιογόνα παρέχονται από το εστιατόριο. Αν έχετε αλλεργία, επιβεβαιώστε πάντα με το προσωπικό πριν παραγγείλετε.",
    warningTitle: "Σημαντικές πληροφορίες για αλλεργιογόνα",
    detailsTitle: "Δηλώσεις αλλεργιογόνων",
    contains: "Περιέχει",
    mayContain: "Μπορεί να περιέχει",
    confirmedFree: "Δηλωμένο χωρίς"
  },
  ar: {
    warning: "يقدم المطعم معلومات مسببات الحساسية. إذا كنت تعاني من حساسية، فتأكد دائماً من الموظفين قبل الطلب.",
    warningTitle: "معلومات مهمة عن مسببات الحساسية",
    detailsTitle: "إقرارات مسببات الحساسية",
    contains: "يحتوي على",
    mayContain: "قد يحتوي على",
    confirmedFree: "معلن خلوه من"
  }
};

export function getAllergenPublicCopy(locale: string = "fr"): AllergenPublicCopy {
  const language = locale.toLowerCase().split("-")[0];
  return ALLERGEN_PUBLIC_COPY[language] ?? ALLERGEN_PUBLIC_COPY.en;
}

export function getRequestedModificationsAllergenDisclaimer(
  locale: string = "fr",
  localizedUiCopy?: Record<string, unknown>
): string {
  const allergensCopy = localizedUiCopy?.allergens;
  if (!allergensCopy || typeof allergensCopy !== "object" || Array.isArray(allergensCopy)) {
    return "";
  }
  const disclaimer = (allergensCopy as Record<string, unknown>)
    .requestedModificationsDisclaimer;
  if (!disclaimer || typeof disclaimer !== "object" || Array.isArray(disclaimer)) {
    return "";
  }
  const language = locale.toLowerCase().startsWith("en") ? "en" : "fr";
  const value = (disclaimer as Record<string, unknown>)[language];
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

const ALLERGEN_ID_SET = new Set<string>(ALLERGEN_REGISTRY.map((item) => item.id));
const ALLERGEN_STATUS_SET = new Set<string>(ALLERGEN_STATUSES);
const REGISTRY_BY_ID = new Map<AllergenId, (typeof ALLERGEN_REGISTRY)[number]>(
  ALLERGEN_REGISTRY.map((item) => [item.id, item])
);
const FILTER_BY_ID = new Map<string, (typeof ALLERGEN_FILTERS)[number]>(
  ALLERGEN_FILTERS.map((item) => [item.id, item])
);
const LEGACY_FILTER_ALLERGEN_IDS: Record<string, AllergenId> = {
  gluten: "gluten",
  dairy: "dairy",
  nuts: "tree_nuts",
  shellfish: "shellfish",
  eggs: "eggs",
  sesame: "sesame",
  soy: "soy",
  fish: "fish"
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 64);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return stringList(parsed);
  } catch {
    // Continue with the legacy separators below.
  }
  return trimmed
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 64);
}

/**
 * Free-text allergens are kept separate from the fixed registry so they never
 * become an unvalidated structured allergen id. They are public declarations,
 * not claims that the ingredient is absent from the kitchen.
 */
export function normalizeCustomAllergens(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const rawValue of rawValues) {
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim().slice(0, 120);
    const key = normalizeText(value);
    if (!value || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
    if (values.length >= 16) break;
  }
  return values;
}

function registryEntryForLegacyValue(value: string) {
  const normalized = normalizeText(value);
  return ALLERGEN_REGISTRY.find((item) =>
    item.aliases.some((alias) => {
      const candidate = normalizeText(alias);
      return normalized === candidate || normalized.includes(` ${candidate} `) || normalized.startsWith(`${candidate} `) || normalized.endsWith(` ${candidate}`);
    })
  );
}

function isMayContainValue(value: string): boolean {
  return /(^|\s)(may contain|peut contenir|traces? de|might contain|cross contamination|contamination croisee)(\s|$)/i.test(
    normalizeText(value)
  );
}

function isFreeFromClaim(value: string): boolean {
  const normalized = normalizeText(value);
  return /(^|\s)(sans|sans allergene|free from|free of|gluten free|dairy free|lactose free)(\s|$)/i.test(normalized);
}

function declarationFromLegacyValue(value: string): DishAllergenDeclaration | null {
  const entry = registryEntryForLegacyValue(value);
  if (!entry || isFreeFromClaim(value)) return null;
  return {
    allergenId: entry.id,
    status: isMayContainValue(value) ? "may_contain" : "contains"
  };
}

function normalizeStructuredDeclarations(input: unknown): {
  declarations: DishAllergenDeclaration[];
  reviewRequired: boolean;
} {
  if (!Array.isArray(input)) return { declarations: [], reviewRequired: true };

  const byId = new Map<AllergenId, AllergenStatus>();
  let reviewRequired = false;
  for (const item of input.slice(0, 32)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      reviewRequired = true;
      continue;
    }
    const candidate = item as { allergenId?: unknown; status?: unknown };
    if (
      typeof candidate.allergenId !== "string" ||
      !ALLERGEN_ID_SET.has(candidate.allergenId) ||
      typeof candidate.status !== "string" ||
      !ALLERGEN_STATUS_SET.has(candidate.status)
    ) {
      reviewRequired = true;
      continue;
    }
    const allergenId = candidate.allergenId as AllergenId;
    const status = candidate.status as AllergenStatus;
    const previous = byId.get(allergenId);
    if (previous && previous !== status) {
      byId.set(allergenId, "unknown");
      reviewRequired = true;
    } else {
      byId.set(allergenId, status);
    }
    if (status === "unknown") reviewRequired = true;
  }

  return {
    declarations: ALLERGEN_REGISTRY.flatMap(({ id }) => {
      const status = byId.get(id);
      return status ? [{ allergenId: id, status }] : [];
    }),
    reviewRequired
  };
}

export function normalizeAllergenData(
  structuredInput: unknown,
  legacyInput: unknown
): NormalizedAllergenData {
  const legacyValues = stringList(legacyInput);
  if (structuredInput !== undefined && structuredInput !== null) {
    const structured = normalizeStructuredDeclarations(structuredInput);
    return {
      declarations: structured.declarations,
      legacyValues,
      source: "structured",
      reviewRequired: structured.reviewRequired
    };
  }

  const byId = new Map<AllergenId, AllergenStatus>();
  let reviewRequired = legacyValues.length > 0;
  for (const value of legacyValues) {
    const declaration = declarationFromLegacyValue(value);
    if (!declaration) {
      reviewRequired = true;
      continue;
    }
    const previous = byId.get(declaration.allergenId);
    if (previous && previous !== declaration.status) {
      byId.set(declaration.allergenId, "unknown");
      reviewRequired = true;
    } else {
      byId.set(declaration.allergenId, declaration.status);
    }
  }

  return {
    declarations: ALLERGEN_REGISTRY.flatMap(({ id }) => {
      const status = byId.get(id);
      return status ? [{ allergenId: id, status }] : [];
    }),
    legacyValues,
    source: legacyValues.length > 0 ? "legacy" : "unknown",
    reviewRequired
  };
}

export function getAllergenStatus(
  input: unknown,
  allergenId: AllergenId
): AllergenStatus {
  const declarations = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? Array.isArray((input as { declarations?: unknown }).declarations)
        ? (input as { declarations: unknown[] }).declarations
        : Array.isArray((input as { allergenDeclarations?: unknown }).allergenDeclarations)
          ? (input as { allergenDeclarations: unknown[] }).allergenDeclarations
          : normalizeAllergenData(
              undefined,
              (input as { allergens?: unknown }).allergens
            ).declarations
      : [];
  const declaration = declarations.find(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { allergenId?: unknown }).allergenId === allergenId
  ) as { status?: unknown } | undefined;
  return declaration && typeof declaration.status === "string" && ALLERGEN_STATUS_SET.has(declaration.status)
    ? (declaration.status as AllergenStatus)
    : "unknown";
}

export function matchesConfirmedFree(input: unknown, allergenId: AllergenId): boolean {
  return getAllergenStatus(input, allergenId) === "confirmed_free";
}

export function allergenIdsForFilter(filterId: string): AllergenId[] {
  const filter = FILTER_BY_ID.get(filterId);
  if (filter) return [...filter.allergenIds];
  const legacyAllergenId = LEGACY_FILTER_ALLERGEN_IDS[filterId];
  return legacyAllergenId ? [legacyAllergenId] : [];
}

export function matchesConfirmedFreeForFilter(input: unknown, filterId: string): boolean {
  const allergenIds = allergenIdsForFilter(filterId);
  return allergenIds.length > 0 && allergenIds.every((allergenId) => matchesConfirmedFree(input, allergenId));
}

export function allergenIdForFilter(filterId: string): AllergenId | null {
  return FILTER_BY_ID.get(filterId)?.allergenId ?? LEGACY_FILTER_ALLERGEN_IDS[filterId] ?? null;
}

export function allergenLabel(
  allergenId: AllergenId,
  locale: string = "fr"
): string {
  const entry = REGISTRY_BY_ID.get(allergenId);
  if (!entry) return allergenId;
  const language = locale.toLowerCase().split("-")[0];
  return entry.labels[language as keyof typeof entry.labels] ?? entry.labels.en;
}

export function getAllergenDisplayGroups(
  input: unknown,
  locale: string = "fr"
): {
  contains: string[];
  mayContain: string[];
  confirmedFree: string[];
  unknownCount: number;
} {
  const declarations = Array.isArray(input)
    ? input
    : input && typeof input === "object" && Array.isArray((input as { declarations?: unknown }).declarations)
      ? (input as { declarations: unknown[] }).declarations
      : input && typeof input === "object" && Array.isArray((input as { allergenDeclarations?: unknown }).allergenDeclarations)
        ? (input as { allergenDeclarations: unknown[] }).allergenDeclarations
        : normalizeAllergenData(
            undefined,
            input && typeof input === "object"
              ? (input as { allergens?: unknown }).allergens
              : undefined
          ).declarations;
  const groups = { contains: [], mayContain: [], confirmedFree: [], unknownCount: 0 } as {
    contains: string[];
    mayContain: string[];
    confirmedFree: string[];
    unknownCount: number;
  };
  for (const { id } of ALLERGEN_REGISTRY) {
    const status = getAllergenStatus(declarations, id);
    if (status === "contains") groups.contains.push(allergenLabel(id, locale));
    else if (status === "may_contain") groups.mayContain.push(allergenLabel(id, locale));
    else if (status === "confirmed_free") groups.confirmedFree.push(allergenLabel(id, locale));
    else groups.unknownCount += 1;
  }
  return groups;
}

export function validateAllergenDeclarations(input: unknown): DishAllergenDeclaration[] {
  if (!Array.isArray(input)) throw new Error("allergenDeclarations must be an array");
  if (input.length > ALLERGEN_REGISTRY.length) {
    throw new Error("Too many allergen declarations");
  }
  const seen = new Set<string>();
  const declarations: DishAllergenDeclaration[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Invalid allergen declaration");
    }
    const candidate = item as { allergenId?: unknown; status?: unknown };
    if (
      typeof candidate.allergenId !== "string" ||
      !ALLERGEN_ID_SET.has(candidate.allergenId) ||
      typeof candidate.status !== "string" ||
      !ALLERGEN_STATUS_SET.has(candidate.status)
    ) {
      throw new Error("Invalid allergen declaration");
    }
    if (seen.has(candidate.allergenId)) {
      throw new Error("Duplicate allergen declaration");
    }
    seen.add(candidate.allergenId);
    declarations.push({
      allergenId: candidate.allergenId as AllergenId,
      status: candidate.status as AllergenStatus
    });
  }
  return ALLERGEN_REGISTRY.flatMap(({ id }) => {
    const declaration = declarations.find((item) => item.allergenId === id);
    return declaration ? [declaration] : [];
  });
}

export function legacyAllergensFromDeclarations(
  declarations: DishAllergenDeclaration[],
  legacyValues: string[] = []
): string[] {
  const values = [...stringList(legacyValues)];
  const seen = new Set(values.map((value) => normalizeText(value)));
  for (const declaration of declarations) {
    if (declaration.status !== "contains" && declaration.status !== "may_contain") continue;
    const entry = REGISTRY_BY_ID.get(declaration.allergenId);
    if (!entry || seen.has(normalizeText(entry.legacyLabel))) continue;
    values.push(entry.legacyLabel);
    seen.add(normalizeText(entry.legacyLabel));
  }
  return values.slice(0, 64);
}
