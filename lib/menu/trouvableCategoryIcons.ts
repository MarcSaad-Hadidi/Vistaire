import type { PublicMenuCategory } from "./publicMenuCore";

export const TROUVABLE_CATEGORY_ICON_FALLBACKS = [
  "chef",
  "cloche",
  "plate",
  "garden",
  "cellar"
] as const;

export type TrouvableCategoryIconKind =
  | "all"
  | "starter"
  | "classic"
  | "flame"
  | "travel"
  | "forno"
  | "morning"
  | "dessert"
  | "fresh"
  | "drinks"
  | (typeof TROUVABLE_CATEGORY_ICON_FALLBACKS)[number];

/** Stable Trouvable premium menu category order (Ouverture, then Matin, then Classique). */
export const TROUVABLE_CATEGORY_KIND_SORT_ORDER: readonly TrouvableCategoryIconKind[] = [
  "starter",
  "morning",
  "classic",
  "flame",
  "travel",
  "forno",
  "dessert",
  "fresh",
  "drinks"
];

const TROUVABLE_CATEGORY_KIND_SORT_INDEX = new Map(
  TROUVABLE_CATEGORY_KIND_SORT_ORDER.map((kind, index) => [kind, index])
);

export type TrouvableCategoryIdentity = {
  id: string;
  label: string;
  slug?: string;
};

function normalizeCategoryLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function fallbackIconKind(label: string): TrouvableCategoryIconKind {
  const normalized = normalizeCategoryLabel(label);
  const score = [...normalized].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  return TROUVABLE_CATEGORY_ICON_FALLBACKS[
    score % TROUVABLE_CATEGORY_ICON_FALLBACKS.length
  ];
}

function resolveKnownCategoryKind(normalized: string): TrouvableCategoryIconKind | null {
  if (!normalized.trim()) return "all";

  if (
    normalized.includes("ouverture") ||
    normalized.includes("opening") ||
    normalized.includes("entree") ||
    normalized.includes("entrada") ||
    normalized.includes("antipast") ||
    normalized.includes("starter") ||
    normalized.includes("tapas") ||
    normalized.includes("vorspeise") ||
    normalized.includes("appetizer") ||
    normalized.includes("appetiser") ||
    normalized.includes("aperitif") ||
    normalized.includes("hors d oeuvre") ||
    normalized.includes("افتتاح") ||
    normalized.includes("مقبلات")
  ) {
    return "starter";
  }

  if (
    normalized.includes("classique") ||
    normalized.includes("classic") ||
    normalized.includes("klassik") ||
    normalized.includes("classico") ||
    normalized.includes("clasico") ||
    normalized.includes("signature") ||
    normalized.includes("كلاسيك")
  ) {
    return "classic";
  }

  if (
    normalized.includes("feu") ||
    normalized.includes("fire") ||
    normalized.includes("fuego") ||
    normalized.includes("fuoco") ||
    normalized.includes("feuer") ||
    normalized.includes("flamme") ||
    normalized.includes("braise") ||
    normalized.includes("grill") ||
    normalized.includes("grille") ||
    normalized.includes("brasa") ||
    normalized.includes("نار")
  ) {
    return "flame";
  }

  if (
    normalized.includes("voyage") ||
    normalized.includes("travel") ||
    normalized.includes("journey") ||
    normalized.includes("viaggio") ||
    normalized.includes("viaje") ||
    normalized.includes("reise") ||
    normalized.includes("monde") ||
    normalized.includes("world") ||
    normalized.includes("international") ||
    normalized.includes("globe") ||
    normalized.includes("assiette") ||
    normalized.includes("رحلة")
  ) {
    return "travel";
  }

  if (
    normalized.includes("forno") ||
    normalized.includes("oven") ||
    normalized.includes("ofen") ||
    normalized.includes("horno") ||
    normalized.includes("pasta") ||
    normalized.includes("pate") ||
    normalized.includes("pizza") ||
    normalized.includes("فورنو")
  ) {
    return "forno";
  }

  if (
    normalized.includes("matin") ||
    normalized.includes("morning") ||
    normalized.includes("dejeuner") ||
    normalized.includes("breakfast") ||
    normalized.includes("brunch") ||
    normalized.includes("fruhstuck") ||
    normalized.includes("mattina") ||
    normalized.includes("manana") ||
    normalized.includes("صباح")
  ) {
    return "morning";
  }

  if (
    normalized.includes("derniere note") ||
    normalized.includes("last note") ||
    normalized.includes("derniere") ||
    normalized.includes("dessert") ||
    normalized.includes("dolci") ||
    normalized.includes("postre") ||
    normalized.includes("sucre") ||
    normalized.includes("gateau") ||
    normalized.includes("cake") ||
    normalized.includes("nachtisch") ||
    normalized.includes("ملاحظة")
  ) {
    return "dessert";
  }

  if (
    normalized.includes("fraicheur") ||
    normalized.includes("freshness") ||
    normalized.includes("fresh") ||
    normalized.includes("frescura") ||
    normalized.includes("freschezza") ||
    normalized.includes("salade") ||
    normalized.includes("salad") ||
    normalized.includes("vegetal") ||
    normalized.includes("vege") ||
    normalized.includes("juice") ||
    normalized.includes("jus") ||
    normalized.includes("نضارة")
  ) {
    return "fresh";
  }

  if (
    normalized.includes("verres") ||
    normalized.includes("verre") ||
    normalized.includes("glasses") ||
    normalized.includes("copas") ||
    normalized.includes("bicchieri") ||
    normalized.includes("bulles") ||
    normalized.includes("vin") ||
    normalized.includes("wine") ||
    normalized.includes("wein") ||
    normalized.includes("cocktail") ||
    normalized.includes("boisson") ||
    normalized.includes("drink") ||
    normalized.includes("getranke") ||
    normalized.includes("glass") ||
    normalized.includes("نظارات")
  ) {
    return "drinks";
  }

  return null;
}

