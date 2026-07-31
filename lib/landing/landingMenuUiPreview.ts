import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import type { Locale } from "@/lib/i18n";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import type {
  PublicMenu,
  PublicMenuContextQuery,
  PublicMenuDish
} from "@/lib/menu/publicMenuCore";

export type LandingMenuUiDish = Pick<
  PublicMenuDish,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "categoryId"
  | "category"
  | "categorySlug"
  | "categoryDescription"
  | "priceLabel"
  | "priceCents"
  | "priceCurrency"
  | "baseCurrency"
  | "displayPriceMode"
  | "originalPriceCents"
  | "calories"
  | "spiceLevel"
  | "dietaryType"
  | "imageUrl"
  | "thumbnailUrl"
  | "hasPhoto"
  | "photoStatus"
  | "available"
  | "isSignature"
  | "isRecommended"
  | "ingredients"
  | "allergens"
  | "customAllergens"
  | "allergenDeclarations"
  | "allergenLegacyValues"
  | "allergenReviewRequired"
  | "options"
  | "houseNote"
  | "tags"
>;

export type LandingMenuUiMenu = Pick<
  PublicMenu,
  | "restaurantId"
  | "menuId"
  | "menuName"
  | "slug"
  | "name"
  | "location"
  | "cuisineType"
  | "settings"
  | "activeLocale"
  | "translationStatus"
  | "translationLocales"
  | "localizedUiCopy"
  | "publicMenuStyleExplicit"
  | "source"
> & {
  dishes: LandingMenuUiDish[];
};

export type LandingMenuUiPreview = {
  menu: LandingMenuUiMenu;
  localizedMenus: Partial<Record<Locale, LandingMenuUiMenu>>;
  config: MenuUiConfig;
  context: string;
  query: PublicMenuContextQuery;
  exchangeRates: MenuExchangeRates;
};

export function projectLandingMenuUiMenu(menu: PublicMenu): LandingMenuUiMenu {
  return {
    restaurantId: menu.restaurantId,
    ...(menu.menuId ? { menuId: menu.menuId } : {}),
    ...(menu.menuName ? { menuName: menu.menuName } : {}),
    slug: menu.slug,
    name: menu.name,
    location: menu.location,
    cuisineType: menu.cuisineType,
    settings: menu.settings,
    ...(menu.activeLocale ? { activeLocale: menu.activeLocale } : {}),
    ...(menu.translationStatus
      ? { translationStatus: menu.translationStatus }
      : {}),
    ...(menu.translationLocales
      ? { translationLocales: menu.translationLocales }
      : {}),
    ...(menu.localizedUiCopy
      ? { localizedUiCopy: menu.localizedUiCopy }
      : {}),
    ...(menu.publicMenuStyleExplicit !== undefined
      ? { publicMenuStyleExplicit: menu.publicMenuStyleExplicit }
      : {}),
    source: menu.source,
    dishes: menu.dishes.map((dish) => ({
      id: dish.id,
      slug: dish.slug,
      name: dish.name,
      description: dish.description,
      ...(dish.categoryId ? { categoryId: dish.categoryId } : {}),
      category: dish.category,
      ...(dish.categorySlug ? { categorySlug: dish.categorySlug } : {}),
      ...(dish.categoryDescription
        ? { categoryDescription: dish.categoryDescription }
        : {}),
      priceLabel: dish.priceLabel,
      priceCents: dish.priceCents,
      priceCurrency: dish.priceCurrency,
      baseCurrency: dish.baseCurrency,
      displayPriceMode: dish.displayPriceMode,
      ...(dish.originalPriceCents !== undefined
        ? { originalPriceCents: dish.originalPriceCents }
        : {}),
      ...(dish.calories !== undefined ? { calories: dish.calories } : {}),
      ...(dish.spiceLevel !== undefined ? { spiceLevel: dish.spiceLevel } : {}),
      ...(dish.dietaryType ? { dietaryType: dish.dietaryType } : {}),
      imageUrl: dish.imageUrl || dish.thumbnailUrl || dish.posterUrl,
      thumbnailUrl: dish.thumbnailUrl || dish.imageUrl || dish.posterUrl,
      hasPhoto: dish.hasPhoto,
      photoStatus: dish.photoStatus,
      available: dish.available,
      ...(dish.isSignature !== undefined
        ? { isSignature: dish.isSignature }
        : {}),
      ...(dish.isRecommended !== undefined
        ? { isRecommended: dish.isRecommended }
        : {}),
      ingredients: dish.ingredients,
      allergens: dish.allergens,
      ...(dish.customAllergens
        ? { customAllergens: dish.customAllergens }
        : {}),
      ...(dish.allergenDeclarations
        ? { allergenDeclarations: dish.allergenDeclarations }
        : {}),
      ...(dish.allergenLegacyValues
        ? { allergenLegacyValues: dish.allergenLegacyValues }
        : {}),
      ...(dish.allergenReviewRequired !== undefined
        ? { allergenReviewRequired: dish.allergenReviewRequired }
        : {}),
      options: dish.options,
      houseNote: dish.houseNote,
      tags: dish.tags
    }))
  };
}

export function inflateLandingMenuUiMenu(menu: LandingMenuUiMenu): PublicMenu {
  return {
    ...menu,
    googleReview: {
      enabled: false,
      googleReviewUrl: ""
    },
    dishes: menu.dishes.map((dish) => ({
      ...dish,
      hasImmersive: false,
      has3d: false,
      hasAr: false,
      hasIosAr: false,
      hasAndroidAr: false,
      model3dUrl: "",
      webModel3dUrl: "",
      webModel3dBytes: 0,
      arModel3dUrl: "",
      arModel3dBytes: 0,
      usdzUrl: "",
      arUsdzUrl: "",
      arUsdzBytes: 0,
      posterUrl: "",
      modelStatus: "missing"
    }))
  };
}

export function inflateLandingLocalizedMenus(
  menus: Partial<Record<Locale, LandingMenuUiMenu>>
): Partial<Record<Locale, PublicMenu>> {
  return Object.fromEntries(
    Object.entries(menus).map(([locale, menu]) => [
      locale,
      inflateLandingMenuUiMenu(menu)
    ])
  ) as Partial<Record<Locale, PublicMenu>>;
}
