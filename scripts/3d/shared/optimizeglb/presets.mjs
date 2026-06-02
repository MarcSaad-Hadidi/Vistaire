// Shared OptimizeGLB browser-local presets and role/preset vocabulary.
//
// These are operator guidance for the manual OptimizeGLB browser-local step.
// Nothing here calls the OptimizeGLB API or performs any network request.

export const VARIANT_ROLES = Object.freeze([
  "web",
  "mobile",
  "arLite",
  "iosSource",
  "posterSource"
]);

export const REQUIRED_SET_ROLES = Object.freeze(["web", "mobile", "arLite"]);

export const PRESET_LABELS = Object.freeze([
  "optimizeglb-web-quality",
  "optimizeglb-mobile-balanced",
  "optimizeglb-ar-lite-aggressive",
  "optimizeglb-ar-lite-emergency",
  "optimizeglb-ios-source",
  "custom"
]);

export const OPTIMIZEGLB_PRESETS = Object.freeze({
  "optimizeglb-web-quality": {
    label: "Web quality",
    role: "web",
    textureFormat: "webp",
    textureSize: 2048,
    simplify: "light",
    simplifyRatio: 0.9,
    guidance: "Texture 2048, light simplification. Keep visual fidelity for desktop/web."
  },
  "optimizeglb-mobile-balanced": {
    label: "Mobile balanced",
    role: "mobile",
    textureFormat: "webp",
    textureSize: 1024,
    simplify: "medium",
    simplifyRatio: 0.55,
    guidance: "Texture 1024, medium simplification. Balance weight and fidelity for phones."
  },
  "optimizeglb-ar-lite-aggressive": {
    label: "AR-lite aggressive",
    role: "arLite",
    textureFormat: "webp",
    textureSize: 1024,
    simplify: "strong",
    simplifyRatio: 0.35,
    guidance: "Texture 512-1024, strong simplification, no required extensions."
  },
  "optimizeglb-ar-lite-emergency": {
    label: "AR-lite emergency",
    role: "arLite",
    textureFormat: "jpeg",
    textureSize: 512,
    simplify: "strongest",
    simplifyRatio: 0.2,
    guidance: "Texture 512, strongest acceptable simplification. Use when AR-lite is over budget."
  },
  "optimizeglb-ios-source": {
    label: "iOS source",
    role: "iosSource",
    textureFormat: "jpeg",
    textureSize: 1024,
    simplify: "strong",
    simplifyRatio: 0.3,
    guidance: "Texture 512-1024, no required extensions. Source for Vistaire USDZ generation."
  },
  custom: {
    label: "Custom",
    role: null,
    textureFormat: null,
    textureSize: null,
    simplify: null,
    simplifyRatio: null,
    guidance: "Operator-defined OptimizeGLB settings. Vistaire still validates the result."
  }
});

export function isValidVariantRole(role) {
  return VARIANT_ROLES.includes(role);
}

export function isValidPresetLabel(label) {
  return PRESET_LABELS.includes(label);
}

export function recommendedPresetsForRole(role) {
  return PRESET_LABELS.filter(
    (label) => label !== "custom" && OPTIMIZEGLB_PRESETS[label].role === role
  );
}

export function listRecommendedPresets() {
  return PRESET_LABELS.filter((label) => label !== "custom").map((label) => ({
    label,
    ...OPTIMIZEGLB_PRESETS[label]
  }));
}
