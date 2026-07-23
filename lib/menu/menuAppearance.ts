import {
  normalizePublicMenuStyle,
  type PublicMenuStyle,
  type PublicMenuThemeMode
} from "./publicMenuSettings.ts";
import {
  buildConfigFromTheme,
  type MenuUiPalette
} from "./menuThemePresets.ts";
import {
  normalizeMenuUiConfig,
  type MenuUiConfig
} from "./menuUiConfig.ts";

export type MenuAppearanceSelection = {
  template: PublicMenuStyle;
  presetId: string;
  primaryColor: string;
  secondaryColor: string;
  themeMode: PublicMenuThemeMode;
};

export type MenuAppearancePreset = {
  id: string;
  label: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  themeMode: PublicMenuThemeMode;
};

export const MENU_APPEARANCE_PRESETS: readonly MenuAppearancePreset[] = [
  {
    id: "noir-champagne",
    label: "Noir & champagne",
    description: "Sombre, chaleureux et très Vistaire.",
    primaryColor: "#e8cf9b",
    secondaryColor: "#c69252",
    themeMode: "dark"
  },
  {
    id: "espresso-creme",
    label: "Espresso & crème",
    description: "Un fond profond et des accents gourmands.",
    primaryColor: "#b9794e",
    secondaryColor: "#e8c9a7",
    themeMode: "dark"
  },
  {
    id: "bordeaux-ivoire",
    label: "Bordeaux & ivoire",
    description: "Éditorial, feutré et contrasté.",
    primaryColor: "#9c3047",
    secondaryColor: "#dfb57f",
    themeMode: "dark"
  },
  {
    id: "olive-beige",
    label: "Olive & beige",
    description: "Naturel, doux et lumineux.",
    primaryColor: "#70804a",
    secondaryColor: "#c6a56a",
    themeMode: "light"
  },
  {
    id: "bleu-nuit-argent",
    label: "Bleu nuit & argent",
    description: "Calme, contemporain et précis.",
    primaryColor: "#9fbad1",
    secondaryColor: "#4d6b86",
    themeMode: "dark"
  },
  {
    id: "terracotta-sable",
    label: "Terracotta & sable",
    description: "Une chaleur solaire sans surcharge.",
    primaryColor: "#b65f43",
    secondaryColor: "#d8b98b",
    themeMode: "light"
  },
  {
    id: "charbon-blanc-casse",
    label: "Charbon & blanc cassé",
    description: "Minimal et très lisible.",
    primaryColor: "#d9d0c2",
    secondaryColor: "#777068",
    themeMode: "dark"
  }
];

// Form-facing alias kept readable without coupling the wizard to the storage name.
export const MENU_STYLE_PRESETS = MENU_APPEARANCE_PRESETS;

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeHexColor(value: unknown, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (HEX_COLOR_PATTERN.test(candidate)) return candidate.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(candidate)) {
    return `#${candidate[1]}${candidate[1]}${candidate[2]}${candidate[2]}${candidate[3]}${candidate[3]}`.toLowerCase();
  }
  return fallback.toLowerCase();
}

