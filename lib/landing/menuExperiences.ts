import "server-only";

import { unstable_cache } from "next/cache";
import type { Locale } from "@/lib/i18n";
import {
  projectLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";
import { buildCurrentPublicMenuPreview } from "@/lib/landing/publicMenuPreview";
import { buildPublicDishPath } from "@/lib/menu/publicMenuCore";
import {
  resolvePublicMenuRenderContext,
  type PublicMenuRenderContext
} from "@/lib/menu/publicMenuRenderContext";
import type { UniqueMenuRendererKey } from "@/lib/menu/uniqueMenuRendererRegistry";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";

export type LandingExperienceId =
  | "maison-elyse"
  | "trouvable"
  | "sauge-noire";

const LANDING_EXPERIENCE_IDS: readonly LandingExperienceId[] = [
  "maison-elyse",
  "trouvable",
  "sauge-noire"
];

export function isLandingExperienceId(
  value: string
): value is LandingExperienceId {
  return LANDING_EXPERIENCE_IDS.includes(value as LandingExperienceId);
}

export type LandingFeaturedDish = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  href: string;
  image: string;
  imageSource: "imageUrl" | "thumbnailUrl" | "posterUrl" | "fallback" | "unavailable";
  imageAlt: string;
  imagePosition: string;
};

type LandingPreviewBase = {
  menuSlug: LandingExperienceId;
  restaurantId: string;
  menuId?: string;
  locale: Locale;
  publicMenuHref: string;
  comparison: PdfComparePreviewData;
  menuUi: LandingMenuUiPreview;
};

export type LandingMenuPreviewPayload =
  | (LandingPreviewBase & {
      kind: "maison-elyse";
    })
  | (LandingPreviewBase & {
      kind: "trouvable";
    })
  | (LandingPreviewBase & {
      kind: "unique-registered";
      rendererKey: UniqueMenuRendererKey;
      rendererVersion: number;
    });

export type LandingExperience = {
  id: LandingExperienceId;
  menuSlug: LandingExperienceId;
  name: "Maison Élyse" | "Trouvable" | "Sauge Noire";
  label: string;
  publicMenuHref: string;
  image: string;
  imageAlt: string;
  imagePosition: string;
  preferredDishSlug: string;
  dishView?: string;
  featuredDish: LandingFeaturedDish;
  preview: PdfComparePreviewData;
  renderPayload: LandingMenuPreviewPayload | null;
};

function presentationFor(
  locale: Locale,
  theme: LandingExperienceId,
  name: LandingExperience["name"]
): NonNullable<PdfComparePreviewData["presentation"]> {
  return {
    theme,
    eyebrow: locale === "en" ? "Current digital menu" : "Carte digitale actuelle",
    title: name,
    tagline:
      locale === "en"
        ? "A lightweight preview based on the restaurant’s current public menu."
        : "Un aperçu léger fondé sur la carte publique actuelle du restaurant.",
    featuredKicker: locale === "en" ? "From the menu" : "À la carte",
    featuredTitle:
      locale === "en" ? "A dish to discover" : "Un plat à découvrir",
    cta: locale === "en" ? "View the full menu" : "Voir toute la carte"
  };
}

