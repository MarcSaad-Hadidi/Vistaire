import { getAllDishes, getCategories } from "@/lib/demoMenuData";
import type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

const MAISON_LIVE_TO_DEMO_SLUG = Object.freeze({
  "risotto-aux-cepes-parmesan-reggiano": "risotto-cepe",
  "homard-bleu-bisque-corsee-fenouil": "homard-bisque",
  "souffle-tiede-au-chocolat-grand-cru": "souffle-chocolat",
  "tartare-de-saumon-label-rouge": "tartare-saumon",
  "tarte-citron-confit-basilic-pourpre": "tarte-citron-basilic",
  "negroni-vieilli-en-fut": "negroni-fut",
  "canette-rotie-aux-figues-epices-douces": "canette-aux-figues",
  "bar-de-ligne-artichaut-poivrade-emulsion-citron-beldi": "bar-ligne",
  "pave-de-b-uf-mature-puree-ratte-jus-bordelaise": "pave-boeuf",
  "elixir-bergamote-the-earl-grey": "mocktail-bergamote",
  "maison-elyse-n-1": "cocktail-maison-elyse",
  "ravioles-de-chevre-frais-miel-de-monteregie": "ravioles-romarin"
});

function normalizeMenuKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function categoryForDish(
  dish: PublicMenuDish,
  demoCategorySlug: string,
  categories: ReturnType<typeof getCategories>
) {
  const liveKeys = [dish.categorySlug, dish.category]
    .filter(Boolean)
    .map((value) => normalizeMenuKey(value ?? "").replace(/^cat-/, ""));

  return (
    categories.find((category) => liveKeys.includes(normalizeMenuKey(category.slug))) ??
    categories.find((category) => liveKeys.includes(normalizeMenuKey(category.name))) ??
    categories.find((category) => category.slug === demoCategorySlug)
  );
}

function translatedMaisonDish(
  dish: PublicMenuDish,
  demoDishes: ReturnType<typeof getAllDishes>,
  categories: ReturnType<typeof getCategories>
): PublicMenuDish {
  const demoSlug =
    MAISON_LIVE_TO_DEMO_SLUG[
      dish.slug as keyof typeof MAISON_LIVE_TO_DEMO_SLUG
    ];
  const demoDish = demoDishes.find((candidate) => candidate.slug === demoSlug);
  if (!demoDish) return dish;

  const category = categoryForDish(dish, demoDish.categorySlug, categories);
  const tags = [
    dish.isSignature ? "Signature" : "",
    dish.isRecommended ? "Recommended" : "",
    dish.available ? "" : "Unavailable"
  ].filter(Boolean);

  return {
    ...dish,
    name: demoDish.name,
    description: demoDish.description,
    ...(category
      ? {
          category: category.name,
          categoryDescription: category.description,
          categorySlug: category.slug
        }
      : {}),
    ingredients: demoDish.ingredients,
    allergens: demoDish.allergens,
    options: demoDish.options,
    houseNote: demoDish.chefRecommendation,
    tags
  };
}

/**
 * Compatibility data for the live Maison Élyse menu while its owner-managed
 * English translation rows are being backfilled. The live IDs, prices,
 * photos, availability and immersive assets remain authoritative.
 */
export function buildMaisonEnglishPublicMenu(menu: PublicMenu): PublicMenu {
  const demoDishes = getAllDishes("en");
  const categories = getCategories("en");
  const dishes = menu.dishes.map((dish) =>
    translatedMaisonDish(dish, demoDishes, categories)
  );
  const matchedDishes = dishes.filter(
    (dish, index) => dish.name !== menu.dishes[index]?.name
  ).length;

  if (matchedDishes === 0) return menu;

  const supportedLocales = Array.from(
    new Set([...menu.settings.supportedLocales, "fr-CA", "en-CA"])
  ) as typeof menu.settings.supportedLocales;
  const translationLocales = [
    ...(menu.translationLocales ?? []).filter(
      (status) => status.locale !== "en-CA"
    ),
    { locale: "en-CA", status: "up_to_date" as const }
  ];

  return {
    ...menu,
    menuName: "Main Menu",
    settings: {
      ...menu.settings,
      supportedLocales,
      defaultLocale: menu.settings.defaultLocale
    },
    activeLocale: "en-CA",
    translationLocales,
    translationStatus: { locale: "en-CA", status: "up_to_date" },
    dishes
  };
}
