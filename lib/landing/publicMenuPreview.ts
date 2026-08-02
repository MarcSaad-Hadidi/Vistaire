import type { Locale } from "@/lib/i18n";
import {
  formatLandingCopyTemplate,
  getLandingCopy,
  type LandingCopy
} from "@/lib/landing/landingCopy";
import {
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import {
  findLandingDishByIdentity,
  landingPhotoForDish,
  type LandingDishPhoto
} from "@/lib/landing/landingDishIdentity";
import type {
  CompareDishPreview,
  PdfComparePreviewData,
  PdfMenuSection
} from "@/lib/pdfComparePreviewData";

type LandingPreviewTheme = NonNullable<
  PdfComparePreviewData["presentation"]
>["theme"];

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function imageForDish(dish: PublicMenuDish) {
  return landingPhotoForDish(dish)?.url ?? null;
}

export function photoForDish(dish: PublicMenuDish): LandingDishPhoto | null {
  return landingPhotoForDish(dish);
}

function toPreviewDish(
  dish: PublicMenuDish,
  copy: LandingCopy["comparison"]
): CompareDishPreview {
  return {
    id: dish.id,
    slug: dish.slug,
    name: dish.name,
    price: dish.priceLabel,
    shortDescription: dish.description,
    categoryId: dish.categoryId,
    categorySlug: dish.categorySlug,
    categoryName: dish.category,
    image: imageForDish(dish),
    imageAlt: formatLandingCopyTemplate(copy.dishPhotoAlt, {
      dishName: dish.name
    }),
    imageObjectPosition: "center",
    allergens: [],
    isSignature: Boolean(dish.isSignature),
    isRecommended: Boolean(dish.isRecommended),
    has3d: false,
    isAvailable: dish.available
  };
}

function categoryDishes(
  dishes: PublicMenuDish[],
  category: { id: string; label: string; slug?: string }
) {
  return dishes.filter(
    (dish) =>
      dish.categoryId === category.id ||
      (Boolean(category.slug) && dish.categorySlug === category.slug) ||
      dish.category === category.label
  );
}

function pickFeaturedDish(
  dishes: PublicMenuDish[],
  preferredDishId?: string,
  preferredDishSlug?: string
) {
  const available = dishes.filter((dish) => dish.available);
  const candidates = available;
  const preferredDish = findLandingDishByIdentity(candidates, {
    id: preferredDishId,
    slug: preferredDishSlug
  });
  return (
    (preferredDish && imageForDish(preferredDish) ? preferredDish : undefined) ??
    candidates.find(
      (dish) =>
        dish.isRecommended && dish.isSignature && Boolean(imageForDish(dish))
    ) ??
    candidates.find(
      (dish) => dish.isRecommended && Boolean(imageForDish(dish))
    ) ??
    candidates.find((dish) => dish.isSignature && Boolean(imageForDish(dish))) ??
    candidates.find((dish) => Boolean(imageForDish(dish))) ??
    (preferredDish ?? undefined) ??
    candidates[0]
  );
}

export function buildFullPdfMenuData(menu: PublicMenu): PdfMenuSection[] {
  const availableDishes = menu.dishes.filter((dish) => dish.available);
  return getVisiblePublicMenuCategories(availableDishes).map((category) => ({
    title: category.label,
    rows: categoryDishes(availableDishes, category).map((dish) => ({
      name: dish.name,
      price: dish.priceLabel
    }))
  }));
}

export function buildCurrentPublicMenuPreview({
  locale,
  menu,
  preferredDishId,
  preferredDishSlug,
  theme
}: {
  locale: Locale;
  menu: PublicMenu;
  preferredDishId?: string;
  preferredDishSlug?: string;
  theme: LandingPreviewTheme;
}): {
  preview: PdfComparePreviewData;
  featuredDish: PublicMenuDish | null;
} {
  const currentDishes = menu.dishes.filter((dish) => dish.available);
  const copy = getLandingCopy(locale).comparison;
  const categories = getVisiblePublicMenuCategories(currentDishes);
  const featuredDish =
    pickFeaturedDish(currentDishes, preferredDishId, preferredDishSlug) ?? null;
  const categoryCards = categories.map((category) => {
    const dishesInCategory = categoryDishes(currentDishes, category);
    const representative =
      dishesInCategory.find(
        (dish) => dish.isRecommended && Boolean(imageForDish(dish))
      ) ??
      dishesInCategory.find((dish) => Boolean(imageForDish(dish))) ??
      dishesInCategory[0];

    return {
      id: category.id,
      slug: category.slug ?? category.id,
      name: category.label,
      description: category.description,
      image: representative ? imageForDish(representative) : null,
      imageAlt: representative
        ? formatLandingCopyTemplate(copy.categoryPhotoAlt, {
            categoryName: category.label,
            dishName: representative.name
          })
        : formatLandingCopyTemplate(copy.categoryAlt, {
            categoryName: category.label
          }),
      imageObjectPosition: "center"
    };
  });
  const previewDishes = currentDishes.map((dish) => toPreviewDish(dish, copy));
  const featuredPreview = featuredDish
    ? toPreviewDish(featuredDish, copy)
    : previewDishes[0];
  const allLabel = locale === "en" ? "All" : "Tous";
  const locationLine = [menu.cuisineType, menu.location]
    .filter(Boolean)
    .join(" · ");

  return {
    featuredDish,
    preview: {
      restaurant: {
        menuSlug: menu.slug,
        name: menu.name,
        tagline: menu.cuisineType,
        location: menu.location,
        logoMonogram: monogram(menu.name),
        currency: menu.settings.defaultCurrency
      },
      pdfSections: buildFullPdfMenuData(menu),
      categoryTabs: [
        { id: `${menu.slug}-all`, slug: "all", name: allLabel },
        ...categoryCards.map(({ id, slug, name }) => ({ id, slug, name }))
      ],
      categoryCards,
      activeCategorySlug: categoryCards[0]?.slug ?? "all",
      vistaireDishes: previewDishes,
      ...(featuredPreview ? { featuredDish: featuredPreview } : {}),
      presentation: {
        theme,
        eyebrow: locale === "en" ? "Current digital menu" : "Carte digitale actuelle",
        title: menu.name,
        tagline:
          locationLine ||
          (locale === "en"
            ? "Explore the restaurant’s current menu."
            : "Découvrez la carte actuelle du restaurant."),
        featuredKicker: locale === "en" ? "From the menu" : "À la carte",
        featuredTitle:
          locale === "en" ? "A dish to discover" : "Un plat à découvrir",
        cta: locale === "en" ? "View the full menu" : "Voir toute la carte"
      }
    }
  };
}
