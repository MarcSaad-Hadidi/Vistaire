import "server-only";

import {
  isValidPresetLabel,
  isValidVariantRole,
  listRecommendedPresets,
  REQUIRED_SET_ROLES,
  type PresetLabel,
  type VariantRole
} from "@/scripts/3d/shared/optimizeglb/presets.mjs";
import {
  candidateStatusFromAnalysis,
  classifyCandidateBudget,
  evaluateCandidateSet,
  recommendCandidatePerRole,
  sortCandidatesForRole,
  type BudgetStatus,
  type CandidateSetEvaluation,
  type CandidateSetMember,
  type CandidateStatus,
  type CandidateSetStatus
} from "@/scripts/3d/shared/optimizeglb/candidate-rules.mjs";
import {
  analyzeCandidateGlb,
  type CandidateAnalysis
} from "@/scripts/3d/shared/optimizeglb/candidate-analysis.mjs";
import {
  validateSourceUploadIdentity,
  type SourceUploadIdentity
} from "@/lib/owner/threeDSourceUploadModel";

export type {
  VariantRole,
  PresetLabel,
  CandidateStatus,
  CandidateSetStatus,
  BudgetStatus,
  CandidateAnalysis,
  CandidateSetEvaluation,
  CandidateSetMember
};

export type OptimizeGlbCandidateRecord = SourceUploadIdentity & {
  id: string;
  sourceUploadId: string;
  sourceSha256: string;
  variantRole: VariantRole;
  presetLabel: PresetLabel;
  originalName: string;
  bytes: number;
  sha256: string;
  triangleCount: number | null;
  vertexCount: number | null;
  materialCount: number | null;
  textureCount: number | null;
  maxTextureSize: number | null;
  status: CandidateStatus;
  budgetStatus: BudgetStatus;
  visualStatus: "passed" | "failed" | "pending" | "none";
  fails: string[];
  warnings: string[];
  notes: string | null;
  uploadedByClerkUserId: string;
  uploadedByEmail: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const REQUIRED_CANDIDATE_SET_ROLES = REQUIRED_SET_ROLES;
export const OPTIMIZEGLB_PRESET_GUIDANCE = listRecommendedPresets();

const FILE_NAME_PATTERN = /^[a-zA-Z0-9._ -]{1,160}$/;

export type CandidateUploadInput = {
  identity: SourceUploadIdentity;
  sourceUploadId: string;
  variantRole: VariantRole;
  presetLabel: PresetLabel;
  notes: string | null;
};

export function validateCandidateUploadFields(input: {
  restaurantSlug: unknown;
  menuSlug: unknown;
  dishSlug: unknown;
  version: unknown;
  sourceUploadId: unknown;
  variantRole: unknown;
  presetLabel: unknown;
  notes: unknown;
}): { ok: true; value: CandidateUploadInput } | { ok: false; error: string } {
  const identity = validateSourceUploadIdentity(input);
  if (!identity.ok) return { ok: false, error: identity.error };

  if (
    typeof input.sourceUploadId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.sourceUploadId
    )
  ) {
    return { ok: false, error: "sourceUploadId is invalid." };
  }
  if (!isValidVariantRole(input.variantRole)) {
    return { ok: false, error: "variantRole is invalid." };
  }
  if (!isValidPresetLabel(input.presetLabel)) {
    return { ok: false, error: "presetLabel is invalid." };
  }

  let notes: string | null = null;
  if (input.notes != null && input.notes !== "") {
    if (typeof input.notes !== "string" || input.notes.length > 600) {
      return { ok: false, error: "notes must be a short string." };
    }
    notes = input.notes.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 600);
  }

  return {
    ok: true,
    value: {
      identity: identity.identity,
      sourceUploadId: input.sourceUploadId,
      variantRole: input.variantRole,
      presetLabel: input.presetLabel,
      notes
    }
  };
}

export function sanitizeCandidateFileName(value: string): string {
  const basename = value.split(/[\\/]+/).filter(Boolean).pop() ?? "candidate.glb";
  const cleaned = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const safe = cleaned || "candidate.glb";
  return FILE_NAME_PATTERN.test(safe) ? safe : "candidate.glb";
}

