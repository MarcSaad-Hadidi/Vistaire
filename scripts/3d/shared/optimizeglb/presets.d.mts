export type VariantRole =
  | "web"
  | "mobile"
  | "arLite"
  | "iosSource"
  | "posterSource";

export type PresetLabel =
  | "optimizeglb-web-quality"
  | "optimizeglb-mobile-balanced"
  | "optimizeglb-ar-lite-aggressive"
  | "optimizeglb-ar-lite-emergency"
  | "optimizeglb-ios-source"
  | "custom";

export type OptimizeGlbPreset = {
  label: string;
  role: VariantRole | null;
  textureFormat: string | null;
  textureSize: number | null;
  simplify: string | null;
  simplifyRatio: number | null;
  guidance: string;
};

export const VARIANT_ROLES: readonly VariantRole[];
export const REQUIRED_SET_ROLES: readonly VariantRole[];
export const PRESET_LABELS: readonly PresetLabel[];
export const OPTIMIZEGLB_PRESETS: Readonly<Record<PresetLabel, OptimizeGlbPreset>>;

export function isValidVariantRole(role: unknown): role is VariantRole;
export function isValidPresetLabel(label: unknown): label is PresetLabel;
export function recommendedPresetsForRole(role: VariantRole): PresetLabel[];
export function listRecommendedPresets(): Array<OptimizeGlbPreset & { label: PresetLabel }>;
