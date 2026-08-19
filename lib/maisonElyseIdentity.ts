const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";

export const MAISON_ELYSE_SLUG = "maison-elyse" as const;

export function getDemoRestaurantId(): string {
  return DEMO_RESTAURANT_ID;
}

export function getMaisonElyseIdentity() {
  return {
    id: getDemoRestaurantId(),
    slug: MAISON_ELYSE_SLUG
  };
}