function fallbackPreview({
  dish,
  locale,
  name,
  theme
}: {
  dish: LandingFeaturedDish;
  locale: Locale;
  name: LandingExperience["name"];
  theme: LandingExperienceId;
}): PdfComparePreviewData {
  const categoryName = locale === "en" ? "Current selection" : "Sélection actuelle";
  const categoryDescription =
    locale === "en"
      ? "A real dish from the public menu"
      : "Un plat réel de la carte publique";
  const previewDish = {
    id: dish.id,
    slug: dish.href.split("/dishes/")[1]?.split("?")[0] ?? theme,
    name: dish.name,
    price: dish.price,
    shortDescription: dish.description,
    categorySlug: "current",
    categoryName,
    image: dish.image,
    imageAlt: dish.imageAlt,
    imageObjectPosition: dish.imagePosition,
    allergens: [],
    isSignature: true,
    isRecommended: true,
    has3d: false,
    isAvailable: true
  };

  return {
    restaurant: {
      name,
      tagline: "",
      location: "",
      logoMonogram: name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2),
      currency: "CAD"
    },
    pdfSections: [
      {
        title: categoryName,
        rows: [{ name: dish.name, price: dish.price }]
      }
    ],
    categoryTabs: [
      { id: `${theme}-all`, slug: "all", name: locale === "en" ? "All" : "Tous" },
      { id: `${theme}-current`, slug: "current", name: categoryName }
    ],
    categoryCards: [
      {
        id: `${theme}-current`,
        slug: "current",
        name: categoryName,
        description: categoryDescription,
        image: dish.image || null,
        imageAlt: dish.imageAlt,
        imageObjectPosition: dish.imagePosition
      }
    ],
    activeCategorySlug: "current",
    vistaireDishes: [previewDish],
    featuredDish: previewDish,
    presentation: presentationFor(locale, theme, name)
  };
}

function fallbackExperiences(locale: Locale): LandingExperience[] {
  const lang = locale === "en" ? "en-CA" : "fr-CA";
  const maisonDish: LandingFeaturedDish = {
    slug: "ravioles-de-chevre-frais-miel-de-monteregie",
    name:
      locale === "en"
        ? "Fresh goat cheese ravioli & Montérégie honey"
        : "Ravioles de chèvre frais & miel de Montérégie",
    description:
      locale === "en"
        ? "Open the current dish page in the Maison Élyse menu."
        : "Ouvrez la fiche actuelle dans la carte Maison Élyse.",
    price: "",
    href: buildPublicDishPath(
      "maison-elyse",
      "ravioles-de-chevre-frais-miel-de-monteregie",
      { lang }
    ),
    image: "",
    imageSource: "unavailable",
    imageAlt:
      locale === "en"
        ? "Fresh goat cheese ravioli from Maison Élyse"
        : "Ravioles de chèvre frais de Maison Élyse",
    imagePosition: "center"
  };
  const trouvableDish: LandingFeaturedDish = {
    slug: "pesto-burrata-verde",
    name: "Pesto Burrata Verde",
    description:
      locale === "en"
        ? "Open the current dish page in the Trouvable menu."
        : "Ouvrez la fiche actuelle dans la carte Trouvable.",
    price: "",
    href: buildPublicDishPath("trouvable", "pesto-burrata-verde", { lang }),
    image: "",
    imageSource: "unavailable",
    imageAlt: "Pesto Burrata Verde de Trouvable",
    imagePosition: "center"
  };
  const saugeDish: LandingFeaturedDish = {
    slug: "betterave-sous-la-cendre",
    name: locale === "en" ? "Beetroot under ash" : "Betterave sous la cendre",
    description:
      locale === "en"
        ? "Open the current dish page in the Sauge Noire menu."
        : "Ouvrez la fiche actuelle dans la carte Sauge Noire.",
    price: "",
    href: buildPublicDishPath("sauge-noire", "betterave-sous-la-cendre", {
      lang,
      view: "sauge-2"
    }),
    image: "",
    imageSource: "unavailable",
    imageAlt:
      locale === "en"
        ? "Beetroot under ash from Sauge Noire"
        : "Betterave sous la cendre de Sauge Noire",
    imagePosition: "center"
  };

  return [
    {
      id: "maison-elyse",
      menuSlug: "maison-elyse",
      name: "Maison Élyse",
      label:
        locale === "en"
          ? "Editorial and gastronomic"
          : "Éditoriale et gastronomique",
      publicMenuHref: buildPublicMenuPath("maison-elyse", { lang }),
      image: "/images/landing/maison-elyse-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Bright, refined dining-room atmosphere"
          : "Ambiance de salle claire et raffinée",
      imagePosition: "center 45%",
      preferredDishSlug: "ravioles-de-chevre-frais-miel-de-monteregie",
      featuredDish: maisonDish,
      preview: fallbackPreview({
        dish: maisonDish,
        locale,
        name: "Maison Élyse",
        theme: "maison-elyse"
      }),
      renderPayload: null
    },
    {
      id: "trouvable",
      menuSlug: "trouvable",
      name: "Trouvable",
      label:
        locale === "en" ? "Modern and interactive" : "Moderne et interactive",
      publicMenuHref: buildPublicMenuPath("trouvable", { lang }),
      image: "/images/landing/trouvable-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Warm bistro and bar atmosphere with plants"
          : "Ambiance de bistro chaleureux avec bar et végétation",
      imagePosition: "center 52%",
      preferredDishSlug: "pesto-burrata-verde",
      featuredDish: trouvableDish,
      preview: fallbackPreview({
        dish: trouvableDish,
        locale,
        name: "Trouvable",
        theme: "trouvable"
      }),
      renderPayload: null
    },
    {
      id: "sauge-noire",
      menuSlug: "sauge-noire",
      name: "Sauge Noire",
      label:
        locale === "en"
          ? "Distinctive and immersive"
          : "Signature et immersive",
      publicMenuHref: buildPublicMenuPath("sauge-noire", { lang }),
      image: "/images/landing/sauge-noire-experience.jpg",
      imageAlt:
        locale === "en"
          ? "Dark botanical dining-room atmosphere"
          : "Ambiance de salle sombre et botanique",
      imagePosition: "center 42%",
      preferredDishSlug: "betterave-sous-la-cendre",
      dishView: "sauge-2",
      featuredDish: saugeDish,
      preview: fallbackPreview({
        dish: saugeDish,
        locale,
        name: "Sauge Noire",
        theme: "sauge-noire"
      }),
      renderPayload: null
    }
  ];
}

