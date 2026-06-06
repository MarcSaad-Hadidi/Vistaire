export const MENU_UI_THEME_IDS = [
  "fresh-homemade",
  "premium-gastronomic",
  "street-casual",
  "cafe-brunch",
  "minimal-clean"
] as const;

export type MenuUiThemeId = (typeof MENU_UI_THEME_IDS)[number];

export const MENU_UI_STATUS_VALUES = ["draft", "published", "archived"] as const;

export type MenuUiConfigStatus = (typeof MENU_UI_STATUS_VALUES)[number];

export const MENU_UI_MOTION_VALUES = ["none", "soft", "expressive"] as const;
export const MENU_UI_DEFAULT_VIEW_VALUES = ["all", "categories"] as const;
export const MENU_UI_CATEGORY_NAVIGATION_VALUES = [
  "tabs",
  "cards",
  "tabs-cards"
] as const;
export const MENU_UI_DISH_CARD_STYLE_VALUES = [
  "compact",
  "photo-compact",
  "photo-large",
  "minimal-list"
] as const;
export const MENU_UI_DETAIL_STYLE_VALUES = [
  "bottom-sheet",
  "full-card",
  "simple-card"
] as const;
export const MENU_UI_DENSITY_VALUES = [
  "compact",
  "comfortable",
  "expressive"
] as const;

export type MenuUiMotion = (typeof MENU_UI_MOTION_VALUES)[number];
export type MenuUiDefaultView = (typeof MENU_UI_DEFAULT_VIEW_VALUES)[number];
export type MenuUiCategoryNavigation =
  (typeof MENU_UI_CATEGORY_NAVIGATION_VALUES)[number];
export type MenuUiDishCardStyle =
  (typeof MENU_UI_DISH_CARD_STYLE_VALUES)[number];
export type MenuUiDetailStyle = (typeof MENU_UI_DETAIL_STYLE_VALUES)[number];
export type MenuUiDensity = (typeof MENU_UI_DENSITY_VALUES)[number];

export type MenuUiConfig = {
  theme: MenuUiThemeId;
  welcomeEnabled: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  motion: MenuUiMotion;
  defaultView: MenuUiDefaultView;
  categoryNavigation: MenuUiCategoryNavigation;
  dishCardStyle: MenuUiDishCardStyle;
  detailStyle: MenuUiDetailStyle;
  density: MenuUiDensity;
  showPhotoPlaceholders: boolean;
  show3dBadges: boolean;
  showArBadges: boolean;
  updatedAt: string;
};

export type MenuUiConfigRow = Record<string, unknown>;

export type MenuUiConfigRecord = {
  id: string;
  restaurantId: string;
  status: MenuUiConfigStatus;
  config: MenuUiConfig;
  persisted: boolean;
  dataSource: "supabase" | "default";
  updatedAt: string;
};

const WELCOME_TITLE_MAX = 120;
const WELCOME_SUBTITLE_MAX = 180;

export const DEFAULT_MENU_UI_CONFIG: MenuUiConfig = {
  theme: "fresh-homemade",
  welcomeEnabled: true,
  welcomeTitle: "Bienvenue chez le restaurant",
  welcomeSubtitle: "Cuisine maison fraiche et genereuse",
  motion: "soft",
  defaultView: "all",
  categoryNavigation: "tabs-cards",
  dishCardStyle: "photo-compact",
  detailStyle: "bottom-sheet",
  density: "comfortable",
  showPhotoPlaceholders: true,
  show3dBadges: true,
  showArBadges: true,
  updatedAt: ""
};

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function cleanText(value: unknown, fallback: string, max: number): string {
  const raw = typeof value === "string" ? value : fallback;
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
}

