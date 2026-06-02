// Precise OptimizeGLB browser-local retry guidance for failed candidates.
// Pure: no fs, no network. Returns concrete, numeric actions (never "try again").

const MB = 1000 * 1000;
const MiB = 1024 * 1024;

function mb(bytes) {
  return `${(bytes / MB).toFixed(1)} MB`;
}

function mib(bytes) {
  return `${(bytes / MiB).toFixed(1)} MiB`;
}

/**
 * Build a structured retry brief for a single candidate.
 * @returns {{ title: string, role: string, items: Array<{problem: string, fix: string}> }}
 */
export function buildCandidateRetryBrief(input) {
  const role = input.variantRole;
  const items = [];

  if (role === "web" && input.budgetStatus === "fail" && Number.isFinite(input.bytes)) {
    items.push({
      problem: `Web GLB is ${mb(input.bytes)} (budget fail above 12 MB).`,
      fix: "Re-run OptimizeGLB with the Web quality preset but texture 1024 and slightly stronger simplification."
    });
  }
  if (role === "mobile" && input.budgetStatus === "fail" && Number.isFinite(input.bytes)) {
    items.push({
      problem: `Mobile GLB is ${mb(input.bytes)} (budget fail above 8 MB).`,
      fix: "Re-run OptimizeGLB Mobile balanced with texture 1024 and simplifyRatio ~0.45."
    });
  }
  if (role === "arLite") {
    if (Number.isFinite(input.bytes) && input.bytes > 15 * MiB) {
      items.push({
        problem: `AR-lite is ${mib(input.bytes)} (hard fail above 15 MiB).`,
        fix: "Re-run OptimizeGLB with texture 512 and stronger simplification (AR-lite emergency preset)."
      });
    }
    if (Number.isFinite(input.triangleCount) && input.triangleCount > 150_000) {
      items.push({
        problem: `Triangle count is ${input.triangleCount.toLocaleString("en-US")} (hard fail above 150k).`,
        fix: "Create an emergency AR candidate closer to 50k-100k triangles (lower simplifyRatio)."
      });
    }
    if ((input.extensionsRequired?.length ?? 0) > 0) {
      items.push({
        problem: `AR-lite requires extensions: ${input.extensionsRequired.join(", ")}.`,
        fix: "Disable Draco/Meshopt in OptimizeGLB so AR-lite has no required extensions."
      });
    }
    if (input.groundedY === false) {
      items.push({
        problem: "Source is not grounded (min Y is not at the floor).",
        fix: "Run repair-source first or fix the origin in Blender before optimizing."
      });
    }
    if (input.centeredXZ === false) {
      items.push({
        problem: "Source is not centered on the XZ plane.",
        fix: "Re-center the model in Blender (or repair-source) before optimizing."
      });
    }
  }
  if ((input.externalUriCount ?? 0) > 0) {
    items.push({
      problem: `Candidate references ${input.externalUriCount} external URI(s).`,
      fix: "Export a self-contained GLB so all textures and buffers are embedded (no external URIs)."
    });
  }
  if (input.visualFailed) {
    items.push({
      problem: "Visual compare failed against the source within strict thresholds.",
      fix: "Use less simplification or a larger texture so the optimized candidate stays visually indistinguishable at dining distance."
    });
  }
  if (Number.isFinite(input.usdzBytes) && input.usdzBytes > 5 * MiB) {
    items.push({
      problem: `Generated USDZ is ${mib(input.usdzBytes)} (hard fail above 5 MiB).`,
      fix: "Use the iOS source preset with 512 textures and a lower-poly mesh, then re-upload."
    });
  }

  return {
    title: items.length > 0 ? `Retry brief for ${role} candidate` : `No blocking issues for ${role} candidate`,
    role,
    items
  };
}

export function buildSetRetryBrief(candidates) {
  return candidates
    .map((candidate) => buildCandidateRetryBrief(candidate))
    .filter((brief) => brief.items.length > 0);
}
