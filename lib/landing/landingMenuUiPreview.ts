import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import type {
  PublicMenu,
  PublicMenuContextQuery,
  PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { PublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import { landingPhotoForDish } from "./landingDishIdentity.ts";

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
  | "cardUrl"
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
  localizedMenus: Partial<Record<PublicMenuLocale, LandingMenuUiMenu>>;
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
    dishes: menu.dishes.map((dish) => {
      const selectedPhoto = landingPhotoForDish(dish)?.url ?? "";
      const imageUrl =
        landingPhotoForDish({
          ...dish,
          cardUrl: "",
          thumbnailUrl: "",
          posterUrl: ""
        })?.url ?? selectedPhoto;
      const thumbnailUrl =
        landingPhotoForDish({
          ...dish,
          cardUrl: "",
          imageUrl: "",
          posterUrl: ""
        })?.url ?? selectedPhoto;
      const cardUrl =
        landingPhotoForDish({
          ...dish,
          imageUrl: "",
          thumbnailUrl: "",
          posterUrl: ""
        })?.url ?? selectedPhoto;
      return {
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
        ...(dish.spiceLevel !== undefined
          ? { spiceLevel: dish.spiceLevel }
          : {}),
        ...(dish.dietaryType ? { dietaryType: dish.dietaryType } : {}),
        imageUrl,
        thumbnailUrl,
        cardUrl,
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
      };
    })
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
  menus: Partial<Record<PublicMenuLocale, LandingMenuUiMenu>>
): Partial<Record<PublicMenuLocale, PublicMenu>> {
  return Object.fromEntries(
    Object.entries(menus).flatMap(([locale, menu]) =>
      menu ? [[locale, inflateLandingMenuUiMenu(menu)]] : []
    )
  ) as Partial<Record<PublicMenuLocale, PublicMenu>>;
}