export function buildCandidateStorageKey(args: {
  identity: SourceUploadIdentity;
  variantRole: VariantRole;
  sha256: string;
}): string {
  const identity = validateSourceUploadIdentity(args.identity);
  if (!identity.ok) throw new Error("Invalid candidate storage identity.");
  if (!isValidVariantRole(args.variantRole)) throw new Error("Invalid candidate variant role.");
  if (!/^[a-f0-9]{64}$/.test(args.sha256)) throw new Error("Invalid candidate sha256.");
  return [
    "candidates",
    identity.identity.restaurantSlug,
    identity.identity.menuSlug,
    identity.identity.dishSlug,
    identity.identity.version,
    args.variantRole,
    `${args.sha256}.glb`
  ].join("/");
}

export type CandidateAnalysisResult = {
  analysis: CandidateAnalysis;
  status: CandidateStatus;
  budgetStatus: BudgetStatus;
  fails: string[];
  warnings: string[];
};

/**
 * Analyze candidate bytes and resolve its stored status against Vistaire gates.
 * Never throws on validation failures; throws only on malformed GLB containers.
 */
export function analyzeCandidateBuffer(args: {
  buffer: Buffer;
  variantRole: VariantRole;
  sourceSha256: string;
}): CandidateAnalysisResult {
  const analysis = analyzeCandidateGlb({ buffer: args.buffer, variantRole: args.variantRole });
  const budget = classifyCandidateBudget(analysis);
  const status = candidateStatusFromAnalysis(
    { ...analysis },
    args.sourceSha256
  );
  return {
    analysis,
    status,
    budgetStatus: budget.budgetStatus,
    fails: budget.fails,
    warnings: budget.warnings
  };
}

function candidateToMember(candidate: OptimizeGlbCandidateRecord): CandidateSetMember {
  return {
    variantRole: candidate.variantRole,
    sha256: candidate.sha256,
    sourceSha256: candidate.sourceSha256,
    bytes: candidate.bytes,
    status: candidate.status,
    budgetStatus: candidate.budgetStatus,
    visualStatus: candidate.visualStatus
  };
}

export function evaluateSelectedCandidateSet(
  sourceSha256: string,
  members: Partial<Record<VariantRole, OptimizeGlbCandidateRecord>>
): CandidateSetEvaluation {
  return evaluateCandidateSet({
    sourceSha256,
    members: Object.fromEntries(
      (Object.keys(members) as VariantRole[]).map((role) => [
        role,
        candidateToMember(members[role] as OptimizeGlbCandidateRecord)
      ])
    ) as Partial<Record<VariantRole, CandidateSetMember>>
  });
}

export type CandidateSetView = {
  sourceSha256: string;
  members: Partial<Record<VariantRole, OptimizeGlbCandidateRecord>>;
  recommended: Partial<Record<VariantRole, OptimizeGlbCandidateRecord | null>>;
  byRole: Record<VariantRole, OptimizeGlbCandidateRecord[]>;
  evaluation: CandidateSetEvaluation;
};

/**
 * Build a candidate-set view from all candidates of a dish version:
 * recommended candidate per role and an evaluation of the recommended set.
 */
export function buildCandidateSetView(
  sourceSha256: string,
  candidates: OptimizeGlbCandidateRecord[]
): CandidateSetView {
  const byRole = {
    web: [],
    mobile: [],
    arLite: [],
    iosSource: [],
    posterSource: []
  } as Record<VariantRole, OptimizeGlbCandidateRecord[]>;
  for (const candidate of candidates) {
    byRole[candidate.variantRole]?.push(candidate);
  }
  for (const role of Object.keys(byRole) as VariantRole[]) {
    byRole[role] = sortCandidatesForRole(
      byRole[role].map(candidateToMember)
    ).map((member) =>
      byRole[role].find((candidate) => candidate.sha256 === member.sha256) as OptimizeGlbCandidateRecord
    );
  }

  const recommendedMembers = recommendCandidatePerRole(candidates.map(candidateToMember));
  const recommended: Partial<Record<VariantRole, OptimizeGlbCandidateRecord | null>> = {};
  const members: Partial<Record<VariantRole, OptimizeGlbCandidateRecord>> = {};
  for (const role of Object.keys(recommendedMembers) as VariantRole[]) {
    const member = recommendedMembers[role];
    const record = member
      ? candidates.find((candidate) => candidate.sha256 === member.sha256) ?? null
      : null;
    recommended[role] = record;
    if (record) members[role] = record;
  }

  const evaluation = evaluateCandidateSet({
    sourceSha256,
    members: Object.fromEntries(
      (Object.keys(members) as VariantRole[]).map((role) => [
        role,
        candidateToMember(members[role] as OptimizeGlbCandidateRecord)
      ])
    ) as Partial<Record<VariantRole, CandidateSetMember>>
  });

  return { sourceSha256, members, recommended, byRole, evaluation };
}
