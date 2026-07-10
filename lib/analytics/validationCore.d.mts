import type { AnalyticsEventPayload } from "@/lib/analytics/types";

export type ValidationResult =
  | { ok: true; payload: AnalyticsEventPayload }
  | { ok: false; error: string };

export function validateAnalyticsEvent(input: unknown): ValidationResult;

export function validateAnalyticsContext(
  payload: AnalyticsEventPayload,
  lookup: {
    restaurantExists: (restaurantId: string) => Promise<boolean>;
    menuBelongsToRestaurant: (
      menuId: string,
      restaurantId: string
    ) => Promise<boolean>;
  }
): Promise<boolean>;
