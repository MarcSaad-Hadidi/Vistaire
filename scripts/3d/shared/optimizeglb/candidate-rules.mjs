// Pure budget/status/selection rules for OptimizeGLB browser-local candidates.
//
// No filesystem, no network. Safe to import from Node tests and (via the
// sibling .d.ts) from server-only TypeScript.

import { PRODUCTION_3D_BUDGETS, classifyBudget } from "../budgets.mjs";
import { REQUIRED_SET_ROLES, isValidVariantRole } from "./presets.mjs";

export const CANDIDATE_STATUSES = Object.freeze([
  "candidate_uploaded",
  "candidate_invalid",
  "candidate_analyzed",
  "candidate_visual_failed",
  "candidate_visual_passed",
  "candidate_selected",
  "candidate_rejected",
  "no_op_rejected"
]);

export const CANDIDATE_SET_STATUSES = Object.freeze([
  "draft",
  "incomplete",
  "needs_visual_compare",
  "visual_failed",
  "recommended",
  "approved_by_human",
  "rejected",
  "ready_for_device_qa",
  "ready_for_cdn",
  "ready_for_finalize"
]);

const FAILING_CANDIDATE_STATUSES = new Set([
  "candidate_invalid",
  "candidate_visual_failed",
  "candidate_rejected",
  "no_op_rejected"
]);

const VISUAL_REQUIRED_ROLES = new Set(["web", "mobile", "arLite"]);

function budgetForRole(variantRole) {
  if (variantRole === "web") return PRODUCTION_3D_BUDGETS.variants.webGlb;
  if (variantRole === "mobile") return PRODUCTION_3D_BUDGETS.variants.mobileGlb;
  if (variantRole === "arLite") return PRODUCTION_3D_BUDGETS.variants.arLiteGlb;
  if (variantRole === "iosSource") return PRODUCTION_3D_BUDGETS.variants.arLiteGlb;
  return null;
}

/**
 * Classify a single uploaded candidate against role-specific gates.
 * Returns a budget status plus explicit fail/warning reasons.
 */
export function classifyCandidateBudget(analysis) {
  const fails = [];
  const warnings = [];
  const role = analysis.variantRole;

  if (!isValidVariantRole(role)) {
    return { budgetStatus: "fail", fails: [`Unknown variant role: ${String(role)}`], warnings };
  }

  if (role === "posterSource") {
    return { budgetStatus: "advisory", fails, warnings };
  }

  const budget = budgetForRole(role);
  const bytesStatus = budget?.bytes ? classifyBudget(analysis.bytes, budget.bytes) : "unknown";
  if (bytesStatus === "fail") {
    fails.push(`${role} GLB is over the byte budget (${analysis.bytes} bytes).`);
  } else if (bytesStatus === "warning") {
    warnings.push(`${role} GLB is approaching the byte budget (${analysis.bytes} bytes).`);
  }

  if ((analysis.externalUriCount ?? 0) > 0) {
    fails.push(`${role} candidate references ${analysis.externalUriCount} external URI(s); production candidates must embed all resources.`);
  }

  if (role === "arLite") {
    const triangleStatus = classifyBudget(analysis.triangleCount ?? Infinity, budget.triangles);
    if (triangleStatus === "fail") {
      fails.push(`AR-lite triangle count is over budget (${analysis.triangleCount}).`);
    } else if (triangleStatus === "warning") {
      warnings.push(`AR-lite triangle count is high (${analysis.triangleCount}).`);
    }
    if ((analysis.extensionsRequired?.length ?? 0) > 0) {
      fails.push(`AR-lite candidate must not require glTF extensions (${analysis.extensionsRequired.join(", ")}).`);
    }
    if (analysis.groundedY === false) {
      fails.push("AR-lite candidate is not grounded (min Y is not at the floor).");
    }
    if (analysis.centeredXZ === false) {
      fails.push("AR-lite candidate is not centered on the XZ plane.");
    }
  }

  if (role === "iosSource") {
    if ((analysis.extensionsRequired?.length ?? 0) > 0) {
      fails.push(`iOS source candidate must not require glTF extensions (${analysis.extensionsRequired.join(", ")}).`);
    }
  }

  let budgetStatus = bytesStatus === "unknown" ? "advisory" : bytesStatus;
  if (fails.length > 0) budgetStatus = "fail";
  return { budgetStatus, fails, warnings };
}