function landingRenderPayload(
  experience: LandingExperience,
  context: PublicMenuRenderContext,
  comparison: PdfComparePreviewData
): LandingMenuPreviewPayload | null {
  if (context.menu.slug !== experience.menuSlug) {
    throw new Error(
      `Landing experience ${experience.id} resolved the wrong menu: ${context.menu.slug}`
    );
  }
  const base: LandingPreviewBase = {
    menuSlug: experience.menuSlug,
    restaurantId: context.menu.restaurantId,
    ...(context.menu.menuId ? { menuId: context.menu.menuId } : {}),
    locale: context.locale,
    publicMenuHref: experience.publicMenuHref,
    comparison,
    menuUi: {
      menu: projectLandingMenuUiMenu(context.menu),
      localizedMenus: Object.fromEntries(
        Object.entries(context.localizedMenus).flatMap(([locale, menu]) =>
          locale !== context.locale && menu
            ? [[locale, projectLandingMenuUiMenu(menu)]]
            : []
        )
      ),
      config: context.config,
      context: context.context,
      query: context.query,
      exchangeRates: context.exchangeRates
    }
  };

  if (
    experience.id === "maison-elyse" &&
    context.experience.kind === "maison-elyse"
  ) {
    return {
      ...base,
      kind: "maison-elyse"
    };
  }

  if (
    experience.id === "trouvable" &&
    context.experience.kind === "trouvable"
  ) {
    return {
      ...base,
      kind: "trouvable"
    };
  }

  if (
    experience.id === "sauge-noire" &&
    context.experience.kind === "unique-registered" &&
    context.experience.rendererKey === "sauge-noire-book-v1" &&
    context.experience.rendererVersion === 1
  ) {
    return {
      ...base,
      kind: "unique-registered",
      rendererKey: "sauge-noire-book-v1",
      rendererVersion: 1
    };
  }

  return null;
}

