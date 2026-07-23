import {
  MENU_THEME_IDS,
  buildConfigFromTheme,
  MAISON_ELYSE_PALETTE
} from "./menuThemePresets.ts";
import {
  MENU_CATEGORY_PRESENTATION_VALUES,
  MENU_DETAIL_PRESENTATION_VALUES,
  MENU_DISH_LIST_PRESENTATION_VALUES,
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  MENU_FEATURED_MODE_VALUES,
  MENU_HOME_LAYOUT_VALUES,
  MENU_SECTION_ORDER_VALUES,
  getMenuExperienceBlueprint,
  type MenuCategoryPresentation,
  type MenuDetailPresentation,
  type MenuDishListPresentation,
  type MenuExperienceBlueprintId,
  type MenuFeaturedMode,
  type MenuHomeLayout,
  type MenuSectionOrder
} from "./menuExperienceBlueprints.ts";

export {
  MENU_CATEGORY_PRESENTATION_VALUES,
  MENU_DETAIL_PRESENTATION_VALUES,
  MENU_DISH_LIST_PRESENTATION_VALUES,
  MENU_EXPERIENCE_BLUEPRINT_IDS,
  MENU_FEATURED_MODE_VALUES,
  MENU_HOME_LAYOUT_VALUES,
  MENU_SECTION_ORDER_VALUES
} from "./menuExperienceBlueprints.ts";

export const MENU_UI_THEME_IDS = MENU_THEME_IDS;

export type MenuUiThemeId = (typeof MENU_UI_THEME_IDS)[number];

export const MENU_UI_STATUS_VALUES = ["draft", "published", "archived"] as const;

export type MenuUiConfigStatus = (typeof MENU_UI_STATUS_VALUES)[number];

export const MENU_UI_MOTION_VALUES = ["none", "soft", "expressive"] as const;
export const MENU_UI_DEFAULT_VIEW_VALUES = ["all", "categories"] as const;
export const MENU_UI_CATEGORY_NAVIGATION_VALUES = [
  "tabs",
  "cards",
  "tabs-cards",
  "sticky-pills",
  "rail",
  "minimal"
] as const;
export const MENU_UI_DISH_CARD_STYLE_VALUES = [
  "compact",
  "photo-compact",
  "photo-large",
  "minimal-list",
  "editorial",
  "split",
  "price-forward"
] as const;
export const MENU_UI_DETAIL_STYLE_VALUES = [
  "bottom-sheet",
  "full-card",
  "simple-card",
  "full-page",
  "modal-card",
  "editorial-detail",
  "compact-detail"
] as const;
export const MENU_UI_DENSITY_VALUES = [
  "compact",
  "comfortable",
  "expressive"
] as const;
export const MENU_UI_BACKGROUND_STYLE_VALUES = [
  "flat",
  "gradient",
  "soft-blobs",
  "texture",
  "editorial",
  "dark",
  "pattern-light"
] as const;
export const MENU_UI_RADIUS_VALUES = [
  "sharp",
  "soft",
  "rounded",
  "pill",
  "organic"
] as const;
export const MENU_UI_SHADOW_VALUES = ["none", "soft", "medium", "strong"] as const;
export const MENU_UI_HEADING_STYLE_VALUES = [
  "elegant",
  "bold",
  "casual",
  "minimal",
  "editorial"
] as const;
export const MENU_UI_BODY_STYLE_VALUES = ["clean", "warm", "compact"] as const;
export const MENU_UI_PRICE_STYLE_VALUES = [
  "badge",
  "inline",
  "right",
  "large"
] as const;
export const MENU_UI_TITLE_SCALE_VALUES = [
  "small",
  "medium",
  "large",
  "dramatic"
] as const;
export const MENU_UI_WELCOME_LAYOUT_VALUES = [
  "compact",
  "hero",
  "editorial",
  "split",
  "minimal"
] as const;
export const MENU_UI_BACKGROUND_SHAPE_VALUES = [
  "none",
  "soft-blobs",
  "organic",
  "pattern",
  "editorial",
  "neon"
] as const;
export const MENU_UI_PHOTO_SHAPE_VALUES = [
  "square",
  "rounded",
  "circle",
  "organic",
  "full-bleed"
] as const;
export const MENU_UI_DESCRIPTION_LENGTH_VALUES = [
  "hidden",
  "short",
  "medium",
  "full"
] as const;
export const MENU_UI_DETAIL_PHOTO_HERO_VALUES = [
  "compact",
  "large",
  "full-bleed",
  "none"
] as const;
export const MENU_UI_MODEL_PANEL_STYLE_VALUES = [
  "compact",
  "large-poster",
  "premium-panel",
  "minimal-cta"
] as const;
export const MENU_UI_DISH_OPEN_MODE_VALUES = [
  "inline",
  "route",
  "hybrid"
] as const;
export const MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES = [
  "initial",
  "soft-gradient",
  "pattern",
  "none"
] as const;
export const MENU_UI_PUBLIC_MISSING_PHOTO_VALUES = [
  "placeholder",
  "text-only",
  "hide"
] as const;

