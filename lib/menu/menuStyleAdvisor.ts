import {
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  MENU_UI_THEME_IDS,
  normalizeMenuUiConfig,
  validateMenuUiConfig,
  type MenuUiConfig,
  type MenuUiThemeId
} from "./menuUiConfig.ts";
import type { MenuExperienceBlueprintId } from "./menuExperienceBlueprints.ts";

export type MenuStyleAdvisorInput = {
  restaurantId?: string;
  restaurantName?: string;
  restaurantSlug?: string;
  cuisineType?: string;
  location?: string;
  dishCount?: number;
  categories?: string[];
  sampleDishes?: string[];
  photoCount?: number;
  modelCount?: number;
  arCount?: number;
  currentConfig?: unknown;
};

export type MenuStyleAdvisorRecommendation = {
  source: "mistral" | "rules";
  recommendedTheme: MenuUiThemeId;
  recommendedBlueprint: MenuExperienceBlueprintId;
  recommendedConfigPatch: Pick<
    MenuUiConfig,
    | "theme"
    | "palette"
    | "navigation"
    | "cards"
    | "detail"
    | "photos"
    | "immersive"
    | "experience"
  >;
  reason: string;
  confidence: number;
  warnings: string[];
};

const TEXT_MAX = 240;
const WARNING_MAX = 160;
const MAX_LIST_ITEMS = 18;

const FORBIDDEN_GENERATED_KEYS = new Set([
  "dish",
  "dishes",
  "menuItems",
  "prices",
  "price",
  "ingredients",
  "allergens",
  "availability"
]);

function stringValue(value: unknown, max = TEXT_MAX): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function listValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const text = stringValue(item, 80);
      return text ? [text] : [];
    })
    .slice(0, MAX_LIST_ITEMS);
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function isTheme(value: unknown): value is MenuUiThemeId {
  return (
    typeof value === "string" &&
    MENU_UI_THEME_IDS.includes(value as MenuUiThemeId)
  );
}

function isBlueprint(value: unknown): value is MenuExperienceBlueprintId {
  return (
    typeof value === "string" &&
    MENU_EXPERIENCE_BLUEPRINT_IDS.includes(value as MenuExperienceBlueprintId)
  );
}

function clampConfidence(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function safeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const text = stringValue(item, WARNING_MAX);
      if (!text || /secret|token|api[_ -]?key|bearer/i.test(text)) return [];
      return [text];
    })
    .slice(0, 4);
}

function hasForbiddenGeneratedContent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenGeneratedContent);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_GENERATED_KEYS.has(key)) return true;
    if (hasForbiddenGeneratedContent(nested)) return true;
  }
  return false;
}

function pickPatch(config: MenuUiConfig): MenuStyleAdvisorRecommendation["recommendedConfigPatch"] {
  return {
    theme: config.theme,
    palette: config.palette,
    experience: config.experience,
    navigation: config.navigation,
    cards: config.cards,
    detail: config.detail,
    photos: config.photos,
    immersive: config.immersive
  };
}

export function sanitizeMenuStyleAdvisorInput(
  input: unknown
): Required<Omit<MenuStyleAdvisorInput, "currentConfig">> & {
  currentConfig: MenuUiConfig;
} {
  const candidate =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  return {
    restaurantId: stringValue(candidate.restaurantId, 80),
    restaurantName: stringValue(candidate.restaurantName, 120),
    restaurantSlug: stringValue(candidate.restaurantSlug, 100),
    cuisineType: stringValue(candidate.cuisineType, 80),
    location: stringValue(candidate.location, 120),
    dishCount: numberValue(candidate.dishCount),
    categories: listValue(candidate.categories),
    sampleDishes: listValue(candidate.sampleDishes).slice(0, 8),
    photoCount: numberValue(candidate.photoCount),
    modelCount: numberValue(candidate.modelCount),
    arCount: numberValue(candidate.arCount),
    currentConfig: normalizeMenuUiConfig(candidate.currentConfig)
  };
}

