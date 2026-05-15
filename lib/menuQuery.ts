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

/** True when a dish has a web 3D or iOS AR asset. */
export function dishHasImmersiveAsset(
  dish: Pick<
    Dish,
    "model3dUrl" | "webModel3dUrl" | "arModel3dUrl" | "usdzUrl" | "arUsdzUrl"
  >
): boolean {
  return Boolean(
    dish.arModel3dUrl?.trim() ||
      dish.webModel3dUrl?.trim() ||
      dish.model3dUrl?.trim() ||
      dish.arUsdzUrl?.trim()
  );
}

export type MenuFilterState = {
  signatureOnly: boolean;
  recommendedOnly: boolean;
  availableOnly: boolean;
  /** Keep dishes with a web 3D or iOS AR asset. */
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
    if (filters.with3dOnly && !dishHasImmersiveAsset(dish)) return false;
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
