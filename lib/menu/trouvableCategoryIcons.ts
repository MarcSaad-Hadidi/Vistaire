export const TROUVABLE_CATEGORY_ICON_FALLBACKS = [
  "chef",
  "cloche",
  "plate",
  "garden",
  "cellar"
] as const;

export type TrouvableCategoryIconKind =
  | "all"
  | "classic"
  | "starter"
  | "flame"
  | "travel"
  | "pasta"
  | "morning"
  | "dessert"
  | "fresh"
  | "drinks"
  | (typeof TROUVABLE_CATEGORY_ICON_FALLBACKS)[number];

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

export function getTrouvableCategoryIconKind(label: string): TrouvableCategoryIconKind {
  const normalized = normalizeCategoryLabel(label);

  if (!normalized.trim()) return "all";
  if (normalized.includes("classique") || normalized.includes("signature")) {
    return "classic";
  }
  if (
    normalized.includes("ouverture") ||
    normalized.includes("entree") ||
    normalized.includes("starter") ||
    normalized.includes("tapas")
  ) {
    return "starter";
  }
  if (
    normalized.includes("feu") ||
    normalized.includes("braise") ||
    normalized.includes("grill") ||
    normalized.includes("grille")
  ) {
    return "flame";
  }
  if (
    normalized.includes("voyage") ||
    normalized.includes("monde") ||
    normalized.includes("world")
  ) {
    return "travel";
  }
  if (
    normalized.includes("forno") ||
    normalized.includes("pasta") ||
    normalized.includes("pate") ||
    normalized.includes("pizza")
  ) {
    return "pasta";
  }
  if (
    normalized.includes("matin") ||
    normalized.includes("dejeuner") ||
    normalized.includes("brunch")
  ) {
    return "morning";
  }
  if (
    normalized.includes("derniere note") ||
    normalized.includes("dessert") ||
    normalized.includes("sucre") ||
    normalized.includes("gateau") ||
    normalized.includes("cake")
  ) {
    return "dessert";
  }
  if (
    normalized.includes("fraicheur") ||
    normalized.includes("fresh") ||
    normalized.includes("salade") ||
    normalized.includes("vegetal") ||
    normalized.includes("vege")
  ) {
    return "fresh";
  }
  if (
    normalized.includes("verres") ||
    normalized.includes("bulles") ||
    normalized.includes("vin") ||
    normalized.includes("wine") ||
    normalized.includes("cocktail") ||
    normalized.includes("boisson")
  ) {
    return "drinks";
  }

  return fallbackIconKind(label);
}
