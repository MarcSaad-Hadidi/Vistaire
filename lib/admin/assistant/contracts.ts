import type { EvidenceId } from "../data/evidenceRegistry.ts";

export const APPROVED_CLAIM_TYPES = [
  "metric-observation",
  "period-comparison",
  "rank-observation",
  "attention-observation"
] as const;

export type ApprovedClaimType = (typeof APPROVED_CLAIM_TYPES)[number];

export type AssistantClaim = Readonly<{
  claimType: ApprovedClaimType;
  evidenceIds: readonly EvidenceId[];
}>;

export type AssistantRenderedBlock = Readonly<{
  kind: "observation" | "comparison" | "ranking" | "attention" | "unavailable";
  label: string;
  value?: string;
  direction?: "up" | "down" | "flat";
  delta?: number;
  evidenceIds: readonly EvidenceId[];
}>;

export type AssistantAnswer = Readonly<{
  source: "mistral" | "rules";
  blocks: readonly AssistantRenderedBlock[];
  evidenceIds: readonly EvidenceId[];
}>;

export function isAssistantClaim(input: unknown): input is AssistantClaim {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => key !== "claimType" && key !== "evidenceIds")) return false;
  if (!APPROVED_CLAIM_TYPES.includes(candidate.claimType as ApprovedClaimType)) return false;
  return Array.isArray(candidate.evidenceIds) && candidate.evidenceIds.length > 0 &&
    candidate.evidenceIds.every((id) => typeof id === "string" && id.startsWith("ev:")) &&
    new Set(candidate.evidenceIds).size === candidate.evidenceIds.length;
}