export function buildFallbackMenuStyleAdvice(
  rawInput: MenuStyleAdvisorInput
): MenuStyleAdvisorRecommendation {
  const input = sanitizeMenuStyleAdvisorInput(rawInput);
  const text = `${input.restaurantName} ${input.restaurantSlug} ${input.cuisineType} ${input.categories.join(" ")}`.toLowerCase();
  let theme: MenuUiThemeId = input.currentConfig.theme;
  let blueprint: MenuExperienceBlueprintId = "classic-tabs";
  let reason = "Conseil genere par regles locales selon les signaux menu disponibles.";

  if (input.modelCount > 0 || input.arCount > 0) {
    blueprint = "immersive-first";
    theme = includesAny(text, ["premium", "elyse", "gastronomic", "gastronomique"])
      ? "premium-gastronomic"
      : theme;
    reason = "Des plats 3D/AR existent, donc la structure met l'immersion en avant sans auto-load.";
  } else if (input.dishCount > 40) {
    blueprint = input.dishCount > 70 ? "compact-qr" : "fast-board";
    theme = includesAny(text, ["bowl", "fresh"]) ? "fast-fresh-bowls" : "street-casual";
    reason = "La carte est large, donc la lecture rapide et les prix visibles priment.";
  } else if (includesAny(text, ["sushi", "japan", "japon", "izakaya"])) {
    theme = "sushi-minimal";
    blueprint = "minimal-list";
    reason = "Le positionnement japonais gagne en sobriete, liste fine et detail route.";
  } else if (includesAny(text, ["cafe", "café", "brunch"])) {
    theme = "cafe-brunch";
    blueprint = input.photoCount > 4 ? "photo-grid" : "story-first";
    reason = "Le contexte cafe/brunch profite d'une experience photo ou narrative douce.";
  } else if (includesAny(text, ["bar", "lounge", "cocktail", "night"])) {
    theme = includesAny(text, ["night"]) ? "night-market" : "premium-gastronomic";
    blueprint = "lounge-cocktail";
    reason = "Le contexte bar/lounge met les boissons et sections compactes en premier.";
  } else if (includesAny(text, ["maison", "casual", "resto marc", "family", "famille"])) {
    theme = "fresh-homemade";
    blueprint = input.dishCount > 28 ? "story-first" : "family-comfort";
    reason = "La cuisine maison demande des blocs lisibles et une experience chaleureuse.";
  } else if (includesAny(text, ["premium", "elyse", "gastronomic", "gastronomique"])) {
    theme = "premium-gastronomic";
    blueprint = input.dishCount <= 18 ? "tasting-journey" : "editorial-magazine";
    reason = "Le positionnement premium merite une structure editoriale et guidee.";
  }

  const normalized = normalizeMenuUiConfig({
    ...input.currentConfig,
    theme,
    experience: { blueprint }
  });

  return {
    source: "rules",
    recommendedTheme: normalized.theme,
    recommendedBlueprint: normalized.experience.blueprint,
    recommendedConfigPatch: pickPatch(normalized),
    reason,
    confidence: input.dishCount || input.categories.length ? 0.72 : 0.55,
    warnings: [
      "Vistaire ne modifie pas les plats, prix, ingredients, allergenes, photos ou assets 3D."
    ]
  };
}

export function sanitizeMenuStyleAdvisorOutput(
  output: unknown,
  input: MenuStyleAdvisorInput
): MenuStyleAdvisorRecommendation {
  const fallback = buildFallbackMenuStyleAdvice(input);
  if (!output || typeof output !== "object" || Array.isArray(output)) return fallback;
  if (hasForbiddenGeneratedContent(output)) return fallback;

  const candidate = output as Record<string, unknown>;
  if (!isTheme(candidate.recommendedTheme)) return fallback;
  if (!isBlueprint(candidate.recommendedBlueprint)) return fallback;

  const patch =
    candidate.recommendedConfigPatch &&
    typeof candidate.recommendedConfigPatch === "object" &&
    !Array.isArray(candidate.recommendedConfigPatch)
      ? (candidate.recommendedConfigPatch as Record<string, unknown>)
      : {};
  if (hasForbiddenGeneratedContent(patch)) return fallback;

  const currentConfig = sanitizeMenuStyleAdvisorInput(input).currentConfig;
  const validated = validateMenuUiConfig({
    ...currentConfig,
    ...patch,
    theme: candidate.recommendedTheme,
    experience: {
      blueprint: candidate.recommendedBlueprint,
      ...(typeof patch.experience === "object" && patch.experience && !Array.isArray(patch.experience)
        ? patch.experience
        : {})
    }
  });

  if (!validated.ok) return fallback;

  return {
    source: "mistral",
    recommendedTheme: validated.value.theme,
    recommendedBlueprint: validated.value.experience.blueprint,
    recommendedConfigPatch: pickPatch(validated.value),
    reason: stringValue(candidate.reason, TEXT_MAX) || fallback.reason,
    confidence: clampConfidence(candidate.confidence, 0.65),
    warnings: safeWarnings(candidate.warnings)
  };
}