export type MenuUiMotion = (typeof MENU_UI_MOTION_VALUES)[number];
export type MenuUiDefaultView = (typeof MENU_UI_DEFAULT_VIEW_VALUES)[number];
export type MenuUiCategoryNavigation =
  (typeof MENU_UI_CATEGORY_NAVIGATION_VALUES)[number];
export type MenuUiDishCardStyle =
  (typeof MENU_UI_DISH_CARD_STYLE_VALUES)[number];
export type MenuUiDetailStyle = (typeof MENU_UI_DETAIL_STYLE_VALUES)[number];
export type MenuUiDensity = (typeof MENU_UI_DENSITY_VALUES)[number];
export type MenuUiBackgroundStyle =
  (typeof MENU_UI_BACKGROUND_STYLE_VALUES)[number];
export type MenuUiRadius = (typeof MENU_UI_RADIUS_VALUES)[number];
export type MenuUiShadow = (typeof MENU_UI_SHADOW_VALUES)[number];
export type MenuUiHeadingStyle = (typeof MENU_UI_HEADING_STYLE_VALUES)[number];
export type MenuUiBodyStyle = (typeof MENU_UI_BODY_STYLE_VALUES)[number];
export type MenuUiPriceStyle = (typeof MENU_UI_PRICE_STYLE_VALUES)[number];
export type MenuUiTitleScale = (typeof MENU_UI_TITLE_SCALE_VALUES)[number];
export type MenuUiWelcomeLayout =
  (typeof MENU_UI_WELCOME_LAYOUT_VALUES)[number];
export type MenuUiBackgroundShapes =
  (typeof MENU_UI_BACKGROUND_SHAPE_VALUES)[number];
export type MenuUiPhotoShape = (typeof MENU_UI_PHOTO_SHAPE_VALUES)[number];
export type MenuUiDescriptionLength =
  (typeof MENU_UI_DESCRIPTION_LENGTH_VALUES)[number];
export type MenuUiDetailPhotoHero =
  (typeof MENU_UI_DETAIL_PHOTO_HERO_VALUES)[number];
export type MenuUiModelPanelStyle =
  (typeof MENU_UI_MODEL_PANEL_STYLE_VALUES)[number];
export type MenuUiDishOpenMode =
  (typeof MENU_UI_DISH_OPEN_MODE_VALUES)[number];
export type MenuUiPhotoPlaceholderStyle =
  (typeof MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES)[number];
export type MenuUiPublicMissingPhoto =
  (typeof MENU_UI_PUBLIC_MISSING_PHOTO_VALUES)[number];

export type MenuUiPalette = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  accent3: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
};