export function isNoOpCandidate(candidateSha256, sourceSha256) {
  return Boolean(candidateSha256) && candidateSha256 === sourceSha256;
}

/**
 * Resolve the stored status for a freshly analyzed candidate.
 */
export function candidateStatusFromAnalysis(analysis, sourceSha256) {
  if (isNoOpCandidate(analysis.sha256, sourceSha256)) return "no_op_rejected";
  const budget = classifyCandidateBudget(analysis);
  if (budget.fails.length > 0) return "candidate_invalid";
  return "candidate_analyzed";
}

function candidatePasses(candidate) {
  if (!candidate) return false;
  if (FAILING_CANDIDATE_STATUSES.has(candidate.status)) return false;
  return candidate.budgetStatus !== "fail";
}

function candidateRank(candidate) {
  // Lower is better: passing first, then by bytes ascending.
  const passing = candidatePasses(candidate) ? 0 : 1;
  const bytes = Number.isFinite(candidate?.bytes) ? candidate.bytes : Number.MAX_SAFE_INTEGER;
  return passing * 1e15 + bytes;
}

export function sortCandidatesForRole(candidates) {
  return [...candidates].sort((a, b) => candidateRank(a) - candidateRank(b));
}

/**
 * Smallest passing candidate per role. Never recommends a failed/no-op candidate.
 */
export function recommendCandidatePerRole(candidates) {
  const byRole = new Map();
  for (const candidate of candidates) {
    const list = byRole.get(candidate.variantRole) ?? [];
    list.push(candidate);
    byRole.set(candidate.variantRole, list);
  }
  const recommended = {};
  for (const [role, list] of byRole.entries()) {
    const passing = list.filter(candidatePasses);
    if (passing.length === 0) {
      recommended[role] = null;
      continue;
    }
    recommended[role] = sortCandidatesForRole(passing)[0] ?? null;
  }
  return recommended;
}

/**
 * Validate a candidate set: completeness, source binding, no failed members,
 * and visual pass for web/mobile/arLite. Returns a status and reasons.
 */
export function evaluateCandidateSet(set) {
  const fails = [];
  const warnings = [];
  const members = set.members ?? {};
  const presentRoles = Object.keys(members).filter((role) => members[role]);
  const missingRoles = REQUIRED_SET_ROLES.filter((role) => !members[role]);

  let totalBytes = 0;
  for (const role of presentRoles) {
    const member = members[role];
    if (Number.isFinite(member.bytes)) totalBytes += member.bytes;
  }

  if (missingRoles.length > 0) {
    fails.push(`Candidate set is missing required role(s): ${missingRoles.join(", ")}.`);
  }

  for (const role of presentRoles) {
    const member = members[role];
    if (set.sourceSha256 && member.sourceSha256 && member.sourceSha256 !== set.sourceSha256) {
      fails.push(`${role} candidate is bound to a different source (SHA mismatch).`);
    }
    if (FAILING_CANDIDATE_STATUSES.has(member.status) || member.budgetStatus === "fail") {
      fails.push(`${role} candidate did not pass Vistaire validation and cannot be part of an approved set.`);
    }
  }

  let needsVisual = false;
  let visualFailed = false;
  for (const role of REQUIRED_SET_ROLES) {
    const member = members[role];
    if (!member) continue;
    if (member.visualStatus === "failed") visualFailed = true;
    else if (member.visualStatus !== "passed") needsVisual = true;
  }

  // total budget (signature profile) gate
  const totalBudget = PRODUCTION_3D_BUDGETS.profiles.signature.totalPublicBytes;
  if (presentRoles.length > 0 && classifyBudget(totalBytes, totalBudget) === "fail") {
    fails.push(`Candidate set total is over the signature budget (${totalBytes} bytes).`);
  }

  let status;
  if (missingRoles.length > 0) status = "incomplete";
  else if (fails.length > 0 && visualFailed) status = "visual_failed";
  else if (fails.length > 0) status = "draft";
  else if (visualFailed) status = "visual_failed";
  else if (needsVisual) status = "needs_visual_compare";
  else status = "recommended";

  return {
    status,
    complete: missingRoles.length === 0,
    missingRoles,
    totalBytes,
    canApprove: fails.length === 0 && !needsVisual && !visualFailed && missingRoles.length === 0,
    fails,
    warnings
  };
}

export { VISUAL_REQUIRED_ROLES, REQUIRED_SET_ROLES };
