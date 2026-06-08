import {
  MENU_UI_THEME_IDS,
  validateMenuUiConfig,
  type MenuUiConfig,
  type MenuUiConfigStatus
} from "./menuUiConfig.ts";
import {
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  type MenuExperienceBlueprintId
} from "./menuExperienceBlueprints.ts";
import type { PublicMenu } from "./publicMenuCore.ts";

export type MenuDesignQualityStatus =
  | "excellent"
  | "ready"
  | "needs-review"
  | "blocked";

export type MenuDesignQualityResult = {
  score: number;
  status: MenuDesignQualityStatus;
  blockers: string[];
  warnings: string[];
  suggestions: string[];
};

export type MenuDesignQualityInput = {
  restaurant?: {
    id?: string;
    name?: string;
    slug?: string;
  } | null;
  menu?: PublicMenu | null;
  config: MenuUiConfig;
  publicMenuPath?: string;
  publicRouteOk?: boolean;
  qrTargetKind?: "menu" | "admin" | null;
  qrTargetPath?: string | null;
  configStatus?: MenuUiConfigStatus | "default" | null;
  publicOwnerWarningsExposed?: boolean;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb[0]) +
    0.7152 * channelLuminance(rgb[1]) +
    0.0722 * channelLuminance(rgb[2])
  );
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = luminance(hexA);
  const lumB = luminance(hexB);
  if (lumA === null || lumB === null) return 1;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isReadablePair(hexA: string, hexB: string, minRatio = 4.5): boolean {
  return contrastRatio(hexA, hexB) >= minRatio;
}

function publicPathIsSafe(path: string): boolean {
  return path === "/demo" || path.startsWith("/menu/");
}

function hasValidBlueprint(value: unknown): value is MenuExperienceBlueprintId {
  return (
    typeof value === "string" &&
    MENU_EXPERIENCE_BLUEPRINT_IDS.includes(value as MenuExperienceBlueprintId)
  );
}

function countCategories(menu: PublicMenu | null | undefined): number {
  return new Set((menu?.dishes ?? []).map((dish) => dish.category).filter(Boolean)).size;
}

function scoreFromDeductions(blockers: string[], warnings: string[]): number {
  return Math.max(0, Math.min(100, 100 - blockers.length * 16 - warnings.length * 4));
}