export type MenuUiConfig = {
  schemaVersion: 2;
  theme: MenuUiThemeId;
  custom: boolean;
  palette: MenuUiPalette;
  global: {
    backgroundStyle: MenuUiBackgroundStyle;
    density: MenuUiDensity;
    radius: MenuUiRadius;
    shadow: MenuUiShadow;
  };
  typography: {
    headingStyle: MenuUiHeadingStyle;
    bodyStyle: MenuUiBodyStyle;
    priceStyle: MenuUiPriceStyle;
    titleScale: MenuUiTitleScale;
  };
  welcome: {
    layout: MenuUiWelcomeLayout;
    motion: MenuUiMotion;
    backgroundShapes: MenuUiBackgroundShapes;
  };
  navigation: {
    style: MenuUiCategoryNavigation;
    showAll: boolean;
    showDishCounts: boolean;
    showIcons: boolean;
  };
  cards: {
    variant: MenuUiDishCardStyle;
    photoShape: MenuUiPhotoShape;
    descriptionLength: MenuUiDescriptionLength;
    priceStyle: MenuUiPriceStyle;
    showTags: boolean;
  };
  detail: {
    style: MenuUiDetailStyle;
    photoHero: MenuUiDetailPhotoHero;
    showShare: boolean;
    modelPanelStyle: MenuUiModelPanelStyle;
    dishOpenMode: MenuUiDishOpenMode;
  };
  experience: {
    blueprint: MenuExperienceBlueprintId;
    homeLayout: MenuHomeLayout;
    sectionOrder: MenuSectionOrder;
    featuredMode: MenuFeaturedMode;
    categoryPresentation: MenuCategoryPresentation;
    dishListPresentation: MenuDishListPresentation;
    detailPresentation: MenuDetailPresentation;
  };
  photos: {
    placeholderStyle: MenuUiPhotoPlaceholderStyle;
    publicMissingBehavior: MenuUiPublicMissingPhoto;
    ownerMissingWarnings: boolean;
  };
  immersive: {
    show3dBadge: boolean;
    showArBadge: boolean;
    autoLoad: false;
    posterUntilClick: boolean;
    cta3d: string;
    ctaAr: string;
  };
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
const CTA_MAX = 40;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const UNSAFE_KEY_PATTERN =
  /(^__proto__$|^constructor$|^prototype$|secret|password|token|bearer|service[_-]?role|api[_-]?key|signature)/i;
const UNSAFE_VALUE_PATTERN =
  /(sk_live_|sk_test_|service_role|bearer\s+[a-z0-9._-]{12,}|eyJ[a-z0-9_-]{12,})/i;

export const DEFAULT_MENU_UI_CONFIG = buildConfigFromTheme(
  "fresh-homemade"
) as MenuUiConfig;

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

function cleanEnum<T extends readonly string[]>(
  values: T,
  value: unknown,
  fallback: T[number]
): T[number] {
  return includesValue(values, value) ? value : fallback;
}

function cleanPalette(
  input: Record<string, unknown>,
  fallback: MenuUiPalette
): MenuUiPalette {
  return {
    background:
      typeof input.background === "string" && HEX_COLOR_PATTERN.test(input.background)
        ? input.background
        : fallback.background,
    surface:
      typeof input.surface === "string" && HEX_COLOR_PATTERN.test(input.surface)
        ? input.surface
        : fallback.surface,
    text:
      typeof input.text === "string" && HEX_COLOR_PATTERN.test(input.text)
        ? input.text
        : fallback.text,
    muted:
      typeof input.muted === "string" && HEX_COLOR_PATTERN.test(input.muted)
        ? input.muted
        : fallback.muted,
    accent:
      typeof input.accent === "string" && HEX_COLOR_PATTERN.test(input.accent)
        ? input.accent
        : fallback.accent,
    accent2:
      typeof input.accent2 === "string" && HEX_COLOR_PATTERN.test(input.accent2)
        ? input.accent2
        : fallback.accent2,
    accent3:
      typeof input.accent3 === "string" && HEX_COLOR_PATTERN.test(input.accent3)
        ? input.accent3
        : fallback.accent3,
    border:
      typeof input.border === "string" && HEX_COLOR_PATTERN.test(input.border)
        ? input.border
        : fallback.border,
    success:
      typeof input.success === "string" && HEX_COLOR_PATTERN.test(input.success)
        ? input.success
        : fallback.success,
    warning:
      typeof input.warning === "string" && HEX_COLOR_PATTERN.test(input.warning)
        ? input.warning
        : fallback.warning,
    danger:
      typeof input.danger === "string" && HEX_COLOR_PATTERN.test(input.danger)
        ? input.danger
        : fallback.danger
  };
}

function unsafeConfigMessage(input: unknown, depth = 0): string | null {
  if (depth > 6) return "Menu UI config is too deeply nested.";
  if (typeof input === "string" && UNSAFE_VALUE_PATTERN.test(input)) {
    return "Menu UI config contains a secret-like value.";
  }
  if (!input || typeof input !== "object") return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const message = unsafeConfigMessage(item, depth + 1);
      if (message) return message;
    }
    return null;
  }
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (UNSAFE_KEY_PATTERN.test(key)) {
      return "Menu UI config contains an unsafe key.";
    }
    const message = unsafeConfigMessage(value, depth + 1);
    if (message) return message;
  }
  return null;
}

