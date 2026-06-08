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

type MenuStyleAdvisorConfigPatch = Pick<
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

export type MenuStyleAdvisorProposal = {
  source: "mistral" | "rules";
  theme: MenuUiThemeId;
  blueprint: MenuExperienceBlueprintId;
  configPatch: MenuStyleAdvisorConfigPatch;
  reason: string;
  confidence: number;
  warnings: string[];
  bestFor?: string;
};

export type MenuStyleAdvisorAnalysis = {
  restaurantType: string;
  dataSignals: string[];
  photoReadiness: "none" | "low" | "partial" | "good";
  immersiveReadiness: "none" | "partial" | "ready";
  menuSize: number;
  recommendedDirection: string;
};

export type MenuStyleAdvisorRecommendation = {
  source: "mistral" | "rules";
  primary: MenuStyleAdvisorProposal;
  alternatives: MenuStyleAdvisorProposal[];
  analysis: MenuStyleAdvisorAnalysis;
  recommendedTheme: MenuUiThemeId;
  recommendedBlueprint: MenuExperienceBlueprintId;
  recommendedConfigPatch: MenuStyleAdvisorConfigPatch;
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
  "item",
  "items",
  "menuitem",
  "menuItems",
  "menuitems",
  "generatedmenu",
  "generateddishes",
  "prices",
  "price",
  "ingredient",
  "ingredients",
  "allergen",
  "allergens",
  "availability",
  "photourl",
  "modelurl",
  "description"
]);
const SECRET_VALUE_PATTERN =
  /(sk_live_|sk_test_|service_role|bearer\s+[a-z0-9._-]{12,}|eyJ[a-z0-9_-]{12,})/i;

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
  if (typeof value === "string") return SECRET_VALUE_PATTERN.test(value);
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenGeneratedContent);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (FORBIDDEN_GENERATED_KEYS.has(normalizedKey)) return true;
    if (hasForbiddenGeneratedContent(nested)) return true;
  }
  return false;
}

