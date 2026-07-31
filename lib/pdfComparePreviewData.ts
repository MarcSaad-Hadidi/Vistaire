import type { Allergen, Category, Dish } from "@/lib/demoMenuData";
import {
  getCategories,
  getDishBySlug,
  getDishCardImageObjectPosition,
  getDishesByCategorySlug,
  getRestaurant
} from "@/lib/demoMenuData";
import { formatPrice } from "@/lib/formatPrice";
import type { Locale } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing/landingCopy";
import { dishHasImmersiveAsset } from "@/lib/menuQuery";

export type PdfMenuRow = {
  name: string;
  price: string;
};

export type PdfMenuSection = {
  title: string;
  rows: PdfMenuRow[];
};

export type CompareCategoryTab = Pick<Category, "id" | "slug" | "name"> & {
  slug: string;
};

export type CompareCategoryPreview = Pick<Category, "id" | "slug" | "name"> & {
  slug: string;
  description: string;
  image: string | null;
  imageAlt: string;
  imageObjectPosition: string;
};

export type CompareDishPreview = {
  id?: string;
  slug: string;
  name: string;
  price: string;
  shortDescription: string;
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  image: string | null;
  imageAlt: string;
  imageObjectPosition: string;
  allergens: Allergen[];
  isSignature: boolean;
  isRecommended: boolean;
  has3d: boolean;
  isAvailable: boolean;
};

export type PdfComparePreviewData = {
  restaurant: {
    menuSlug?: string;
    name: string;
    tagline: string;
    location: string;
    logoMonogram: string;
    currency: string;
  };
  pdfSections: PdfMenuSection[];
  categoryTabs: CompareCategoryTab[];
  categoryCards: CompareCategoryPreview[];
  activeCategorySlug: string;
  vistaireDishes: CompareDishPreview[];
  featuredDish?: CompareDishPreview;
  presentation?: {
    theme: "maison-elyse" | "trouvable" | "sauge-noire";
    eyebrow: string;
    title: string;
    tagline: string;
    featuredKicker: string;
    featuredTitle: string;
    cta: string;
  };
};

const PDF_SECTION_SLUGS = [
  "entrees",
  "plats-signatures",
  "desserts",
  "cocktails"
] as const;
const VISTAIRE_PREVIEW_CATEGORY = "desserts";
const VISTAIRE_PREVIEW_DISH_SLUGS = ["tarte-citron-basilic", "souffle-chocolat"] as const;
type PdfSectionSlug = (typeof PDF_SECTION_SLUGS)[number];

const CATEGORY_CARD_COPY: Record<Locale, Record<PdfSectionSlug, string>> = {
  fr: {
    entrees: "Pour commencer doucement",
    "plats-signatures": "La sélection du moment",
    desserts: "Une touche sucrée",
    cocktails: "Classiques et créations du bar"
  },
  en: {
    entrees: "A refined opening",
    "plats-signatures": "The signature selection",
    desserts: "A final sweet note",
    cocktails: "Classics and house creations"
  }
};

export type PdfComparePreviewOptions = {
  activeCategorySlug?: string;
  vistaireDishSlugs?: readonly string[];
  locale?: Locale;
};

function formatPdfMenuPrice(amount: number): string {
  return `${amount} $`;
}

function toPdfRow(dish: Dish): PdfMenuRow {
  return {
    name: dish.name,
    price: formatPdfMenuPrice(dish.price)
  };
}

function toCompareDishPreview(
  dish: Dish,
  currency: string,
  locale: Locale
): CompareDishPreview {
  const copy = getLandingCopy(locale).comparison;
  return {
    id: dish.id,
    slug: dish.slug,
    name: dish.name,
    price: formatPrice(dish.price, currency),
    shortDescription: dish.shortDescription,
    categorySlug: dish.categorySlug,
    image: dish.image,
    imageAlt: copy.dishPhotoAlt(dish.name),
    imageObjectPosition: getDishCardImageObjectPosition(dish),
    allergens: dish.allergens,
    isSignature: dish.isSignature,
    isRecommended: dish.isRecommended,
    has3d: dishHasImmersiveAsset(dish),
    isAvailable: dish.isAvailable
  };
}

/** Source de vérité partagée avec `/demo` pour le slider PDF vs Vistaire. */
function isPreviewCategorySlug(slug: string): slug is PdfSectionSlug {
  return PDF_SECTION_SLUGS.includes(slug as PdfSectionSlug);
}

function toCompareCategoryPreview(
  category: Category,
  locale: Locale
): CompareCategoryPreview {
  const copy = getLandingCopy(locale).comparison;
  const dishes = getDishesByCategorySlug(category.slug, locale);
  const heroDish =
    dishes.find((dish) => dish.isRecommended && dish.image) ??
    dishes.find((dish) => dish.isSignature && dish.image) ??
    dishes.find((dish) => dish.image);

  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: isPreviewCategorySlug(category.slug)
      ? CATEGORY_CARD_COPY[locale][category.slug]
      : category.description,
    image: heroDish?.image ?? null,
    imageAlt: heroDish
      ? copy.categoryPhotoAlt(category.name, heroDish.name)
      : copy.categoryAlt(category.name),
    imageObjectPosition: heroDish ? getDishCardImageObjectPosition(heroDish) : "center 50%"
  };
}

export function buildPdfComparePreviewData(
  options: PdfComparePreviewOptions = {}
): PdfComparePreviewData {
  const locale = options.locale ?? "fr";
  const activeCategorySlug = options.activeCategorySlug ?? VISTAIRE_PREVIEW_CATEGORY;
  const vistaireDishSlugs = options.vistaireDishSlugs ?? VISTAIRE_PREVIEW_DISH_SLUGS;
  const restaurant = getRestaurant(locale);
  const categories = getCategories(locale);

  const pdfSections: PdfMenuSection[] = PDF_SECTION_SLUGS.map((slug) => {
    const category = categories.find((entry) => entry.slug === slug);
    const rows = getDishesByCategorySlug(slug, locale).map(toPdfRow);
    return {
      title: category?.name ?? slug,
      rows
    };
  });

  const categoryTabs: CompareCategoryTab[] = [
    {
      id: "tab-tous",
      slug: "tous",
      name: locale === "en" ? "All" : "Tous"
    },
    ...categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name
    }))
  ];

  const previewCategories = categories.filter((category) =>
    isPreviewCategorySlug(category.slug)
  );
  const categoryCards = previewCategories.map((category) =>
    toCompareCategoryPreview(category, locale)
  );
  const previewDishes = previewCategories.flatMap((category) =>
    getDishesByCategorySlug(category.slug, locale)
  );
  const featuredDishSource =
    previewDishes.find((dish) => dish.isSignature && dish.isRecommended) ??
    previewDishes.find((dish) => dish.isRecommended) ??
    previewDishes[0];

  const vistaireDishes = vistaireDishSlugs.map((slug) => {
    const dish = getDishBySlug(slug, locale);
    if (!dish) {
      throw new Error(`Missing demo dish for PDF compare preview: ${slug}`);
    }
    return toCompareDishPreview(dish, restaurant.currency, locale);
  });

  return {
    restaurant: {
      menuSlug: "maison-elyse",
      name: restaurant.name,
      tagline: restaurant.tagline,
      location: restaurant.location,
      logoMonogram: restaurant.logoMonogram,
      currency: restaurant.currency
    },
    pdfSections,
    categoryTabs,
    categoryCards,
    activeCategorySlug,
    vistaireDishes,
    featuredDish: featuredDishSource
      ? toCompareDishPreview(featuredDishSource, restaurant.currency, locale)
      : undefined
  };
}