function invalidEnumMessage(
  input: Record<string, unknown>,
  key: string,
  values: readonly string[],
  label: string
): string | null {
  if (key in input && !includesValue(values, input[key])) {
    return `Invalid menu UI ${label}.`;
  }
  return null;
}

function invalidPaletteMessage(input: Record<string, unknown>): string | null {
  const palette = objectInput(input.palette);
  for (const [key, value] of Object.entries(palette)) {
    if (key in DEFAULT_MENU_UI_CONFIG.palette) {
      if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) {
        return `Invalid menu UI palette color: ${key}.`;
      }
    }
  }
  return null;
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
  const theme: MenuUiThemeId = premium ? "premium-gastronomic" : "fresh-homemade";
  const baseConfig = buildConfigFromTheme(theme, { name, slug });

  if (premium) {
    return normalizeMenuUiConfig({
      ...baseConfig,
      palette: MAISON_ELYSE_PALETTE,
      global: {
        ...baseConfig.global,
        backgroundStyle: "dark",
        density: "compact",
        radius: "soft",
        shadow: "medium"
      },
      navigation: {
        ...baseConfig.navigation,
        style: "tabs",
        showAll: true,
        showDishCounts: false
      },
      cards: {
        ...baseConfig.cards,
        variant: "photo-compact",
        photoShape: "rounded",
        descriptionLength: "short",
        priceStyle: "right",
        showTags: true
      },
      welcome: {
        ...baseConfig.welcome,
        layout: "compact",
        backgroundShapes: "none"
      },
      detail: {
        ...baseConfig.detail,
        dishOpenMode: "route"
      },
      welcomeTitle: name,
      welcomeSubtitle: "Carte gastronomique a explorer a table"
    });
  }

  return normalizeMenuUiConfig({
    ...baseConfig,
    welcomeTitle: `Bienvenue chez ${name}`,
    welcomeSubtitle: "Cuisine maison fraiche et genereuse"
  });
}

