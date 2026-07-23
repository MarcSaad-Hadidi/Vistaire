import {
  normalizeMenuUiConfig,
  type MenuUiConfig
} from "@/lib/menu/menuUiConfig";
import type { PublicMenuStyle } from "@/lib/menu/publicMenuSettings";
import type { PublicMenu } from "@/lib/menu/publicMenuCore";

type PublicMenuStyleRouteInput = Pick<PublicMenu, "slug" | "name"> & {
  settings?: Pick<PublicMenu["settings"], "publicMenuStyle">;
  publicMenuStyleExplicit?: boolean;
};

function matchesMenuIdentity(
  menu: Pick<PublicMenu, "slug" | "name">,
  expected: string
): boolean {
  const slug = menu.slug.trim().toLowerCase();
  const name = menu.name.trim().toLowerCase();
  return slug === expected || name === expected;
}

export function getPublicMenuExperienceStyle(
  menu: PublicMenuStyleRouteInput
): PublicMenuStyle | null {
  if (menu.publicMenuStyleExplicit && menu.settings?.publicMenuStyle) {
    return menu.settings.publicMenuStyle;
  }

  if (matchesMenuIdentity(menu, "maison-elyse")) return "maison-elyse";
  if (matchesMenuIdentity(menu, "trouvable")) return "trouvable";
  return null;
}

export function isMaisonElysePublicMenu(menu: PublicMenuStyleRouteInput): boolean {
  return getPublicMenuExperienceStyle(menu) === "maison-elyse";
}

export function isTrouvablePublicMenu(
  menu: PublicMenuStyleRouteInput
): boolean {
  return getPublicMenuExperienceStyle(menu) === "trouvable";
}

export function resolvePublicMenuUiConfig(
  menu: Pick<PublicMenu, "slug" | "name">,
  config: MenuUiConfig
): MenuUiConfig {
  if (!isTrouvablePublicMenu(menu)) return config;

  const isLegacyTrouvable = matchesMenuIdentity(menu, "trouvable");

  return normalizeMenuUiConfig({
    ...config,
    theme: "premium-gastronomic",
    global: {
      ...config.global,
      backgroundStyle: "dark",
      density: "compact",
      radius: "soft",
      shadow: "medium"
    },
    typography: {
      ...config.typography,
      headingStyle: "elegant",
      bodyStyle: "compact",
      priceStyle: "right",
      titleScale: "medium"
    },
    welcome: {
      ...config.welcome,
      layout: "compact",
      motion: "soft",
      backgroundShapes: "none"
    },
    navigation: {
      ...config.navigation,
      style: "sticky-pills",
      showAll: true,
      showDishCounts: true,
      showIcons: false
    },
    cards: {
      ...config.cards,
      variant: "photo-compact",
      photoShape: "rounded",
      descriptionLength: "short",
      priceStyle: "right",
      showTags: true
    },
    detail: {
      ...config.detail,
      style: "bottom-sheet",
      photoHero: "large",
      modelPanelStyle: "premium-panel",
      dishOpenMode: "route"
    },
    photos: {
      ...config.photos,
      placeholderStyle: "soft-gradient",
      publicMissingBehavior: "placeholder",
      ownerMissingWarnings: false
    },
    immersive: {
      ...config.immersive,
      show3dBadge: true,
      showArBadge: true,
      autoLoad: false,
      posterUntilClick: true,
      cta3d: "Voir en 3D",
      ctaAr: "Voir devant moi"
    },
    welcomeEnabled: true,
    welcomeTitle: isLegacyTrouvable
      ? "Trouvable"
      : config.welcomeTitle || `Bienvenue chez ${menu.name}`,
    welcomeSubtitle: isLegacyTrouvable
      ? "Cuisine maison, service a table et carte immersive."
      : config.welcomeSubtitle || "Une carte pensée pour être explorée à table.",
    motion: "soft",
    defaultView: "all",
    categoryNavigation: "sticky-pills",
    dishCardStyle: "photo-compact",
    detailStyle: "bottom-sheet",
    density: "compact",
    showPhotoPlaceholders: true,
    show3dBadges: true,
    showArBadges: true
  });
}