function rgbFromHex(hex: string): [number, number, number] {
  const value = normalizeHexColor(hex, "#000000").slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hexFromRgb(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(first: string, second: string, weight: number): string {
  const a = rgbFromHex(first);
  const b = rgbFromHex(second);
  const ratio = Math.max(0, Math.min(1, weight));
  return hexFromRgb([
    a[0] + (b[0] - a[0]) * ratio,
    a[1] + (b[1] - a[1]) * ratio,
    a[2] + (b[2] - a[2]) * ratio
  ]);
}

function relativeLuminance(hex: string): number {
  return rgbFromHex(hex)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function ensureContrast(
  color: string,
  against: string,
  minimum: number
): { color: string; adjusted: boolean } {
  if (contrastRatio(color, against) >= minimum) return { color, adjusted: false };
  const target = relativeLuminance(against) > 0.5 ? "#000000" : "#ffffff";
  for (let step = 1; step <= 12; step += 1) {
    const candidate = mixHex(color, target, step / 14);
    if (contrastRatio(candidate, against) >= minimum) {
      return { color: candidate, adjusted: true };
    }
  }
  return { color: target, adjusted: true };
}

export function normalizeMenuAppearanceSelection(
  input: unknown,
  fallback: Partial<MenuAppearanceSelection> = {}
): MenuAppearanceSelection {
  const candidate = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  const preset = MENU_APPEARANCE_PRESETS.find((item) => item.id === candidate.presetId) ?? MENU_APPEARANCE_PRESETS[0];
  const template = normalizePublicMenuStyle(candidate.template ?? fallback.template);
  const primaryColor = normalizeHexColor(
    candidate.primaryColor ?? fallback.primaryColor,
    preset.primaryColor
  );
  const secondaryColor = normalizeHexColor(
    candidate.secondaryColor ?? fallback.secondaryColor,
    preset.secondaryColor
  );
  const themeMode = candidate.themeMode === "light" || fallback.themeMode === "light"
    ? "light"
    : "dark";
  return {
    template,
    presetId: typeof candidate.presetId === "string" && candidate.presetId.trim()
      ? candidate.presetId.trim().slice(0, 48)
      : preset.id,
    primaryColor,
    secondaryColor,
    themeMode
  };
}

export function buildAccessibleMenuPalette(selection: Pick<MenuAppearanceSelection, "primaryColor" | "secondaryColor" | "themeMode">): {
  palette: MenuUiPalette;
  warnings: string[];
} {
  const isDark = selection.themeMode === "dark";
  const primary = normalizeHexColor(selection.primaryColor, "#e8cf9b");
  const secondary = normalizeHexColor(selection.secondaryColor, "#c69252");
  const backgroundBase = isDark ? "#0d0a08" : "#fbf7ef";
  const surfaceBase = isDark ? "#1a1310" : "#fffdf9";
  const background = isDark
    ? mixHex(backgroundBase, primary, 0.16)
    : mixHex(backgroundBase, secondary, 0.08);
  const surface = isDark
    ? mixHex(surfaceBase, primary, 0.12)
    : mixHex(surfaceBase, secondary, 0.08);
  const text = isDark ? "#fff7ea" : "#211912";
  const mutedBase = isDark ? "#c7b9a8" : "#62574d";
  const border = mixHex(background, secondary, isDark ? 0.34 : 0.24);
  const accentResult = ensureContrast(
    primary,
    text,
    3
  );
  const accent2Result = ensureContrast(
    secondary,
    text,
    3
  );
  const mutedResult = ensureContrast(mutedBase, background, 4.5);
  const warnings: string[] = [];
  if (accentResult.adjusted || accent2Result.adjusted) {
    warnings.push("Les accents ont été légèrement ajustés pour rester lisibles sur le fond choisi.");
  }
  if (contrastRatio(text, background) < 4.5 || contrastRatio(text, surface) < 4.5) {
    warnings.push("La palette utilise un texte de secours contrasté pour respecter WCAG AA.");
  }

  return {
    palette: {
      background,
      surface,
      text,
      muted: mutedResult.color,
      accent: accentResult.color,
      accent2: accent2Result.color,
      accent3: mixHex(accentResult.color, accent2Result.color, 0.5),
      border,
      success: isDark ? "#9bcaa2" : "#2f7b54",
      warning: isDark ? "#f0c56a" : "#8a5a00",
      danger: isDark ? "#f09a8e" : "#a53f39"
    },
    warnings
  };
}

export function buildMenuUiConfigForRestaurant(args: {
  name: string;
  slug: string;
  appearance: MenuAppearanceSelection;
  publicMenuSettings?: Record<string, unknown>;
}): MenuUiConfig & { publicMenuSettings?: Record<string, unknown>; menuAppearance: MenuAppearanceSelection } {
  const theme = args.appearance.template === "trouvable"
    ? "premium-gastronomic"
    : "fresh-homemade";
  const base = buildConfigFromTheme(theme, { name: args.name, slug: args.slug });
  const palette = buildAccessibleMenuPalette(args.appearance).palette;
  const config = normalizeMenuUiConfig({
    ...base,
    custom: true,
    palette,
    global: {
      ...base.global,
      backgroundStyle: args.appearance.themeMode === "dark" ? "dark" : "editorial"
    },
    experience: {
      ...base.experience,
      blueprint: args.appearance.template === "trouvable" ? "immersive-first" : "editorial-magazine"
    },
    welcomeTitle: `Bienvenue chez ${args.name}`,
    welcomeSubtitle: args.appearance.template === "trouvable"
      ? "Une carte immersive pensée pour le service à table."
      : "Une carte éditoriale pensée pour votre salle."
  });
  return {
    ...config,
    ...(args.publicMenuSettings ? { publicMenuSettings: args.publicMenuSettings } : {}),
    menuAppearance: args.appearance
  };
}
