import type { VariantRole } from "./presets.mjs";

export type CandidateStatus =
  | "candidate_uploaded"
  | "candidate_invalid"
  | "candidate_analyzed"
  | "candidate_visual_failed"
  | "candidate_visual_passed"
  | "candidate_selected"
  | "candidate_rejected"
  | "no_op_rejected";

export type CandidateSetStatus =
  | "draft"
  | "incomplete"
  | "needs_visual_compare"
  | "visual_failed"
  | "recommended"
  | "approved_by_human"
  | "rejected"
  | "ready_for_device_qa"
  | "ready_for_cdn"
  | "ready_for_finalize";

export type BudgetStatus = "target" | "advisory" | "warning" | "fail" | "unknown";

export type CandidateBudgetInput = {
  variantRole: VariantRole;
  bytes: number;
  triangleCount?: number;
  extensionsRequired?: string[];
  externalUriCount?: number;
  groundedY?: boolean;
  centeredXZ?: boolean;
};

export type CandidateBudgetResult = {
  budgetStatus: BudgetStatus;
  fails: string[];
  warnings: string[];
};

export type CandidateSetMember = {
  variantRole: VariantRole;
  sha256?: string;
  sourceSha256?: string;
  bytes?: number;
  status: CandidateStatus;
  budgetStatus: BudgetStatus;
  visualStatus?: "passed" | "failed" | "pending" | "none";
};

export type CandidateSetInput = {
  sourceSha256?: string;
  members: Partial<Record<VariantRole, CandidateSetMember>>;
};

export type CandidateSetEvaluation = {
  status: CandidateSetStatus;
  complete: boolean;
  missingRoles: VariantRole[];
  totalBytes: number;
  canApprove: boolean;
  fails: string[];
  warnings: string[];
};

export const CANDIDATE_STATUSES: readonly CandidateStatus[];
export const CANDIDATE_SET_STATUSES: readonly CandidateSetStatus[];
export const REQUIRED_SET_ROLES: readonly VariantRole[];
export const VISUAL_REQUIRED_ROLES: ReadonlySet<string>;

export function classifyCandidateBudget(analysis: CandidateBudgetInput): CandidateBudgetResult;
export function isNoOpCandidate(candidateSha256: string, sourceSha256: string): boolean;
export function candidateStatusFromAnalysis(
  analysis: CandidateBudgetInput & { sha256: string },
  sourceSha256: string
): CandidateStatus;
export function sortCandidatesForRole<T extends CandidateSetMember>(candidates: T[]): T[];
export function recommendCandidatePerRole<T extends CandidateSetMember>(
  candidates: T[]
): Record<string, T | null>;
export function evaluateCandidateSet(set: CandidateSetInput): CandidateSetEvaluation;
