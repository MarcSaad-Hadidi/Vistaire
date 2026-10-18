import type { AnalyticsEventPayload } from "@/lib/analytics/types";

export type ValidationResult =
  | { ok: true; payload: AnalyticsEventPayload }
  | { ok: false; error: string };

export function validateAnalyticsEvent(input: unknown): ValidationResult;

export function validateAnalyticsContext(
  payload: AnalyticsEventPayload,
  lookup: {
    publicQrBelongsToRestaurant?: (qrId: string, restaurantId: string) => Promise<boolean>;
    restaurantExists: (restaurantId: string) => Promise<boolean>;
    menuBelongsToRestaurant: (
      menuId: string,
      restaurantId: string
    ) => Promise<boolean>;
  }
): Promise<boolean>;

export function sanitizeAnalyticsMetadata(input: unknown): Record<string, unknown>;
export function canRetryLegacyAnalyticsInsert(
  payload: AnalyticsEventPayload,
  error: { code?: string; message?: string } | null
): boolean;

export function publicQrAttributionPath(resolved: { targetKind: string; targetPath: string; qrId: string }): string;