function objectInput(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

export function isMenuUiThemeId(value: unknown): value is MenuUiThemeId {
  return includesValue(MENU_UI_THEME_IDS, value);
}

export function isMenuUiConfigStatus(
  value: unknown
): value is MenuUiConfigStatus {
  return includesValue(MENU_UI_STATUS_VALUES, value);
}

export function menuUiConfigForRestaurant(args: {
  name?: string;
  slug?: string;
}): MenuUiConfig {
  const name = args.name?.trim() || "le restaurant";
  const slug = args.slug?.trim().toLowerCase() || "";
  const premium = slug === "maison-elyse" || name.toLowerCase().includes("elyse");

  return {
    ...DEFAULT_MENU_UI_CONFIG,
    theme: premium ? "premium-gastronomic" : "fresh-homemade",
    welcomeTitle: `Bienvenue chez ${name}`,
    welcomeSubtitle: premium
      ? "Une carte gastronomique a explorer a table"
      : "Cuisine maison fraiche et genereuse"
  };
}

export function normalizeMenuUiConfig(input: unknown): MenuUiConfig {
  const candidate = objectInput(input);
  const base = {
    ...DEFAULT_MENU_UI_CONFIG,
    ...("theme" in candidate && isMenuUiThemeId(candidate.theme)
      ? { theme: candidate.theme }
      : {})
  };

  return {
    theme: includesValue(MENU_UI_THEME_IDS, candidate.theme)
      ? candidate.theme
      : base.theme,
    welcomeEnabled: cleanBoolean(
      candidate.welcomeEnabled,
      base.welcomeEnabled
    ),
    welcomeTitle: cleanText(
      candidate.welcomeTitle,
      base.welcomeTitle,
      WELCOME_TITLE_MAX
    ),
    welcomeSubtitle: cleanText(
      candidate.welcomeSubtitle,
      base.welcomeSubtitle,
      WELCOME_SUBTITLE_MAX
    ),
    motion: includesValue(MENU_UI_MOTION_VALUES, candidate.motion)
      ? candidate.motion
      : base.motion,
    defaultView: includesValue(
      MENU_UI_DEFAULT_VIEW_VALUES,
      candidate.defaultView
    )
      ? candidate.defaultView
      : base.defaultView,
    categoryNavigation: includesValue(
      MENU_UI_CATEGORY_NAVIGATION_VALUES,
      candidate.categoryNavigation
    )
      ? candidate.categoryNavigation
      : base.categoryNavigation,
    dishCardStyle: includesValue(
      MENU_UI_DISH_CARD_STYLE_VALUES,
      candidate.dishCardStyle
    )
      ? candidate.dishCardStyle
      : base.dishCardStyle,
    detailStyle: includesValue(MENU_UI_DETAIL_STYLE_VALUES, candidate.detailStyle)
      ? candidate.detailStyle
      : base.detailStyle,
    density: includesValue(MENU_UI_DENSITY_VALUES, candidate.density)
      ? candidate.density
      : base.density,
    showPhotoPlaceholders: cleanBoolean(
      candidate.showPhotoPlaceholders,
      base.showPhotoPlaceholders
    ),
    show3dBadges: cleanBoolean(candidate.show3dBadges, base.show3dBadges),
    showArBadges: cleanBoolean(candidate.showArBadges, base.showArBadges),
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt.trim().slice(0, 40)
        : new Date().toISOString()
  };
}

function invalidWhitelistMessage(
  input: Record<string, unknown>
): string | null {
  const checks: Array<[string, readonly string[]]> = [
    ["theme", MENU_UI_THEME_IDS],
    ["motion", MENU_UI_MOTION_VALUES],
    ["defaultView", MENU_UI_DEFAULT_VIEW_VALUES],
    ["categoryNavigation", MENU_UI_CATEGORY_NAVIGATION_VALUES],
    ["dishCardStyle", MENU_UI_DISH_CARD_STYLE_VALUES],
    ["detailStyle", MENU_UI_DETAIL_STYLE_VALUES],
    ["density", MENU_UI_DENSITY_VALUES]
  ];

  for (const [key, values] of checks) {
    if (key in input && !includesValue(values, input[key])) {
      return `Invalid menu UI ${key}.`;
    }
  }
  return null;
}

export function validateMenuUiConfig(
  input: unknown
): { ok: true; value: MenuUiConfig } | { ok: false; error: string } {
  const candidate = objectInput(input);
  const whitelistError = invalidWhitelistMessage(candidate);
  if (whitelistError) return { ok: false, error: whitelistError };

  return { ok: true, value: normalizeMenuUiConfig(candidate) };
}

export function serializeMenuUiConfig(config: MenuUiConfig): MenuUiConfig {
  return normalizeMenuUiConfig(config);
}

function getString(row: MenuUiConfigRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

export function mapMenuUiConfigRow(
  row: MenuUiConfigRow,
  fallbackConfig: MenuUiConfig = DEFAULT_MENU_UI_CONFIG
): MenuUiConfigRecord {
  const rawConfig =
    row.config_json && typeof row.config_json === "object"
      ? row.config_json
      : {};
  const theme = getString(row, ["theme"], fallbackConfig.theme);
  const config = normalizeMenuUiConfig({
    ...fallbackConfig,
    ...(rawConfig as Record<string, unknown>),
    theme,
    updatedAt: getString(row, ["updated_at", "updatedAt"], "")
  });

  return {
    id: getString(row, ["id"], ""),
    restaurantId: getString(row, ["restaurant_id", "restaurantId"], ""),
    status: isMenuUiConfigStatus(row.status) ? row.status : "draft",
    config,
    persisted: true,
    dataSource: "supabase",
    updatedAt: getString(row, ["updated_at", "updatedAt"], config.updatedAt)
  };
}

export function defaultMenuUiConfigRecord(args: {
  restaurantId?: string;
  config?: MenuUiConfig;
} = {}): MenuUiConfigRecord {
  const config = normalizeMenuUiConfig(args.config ?? DEFAULT_MENU_UI_CONFIG);
  return {
    id: "",
    restaurantId: args.restaurantId ?? "",
    status: "draft",
    config,
    persisted: false,
    dataSource: "default",
    updatedAt: config.updatedAt
  };
}

