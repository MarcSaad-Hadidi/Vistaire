import {
  validateAnalyticsEvent as validateAnalyticsEventCore
} from "./validationCore.mjs";
import type {
  AnalyticsEventPayload
} from "./types.ts";

type ValidationResult =
  | { ok: true; payload: AnalyticsEventPayload }
  | { ok: false; error: string };

export function validateAnalyticsEvent(input: unknown): ValidationResult {
  return validateAnalyticsEventCore(input) as ValidationResult;
}
