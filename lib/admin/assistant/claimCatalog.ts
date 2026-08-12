import type { ApprovedClaimType } from "./contracts.ts";

export const ASSISTANT_CLAIM_REQUIREMENTS: Readonly<Record<ApprovedClaimType, Readonly<{ minimum: number; maximum: number }>>> = Object.freeze({
  "metric-observation": { minimum: 1, maximum: 1 },
  "period-comparison": { minimum: 2, maximum: 2 },
  "rank-observation": { minimum: 1, maximum: 1 },
  "attention-observation": { minimum: 1, maximum: 1 }
});
