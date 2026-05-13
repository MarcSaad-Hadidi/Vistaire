import type { Allergen, Dish } from "@/lib/demoMenuData";

/** Slug de l’onglet « Tous » : aucun filtre par catégorie. */
export const MENU_ALL_CATEGORY_SLUG = "tous" as const;

/** Normalise pour recherche insensible à la casse. */
export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function dishMatchesSearch(dish: Dish, rawQuery: string): boolean {
  const q = normalizeSearchText(rawQuery);
  if (!q) return true;

  const haystack = [
    dish.name,
    dish.shortDescription,
    dish.ingredients.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

/** Vrai si le plat dispose d’un modèle 3D rattaché. */
export function dishHas3dModel(dish: Pick<Dish, "model3dUrl">): boolean {
  return Boolean(dish.model3dUrl?.trim());
}

export function dishHasImmersiveAsset(
  dish: Pick<Dish, "model3dUrl" | "usdzUrl">
): boolean {
  return Boolean(dish.model3dUrl?.trim() || dish.usdzUrl?.trim());
}

export type MenuFilterState = {
  signatureOnly: boolean;
  recommendedOnly: boolean;
  availableOnly: boolean;
  /** Garder uniquement les plats avec une vue 3D rattachée. */
  with3dOnly: boolean;
  /** Exclure les plats contenant cet allergène (“sans …”). */
  excludeAllergen: Allergen | null;
};

export const defaultMenuFilterState = (): MenuFilterState => ({
  signatureOnly: false,
  recommendedOnly: false,
  availableOnly: false,
  with3dOnly: false,
  excludeAllergen: null
});

export function applyMenuFilters(
  dishes: Dish[],
  filters: MenuFilterState
): Dish[] {
  return dishes.filter((dish) => {
    if (filters.signatureOnly && !dish.isSignature) return false;
    if (filters.recommendedOnly && !dish.isRecommended) return false;
    if (filters.availableOnly && !dish.isAvailable) return false;
    if (filters.with3dOnly && !dishHas3dModel(dish)) return false;
    if (
      filters.excludeAllergen &&
      dish.allergens.includes(filters.excludeAllergen)
    ) {
      return false;
    }
    return true;
  });
}

export function hasActiveFilters(filters: MenuFilterState): boolean {
  return (
    filters.signatureOnly ||
    filters.recommendedOnly ||
    filters.availableOnly ||
    filters.with3dOnly ||
    filters.excludeAllergen !== null
  );
}