export function normalizeMenuUiConfig(input: unknown): MenuUiConfig {
  const candidate = objectInput(input);
  const theme = includesValue(MENU_UI_THEME_IDS, candidate.theme)
    ? candidate.theme
    : DEFAULT_MENU_UI_CONFIG.theme;
  const base = buildConfigFromTheme(theme) as MenuUiConfig;
  const palette = cleanPalette(objectInput(candidate.palette), base.palette);
  const globalInput = objectInput(candidate.global);
  const typographyInput = objectInput(candidate.typography);
  const welcomeInput = objectInput(candidate.welcome);
  const navigationInput = objectInput(candidate.navigation);
  const cardsInput = objectInput(candidate.cards);
  const detailInput = objectInput(candidate.detail);
  const experienceInput = objectInput(candidate.experience);
  const photosInput = objectInput(candidate.photos);
  const immersiveInput = objectInput(candidate.immersive);
  const legacyShowPhotoPlaceholders = cleanBoolean(
    candidate.showPhotoPlaceholders,
    base.showPhotoPlaceholders
  );
  const global = {
    backgroundStyle: cleanEnum(
      MENU_UI_BACKGROUND_STYLE_VALUES,
      globalInput.backgroundStyle,
      base.global.backgroundStyle
    ),
    density: cleanEnum(
      MENU_UI_DENSITY_VALUES,
      globalInput.density ?? candidate.density,
      base.global.density
    ),
    radius: cleanEnum(MENU_UI_RADIUS_VALUES, globalInput.radius, base.global.radius),
    shadow: cleanEnum(MENU_UI_SHADOW_VALUES, globalInput.shadow, base.global.shadow)
  };
  const typography = {
    headingStyle: cleanEnum(
      MENU_UI_HEADING_STYLE_VALUES,
      typographyInput.headingStyle,
      base.typography.headingStyle
    ),
    bodyStyle: cleanEnum(
      MENU_UI_BODY_STYLE_VALUES,
      typographyInput.bodyStyle,
      base.typography.bodyStyle
    ),
    priceStyle: cleanEnum(
      MENU_UI_PRICE_STYLE_VALUES,
      typographyInput.priceStyle,
      base.typography.priceStyle
    ),
    titleScale: cleanEnum(
      MENU_UI_TITLE_SCALE_VALUES,
      typographyInput.titleScale,
      base.typography.titleScale
    )
  };
  const motion = cleanEnum(
    MENU_UI_MOTION_VALUES,
    welcomeInput.motion ?? candidate.motion,
    base.motion
  );
  const welcome = {
    layout: cleanEnum(
      MENU_UI_WELCOME_LAYOUT_VALUES,
      welcomeInput.layout,
      base.welcome.layout
    ),
    motion,
    backgroundShapes: cleanEnum(
      MENU_UI_BACKGROUND_SHAPE_VALUES,
      welcomeInput.backgroundShapes,
      base.welcome.backgroundShapes
    )
  };
  const navigation = {
    style: cleanEnum(
      MENU_UI_CATEGORY_NAVIGATION_VALUES,
      navigationInput.style ?? candidate.categoryNavigation,
      base.navigation.style
    ),
    showAll: cleanBoolean(navigationInput.showAll, base.navigation.showAll),
    showDishCounts: cleanBoolean(
      navigationInput.showDishCounts,
      base.navigation.showDishCounts
    ),
    showIcons: cleanBoolean(navigationInput.showIcons, base.navigation.showIcons)
  };
  const cards = {
    variant: cleanEnum(
      MENU_UI_DISH_CARD_STYLE_VALUES,
      cardsInput.variant ?? candidate.dishCardStyle,
      base.cards.variant
    ),
    photoShape: cleanEnum(
      MENU_UI_PHOTO_SHAPE_VALUES,
      cardsInput.photoShape,
      base.cards.photoShape
    ),
    descriptionLength: cleanEnum(
      MENU_UI_DESCRIPTION_LENGTH_VALUES,
      cardsInput.descriptionLength,
      base.cards.descriptionLength
    ),
    priceStyle: cleanEnum(
      MENU_UI_PRICE_STYLE_VALUES,
      cardsInput.priceStyle ?? typography.priceStyle,
      base.cards.priceStyle
    ),
    showTags: cleanBoolean(cardsInput.showTags, base.cards.showTags)
  };
  const detail = {
    style: cleanEnum(
      MENU_UI_DETAIL_STYLE_VALUES,
      detailInput.style ?? candidate.detailStyle,
      base.detail.style
    ),
    photoHero: cleanEnum(
      MENU_UI_DETAIL_PHOTO_HERO_VALUES,
      detailInput.photoHero,
      base.detail.photoHero
    ),
    showShare: cleanBoolean(detailInput.showShare, base.detail.showShare),
    modelPanelStyle: cleanEnum(
      MENU_UI_MODEL_PANEL_STYLE_VALUES,
      detailInput.modelPanelStyle,
      base.detail.modelPanelStyle
    ),
    dishOpenMode: cleanEnum(
      MENU_UI_DISH_OPEN_MODE_VALUES,
      detailInput.dishOpenMode,
      base.detail.dishOpenMode
    )
  };
  const blueprint = cleanEnum(
    MENU_EXPERIENCE_BLUEPRINT_IDS,
    experienceInput.blueprint,
    base.experience?.blueprint ?? "classic-tabs"
  );
  const blueprintDefaults = getMenuExperienceBlueprint(blueprint).experienceDefaults;
  const experience = {
    blueprint,
    homeLayout: cleanEnum(
      MENU_HOME_LAYOUT_VALUES,
      experienceInput.homeLayout,
      blueprintDefaults.homeLayout
    ),
    sectionOrder: cleanEnum(
      MENU_SECTION_ORDER_VALUES,
      experienceInput.sectionOrder,
      blueprintDefaults.sectionOrder
    ),
    featuredMode: cleanEnum(
      MENU_FEATURED_MODE_VALUES,
      experienceInput.featuredMode,
      blueprintDefaults.featuredMode
    ),
    categoryPresentation: cleanEnum(
      MENU_CATEGORY_PRESENTATION_VALUES,
      experienceInput.categoryPresentation,
      blueprintDefaults.categoryPresentation
    ),
    dishListPresentation: cleanEnum(
      MENU_DISH_LIST_PRESENTATION_VALUES,
      experienceInput.dishListPresentation,
      blueprintDefaults.dishListPresentation
    ),
    detailPresentation: cleanEnum(
      MENU_DETAIL_PRESENTATION_VALUES,
      experienceInput.detailPresentation,
      blueprintDefaults.detailPresentation
    )
  };
  const photos = {
    placeholderStyle: cleanEnum(
      MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES,
      photosInput.placeholderStyle,
      base.photos.placeholderStyle
    ),
    publicMissingBehavior: cleanEnum(
      MENU_UI_PUBLIC_MISSING_PHOTO_VALUES,
      photosInput.publicMissingBehavior,
      legacyShowPhotoPlaceholders
        ? base.photos.publicMissingBehavior
        : "hide"
    ),
    ownerMissingWarnings: cleanBoolean(
      photosInput.ownerMissingWarnings,
      base.photos.ownerMissingWarnings
    )
  };
  const immersive = {
    show3dBadge: cleanBoolean(
      immersiveInput.show3dBadge ?? candidate.show3dBadges,
      base.immersive.show3dBadge
    ),
    showArBadge: cleanBoolean(
      immersiveInput.showArBadge ?? candidate.showArBadges,
      base.immersive.showArBadge
    ),
    autoLoad: false as const,
    posterUntilClick: cleanBoolean(
      immersiveInput.posterUntilClick,
      base.immersive.posterUntilClick
    ),
    cta3d: cleanText(immersiveInput.cta3d, base.immersive.cta3d, CTA_MAX),
    ctaAr: cleanText(immersiveInput.ctaAr, base.immersive.ctaAr, CTA_MAX)
  };
  const welcomeEnabled = cleanBoolean(
    candidate.welcomeEnabled,
    base.welcomeEnabled
  );

  return {
    schemaVersion: 2,
    theme,
    custom: cleanBoolean(candidate.custom, base.custom),
    palette,
    global,
    typography,
    welcome,
    navigation,
    cards,
    detail,
    experience,
    photos,
    immersive,
    welcomeEnabled,
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
    motion,
    defaultView: includesValue(
      MENU_UI_DEFAULT_VIEW_VALUES,
      candidate.defaultView
    )
      ? candidate.defaultView
      : base.defaultView,
    categoryNavigation: navigation.style,
    dishCardStyle: cards.variant,
    detailStyle: detail.style,
    density: global.density,
    showPhotoPlaceholders: photos.publicMissingBehavior !== "hide",
    show3dBadges: immersive.show3dBadge,
    showArBadges: immersive.showArBadge,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
        ? candidate.updatedAt.trim().slice(0, 40)
        : new Date().toISOString()
  };
}

