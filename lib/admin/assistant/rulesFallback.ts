import type { AdminEvidenceBundle } from "../data/evidenceRegistry.ts";
import type { AssistantClaim } from "./contracts.ts";

export function buildRuleBasedAssistantClaims(bundle: AdminEvidenceBundle): readonly AssistantClaim[] {
  const admitted = Object.values(bundle.records).filter((record) => record.audiences.includes("mistral") && !record.privacy.promptUnsafe);
  const current = admitted.find((record) => record.metricId === "observed-menu-opens" && record.period === "current");
  const previous = admitted.find((record) => record.metricId === "observed-menu-opens" && record.period === "previous");
  const claims: AssistantClaim[] = [];
  if (current) claims.push({ claimType: "metric-observation", evidenceIds: [current.evidenceId] });
  if (current && previous) claims.push({ claimType: "period-comparison", evidenceIds: [current.evidenceId, previous.evidenceId] });
  return claims;
}
