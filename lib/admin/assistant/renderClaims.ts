import type { AdminEvidenceBundle, AdminEvidenceRecord, EvidenceId } from "../data/evidenceRegistry.ts";
import { requireEvidenceReferences } from "../data/evidenceRegistry.ts";
import { ASSISTANT_CLAIM_REQUIREMENTS } from "./claimCatalog.ts";
import type { AssistantAnswer, AssistantClaim, AssistantRenderedBlock } from "./contracts.ts";

type Locale = "fr" | "en";

function count(record: AdminEvidenceRecord): number | null {
  if (record.state.kind !== "available") return null;
  const value = record.state.value;
  if (!value || typeof value !== "object" || !("count" in value) || typeof value.count !== "number" || !Number.isFinite(value.count)) return null;
  return value.count;
}

function label(record: AdminEvidenceRecord, locale: Locale): string {
  const labels: Record<string, readonly [string, string]> = {
    "observed-menu-opens": ["Ouvertures du menu", "Menu opens"],
    "catalog-dishes": ["Plats au menu", "Menu dishes"]
  };
  return labels[record.metricId]?.[locale === "fr" ? 0 : 1] ?? record.labelKey;
}

function unavailable(record: AdminEvidenceRecord, locale: Locale): AssistantRenderedBlock {
  return { kind: "unavailable", label: locale === "fr" ? "Donnée insuffisante" : "Insufficient data", evidenceIds: [record.evidenceId] };
}

function renderClaim(locale: Locale, bundle: AdminEvidenceBundle, claim: AssistantClaim): AssistantRenderedBlock {
  const requirement = ASSISTANT_CLAIM_REQUIREMENTS[claim.claimType];
  if (claim.evidenceIds.length < requirement.minimum || claim.evidenceIds.length > requirement.maximum) throw new Error("Invalid evidence cardinality.");
  const records = requireEvidenceReferences(bundle, { bundleId: bundle.bundleId, evidenceIds: claim.evidenceIds }, "mistral");
  if (claim.claimType === "period-comparison") {
    const current = records.find((record) => record.period === "current");
    const previous = records.find((record) => record.period === "previous");
    if (!current || !previous || current.evidenceId === previous.evidenceId) throw new Error("Comparison requires current and previous evidence.");
    const currentValue = count(current), previousValue = count(previous);
    if (currentValue === null || previousValue === null) return unavailable(current, locale);
    const delta = currentValue - previousValue;
    return { kind: "comparison", label: label(current, locale), value: new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA").format(currentValue), direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat", delta, evidenceIds: records.map((record) => record.evidenceId) };
  }
  const record = records[0];
  const value = count(record);
  if (value === null) return unavailable(record, locale);
  const kind = claim.claimType === "rank-observation" ? "ranking" : claim.claimType === "attention-observation" ? "attention" : "observation";
  return { kind, label: label(record, locale), value: new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA").format(value), evidenceIds: [record.evidenceId] };
}

export function renderAssistantClaims(input: { locale: Locale; bundle: AdminEvidenceBundle; claims: readonly AssistantClaim[]; source?: "mistral" | "rules" }): AssistantAnswer {
  const blocks = input.claims.map((claim) => renderClaim(input.locale, input.bundle, claim));
  return { source: input.source ?? "rules", blocks, evidenceIds: [...new Set(blocks.flatMap((block) => block.evidenceIds))] as EvidenceId[] };
}
