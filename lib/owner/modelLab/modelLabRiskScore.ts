import type { ModelLabInspectionReport } from "@/lib/owner/modelLab/inspectGlb";
import type { ModelLabPreset } from "@/lib/owner/modelLab/modelLabPresets";

export type ModelLabRiskAssessment = {
  score: number;
  label: "low" | "medium" | "high";
  targetBytes: number | null;
  targetLabel: string;
  targetPass: boolean | null;
  reductionPercent: number | null;
  triangleReductionPercent: number | null;
  reasons: string[];
};

function percentReduction(before: number, after: number): number {
  return Math.round((1 - after / Math.max(before, 1)) * 1000) / 10;
}

function riskLabel(score: number): ModelLabRiskAssessment["label"] {
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function clampRisk(score: number): number {
  return Math.max(1, Math.min(5, score));
}

export function assessModelLabCandidate(args: {
  source: ModelLabInspectionReport | null;
  candidate: ModelLabInspectionReport | null;
  preset: ModelLabPreset;
}): ModelLabRiskAssessment {
  const { source, candidate, preset } = args;
  const reasons: string[] = [];
  let score = preset.visualRisk;

  if (!candidate) {
    return {
      score,
      label: riskLabel(score),
      targetBytes: preset.targetBytes,
      targetLabel: preset.targetLabel,
      targetPass: null,
      reductionPercent: null,
      triangleReductionPercent: null,
      reasons: ["Generez le candidat pour calculer le risque."]
    };
  }

  const targetPass =
    preset.targetBytes === null ? null : candidate.bytes <= preset.targetBytes;
  if (preset.targetBytes !== null && !targetPass) {
    score += 1;
    reasons.push(
      `Poids au-dessus de la cible ${preset.targetLabel}: ${formatBytes(candidate.bytes)}.`
    );
  }

  const reductionPercent = source
    ? percentReduction(source.bytes, candidate.bytes)
    : null;
  if (reductionPercent !== null && reductionPercent < 35 && preset.id !== "source-clean") {
    score += 1;
    reasons.push(`Reduction poids limitee (${reductionPercent}%).`);
  }

  const triangleReductionPercent = source
    ? percentReduction(source.triangles, candidate.triangles)
    : null;
  if (triangleReductionPercent !== null && triangleReductionPercent > 55) {
    score += 1;
    reasons.push(`Reduction triangles forte (${triangleReductionPercent}%).`);
  }

  if (candidate.maxTextureSize !== null) {
    if (candidate.maxTextureSize <= 768) {
      score += 2;
      reasons.push("Textures finales <= 768 px: revue close-up obligatoire.");
    } else if (candidate.maxTextureSize <= 1024) {
      score += 1;
      reasons.push("Textures finales <= 1024 px: verifier le rendu du plat de proche.");
    }
  }

  if (source?.maxTextureSize && candidate.maxTextureSize) {
    const downscaleRatio = candidate.maxTextureSize / Math.max(source.maxTextureSize, 1);
    if (downscaleRatio < 0.5) {
      score += 1;
      reasons.push("Texture downscale > 50% vs source.");
    }
  }

  if (candidate.extensionsRequired.length > 0) {
    score += preset.requiresNoRequiredExtensions ? 2 : 1;
    reasons.push(`Extensions requises: ${candidate.extensionsRequired.join(", ")}.`);
  }

  if (source && source.externalUris.length > 0) {
    score += 1;
    reasons.push("La source reference des URI externes; Model Lab refuse l'optimisation stockage.");
  }

  if (source && (source.triangles > 1_000_000 || source.totalTexturePixels > 180_000_000)) {
    score += 1;
    reasons.push("Source complexe: la compression serverless peut rester au-dessus de la cible.");
  }

  if (preset.isRisky) {
    reasons.push("Preset marque high risk: validation visuelle obligatoire avant usage.");
  }

  if (reasons.length === 0) {
    reasons.push("Aucun signal bloquant detecte; la revue visuelle reste obligatoire.");
  }

  const finalScore = clampRisk(score);
  return {
    score: finalScore,
    label: riskLabel(finalScore),
    targetBytes: preset.targetBytes,
    targetLabel: preset.targetLabel,
    targetPass,
    reductionPercent,
    triangleReductionPercent,
    reasons
  };
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