export function getTrouvableCategoryIconKind(label: string): TrouvableCategoryIconKind {
  const normalized = normalizeCategoryLabel(label);
  return resolveKnownCategoryKind(normalized) ?? fallbackIconKind(label);
}

function resolveCategoryKind(category: TrouvableCategoryIdentity): TrouvableCategoryIconKind | null {
  for (const candidate of [category.slug, category.id, category.label]) {
    if (!candidate?.trim()) continue;
    const kind = resolveKnownCategoryKind(normalizeCategoryLabel(candidate));
    if (kind && kind !== "all") return kind;
  }
  return null;
}

export function getTrouvableCategoryIconKindForCategory(
  category: TrouvableCategoryIdentity
): TrouvableCategoryIconKind {
  return resolveCategoryKind(category) ?? getTrouvableCategoryIconKind(category.label);
}

export function getTrouvableCategorySortPriority(
  category: TrouvableCategoryIdentity
): number {
  const kind = resolveCategoryKind(category);
  if (!kind) return Number.MAX_SAFE_INTEGER;
  return TROUVABLE_CATEGORY_KIND_SORT_INDEX.get(kind) ?? Number.MAX_SAFE_INTEGER;
}

function getTrouvableCategorySortPriorityIfKnown(
  category: TrouvableCategoryIdentity
): number | null {
  const kind = resolveCategoryKind(category);
  if (!kind) return null;
  const priority = TROUVABLE_CATEGORY_KIND_SORT_INDEX.get(kind);
  return priority === undefined ? null : priority;
}

export function sortTrouvablePublicMenuCategories(
  categories: PublicMenuCategory[]
): PublicMenuCategory[] {
  return categories
    .map((category, index) => ({
      category,
      index,
      priority: getTrouvableCategorySortPriorityIfKnown(category)
    }))
    .sort((left, right) => {
      if (left.priority !== null && right.priority !== null) {
        const priorityDelta = left.priority - right.priority;
        if (priorityDelta !== 0) return priorityDelta;
        return left.index - right.index;
      }

      return left.index - right.index;
    })
    .map(({ category }) => category);
}
