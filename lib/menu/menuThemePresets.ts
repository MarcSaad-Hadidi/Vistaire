import { getMenuExperienceBlueprint } from "./menuExperienceBlueprints.ts";

export const MENU_THEME_IDS = [
  "fresh-homemade",
  "premium-gastronomic",
  "street-casual",
  "cafe-brunch",
  "minimal-clean",
  "mediterranean-fresh",
  "sushi-minimal",
  "retro-diner",
  "fast-fresh-bowls",
  "patisserie-sweet",
  "bbq-smokehouse",
  "night-market"
] as const;

export type MenuThemeId = (typeof MENU_THEME_IDS)[number];

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

export const MAISON_ELYSE_PALETTE: MenuUiPalette = {
  background: "#000000",
  surface: "#0A0A0A",
  text: "#FFFFFF",
  muted: "#A6A6A6",
  accent: "#C9A45C",
  accent2: "#DFC478",
  accent3: "#8A8A8A",
  border: "#2A2A2A",
  success: "#A6A6A6",
  warning: "#DFC478",
  danger: "#FFFFFF"
};

export type MenuThemePreset = {
  id: MenuThemeId;
  name: string;
  description: string;
  palette: MenuUiPalette;
  global: {
    backgroundStyle:
      | "flat"
      | "gradient"
      | "soft-blobs"
      | "texture"
      | "editorial"
      | "dark"
      | "pattern-light";
    density: "compact" | "comfortable" | "expressive";
    radius: "sharp" | "soft" | "rounded" | "pill" | "organic";
    shadow: "none" | "soft" | "medium" | "strong";
  };
  typography: {
    headingStyle: "elegant" | "bold" | "casual" | "minimal" | "editorial";
    bodyStyle: "clean" | "warm" | "compact";
    priceStyle: "badge" | "inline" | "right" | "large";
    titleScale: "small" | "medium" | "large" | "dramatic";
  };
  welcome: {
    layout: "compact" | "hero" | "editorial" | "split" | "minimal";
    motion: "none" | "soft" | "expressive";
    backgroundShapes: "none" | "soft-blobs" | "organic" | "pattern" | "editorial" | "neon";
  };
  navigation: {
    style: "tabs" | "cards" | "tabs-cards" | "sticky-pills" | "rail" | "minimal";
    showAll: boolean;
    showDishCounts: boolean;
    showIcons: boolean;
  };
  cards: {
    variant:
      | "compact"
      | "photo-compact"
      | "photo-large"
      | "editorial"
      | "split"
      | "minimal-list"
      | "price-forward";
    photoShape: "square" | "rounded" | "circle" | "organic" | "full-bleed";
    descriptionLength: "hidden" | "short" | "medium" | "full";
    priceStyle: "badge" | "inline" | "right" | "large";
    showTags: boolean;
  };
  detail: {
    style: "bottom-sheet" | "full-page" | "modal-card" | "editorial-detail" | "compact-detail";
    photoHero: "compact" | "large" | "full-bleed" | "none";
    showShare: boolean;
    modelPanelStyle: "compact" | "large-poster" | "premium-panel" | "minimal-cta";
    dishOpenMode: "inline" | "route" | "hybrid";
  };
  photos: {
    placeholderStyle: "initial" | "soft-gradient" | "pattern" | "none";
    publicMissingBehavior: "placeholder" | "text-only" | "hide";
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
};

export const MENU_THEME_PRESETS: MenuThemePreset[] = [
  {
    id: "fresh-homemade",
    name: "Fresh Homemade",
    description: "Clair, vivant et maison, avec photos utiles et accents frais.",
    palette: {
      background: "#fffdf6",
      surface: "#ffffff",
      text: "#17324d",
      muted: "#5f6f7a",
      accent: "#f6c453",
      accent2: "#e85d3f",
      accent3: "#2fa866",
      border: "#ddeaf3",
      success: "#2fa866",
      warning: "#f6c453",
      danger: "#e75b4e"
    },
    global: {
      backgroundStyle: "soft-blobs",
      density: "comfortable",
      radius: "rounded",
      shadow: "soft"
    },
    typography: {
      headingStyle: "bold",
      bodyStyle: "warm",
      priceStyle: "right",
      titleScale: "large"
    },
    welcome: {
      layout: "hero",
      motion: "soft",
      backgroundShapes: "organic"
    },
    navigation: {
      style: "tabs-cards",
      showAll: true,
      showDishCounts: true,
      showIcons: false
    },
    cards: {
      variant: "photo-compact",
      photoShape: "rounded",
      descriptionLength: "medium",
      priceStyle: "right",
      showTags: true
    },
    detail: {
      style: "bottom-sheet",
      photoHero: "large",
      showShare: true,
      modelPanelStyle: "compact",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir en 3D",
      ctaAr: "Voir a table"
    }
  },
  {
    id: "premium-gastronomic",
    name: "Premium Gastronomic",
    description: "Sombre, gastronomique, champagne, avec fiches detail editorialisees.",
    palette: {
      background: "#0d0805",
      surface: "#1b130d",
      text: "#fff7ea",
      muted: "#cbbca6",
      accent: "#e8cf9b",
      accent2: "#c69252",
      accent3: "#8f7653",
      border: "#3c2d21",
      success: "#9bbf8a",
      warning: "#e8cf9b",
      danger: "#d36a5d"
    },
    global: {
      backgroundStyle: "dark",
      density: "comfortable",
      radius: "soft",
      shadow: "strong"
    },
    typography: {
      headingStyle: "elegant",
      bodyStyle: "warm",
      priceStyle: "inline",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "editorial",
      motion: "soft",
      backgroundShapes: "editorial"
    },
    navigation: {
      style: "minimal",
      showAll: true,
      showDishCounts: false,
      showIcons: false
    },
    cards: {
      variant: "editorial",
      photoShape: "full-bleed",
      descriptionLength: "full",
      priceStyle: "inline",
      showTags: false
    },
    detail: {
      style: "editorial-detail",
      photoHero: "full-bleed",
      showShare: true,
      modelPanelStyle: "premium-panel",
      dishOpenMode: "route"
    },
    photos: {
      placeholderStyle: "initial",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Explorer en 3D",
      ctaAr: "Voir a table"
    }
  },
  {
    id: "street-casual",
    name: "Street Casual",
    description: "Rapide, punchy, prix visibles et cards solides pour comptoir.",
    palette: {
      background: "#fffaf0",
      surface: "#ffffff",
      text: "#191919",
      muted: "#5e5a52",
      accent: "#ffcf24",
      accent2: "#ff4d2e",
      accent3: "#17b978",
      border: "#eadfc5",
      success: "#17b978",
      warning: "#ffcf24",
      danger: "#ff4d2e"
    },
    global: {
      backgroundStyle: "gradient",
      density: "compact",
      radius: "pill",
      shadow: "medium"
    },
    typography: {
      headingStyle: "bold",
      bodyStyle: "compact",
      priceStyle: "badge",
      titleScale: "large"
    },
    welcome: {
      layout: "compact",
      motion: "expressive",
      backgroundShapes: "pattern"
    },
    navigation: {
      style: "sticky-pills",
      showAll: true,
      showDishCounts: true,
      showIcons: true
    },
    cards: {
      variant: "price-forward",
      photoShape: "square",
      descriptionLength: "short",
      priceStyle: "badge",
      showTags: true
    },
    detail: {
      style: "modal-card",
      photoHero: "large",
      showShare: false,
      modelPanelStyle: "large-poster",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "pattern",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: false,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir le plat",
      ctaAr: "AR"
    }
  },
  {
    id: "cafe-brunch",
    name: "Cafe Brunch",
    description: "Chaud, doux et lumineux pour cafe, brunch et carte du matin.",
    palette: {
      background: "#fff8ee",
      surface: "#ffffff",
      text: "#452b20",
      muted: "#7a6256",
      accent: "#d9a063",
      accent2: "#b77752",
      accent3: "#78956e",
      border: "#ead7c2",
      success: "#78956e",
      warning: "#d9a063",
      danger: "#c65f55"
    },
    global: {
      backgroundStyle: "texture",
      density: "comfortable",
      radius: "rounded",
      shadow: "soft"
    },
    typography: {
      headingStyle: "casual",
      bodyStyle: "warm",
      priceStyle: "inline",
      titleScale: "large"
    },
    welcome: {
      layout: "split",
      motion: "soft",
      backgroundShapes: "soft-blobs"
    },
    navigation: {
      style: "cards",
      showAll: true,
      showDishCounts: true,
      showIcons: false
    },
    cards: {
      variant: "photo-large",
      photoShape: "rounded",
      descriptionLength: "medium",
      priceStyle: "inline",
      showTags: true
    },
    detail: {
      style: "bottom-sheet",
      photoHero: "large",
      showShare: true,
      modelPanelStyle: "compact",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir en 3D",
      ctaAr: "Voir sur table"
    }
  },
  {
    id: "minimal-clean",
    name: "Minimal Clean",
    description: "Tres sobre, lisible, liste fine et peu d'ornement.",
    palette: {
      background: "#fbfbf8",
      surface: "#ffffff",
      text: "#20242b",
      muted: "#6b7280",
      accent: "#e9edf3",
      accent2: "#5a6472",
      accent3: "#4b8063",
      border: "#e5e7eb",
      success: "#4b8063",
      warning: "#c7a45a",
      danger: "#b65b55"
    },
    global: {
      backgroundStyle: "flat",
      density: "compact",
      radius: "sharp",
      shadow: "none"
    },
    typography: {
      headingStyle: "minimal",
      bodyStyle: "clean",
      priceStyle: "right",
      titleScale: "medium"
    },
    welcome: {
      layout: "minimal",
      motion: "none",
      backgroundShapes: "none"
    },
    navigation: {
      style: "minimal",
      showAll: true,
      showDishCounts: false,
      showIcons: false
    },
    cards: {
      variant: "minimal-list",
      photoShape: "square",
      descriptionLength: "short",
      priceStyle: "right",
      showTags: false
    },
    detail: {
      style: "compact-detail",
      photoHero: "compact",
      showShare: true,
      modelPanelStyle: "minimal-cta",
      dishOpenMode: "route"
    },
    photos: {
      placeholderStyle: "none",
      publicMissingBehavior: "text-only",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: false,
      showArBadge: false,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "3D",
      ctaAr: "AR"
    }
  },
  {
    id: "mediterranean-fresh",
    name: "Mediterranean Fresh",
    description: "Blanc, turquoise, citron et olive, avec cards aeriennes.",
    palette: {
      background: "#f8fffb",
      surface: "#ffffff",
      text: "#123a3a",
      muted: "#5a7470",
      accent: "#4ecdc4",
      accent2: "#f3c84b",
      accent3: "#7aa95c",
      border: "#d9eee9",
      success: "#7aa95c",
      warning: "#f3c84b",
      danger: "#e76f51"
    },
    global: {
      backgroundStyle: "gradient",
      density: "expressive",
      radius: "soft",
      shadow: "soft"
    },
    typography: {
      headingStyle: "elegant",
      bodyStyle: "clean",
      priceStyle: "inline",
      titleScale: "large"
    },
    welcome: {
      layout: "split",
      motion: "soft",
      backgroundShapes: "organic"
    },
    navigation: {
      style: "tabs-cards",
      showAll: true,
      showDishCounts: true,
      showIcons: true
    },
    cards: {
      variant: "split",
      photoShape: "organic",
      descriptionLength: "medium",
      priceStyle: "inline",
      showTags: true
    },
    detail: {
      style: "editorial-detail",
      photoHero: "full-bleed",
      showShare: true,
      modelPanelStyle: "large-poster",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir l'assiette",
      ctaAr: "Voir a table"
    }
  },
  {
    id: "sushi-minimal",
    name: "Sushi Minimal",
    description: "Blanc, pierre et rouge, liste calme, cards fines sans blobs.",
    palette: {
      background: "#fbfaf7",
      surface: "#ffffff",
      text: "#1f1d1b",
      muted: "#6f6961",
      accent: "#d94b3d",
      accent2: "#2b2b2b",
      accent3: "#b8b0a3",
      border: "#e5e0d8",
      success: "#4e8a69",
      warning: "#d2a84a",
      danger: "#d94b3d"
    },
    global: {
      backgroundStyle: "flat",
      density: "compact",
      radius: "sharp",
      shadow: "none"
    },
    typography: {
      headingStyle: "minimal",
      bodyStyle: "clean",
      priceStyle: "right",
      titleScale: "medium"
    },
    welcome: {
      layout: "minimal",
      motion: "none",
      backgroundShapes: "none"
    },
    navigation: {
      style: "tabs",
      showAll: true,
      showDishCounts: false,
      showIcons: false
    },
    cards: {
      variant: "minimal-list",
      photoShape: "square",
      descriptionLength: "short",
      priceStyle: "right",
      showTags: false
    },
    detail: {
      style: "full-page",
      photoHero: "compact",
      showShare: true,
      modelPanelStyle: "minimal-cta",
      dishOpenMode: "route"
    },
    photos: {
      placeholderStyle: "none",
      publicMissingBehavior: "text-only",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: false,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir en 3D",
      ctaAr: "AR discret"
    }
  },
  {
    id: "retro-diner",
    name: "Retro Diner",
    description: "Rouge, creme et bleu, prix en avant et pills marquees.",
    palette: {
      background: "#fff3dc",
      surface: "#fffaf0",
      text: "#182844",
      muted: "#6d5d4f",
      accent: "#e63946",
      accent2: "#1d5f99",
      accent3: "#f5c04f",
      border: "#e4caa3",
      success: "#25876d",
      warning: "#f5c04f",
      danger: "#e63946"
    },
    global: {
      backgroundStyle: "pattern-light",
      density: "comfortable",
      radius: "pill",
      shadow: "medium"
    },
    typography: {
      headingStyle: "bold",
      bodyStyle: "warm",
      priceStyle: "badge",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "hero",
      motion: "expressive",
      backgroundShapes: "pattern"
    },
    navigation: {
      style: "sticky-pills",
      showAll: true,
      showDishCounts: true,
      showIcons: true
    },
    cards: {
      variant: "price-forward",
      photoShape: "circle",
      descriptionLength: "short",
      priceStyle: "badge",
      showTags: true
    },
    detail: {
      style: "modal-card",
      photoHero: "large",
      showShare: false,
      modelPanelStyle: "large-poster",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "pattern",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: false,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Tourner le plat",
      ctaAr: "Sur table"
    }
  },
  {
    id: "fast-fresh-bowls",
    name: "Fast Fresh Bowls",
    description: "Vert, orange et bleu, tags ingredients et cards efficaces.",
    palette: {
      background: "#f7fff3",
      surface: "#ffffff",
      text: "#173527",
      muted: "#5e7466",
      accent: "#39b86f",
      accent2: "#ff8a3d",
      accent3: "#2e9be8",
      border: "#d8ecd8",
      success: "#39b86f",
      warning: "#ffb13d",
      danger: "#e75b4e"
    },
    global: {
      backgroundStyle: "soft-blobs",
      density: "compact",
      radius: "rounded",
      shadow: "soft"
    },
    typography: {
      headingStyle: "bold",
      bodyStyle: "compact",
      priceStyle: "right",
      titleScale: "large"
    },
    welcome: {
      layout: "compact",
      motion: "soft",
      backgroundShapes: "organic"
    },
    navigation: {
      style: "rail",
      showAll: true,
      showDishCounts: true,
      showIcons: true
    },
    cards: {
      variant: "compact",
      photoShape: "rounded",
      descriptionLength: "short",
      priceStyle: "right",
      showTags: true
    },
    detail: {
      style: "compact-detail",
      photoHero: "large",
      showShare: true,
      modelPanelStyle: "compact",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir le bol",
      ctaAr: "Voir format"
    }
  },
  {
    id: "patisserie-sweet",
    name: "Patisserie Sweet",
    description: "Pastel, photos larges, arrondis doux et details sucres.",
    palette: {
      background: "#fff7fb",
      surface: "#ffffff",
      text: "#4a2534",
      muted: "#8a6272",
      accent: "#f5a6c8",
      accent2: "#c78b3d",
      accent3: "#b9d88f",
      border: "#f0d5e0",
      success: "#8aa85f",
      warning: "#e8b75c",
      danger: "#d85b77"
    },
    global: {
      backgroundStyle: "soft-blobs",
      density: "expressive",
      radius: "rounded",
      shadow: "soft"
    },
    typography: {
      headingStyle: "elegant",
      bodyStyle: "warm",
      priceStyle: "inline",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "hero",
      motion: "soft",
      backgroundShapes: "soft-blobs"
    },
    navigation: {
      style: "cards",
      showAll: true,
      showDishCounts: true,
      showIcons: false
    },
    cards: {
      variant: "photo-large",
      photoShape: "rounded",
      descriptionLength: "medium",
      priceStyle: "inline",
      showTags: true
    },
    detail: {
      style: "editorial-detail",
      photoHero: "full-bleed",
      showShare: true,
      modelPanelStyle: "premium-panel",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir la piece",
      ctaAr: "Voir en vitrine"
    }
  },
  {
    id: "bbq-smokehouse",
    name: "BBQ Smokehouse",
    description: "Charbon, ambre et rouge, cards robustes et fond smoky.",
    palette: {
      background: "#14100c",
      surface: "#241a13",
      text: "#fff1df",
      muted: "#c9aa8d",
      accent: "#d97a32",
      accent2: "#b33a2b",
      accent3: "#8d6a44",
      border: "#4b3425",
      success: "#8aa85f",
      warning: "#d97a32",
      danger: "#d45745"
    },
    global: {
      backgroundStyle: "texture",
      density: "comfortable",
      radius: "soft",
      shadow: "strong"
    },
    typography: {
      headingStyle: "bold",
      bodyStyle: "warm",
      priceStyle: "large",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "editorial",
      motion: "soft",
      backgroundShapes: "editorial"
    },
    navigation: {
      style: "sticky-pills",
      showAll: true,
      showDishCounts: true,
      showIcons: false
    },
    cards: {
      variant: "split",
      photoShape: "rounded",
      descriptionLength: "medium",
      priceStyle: "large",
      showTags: true
    },
    detail: {
      style: "modal-card",
      photoHero: "large",
      showShare: true,
      modelPanelStyle: "premium-panel",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "pattern",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir la piece",
      ctaAr: "Voir au format"
    }
  },
  {
    id: "night-market",
    name: "Night Market",
    description: "Nocturne, neon, haute energie et cartes denses.",
    palette: {
      background: "#090b14",
      surface: "#151927",
      text: "#f7f4ff",
      muted: "#aaa7c7",
      accent: "#ff4fd8",
      accent2: "#28d7ff",
      accent3: "#ffe866",
      border: "#303651",
      success: "#43d689",
      warning: "#ffe866",
      danger: "#ff5d5d"
    },
    global: {
      backgroundStyle: "dark",
      density: "compact",
      radius: "organic",
      shadow: "strong"
    },
    typography: {
      headingStyle: "editorial",
      bodyStyle: "compact",
      priceStyle: "badge",
      titleScale: "dramatic"
    },
    welcome: {
      layout: "compact",
      motion: "expressive",
      backgroundShapes: "neon"
    },
    navigation: {
      style: "rail",
      showAll: true,
      showDishCounts: true,
      showIcons: true
    },
    cards: {
      variant: "price-forward",
      photoShape: "organic",
      descriptionLength: "short",
      priceStyle: "badge",
      showTags: true
    },
    detail: {
      style: "full-page",
      photoHero: "full-bleed",
      showShare: true,
      modelPanelStyle: "premium-panel",
      dishOpenMode: "hybrid"
    },
    photos: {
      placeholderStyle: "pattern",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: true
    },
    immersive: {
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir le volume",
      ctaAr: "Voir en AR"
    }
  }
];

const PRESET_BY_ID = new Map(MENU_THEME_PRESETS.map((preset) => [preset.id, preset]));

const BACKGROUND_VARIATIONS: MenuThemePreset["global"]["backgroundStyle"][] = [
  "flat",
  "gradient",
  "soft-blobs",
  "texture",
  "editorial",
  "pattern-light"
];
const RADIUS_VARIATIONS: MenuThemePreset["global"]["radius"][] = [
  "sharp",
  "soft",
  "rounded",
  "pill",
  "organic"
];
const SHADOW_VARIATIONS: MenuThemePreset["global"]["shadow"][] = [
  "none",
  "soft",
  "medium",
  "strong"
];
const CARD_VARIATIONS: MenuThemePreset["cards"]["variant"][] = [
  "compact",
  "photo-compact",
  "photo-large",
  "editorial",
  "split",
  "minimal-list",
  "price-forward"
];
const NAV_VARIATIONS: MenuThemePreset["navigation"]["style"][] = [
  "tabs",
  "cards",
  "tabs-cards",
  "sticky-pills",
  "rail",
  "minimal"
];

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(values: readonly T[], hash: number, offset: number): T {
  return values[(hash + offset) % values.length];
}

function restaurantName(args?: { name?: string; slug?: string }): string {
  return args?.name?.trim() || "le restaurant";
}

function legacyCardVariant(variant: MenuThemePreset["cards"]["variant"]) {
  return variant === "editorial" || variant === "split" || variant === "price-forward"
    ? "photo-compact"
    : variant;
}

function legacyDetailStyle(style: MenuThemePreset["detail"]["style"]) {
  if (style === "modal-card") return "full-card";
  if (style === "compact-detail") return "simple-card";
  return style;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function presetConfig(preset: MenuThemePreset, restaurant?: { name?: string; slug?: string }) {
  const name = restaurantName(restaurant);
  const classicTabs = getMenuExperienceBlueprint("classic-tabs");

  return {
    schemaVersion: 2,
    theme: preset.id,
    custom: false,
    palette: clone(preset.palette),
    global: clone(preset.global),
    typography: clone(preset.typography),
    welcome: clone(preset.welcome),
    navigation: clone(preset.navigation),
    cards: clone(preset.cards),
    detail: clone(preset.detail),
    experience: {
      blueprint: classicTabs.id,
      ...clone(classicTabs.experienceDefaults)
    },
    photos: clone(preset.photos),
    immersive: clone(preset.immersive),
    welcomeEnabled: true,
    welcomeTitle: `Bienvenue chez ${name}`,
    welcomeSubtitle:
      preset.id === "premium-gastronomic"
        ? "Une carte gastronomique a explorer a table"
        : "Cuisine maison fraiche et genereuse",
    motion: preset.welcome.motion,
    defaultView: "all",
    categoryNavigation: preset.navigation.style,
    dishCardStyle: legacyCardVariant(preset.cards.variant),
    detailStyle: legacyDetailStyle(preset.detail.style),
    density: preset.global.density,
    showPhotoPlaceholders: preset.photos.publicMissingBehavior !== "hide",
    show3dBadges: preset.immersive.show3dBadge,
    showArBadges: preset.immersive.showArBadge,
    updatedAt: ""
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergePlain<T extends Record<string, unknown>>(
  base: T,
  custom: unknown
): T {
  if (!isRecord(custom)) return clone(base);
  const output = clone(base) as Record<string, unknown>;
  for (const [key, value] of Object.entries(custom)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    const current = output[key];
    output[key] =
      isRecord(current) && isRecord(value)
        ? mergePlain(current, value)
        : value;
  }
  return output as T;
}

export function getMenuThemePreset(theme: unknown): MenuThemePreset {
  return PRESET_BY_ID.get(theme as MenuThemeId) ?? MENU_THEME_PRESETS[0];
}

export function buildConfigFromTheme(
  theme: unknown,
  restaurant?: { name?: string; slug?: string }
) {
  return presetConfig(getMenuThemePreset(theme), restaurant);
}

export function mergeCustomConfig(base: Record<string, unknown>, custom: unknown) {
  const merged = mergePlain(base, custom);
  const immersive = isRecord(merged.immersive) ? merged.immersive : {};
  merged.custom = true;
  merged.immersive = {
    ...immersive,
    autoLoad: false
  };
  merged.updatedAt = new Date().toISOString();
  return merged;
}

export function createMenuThemeVariation(
  config: Record<string, unknown>,
  seed = `${Date.now()}`
) {
  const preset = getMenuThemePreset(config.theme);
  const hash = hashSeed(`${preset.id}:${seed}`);
  const palette = isRecord(config.palette)
    ? config.palette
    : preset.palette;
  const global = isRecord(config.global)
    ? config.global
    : preset.global;
  const navigation = isRecord(config.navigation)
    ? config.navigation
    : preset.navigation;
  const cards = isRecord(config.cards) ? config.cards : preset.cards;

  return mergeCustomConfig(config, {
    custom: true,
    palette: {
      ...palette,
      accent: pick(
        [preset.palette.accent, preset.palette.accent2, preset.palette.accent3],
        hash,
        1
      ),
      accent2: pick(
        [preset.palette.accent2, preset.palette.accent3, preset.palette.accent],
        hash,
        2
      )
    },
    global: {
      ...global,
      backgroundStyle: pick(BACKGROUND_VARIATIONS, hash, 3),
      radius: pick(RADIUS_VARIATIONS, hash, 5),
      shadow: pick(SHADOW_VARIATIONS, hash, 7),
      density: pick(["compact", "comfortable", "expressive"] as const, hash, 11)
    },
    navigation: {
      ...navigation,
      style: pick(NAV_VARIATIONS, hash, 13)
    },
    cards: {
      ...cards,
      variant: pick(CARD_VARIATIONS, hash, 17),
      photoShape: pick(["square", "rounded", "circle", "organic", "full-bleed"] as const, hash, 19)
    },
    immersive: {
      autoLoad: false
    }
  });
}
