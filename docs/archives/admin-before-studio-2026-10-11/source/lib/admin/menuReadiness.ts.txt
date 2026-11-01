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

export type AdminMenuSelectionRow = {
  id?: unknown;
  status?: unknown;
  is_primary?: unknown;
  isPrimary?: unknown;
  updated_at?: unknown;
  updatedAt?: unknown;
};

export type AdminDashboardMenu = {
  id: string;
  status: "published" | "draft";
};

function menuId(row: AdminMenuSelectionRow): string {
  return typeof row.id === "string" ? row.id.trim() : "";
}

function menuStatus(row: AdminMenuSelectionRow): "published" | "draft" | "archived" | "unknown" {
  const value = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
  return value === "published" || value === "draft" || value === "archived"
    ? value
    : "unknown";
}

function isPrimaryMenu(row: AdminMenuSelectionRow): boolean {
  return row.is_primary === true || row.isPrimary === true;
}

function menuUpdatedAtMs(row: AdminMenuSelectionRow): number {
  const raw = row.updated_at ?? row.updatedAt;
  const timestamp = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function deterministicMenuOrder(left: AdminMenuSelectionRow, right: AdminMenuSelectionRow): number {
  const updatedAtDifference = menuUpdatedAtMs(right) - menuUpdatedAtMs(left);
  if (updatedAtDifference !== 0) return updatedAtDifference;
  const leftId = menuId(left);
  const rightId = menuId(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

/**
 * Picks the only menu the restaurant dashboard may read or mutate. Published
 * menus always win, then the newest row with a stable ID tie-breaker. A draft
 * primary menu is allowed only as an explicit empty-state fallback.
 */
export function selectAdminDashboardMenu(
  rows: AdminMenuSelectionRow[]
): AdminDashboardMenu | null {
  const validRows = rows.filter((row) => Boolean(menuId(row)));
  const publishedPrimary = validRows.filter(
    (row) => menuStatus(row) === "published" && isPrimaryMenu(row)
  );
  const published = validRows.filter((row) => menuStatus(row) === "published");
  const draftPrimary = validRows.filter(
    (row) => menuStatus(row) === "draft" && isPrimaryMenu(row)
  );
  const selected =
    publishedPrimary.sort(deterministicMenuOrder)[0] ??
    published.sort(deterministicMenuOrder)[0] ??
    draftPrimary.sort(deterministicMenuOrder)[0];

  if (!selected) return null;
  return { id: menuId(selected), status: menuStatus(selected) as "published" | "draft" };
}

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
