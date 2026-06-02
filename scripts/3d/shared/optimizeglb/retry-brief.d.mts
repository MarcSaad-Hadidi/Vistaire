import type { VariantRole } from "./presets.mjs";

export type RetryBriefInput = {
  variantRole: VariantRole;
  budgetStatus?: string;
  bytes?: number;
  triangleCount?: number;
  extensionsRequired?: string[];
  externalUriCount?: number;
  groundedY?: boolean;
  centeredXZ?: boolean;
  visualFailed?: boolean;
  usdzBytes?: number;
};

export type RetryBrief = {
  title: string;
  role: VariantRole;
  items: Array<{ problem: string; fix: string }>;
};

export function buildCandidateRetryBrief(input: RetryBriefInput): RetryBrief;
export function buildSetRetryBrief(candidates: RetryBriefInput[]): RetryBrief[];