function pickPatch(config: MenuUiConfig): MenuStyleAdvisorConfigPatch {
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

function photoReadiness(input: ReturnType<typeof sanitizeMenuStyleAdvisorInput>): MenuStyleAdvisorAnalysis["photoReadiness"] {
  if (input.photoCount === 0) return "none";
  if (!input.dishCount) return "partial";
  const ratio = input.photoCount / input.dishCount;
  if (ratio >= 0.5) return "good";
  if (ratio >= 0.2) return "partial";
  return "low";
}

function immersiveReadiness(input: ReturnType<typeof sanitizeMenuStyleAdvisorInput>): MenuStyleAdvisorAnalysis["immersiveReadiness"] {
  const count = input.modelCount + input.arCount;
  if (count === 0) return "none";
  return count >= 2 ? "ready" : "partial";
}

function classifyRestaurant(text: string): string {
  if (includesAny(text, ["sushi", "japan", "japon", "izakaya"])) return "sushi";
  if (includesAny(text, ["cafe", "café", "cafÃ©", "brunch"])) return "cafe-brunch";
  if (includesAny(text, ["bar", "lounge", "cocktail", "night"])) return "bar-lounge";
  if (includesAny(text, ["premium", "elyse", "gastronomic", "gastronomique"])) return "premium";
  if (includesAny(text, ["maison", "resto marc", "family", "famille"])) return "maison";
  return "general";
}

function proposalFromChoice(args: {
  source: "mistral" | "rules";
  input: ReturnType<typeof sanitizeMenuStyleAdvisorInput>;
  theme: MenuUiThemeId;
  blueprint: MenuExperienceBlueprintId;
  reason: string;
  confidence: number;
  warnings?: string[];
  bestFor?: string;
  patch?: Record<string, unknown>;
}): MenuStyleAdvisorProposal {
  const patch = args.patch ?? {};
  const patchExperience =
    patch.experience && typeof patch.experience === "object" && !Array.isArray(patch.experience)
      ? (patch.experience as Record<string, unknown>)
      : {};
  const normalized = normalizeMenuUiConfig({
    ...args.input.currentConfig,
    ...patch,
    theme: args.theme,
    experience: {
      ...patchExperience,
      blueprint: args.blueprint
    }
  });

  return {
    source: args.source,
    theme: normalized.theme,
    blueprint: normalized.experience.blueprint,
    configPatch: pickPatch(normalized),
    reason: stringValue(args.reason, TEXT_MAX),
    confidence: clampConfidence(args.confidence, 0.65),
    warnings: (args.warnings ?? []).slice(0, 4),
    bestFor: args.bestFor ? stringValue(args.bestFor, 120) : undefined
  };
}

function recommendationFromParts(args: {
  source: "mistral" | "rules";
  primary: MenuStyleAdvisorProposal;
  alternatives: MenuStyleAdvisorProposal[];
  analysis: MenuStyleAdvisorAnalysis;
}): MenuStyleAdvisorRecommendation {
  return {
    source: args.source,
    primary: args.primary,
    alternatives: args.alternatives.slice(0, 3),
    analysis: args.analysis,
    recommendedTheme: args.primary.theme,
    recommendedBlueprint: args.primary.blueprint,
    recommendedConfigPatch: args.primary.configPatch,
    reason: args.primary.reason,
    confidence: args.primary.confidence,
    warnings: args.primary.warnings
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

  const warnings = [
    "Vistaire ne modifie pas les plats, prix, ingredients, allergenes, photos ou assets 3D."
  ];
  if (blueprint === "photo-grid" && input.photoCount === 0) {
    warnings.push("Peu ou pas de photos: photo-grid peut perdre en impact.");
  }
  if (blueprint === "immersive-first" && input.modelCount + input.arCount === 0) {
    warnings.push("Aucun plat 3D/AR disponible pour immersive-first.");
  }

  const primary = proposalFromChoice({
    source: "rules",
    input,
    theme,
    blueprint,
    reason,
    confidence: input.dishCount || input.categories.length ? 0.72 : 0.55,
    warnings
  });

  const fallbackChoices: Array<{
    theme: MenuUiThemeId;
    blueprint: MenuExperienceBlueprintId;
    reason: string;
    confidence: number;
    bestFor: string;
  }> = [
    {
      theme: input.photoCount > Math.max(3, input.dishCount / 3) ? "cafe-brunch" : "fresh-homemade",
      blueprint: input.photoCount > 3 ? "photo-grid" : "story-first",
      reason: "Option plus chaleureuse pour valoriser les plats disponibles sans inventer de contenu.",
      confidence: 0.64,
      bestFor: "Menu chaleureux avec photos ou narration"
    },
    {
      theme: input.dishCount > 35 ? "street-casual" : "minimal-clean",
      blueprint: input.dishCount > 35 ? "compact-qr" : "minimal-list",
      reason: "Option plus rapide et lisible pour consultation QR.",
      confidence: 0.61,
      bestFor: "Lecture rapide apres scan QR"
    },
    {
      theme: input.modelCount + input.arCount > 0 ? "premium-gastronomic" : "mediterranean-fresh",
      blueprint: input.modelCount + input.arCount > 0 ? "immersive-first" : "bento-showcase",
      reason: "Option plus distinctive pour comparer une direction visuelle forte.",
      confidence: 0.58,
      bestFor: "Exploration visuelle differenciante"
    }
  ];

  const alternatives = fallbackChoices
    .filter((choice) => choice.theme !== primary.theme || choice.blueprint !== primary.blueprint)
    .map((choice) =>
      proposalFromChoice({
        source: "rules",
        input,
        theme: choice.theme,
        blueprint: choice.blueprint,
        reason: choice.reason,
        confidence: choice.confidence,
        warnings,
        bestFor: choice.bestFor
      })
    )
    .slice(0, 3);

  while (alternatives.length < 2) {
    alternatives.push(
      proposalFromChoice({
        source: "rules",
        input,
        theme: "fresh-homemade",
        blueprint: alternatives.length === 0 ? "classic-tabs" : "compact-qr",
        reason: "Option de secours stable pour comparer une structure simple.",
        confidence: 0.52,
        warnings,
        bestFor: "Fallback stable"
      })
    );
  }

  const restaurantType = classifyRestaurant(text);
  const analysis: MenuStyleAdvisorAnalysis = {
    restaurantType,
    dataSignals: [
      input.categories.length ? `${input.categories.length} categories` : "",
      input.dishCount ? `${input.dishCount} plats` : "",
      input.photoCount ? `${input.photoCount} photos` : "",
      input.modelCount + input.arCount ? `${input.modelCount + input.arCount} assets immersifs` : ""
    ].filter(Boolean),
    photoReadiness: photoReadiness(input),
    immersiveReadiness: immersiveReadiness(input),
    menuSize: input.dishCount,
    recommendedDirection: reason
  };

  return recommendationFromParts({
    source: "rules",
    primary,
    alternatives,
    analysis
  });
}

function candidateRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function proposalFromOutput(
  value: unknown,
  input: ReturnType<typeof sanitizeMenuStyleAdvisorInput>,
  fallback: MenuStyleAdvisorRecommendation,
  source: "mistral" | "rules"
): MenuStyleAdvisorProposal | null {
  const candidate = candidateRecord(value);
  const legacy = "recommendedTheme" in candidate || "recommendedBlueprint" in candidate;
  const theme = legacy ? candidate.recommendedTheme : candidate.theme;
  const blueprint = legacy ? candidate.recommendedBlueprint : candidate.blueprint;
  if (!isTheme(theme) || !isBlueprint(blueprint)) return null;

  const patchValue = legacy ? candidate.recommendedConfigPatch : candidate.configPatch;
  const patch = candidateRecord(patchValue);
  if (hasForbiddenGeneratedContent(patch)) return null;

  const validated = validateMenuUiConfig({
    ...input.currentConfig,
    ...patch,
    theme,
    experience: {
      ...(candidateRecord(patch.experience)),
      blueprint
    }
  });
  if (!validated.ok) return null;

  const proposal = proposalFromChoice({
    source,
    input,
    theme,
    blueprint,
    reason: stringValue(candidate.reason, TEXT_MAX) || fallback.reason,
    confidence: clampConfidence(candidate.confidence, 0.65),
    warnings: safeWarnings(candidate.warnings),
    bestFor: stringValue(candidate.bestFor, 120),
    patch
  });

  return proposal;
}

export function sanitizeMenuStyleAdvisorOutput(
  output: unknown,
  input: MenuStyleAdvisorInput
): MenuStyleAdvisorRecommendation {
  const fallback = buildFallbackMenuStyleAdvice(input);
  if (!output || typeof output !== "object" || Array.isArray(output)) return fallback;
  if (hasForbiddenGeneratedContent(output)) return fallback;

  const candidate = output as Record<string, unknown>;
  const sanitizedInput = sanitizeMenuStyleAdvisorInput(input);
  const primaryInput = "primary" in candidate ? candidate.primary : candidate;
  const primary = proposalFromOutput(primaryInput, sanitizedInput, fallback, "mistral");
  if (!primary) return fallback;

  const rawAlternatives = Array.isArray(candidate.alternatives)
    ? candidate.alternatives
    : [];
  const alternatives = rawAlternatives
    .flatMap((item) => {
      if (hasForbiddenGeneratedContent(item)) return [];
      const proposal = proposalFromOutput(item, sanitizedInput, fallback, "mistral");
      return proposal ? [proposal] : [];
    })
    .filter((item) => item.theme !== primary.theme || item.blueprint !== primary.blueprint)
    .slice(0, 3);
  const analysisCandidate = candidateRecord(candidate.analysis);
  const analysis: MenuStyleAdvisorAnalysis = {
    restaurantType:
      stringValue(analysisCandidate.restaurantType, 80) ||
      fallback.analysis.restaurantType,
    dataSignals: listValue(analysisCandidate.dataSignals),
    photoReadiness: ["none", "low", "partial", "good"].includes(
      String(analysisCandidate.photoReadiness)
    )
      ? (analysisCandidate.photoReadiness as MenuStyleAdvisorAnalysis["photoReadiness"])
      : fallback.analysis.photoReadiness,
    immersiveReadiness: ["none", "partial", "ready"].includes(
      String(analysisCandidate.immersiveReadiness)
    )
      ? (analysisCandidate.immersiveReadiness as MenuStyleAdvisorAnalysis["immersiveReadiness"])
      : fallback.analysis.immersiveReadiness,
    menuSize: numberValue(analysisCandidate.menuSize) || fallback.analysis.menuSize,
    recommendedDirection:
      stringValue(analysisCandidate.recommendedDirection, TEXT_MAX) ||
      primary.reason
  };

  return recommendationFromParts({
    source: "mistral",
    primary,
    alternatives: alternatives.length ? alternatives : fallback.alternatives,
    analysis
  });
}
