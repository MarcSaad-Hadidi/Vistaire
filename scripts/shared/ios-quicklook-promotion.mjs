export const MAX_PRODUCTION_IOS_USDZ_BYTES = 5 * 1024 * 1024;

export const PRODUCTION_PROMOTION_ORDER = [
  "conservative",
  "balanced",
  "ultra",
  "extreme"
];

export function formatPromotionSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function candidateName(candidate) {
  return String(candidate?.label || candidate?.level || "unknown candidate");
}

function candidateBytes(candidate) {
  const bytes = candidate?.usdz?.bytes;
  return Number.isFinite(bytes) ? bytes : 0;
}

export function getProductionPromotionRejectionReasons(
  candidate,
  productionBudgetBytes = MAX_PRODUCTION_IOS_USDZ_BYTES
) {
  const reasons = [];
  const name = candidateName(candidate);

  if (!candidate || candidate.failed) {
    reasons.push(
      candidate?.error
        ? `${name} failed to build: ${candidate.error}`
        : `${name} failed to build`
    );
    return reasons;
  }

  const bytes = candidateBytes(candidate);
  if (candidate.productionBudgetPass === false || bytes > productionBudgetBytes) {
    reasons.push(
      `${name} is ${formatPromotionSize(bytes)}, above ${formatPromotionSize(
        productionBudgetBytes
      )}`
    );
  }

  if (!candidate.usdz?.valid) {
    reasons.push(`${name} has an invalid USDZ package`);
  }

  if (!candidate.bounds?.grounded) {
    reasons.push(`${name} is not grounded`);
  }

  if (!candidate.bounds?.centeredXZ) {
    reasons.push(`${name} is not centered on X/Z`);
  }

  return reasons;
}

export function isProductionPromotableCandidate(
  candidate,
  productionBudgetBytes = MAX_PRODUCTION_IOS_USDZ_BYTES
) {
  return (
    getProductionPromotionRejectionReasons(candidate, productionBudgetBytes)
      .length === 0
  );
}

function normalizeRequestedLevel(requestedLevel) {
  const normalized = String(requestedLevel || "").trim().toLowerCase();
  return normalized || "auto";
}

function candidateMap(candidates) {
  return new Map(
    candidates
      .filter((candidate) => candidate?.level)
      .map((candidate) => [String(candidate.level), candidate])
  );
}

function describeRejections(candidates, productionBudgetBytes) {
  return candidates
    .map((candidate) => {
      const reasons = getProductionPromotionRejectionReasons(
        candidate,
        productionBudgetBytes
      );
      return reasons.length > 0
        ? `${candidateName(candidate)}: ${reasons.join("; ")}`
        : "";
    })
    .filter(Boolean)
    .join(" | ");
}

export function selectProductionPromotionCandidate({
  requestedLevel = "auto",
  candidates,
  productionBudgetBytes = MAX_PRODUCTION_IOS_USDZ_BYTES,
  promotionOrder = PRODUCTION_PROMOTION_ORDER
}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("No USDZ candidates were generated.");
  }

  const requested = normalizeRequestedLevel(requestedLevel);
  const byLevel = candidateMap(candidates);

  if (requested !== "auto") {
    const candidate = byLevel.get(requested);
    if (!candidate) {
      throw new Error(
        `Cannot promote unknown candidate level: ${requested}. Known levels: ${[
          ...byLevel.keys()
        ].join(", ")}`
      );
    }
    const reasons = getProductionPromotionRejectionReasons(
      candidate,
      productionBudgetBytes
    );
    if (reasons.length > 0) {
      throw new Error(`Cannot promote ${requested}: ${reasons.join("; ")}.`);
    }
    return {
      mode: "strict",
      requestedLevel: requested,
      selectedLevel: requested,
      selectedCandidate: candidate,
      rejected: [],
      summary: `Selected ${candidateName(candidate)} (${requested}).`
    };
  }

  const rejected = [];
  for (const level of promotionOrder) {
    const candidate = byLevel.get(level);
    if (!candidate) continue;
    const reasons = getProductionPromotionRejectionReasons(
      candidate,
      productionBudgetBytes
    );
    if (reasons.length === 0) {
      return {
        mode: "auto",
        requestedLevel: "auto",
        selectedLevel: level,
        selectedCandidate: candidate,
        rejected,
        summary: [
          `Selected ${candidateName(candidate)} (${level}).`,
          rejected.length > 0
            ? `Rejected: ${rejected
                .map((entry) => `${candidateName(entry.candidate)}: ${entry.reasons.join("; ")}`)
                .join(" | ")}.`
            : ""
        ]
          .filter(Boolean)
          .join(" ")
      };
    }
    rejected.push({ candidate, reasons });
  }

  const rejectionSummary = describeRejections(candidates, productionBudgetBytes);
  throw new Error(
    `No production-safe USDZ candidate under ${formatPromotionSize(
      productionBudgetBytes
    )}. ${rejectionSummary}`
  );
}
