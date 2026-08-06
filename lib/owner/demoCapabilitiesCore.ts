/**
 * Granular owner capabilities for restaurants.
 *
 * This module is intentionally free of framework/Supabase imports so the
 * policy can be exercised in unit tests and consumed by both server routes and
 * the owner UI. The canonical Maison Élyse identity itself is resolved by the
 * server wrapper (demoCapabilities.ts); callers must never infer editability
 * from a client supplied slug or query string.
 */

export type RestaurantOwnerCapabilities = {
  canEditMenuContent: boolean;
  canEditMenuSettings: boolean;
  canManageTranslations: boolean;
  canManageMedia: boolean;
  canDeleteRestaurant: boolean;
  canPerformDestructiveQrActions: boolean;
};

export type CanonicalDemoIdentity = {
  id: string;
  slug: string;
};

export type RestaurantIdentity = {
  id: string;
  slug?: string | null;
  status?: string | null;
};

export const PROTECTED_DEMO_CAPABILITIES: RestaurantOwnerCapabilities = {
  canEditMenuContent: false,
  canEditMenuSettings: false,
  canManageTranslations: false,
  canManageMedia: false,
  canDeleteRestaurant: false,
  canPerformDestructiveQrActions: false
};

/** Normal client restaurants preserve the existing owner behaviour. */
export const STANDARD_OWNER_CAPABILITIES: RestaurantOwnerCapabilities = {
  canEditMenuContent: true,
  canEditMenuSettings: true,
  canManageTranslations: true,
  canManageMedia: true,
  canDeleteRestaurant: true,
  canPerformDestructiveQrActions: true
};

/** Maison Élyse is editable, but remains protected from destructive actions. */
export const MAISON_ELYSE_EDITABLE_CAPABILITIES: RestaurantOwnerCapabilities = {
  canEditMenuContent: true,
  canEditMenuSettings: true,
  canManageTranslations: true,
  canManageMedia: true,
  canDeleteRestaurant: false,
  canPerformDestructiveQrActions: false
};

export function isCanonicalMaisonElyse(
  restaurant: RestaurantIdentity,
  canonical: CanonicalDemoIdentity
): boolean {
  return (
    restaurant.id.trim() === canonical.id.trim() &&
    (restaurant.slug ?? "").trim().toLowerCase() === canonical.slug.trim().toLowerCase()
  );
}

export function resolveRestaurantOwnerCapabilities(
  restaurant: RestaurantIdentity,
  canonical: CanonicalDemoIdentity
): RestaurantOwnerCapabilities {
  if (isCanonicalMaisonElyse(restaurant, canonical)) {
    return MAISON_ELYSE_EDITABLE_CAPABILITIES;
  }

  // Any other row marked demo remains fail-closed. This deliberately does not
  // treat a matching slug alone as Maison Élyse.
  if ((restaurant.status ?? "").trim().toLowerCase() === "demo") {
    return PROTECTED_DEMO_CAPABILITIES;
  }

  return STANDARD_OWNER_CAPABILITIES;
}

export function capabilityDeniedMessage(capability: keyof RestaurantOwnerCapabilities): string {
  switch (capability) {
    case "canEditMenuContent":
      return "Le contenu de ce restaurant de démonstration est protégé contre l’édition.";
    case "canEditMenuSettings":
      return "Les settings de ce restaurant de démonstration sont protégés contre l’édition.";
    case "canManageTranslations":
      return "Les traductions de ce restaurant de démonstration sont protégées.";
    case "canManageMedia":
      return "Les médias de ce restaurant ne peuvent pas être modifiés.";
    case "canDeleteRestaurant":
      return "La suppression des restaurants de démonstration est interdite.";
    case "canPerformDestructiveQrActions":
      return "Les actions QR destructives restent protégées pour cette démonstration.";
  }
}
