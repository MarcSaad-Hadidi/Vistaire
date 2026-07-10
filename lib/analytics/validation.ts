import {
  validateAnalyticsEvent as validateAnalyticsEventCore
} from "./validationCore.mjs";
import type {
  AnalyticsEventPayload
} from "./types.ts";

type ValidationResult =
  | { ok: true; payload: AnalyticsEventPayload }
  | { ok: false; error: string };

const DEMO_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ??
  "11111111-1111-1111-1111-111111111111";
const DEMO_MENU_ID =
  process.env.NEXT_PUBLIC_DEMO_MENU_ID ??
  "22222222-2222-2222-2222-222222222222";

export function validateAnalyticsEvent(input: unknown): ValidationResult {
  return validateAnalyticsEventCore(input) as ValidationResult;
}

export function isConfiguredDemoAnalyticsPayload(
  payload: AnalyticsEventPayload
): boolean {
  return (
    payload.source === "demo" &&
    payload.restaurantId === DEMO_RESTAURANT_ID &&
    (!payload.menuId || payload.menuId === DEMO_MENU_ID)
  );
}