async function buildLandingExperiences(
  locale: Locale
): Promise<LandingExperience[]> {
  const lang = locale === "en" ? "en-CA" : "fr-CA";
  const fallbacks = fallbackExperiences(locale);

  const resolved = await Promise.all(
    fallbacks.map(async (experience) => {
      try {
        const renderContext = await resolvePublicMenuRenderContext({
          slug: experience.menuSlug,
          query: {
            lang,
            ...(experience.dishView ? { view: experience.dishView } : {})
          }
        });
        if (!renderContext?.menu.dishes.length) return experience;
        const menu = renderContext.menu;
        const current = buildCurrentPublicMenuPreview({
          locale,
          menu,
          preferredDishSlug: experience.preferredDishSlug,
          theme: experience.id
        });
        if (!current.featuredDish) {
          return {
            ...experience,
            preview: current.preview,
            renderPayload:
              experience.id === "maison-elyse"
                ? landingRenderPayload(experience, renderContext, current.preview)
                : null
          };
        }
        const dish = current.featuredDish;
        const image = dish.imageUrl || dish.thumbnailUrl || dish.posterUrl || "";
        const imageSource: LandingFeaturedDish["imageSource"] = dish.imageUrl
          ? "imageUrl"
          : dish.thumbnailUrl
            ? "thumbnailUrl"
            : dish.posterUrl
              ? "posterUrl"
              : "unavailable";

        return {
          ...experience,
          preview: experience.preview,
          renderPayload:
            experience.id === "maison-elyse"
              ? landingRenderPayload(experience, renderContext, current.preview)
              : null,
          featuredDish: {
            id: dish.id,
            slug: dish.slug,
            name: dish.name,
            description: dish.description,
            price: dish.priceLabel,
            href: buildPublicDishPath(menu.slug, dish.slug, {
              lang,
              ...(experience.dishView ? { view: experience.dishView } : {})
            }),
            image,
            imageSource,
            imageAlt:
              locale === "en"
                ? `${dish.name}, from ${experience.name}`
                : `${dish.name}, dans la carte ${experience.name}`,
            imagePosition: "center"
          }
        };
      } catch {
        return experience;
      }
    })
  );

  const claimedImages = new Set<string>();
  return resolved.map((experience) => {
    const image = experience.featuredDish.image;
    if (!image || !claimedImages.has(image)) {
      if (image) claimedImages.add(image);
      return experience;
    }
    return {
      ...experience,
      featuredDish: {
        ...experience.featuredDish,
        image: "",
        imageSource: "unavailable" as const
      }
    };
  });
}

const getCachedLandingExperiences = unstable_cache(
  buildLandingExperiences,
  ["landing-menu-experiences-v3"],
  { revalidate: 60 }
);

export async function getLandingExperiences(
  locale: Locale
): Promise<LandingExperience[]> {
  return getCachedLandingExperiences(locale);
}

async function buildLandingMenuPreviewPayload(
  experienceId: LandingExperienceId,
  locale: Locale
): Promise<LandingMenuPreviewPayload | null> {
  const experience = fallbackExperiences(locale).find(
    (candidate) => candidate.id === experienceId
  );
  if (!experience) return null;

  const lang = locale === "en" ? "en-CA" : "fr-CA";
  const renderContext = await resolvePublicMenuRenderContext({
    slug: experience.menuSlug,
    query: {
      lang,
      ...(experience.dishView ? { view: experience.dishView } : {})
    }
  });
  if (!renderContext?.menu.dishes.length) return null;

  const current = buildCurrentPublicMenuPreview({
    locale,
    menu: renderContext.menu,
    preferredDishSlug: experience.preferredDishSlug,
    theme: experience.id
  });

  return landingRenderPayload(experience, renderContext, current.preview);
}

const getCachedLandingMenuPreviewPayload = unstable_cache(
  buildLandingMenuPreviewPayload,
  ["landing-menu-preview-payload-v2"],
  { revalidate: 60 }
);

export async function getLandingMenuPreviewPayload(
  experienceId: LandingExperienceId,
  locale: Locale
): Promise<LandingMenuPreviewPayload | null> {
  return getCachedLandingMenuPreviewPayload(experienceId, locale);
}