export function evaluateMenuDesignQuality(
  input: MenuDesignQualityInput
): MenuDesignQualityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const menu = input.menu;
  const dishes = menu?.dishes ?? [];
  const restaurantName = input.restaurant?.name?.trim() ?? "";
  const restaurantSlug = input.restaurant?.slug?.trim() ?? menu?.slug ?? "";
  const publicMenuPath = input.publicMenuPath?.trim() ?? "";
  const photoCount = dishes.filter((dish) => dish.hasPhoto).length;
  const modelCount = dishes.filter((dish) => dish.has3d).length;
  const arCount = dishes.filter((dish) => dish.hasAr).length;
  const categoryCount = countCategories(menu);
  const configValidation = validateMenuUiConfig(input.config);

  if (!input.restaurant?.id && !restaurantName && !restaurantSlug) {
    blockers.push("Restaurant absent.");
  }
  if (!publicMenuPath || !publicPathIsSafe(publicMenuPath)) {
    blockers.push("Public path invalide.");
  }
  if (input.publicRouteOk === false) {
    blockers.push("Public route impossible a verifier.");
  }
  if (dishes.length === 0) {
    blockers.push("Menu vide: aucun plat public disponible.");
  }
  if (categoryCount === 0) {
    blockers.push("Aucune categorie publique disponible.");
  }
  if (!configValidation.ok) {
    blockers.push(`Config UI unsafe: ${configValidation.error}`);
  }
  if (!MENU_UI_THEME_IDS.includes(input.config.theme)) {
    blockers.push("Theme invalide.");
  }
  if (!hasValidBlueprint(input.config.experience.blueprint)) {
    blockers.push("Blueprint invalide.");
  }
  if (input.config.immersive.autoLoad) {
    blockers.push("Immersive auto-load interdit pour GLB/USDZ/MP4.");
  }
  if (input.qrTargetKind === "admin" || (input.qrTargetPath ?? "").startsWith("/owner")) {
    blockers.push("QR admin interdit pour un menu public.");
  }
  if ((input.qrTargetPath ?? "").startsWith("/owner")) {
    blockers.push("Owner-only target expose pour un QR public.");
  }
  if (input.publicOwnerWarningsExposed) {
    blockers.push("Owner warning expose en public.");
  }
  if (
    restaurantSlug === "resto-marc" &&
    dishes.some((dish) => /elyse/i.test(`${dish.name} ${dish.description}`))
  ) {
    blockers.push("Maison Elyse detecte dans Resto Marc.");
  }

  if (input.configStatus !== "published") {
    warnings.push("Aucune config publiee confirmee pour ce restaurant.");
  }
  if (photoCount < dishes.length) {
    warnings.push(`Photos manquantes: ${photoCount}/${dishes.length}.`);
  }
  if (modelCount === 0) warnings.push("3D manquante pour tous les plats.");
  if (arCount === 0) warnings.push("AR manquante pour tous les plats.");
  if (
    input.config.experience.blueprint === "photo-grid" &&
    photoCount === 0
  ) {
    warnings.push("photo-grid avec 0 photo: choisir placeholder fort ou autre blueprint.");
    suggestions.push("Passer a story-first ou compact-qr si les photos ne sont pas pretes.");
  }
  if (
    input.config.experience.blueprint === "immersive-first" &&
    modelCount + arCount === 0
  ) {
    warnings.push("immersive-first sans plat 3D/AR disponible.");
    suggestions.push("Passer a editorial-magazine ou compact-qr jusqu'a la validation 3D/AR.");
  }
  if (
    dishes.length > 45 &&
    !["compact-qr", "fast-board"].includes(input.config.experience.blueprint)
  ) {
    warnings.push("Menu tres long sans structure compacte.");
    suggestions.push("Passer le blueprint a compact-qr ou fast-board.");
  }
  if (
    input.config.experience.blueprint === "compact-qr" &&
    input.config.welcomeEnabled
  ) {
    warnings.push("compact-qr avec welcome active: le scan devrait ouvrir le menu directement.");
    suggestions.push("Desactiver le welcome pour compact-qr.");
  }
  if (!isReadablePair(input.config.palette.text, input.config.palette.background)) {
    warnings.push("Contraste texte/background faible.");
  }
  if (!isReadablePair(input.config.palette.muted, input.config.palette.background, 3)) {
    warnings.push("Contraste muted/background faible.");
  }
  if (!isReadablePair(input.config.palette.text, input.config.palette.surface)) {
    warnings.push("Contraste texte/surface faible.");
  }
  if (
    input.config.cards.descriptionLength === "hidden" &&
    input.config.detail.dishOpenMode === "inline"
  ) {
    warnings.push("Descriptions masquees avec detail inline: risque de lecture trop faible.");
  }

  if (!input.config.immersive.posterUntilClick) {
    suggestions.push("Garder posterUntilClick actif pour les experiences 3D/AR.");
  }
  if (input.config.defaultView !== "all") {
    suggestions.push("Passer defaultView a all pour une premiere vue plus utile.");
  }
  if (input.config.photos.ownerMissingWarnings) {
    suggestions.push("Desactiver ownerMissingWarnings avant publication si le warning devient public.");
  }

  const cleanBlockers = unique(blockers);
  const cleanWarnings = unique(warnings);
  const cleanSuggestions = unique(suggestions);
  const score = scoreFromDeductions(cleanBlockers, cleanWarnings);
  const status: MenuDesignQualityStatus =
    cleanBlockers.length > 0
      ? "blocked"
      : score >= 90
        ? "excellent"
        : score >= 76
          ? "ready"
          : "needs-review";

  return {
    score,
    status,
    blockers: cleanBlockers,
    warnings: cleanWarnings,
    suggestions: cleanSuggestions
  };
}
