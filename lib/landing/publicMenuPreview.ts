import type { Locale } from "@/lib/i18n";
import {
  getVisiblePublicMenuCategories,
  type PublicMenu,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type {
  CompareDishPreview,
  PdfComparePreviewData
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

function imageForDish(dish: PublicMenuDish) {
  return dish.imageUrl || dish.thumbnailUrl || dish.posterUrl || null;
}

function toPreviewDish(dish: PublicMenuDish): CompareDishPreview {
  return {
    slug: dish.slug,
    name: dish.name,
    price: dish.priceLabel,
    shortDescription: dish.description,
    image: imageForDish(dish),
    imageAlt: `Photo du plat : ${dish.name}`,
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
      dish.categorySlug === category.slug ||
      dish.category === category.label
  );
}

function pickFeaturedDish(
  dishes: PublicMenuDish[],
  preferredDishSlug?: string
) {
  const available = dishes.filter((dish) => dish.available);
  const candidates = available.length ? available : dishes;
  return (
    candidates.find((dish) => dish.slug === preferredDishSlug) ??
    candidates.find(
      (dish) =>
        dish.isRecommended && dish.isSignature && Boolean(imageForDish(dish))
    ) ??
    candidates.find(
      (dish) => dish.isRecommended && Boolean(imageForDish(dish))
    ) ??
    candidates.find((dish) => dish.isSignature && Boolean(imageForDish(dish))) ??
    candidates.find((dish) => Boolean(imageForDish(dish))) ??
    candidates[0]
  );
}

export function buildCurrentPublicMenuPreview({
  locale,
  menu,
  preferredDishSlug,
  theme
}: {
  locale: Locale;
  menu: PublicMenu;
  preferredDishSlug?: string;
  theme: LandingPreviewTheme;
}): {
  preview: PdfComparePreviewData;
  featuredDish: PublicMenuDish | null;
} {
  const dishes = menu.dishes.filter((dish) => dish.available);
  const currentDishes = dishes.length ? dishes : menu.dishes;
  const categories = getVisiblePublicMenuCategories(currentDishes);
  const visibleCategories = categories.slice(0, 3);
  const featuredDish = pickFeaturedDish(currentDishes, preferredDishSlug) ?? null;
  const categoryCards = visibleCategories.map((category) => {
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
        ? `Photo de la catégorie ${category.label} : ${representative.name}`
        : `Catégorie ${category.label}`,
      imageObjectPosition: "center"
    };
  });
  const previewDishes = currentDishes.slice(0, 6).map(toPreviewDish);
  const featuredPreview = featuredDish
    ? toPreviewDish(featuredDish)
    : previewDishes[0];
  const allLabel = locale === "en" ? "All" : "Tous";
  const locationLine = [menu.cuisineType, menu.location]
    .filter(Boolean)
    .join(" · ");

  return {
    featuredDish,
    preview: {
      restaurant: {
        name: menu.name,
        tagline: menu.cuisineType,
        location: menu.location,
        logoMonogram: monogram(menu.name),
        currency: menu.settings.defaultCurrency
      },
      pdfSections: visibleCategories.map((category) => ({
        title: category.label,
        rows: categoryDishes(currentDishes, category)
          .slice(0, 3)
          .map((dish) => ({
            name: dish.name,
            price: dish.priceLabel
          }))
      })),
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
