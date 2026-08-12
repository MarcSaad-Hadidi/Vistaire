import type { AdminEvidencePayload, AdminMetricId, AdminMetricState, ProductionAdminMetricScope } from "./contracts.ts";
import type { AdminObservationWindow } from "./time.ts";

export type EvidenceId = string & { readonly __brand: "EvidenceId" };
export type AdminEvidenceAudience = "ui" | "export" | "mistral";
export type AdminEvidenceRecord = Readonly<{
  evidenceId: EvidenceId;
  metricId: AdminMetricId;
  definitionVersion: string;
  labelKey: string;
  state: AdminMetricState<AdminEvidencePayload>;
  period: "current" | "previous" | "snapshot";
  provenance: Readonly<Record<string, unknown>>;
  freshness: Readonly<Record<string, unknown>>;
  sample: Readonly<Record<string, unknown>>;
  privacy: Readonly<{ classification: string; promptUnsafe?: boolean }>;
  audiences: readonly AdminEvidenceAudience[];
}>;
export type AdminEvidenceRecordInput = Omit<AdminEvidenceRecord, "evidenceId">;
export type AdminEvidenceBundle = Readonly<{
  bundleId: string;
  scope: ProductionAdminMetricScope;
  window: AdminObservationWindow;
  generatedAt: string;
  records: Readonly<Record<string, AdminEvidenceRecord>>;
}>;

function opaqueScopeHash(scope: ProductionAdminMetricScope): string {
  let hash = 2166136261;
  for (const char of `${scope.restaurantId}\u0000${scope.menuId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function evidenceId(record: AdminEvidenceRecordInput): EvidenceId {
  return `ev:${record.metricId}:${record.period}:${record.definitionVersion}` as EvidenceId;
}

export function buildAdminEvidenceBundle(input: {
  scope: ProductionAdminMetricScope;
  window: AdminObservationWindow;
  generatedAt: string;
  records: readonly AdminEvidenceRecordInput[];
}): AdminEvidenceBundle {
  const records: Record<string, AdminEvidenceRecord> = {};
  for (const candidate of input.records) {
    const id = evidenceId(candidate);
    if (records[id]) throw new Error("Duplicate evidence identity.");
    const serialized = JSON.stringify(candidate);
    if (/session_id|sessionId|rawRows/.test(serialized)) throw new Error("Private row material is forbidden in evidence.");
    records[id] = Object.freeze({ ...candidate, evidenceId: id });
  }
  return Object.freeze({
    bundleId: `bundle:${opaqueScopeHash(input.scope)}:${input.generatedAt}:${input.window.range}`,
    scope: input.scope,
    window: input.window,
    generatedAt: input.generatedAt,
    records: Object.freeze(records)
  });
}

export function projectEvidenceForAudience(bundle: AdminEvidenceBundle, audience: AdminEvidenceAudience) {
  if (audience !== "ui" && audience !== "export" && audience !== "mistral") throw new Error("Unknown evidence audience.");
  const admitted = Object.values(bundle.records).filter((record) =>
    record.audiences.includes(audience) && !(audience === "mistral" && record.privacy.promptUnsafe)
  );
  if (audience === "mistral") {
    return {
      records: Object.fromEntries(admitted.map((record) => [record.evidenceId, {
        evidenceId: record.evidenceId,
        metricId: record.metricId,
        labelKey: record.labelKey,
        state: record.state,
        period: record.period
      }]))
    };
  }
  return {
    bundleId: bundle.bundleId,
    scope: bundle.scope,
    window: bundle.window,
    generatedAt: bundle.generatedAt,
    records: Object.fromEntries(admitted.map((record) => [record.evidenceId, record]))
  };
}

export function requireEvidenceReferences(
  bundle: AdminEvidenceBundle,
  reference: { bundleId: string; evidenceIds: readonly string[] },
  audience: AdminEvidenceAudience
): readonly AdminEvidenceRecord[] {
  if (audience !== "ui" && audience !== "export" && audience !== "mistral") throw new Error("Unknown evidence audience.");
  if (reference.bundleId !== bundle.bundleId) throw new Error("Cross-bundle evidence reference.");
  return reference.evidenceIds.map((id) => {
    const record = bundle.records[id];
    if (!record || !record.audiences.includes(audience) || (audience === "mistral" && record.privacy.promptUnsafe)) {
      throw new Error("Unknown or unauthorized evidence reference.");
    }
    return record;
  });
}