function invalidWhitelistMessage(
  input: Record<string, unknown>
): string | null {
  const checks: Array<[Record<string, unknown>, string, readonly string[], string]> = [
    [input, "theme", MENU_UI_THEME_IDS, "theme"],
    [input, "motion", MENU_UI_MOTION_VALUES, "motion"],
    [input, "defaultView", MENU_UI_DEFAULT_VIEW_VALUES, "defaultView"],
    [input, "categoryNavigation", MENU_UI_CATEGORY_NAVIGATION_VALUES, "categoryNavigation"],
    [input, "dishCardStyle", MENU_UI_DISH_CARD_STYLE_VALUES, "dishCardStyle"],
    [input, "detailStyle", MENU_UI_DETAIL_STYLE_VALUES, "detailStyle"],
    [input, "density", MENU_UI_DENSITY_VALUES, "density"],
    [objectInput(input.global), "backgroundStyle", MENU_UI_BACKGROUND_STYLE_VALUES, "global.backgroundStyle"],
    [objectInput(input.global), "density", MENU_UI_DENSITY_VALUES, "global.density"],
    [objectInput(input.global), "radius", MENU_UI_RADIUS_VALUES, "global.radius"],
    [objectInput(input.global), "shadow", MENU_UI_SHADOW_VALUES, "global.shadow"],
    [objectInput(input.typography), "headingStyle", MENU_UI_HEADING_STYLE_VALUES, "typography.headingStyle"],
    [objectInput(input.typography), "bodyStyle", MENU_UI_BODY_STYLE_VALUES, "typography.bodyStyle"],
    [objectInput(input.typography), "priceStyle", MENU_UI_PRICE_STYLE_VALUES, "typography.priceStyle"],
    [objectInput(input.typography), "titleScale", MENU_UI_TITLE_SCALE_VALUES, "typography.titleScale"],
    [objectInput(input.welcome), "layout", MENU_UI_WELCOME_LAYOUT_VALUES, "welcome.layout"],
    [objectInput(input.welcome), "motion", MENU_UI_MOTION_VALUES, "welcome.motion"],
    [objectInput(input.welcome), "backgroundShapes", MENU_UI_BACKGROUND_SHAPE_VALUES, "welcome.backgroundShapes"],
    [objectInput(input.navigation), "style", MENU_UI_CATEGORY_NAVIGATION_VALUES, "navigation.style"],
    [objectInput(input.cards), "variant", MENU_UI_DISH_CARD_STYLE_VALUES, "cards.variant"],
    [objectInput(input.cards), "photoShape", MENU_UI_PHOTO_SHAPE_VALUES, "cards.photoShape"],
    [objectInput(input.cards), "descriptionLength", MENU_UI_DESCRIPTION_LENGTH_VALUES, "cards.descriptionLength"],
    [objectInput(input.cards), "priceStyle", MENU_UI_PRICE_STYLE_VALUES, "cards.priceStyle"],
    [objectInput(input.detail), "style", MENU_UI_DETAIL_STYLE_VALUES, "detail.style"],
    [objectInput(input.detail), "photoHero", MENU_UI_DETAIL_PHOTO_HERO_VALUES, "detail.photoHero"],
    [objectInput(input.detail), "modelPanelStyle", MENU_UI_MODEL_PANEL_STYLE_VALUES, "detail.modelPanelStyle"],
    [objectInput(input.detail), "dishOpenMode", MENU_UI_DISH_OPEN_MODE_VALUES, "detail.dishOpenMode"],
    [objectInput(input.experience), "blueprint", MENU_EXPERIENCE_BLUEPRINT_IDS, "experience blueprint"],
    [objectInput(input.experience), "homeLayout", MENU_HOME_LAYOUT_VALUES, "experience.homeLayout"],
    [objectInput(input.experience), "sectionOrder", MENU_SECTION_ORDER_VALUES, "experience.sectionOrder"],
    [objectInput(input.experience), "featuredMode", MENU_FEATURED_MODE_VALUES, "experience.featuredMode"],
    [objectInput(input.experience), "categoryPresentation", MENU_CATEGORY_PRESENTATION_VALUES, "experience.categoryPresentation"],
    [objectInput(input.experience), "dishListPresentation", MENU_DISH_LIST_PRESENTATION_VALUES, "experience.dishListPresentation"],
    [objectInput(input.experience), "detailPresentation", MENU_DETAIL_PRESENTATION_VALUES, "experience.detailPresentation"],
    [objectInput(input.photos), "placeholderStyle", MENU_UI_PHOTO_PLACEHOLDER_STYLE_VALUES, "photos.placeholderStyle"],
    [objectInput(input.photos), "publicMissingBehavior", MENU_UI_PUBLIC_MISSING_PHOTO_VALUES, "photos.publicMissingBehavior"]
  ];

  for (const [source, key, values, label] of checks) {
    const message = invalidEnumMessage(source, key, values, label);
    if (message) return message;
  }
  return null;
}

export function validateMenuUiConfig(
  input: unknown
): { ok: true; value: MenuUiConfig } | { ok: false; error: string } {
  const candidate = objectInput(input);
  const unsafe = unsafeConfigMessage(candidate);
  if (unsafe) return { ok: false, error: unsafe };
  const whitelistError = invalidWhitelistMessage(candidate);
  if (whitelistError) return { ok: false, error: whitelistError };
  const paletteError = invalidPaletteMessage(candidate);
  if (paletteError) return { ok: false, error: paletteError };

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
