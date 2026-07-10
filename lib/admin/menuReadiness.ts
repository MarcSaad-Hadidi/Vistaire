export type AdminMenuCategory = {
  id: string;
  label: string;
  slug: string;
};

export type AdminMenuDish = {
  id: string;
  slug: string;
  name: string;
  category: string;
  categorySlug?: string;
  description: string;
  priceLabel: string;
  priceCents: number;
  imageUrl: string;
  thumbnailUrl: string;
  hasPhoto: boolean;
  photoStatus: string;
  hasImmersive: boolean;
  has3d: boolean;
  hasAr: boolean;
  available: boolean;
};

export type AdminMenuReadinessAction = {
  kind:
    | "setup-menu"
    | "missing-price"
    | "missing-description"
    | "missing-photo"
    | "unavailable";
  count: number;
  label: string;
};

export type AdminMenuReadiness = {
  score: number;
  counts: {
    categories: number;
    dishes: number;
    available: number;
    unavailable: number;
    missingPrice: number;
    missingDescription: number;
    missingPhoto: number;
    withPhoto: number;
    withImmersive: number;
  };
  actions: AdminMenuReadinessAction[];
};

export function buildAdminMenuReadiness(
  categories: AdminMenuCategory[],
  dishes: AdminMenuDish[]
): AdminMenuReadiness {
  const counts = {
    categories: categories.length,
    dishes: dishes.length,
    available: dishes.filter((dish) => dish.available).length,
    unavailable: dishes.filter((dish) => !dish.available).length,
    missingPrice: dishes.filter(
      (dish) => dish.priceCents <= 0 || !dish.priceLabel.trim()
    ).length,
    missingDescription: dishes.filter((dish) => !dish.description.trim()).length,
    missingPhoto: dishes.filter((dish) => !dish.hasPhoto).length,
    withPhoto: dishes.filter((dish) => dish.hasPhoto).length,
    withImmersive: dishes.filter((dish) => dish.hasImmersive).length
  };

  if (dishes.length === 0) {
    return {
      score: 0,
      counts,
      actions: [
        {
          kind: "setup-menu",
          count: 1,
          label: "Ajoutez les premiers plats à la carte."
        }
      ]
    };
  }

  const actions: AdminMenuReadinessAction[] = [];
  if (counts.missingPrice > 0) {
    actions.push({
      kind: "missing-price",
      count: counts.missingPrice,
      label: `${counts.missingPrice} plat${counts.missingPrice > 1 ? "s" : ""} sans prix`
    });
  }
  if (counts.missingDescription > 0) {
    actions.push({
      kind: "missing-description",
      count: counts.missingDescription,
      label: `${counts.missingDescription} plat${counts.missingDescription > 1 ? "s" : ""} sans description`
    });
  }
  if (counts.missingPhoto > 0) {
    actions.push({
      kind: "missing-photo",
      count: counts.missingPhoto,
      label: `${counts.missingPhoto} plat${counts.missingPhoto > 1 ? "s" : ""} sans photo`
    });
  }
  if (counts.unavailable > 0) {
    actions.push({
      kind: "unavailable",
      count: counts.unavailable,
      label: `${counts.unavailable} plat${counts.unavailable > 1 ? "s" : ""} indisponible${counts.unavailable > 1 ? "s" : ""}`
    });
  }

  const possibleSignals = dishes.length * 4;
  const readySignals =
    possibleSignals -
    counts.missingPrice -
    counts.missingDescription -
    counts.missingPhoto -
    counts.unavailable;

  return {
    score: Math.max(0, Math.min(100, Math.round((readySignals / possibleSignals) * 100))),
    counts,
    actions
  };
}
