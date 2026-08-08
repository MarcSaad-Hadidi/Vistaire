import "server-only";

import { unstable_cache } from "next/cache";
import { LOCALE_LANGUAGE_TAG, type Locale } from "@/lib/i18n";
import {
  projectLandingMenuUiMenu,
  type LandingMenuUiPreview
} from "@/lib/landing/landingMenuUiPreview";
import { buildCurrentPublicMenuPreview } from "@/lib/landing/publicMenuPreview";
import {
  dedupeLandingDishPhotos,
  resolveLandingDishPhoto
} from "@/lib/landing/landingDishIdentity";
import { buildPublicDishPath } from "@/lib/menu/publicMenuCore";
import {
  resolvePublicMenuRenderContext,
  type PublicMenuRenderContext
} from "@/lib/menu/publicMenuRenderContext";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import type { PdfComparePreviewData } from "@/lib/pdfComparePreviewData";
import { getMaisonElyseIdentity } from "@/lib/owner/demoCapabilities";
import type { LandingPublicMenuHref } from "@/components/landing/LandingPublicMenuLink";
import {
  isRestaurantExperienceId,
  type RestaurantExperienceId,
  type RestaurantMenuPreviewBase,
  type RestaurantMenuPreviewPayload
} from "@/lib/restaurant-experiences/contracts";

export type LandingExperienceId = RestaurantExperienceId;

type LandingPreviewBase = RestaurantMenuPreviewBase & {
  menuUi: LandingMenuUiPreview;
};

export function isLandingExperienceId(
  value: string
): value is LandingExperienceId {
  return isRestaurantExperienceId(value);
}

export type LandingFeaturedDish = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: string;
  href: LandingPublicMenuHref;
  image: string;
  imageSource: "imageUrl" | "thumbnailUrl" | "posterUrl" | "fallback" | "unavailable";
  imageAlt: string;
  imagePosition: string;
};

const LANDING_FALLBACK_DISH_PHOTOS = Object.freeze({
  maisonElyse:
    "/api/public/menu-dishes/fd64dc12-8bd2-4669-be63-51cf0d50b839/photo?v=a4ab316568668db121d32130ba53e60f2093872faaf106cbd4ceede879ec1f1f",
  trouvable:
    "/api/public/menu-dishes/7a312411-975a-4a12-9e74-d435a7c83406/photo?v=8701433fa5746feec3c320d717f3aea74980e9db52715ad9d0109ff7dd3d3d29",
  saugeNoire:
    "/api/public/menu-dishes/cb7121a7-a8df-4650-8453-df83135defeb/photo?v=bd0c28bbf0139fcccb7c224c20c5770292b856213f316702737dc1e97a21a894"
});

export type LandingMenuPreviewPayload = RestaurantMenuPreviewPayload;

export type LandingMenuPreviewErrorCode =
  | "landing_identity_mismatch"
  | "landing_locale_mismatch"
  | "landing_translation_not_ready";

export class LandingMenuPreviewError extends Error {
  readonly status = 424;

  constructor(
    readonly code: LandingMenuPreviewErrorCode,
    message: string,
    readonly details: Record<string, string>
  ) {
    super(message);
    this.name = "LandingMenuPreviewError";
  }
}

export function assertLandingMenuPreviewReady(
  context: Pick<
    PublicMenuRenderContext,
    "locale" | "publicLocale" | "query" | "menu"
  >,
  requestedLocale: Locale
): void {
  const expectedPublicLocale = LOCALE_LANGUAGE_TAG[requestedLocale];
  const actualActiveLocale = context.menu.activeLocale ?? "";
  const queryLang = context.query.lang ?? "";

  if (
    context.locale !== requestedLocale ||
    context.publicLocale !== expectedPublicLocale ||
    actualActiveLocale !== expectedPublicLocale ||
    queryLang !== expectedPublicLocale
  ) {
    throw new LandingMenuPreviewError(
      "landing_locale_mismatch",
      `Landing menu preview resolved ${context.publicLocale} instead of ${expectedPublicLocale}.`,
      {
        requestedLocale,
        expectedPublicLocale,
        actualPublicLocale: context.publicLocale,
        actualActiveLocale,
        queryLang
      }
    );
  }

  const status = context.menu.translationStatus?.status;
  const isReady =
    requestedLocale === "fr"
      ? status === "source" || status === "up_to_date"
      : status === "up_to_date";
  if (!isReady) {
    throw new LandingMenuPreviewError(
      "landing_translation_not_ready",
      `Landing menu preview translation is not ready for ${expectedPublicLocale}.`,
      {
        requestedLocale,
        expectedPublicLocale,
        translationStatus: status ?? "missing"
      }
    );
  }
}

export type LandingExperience = {
  id: LandingExperienceId;
  menuSlug: LandingExperienceId;
  name: "Maison Élyse" | "Trouvable" | "Sauge Noire";
  label: string;
  publicMenuHref: LandingPublicMenuHref;
  image: string;
  imageAlt: string;
  imagePosition: string;
  preferredDishSlug: string;
  dishView?: string;
  featuredDish: LandingFeaturedDish;
  preview: PdfComparePreviewData;
  renderPayload: LandingMenuPreviewPayload | null;
  hasLiveData: boolean;
};

function toLandingPublicMenuHref(href: string): LandingPublicMenuHref {
  if (!href.startsWith("/menu/")) {
    throw new Error(`Landing public menu href must start with /menu/: ${href}`);
  }
  return href as LandingPublicMenuHref;
}

function buildLandingFeaturedDishHref(
  experience: Pick<
    LandingExperience,
    "dishView" | "featuredDish" | "id" | "menuSlug"
  >,
  locale: Locale
): LandingPublicMenuHref {
  return toLandingPublicMenuHref(
    buildPublicDishPath(
      experience.menuSlug,
      experience.featuredDish.slug,
      {
        lang: locale === "en" ? "en-CA" : "fr-CA",
        ...(experience.id === "sauge-noire" && experience.dishView
          ? { view: experience.dishView }
          : {})
      }
    )
  );
}

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
  const lang = LOCALE_LANGUAGE_TAG[locale];
  const maisonDish: LandingFeaturedDish = {
    id: "fd64dc12-8bd2-4669-be63-51cf0d50b839",
    slug: "ravioles-de-chevre-frais-miel-de-monteregie",
    name: "Ravioles de chèvre frais & miel de Montérégie",
    description:
      locale === "en"
        ? "Delicate, tender ravioli balanced by the sweetness of honey and the woodland notes of burnt rosemary."
        : "De délicates ravioles fondantes au chèvre frais, équilibrées par la douceur du miel et les notes boisées du romarin brûlé.",
    price: "$34",
    href: toLandingPublicMenuHref(buildPublicDishPath(
      "maison-elyse",
      "ravioles-de-chevre-frais-miel-de-monteregie",
      { lang }
    )),
    image: LANDING_FALLBACK_DISH_PHOTOS.maisonElyse,
    imageSource: "fallback",
    imageAlt:
      locale === "en"
        ? "Ravioles de chèvre frais from Maison Élyse"
        : "Ravioles de chèvre frais de Maison Élyse",
    imagePosition: "center"
  };
  const trouvableDish: LandingFeaturedDish = {
    id: "7a312411-975a-4a12-9e74-d435a7c83406",
    slug: "pesto-burrata-verde",
    name: "Pesto Burrata Verde",
    description:
      locale === "en"
        ? "Basil pesto pasta, creamy burrata, Parmesan, and a drizzle of olive oil."
        : "Pâtes au pesto de basilic, burrata crémeuse, parmesan et filet d’huile d’olive.",
    price: "$24.99",
    href: toLandingPublicMenuHref(
      buildPublicDishPath("trouvable", "pesto-burrata-verde", { lang })
    ),
    image: LANDING_FALLBACK_DISH_PHOTOS.trouvable,
    imageSource: "fallback",
    imageAlt:
      locale === "en"
        ? "Pesto Burrata Verde from Trouvable"
        : "Pesto Burrata Verde de Trouvable",
    imagePosition: "center"
  };
  const saugeDish: LandingFeaturedDish = {
    id: "cb7121a7-a8df-4650-8453-df83135defeb",
    slug: "betterave-sous-la-cendre",
    name: "Betterave sous la cendre",
    description:
      locale === "en"
        ? "Ash-roasted beetroot with smoked labneh, blackcurrant, pistachio, and raspberry vinegar."
        : "La betterave cuite sous la cendre est accompagnée de labneh fumé, de cassis, de pistache et d’un vinaigre de framboise.",
    price: "$16",
    href: toLandingPublicMenuHref(
      buildPublicDishPath("sauge-noire", "betterave-sous-la-cendre", {
        lang,
        view: "sauge-2"
      })
    ),
    image: LANDING_FALLBACK_DISH_PHOTOS.saugeNoire,
    imageSource: "fallback",
    imageAlt:
      locale === "en"
        ? "Betterave sous la cendre from Sauge Noire"
        : "Betterave sous la cendre de Sauge Noire",
    imagePosition: "center"
  };

  const experiences: LandingExperience[] = [
    {
      id: "maison-elyse",
      menuSlug: "maison-elyse",
      name: "Maison Élyse",
      label:
        locale === "en"
          ? "Editorial and gastronomic"
          : "Éditoriale et gastronomique",
      publicMenuHref: toLandingPublicMenuHref(
        buildPublicMenuPath("maison-elyse", { lang })
      ),
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
      renderPayload: null,
      hasLiveData: false
    },
    {
      id: "trouvable",
      menuSlug: "trouvable",
      name: "Trouvable",
      label:
        locale === "en" ? "Modern and interactive" : "Moderne et interactive",
      publicMenuHref: toLandingPublicMenuHref(
        buildPublicMenuPath("trouvable", { lang })
      ),
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
      renderPayload: null,
      hasLiveData: false
    },
    {
      id: "sauge-noire",
      menuSlug: "sauge-noire",
      name: "Sauge Noire",
      label:
        locale === "en"
          ? "Distinctive and immersive"
          : "Signature et immersive",
      publicMenuHref: toLandingPublicMenuHref(
        buildPublicMenuPath("sauge-noire", { lang })
      ),
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
      renderPayload: null,
      hasLiveData: false
    }
  ];

  return experiences.map((experience) => ({
    ...experience,
    featuredDish: {
      ...experience.featuredDish,
      href: buildLandingFeaturedDishHref(experience, locale)
    }
  }));
}

function landingRenderPayload(
  experience: LandingExperience,
  context: PublicMenuRenderContext,
  comparison: PdfComparePreviewData
): LandingMenuPreviewPayload | null {
  // E2E uses the same readiness contract as production.  Hermetic fixtures
  // must provide valid locale, translation and renderer data rather than
  // activating a product-only compatibility path.
  assertLandingMenuPreviewReady(context, context.locale);
  if (context.menu.slug !== experience.menuSlug) {
    throw new LandingMenuPreviewError(
      "landing_identity_mismatch",
      `Landing experience ${experience.id} resolved the wrong menu identity.`,
      {
        expectedSlug: experience.menuSlug,
        actualSlug: context.menu.slug,
        actualRestaurantId: context.menu.restaurantId
      }
    );
  }
  if (experience.id === "maison-elyse") {
    const canonicalMaisonElyse = getMaisonElyseIdentity();
    if (
      context.menu.restaurantId !== canonicalMaisonElyse.id ||
      context.menu.slug !== canonicalMaisonElyse.slug
    ) {
      throw new LandingMenuPreviewError(
        "landing_identity_mismatch",
        "Maison Elyse landing preview failed its canonical identity check.",
        {
          expectedRestaurantId: canonicalMaisonElyse.id,
          actualRestaurantId: context.menu.restaurantId,
          expectedSlug: canonicalMaisonElyse.slug,
          actualSlug: context.menu.slug
        }
      );
    }
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
          locale !== context.publicLocale && menu
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
  const lang = LOCALE_LANGUAGE_TAG[locale];
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
        assertLandingMenuPreviewReady(renderContext, locale);
        const menu = renderContext.menu;
        const current = buildCurrentPublicMenuPreview({
          locale,
          menu,
          preferredDishId: experience.featuredDish.id,
          preferredDishSlug: experience.preferredDishSlug,
          theme: experience.id
        });
        if (!current.featuredDish) {
          return {
            ...experience,
            preview: current.preview,
            hasLiveData: false,
            renderPayload:
              experience.id === "maison-elyse"
                ? landingRenderPayload(experience, renderContext, current.preview)
                : null
          };
        }
        const dish = current.featuredDish;
        const resolvedPhoto = resolveLandingDishPhoto(
          dish,
          experience.featuredDish,
          menu.dishes
        );
        const image = resolvedPhoto?.url ?? "";
        const imageSource: LandingFeaturedDish["imageSource"] =
          resolvedPhoto?.source ?? "unavailable";

        return {
          ...experience,
          preview: current.preview,
          hasLiveData: true,
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
            href: toLandingPublicMenuHref(
              buildPublicDishPath(menu.slug, dish.slug, {
                lang,
                ...(experience.dishView ? { view: experience.dishView } : {})
              })
            ),
            image,
            imageSource,
            imageAlt:
              locale === "en"
                ? `${dish.name}, from ${experience.name}`
                : `${dish.name}, dans la carte ${experience.name}`,
            imagePosition: "center"
          }
        };
      } catch (error) {
        if (error instanceof LandingMenuPreviewError) return experience;
        throw error;
      }
    })
  );

  const routedExperiences = resolved.map((experience) => ({
    ...experience,
    featuredDish: {
      ...experience.featuredDish,
      href: buildLandingFeaturedDishHref(experience, locale)
    }
  }));
  return dedupeLandingDishPhotos(routedExperiences);
}

const getCachedFrenchLandingExperiences = unstable_cache(
  () => buildLandingExperiences("fr"),
  ["landing-menu-experiences-fr-v11"],
  { revalidate: 60 }
);

const getCachedEnglishLandingExperiences = unstable_cache(
  () => buildLandingExperiences("en"),
  ["landing-menu-experiences-en-v11"],
  { revalidate: 60 }
);

export async function getLandingExperiences(
  locale: Locale
): Promise<LandingExperience[]> {
  return locale === "en"
    ? getCachedEnglishLandingExperiences()
    : getCachedFrenchLandingExperiences();
}

async function buildLandingMenuPreviewPayload(
  experienceId: LandingExperienceId,
  locale: Locale
): Promise<LandingMenuPreviewPayload | null> {
  const experience = fallbackExperiences(locale).find(
    (candidate) => candidate.id === experienceId
  );
  if (!experience) return null;

  const lang = LOCALE_LANGUAGE_TAG[locale];
  const renderContext = await resolvePublicMenuRenderContext({
    slug: experience.menuSlug,
    query: {
      lang,
      ...(experience.dishView ? { view: experience.dishView } : {})
    }
  });
  if (!renderContext?.menu.dishes.length) return null;
  assertLandingMenuPreviewReady(renderContext, locale);

  const current = buildCurrentPublicMenuPreview({
    locale,
    menu: renderContext.menu,
    preferredDishId: experience.featuredDish.id,
    preferredDishSlug: experience.preferredDishSlug,
    theme: experience.id
  });

  return landingRenderPayload(experience, renderContext, current.preview);
}

const getCachedFrenchLandingMenuPreviewPayload = unstable_cache(
  (experienceId: LandingExperienceId) =>
    buildLandingMenuPreviewPayload(experienceId, "fr"),
  ["landing-menu-preview-payload-fr-v9"],
  { revalidate: 60 }
);

const getCachedEnglishLandingMenuPreviewPayload = unstable_cache(
  (experienceId: LandingExperienceId) =>
    buildLandingMenuPreviewPayload(experienceId, "en"),
  ["landing-menu-preview-payload-en-v9"],
  { revalidate: 60 }
);

export async function getLandingMenuPreviewPayload(
  experienceId: LandingExperienceId,
  locale: Locale
): Promise<LandingMenuPreviewPayload | null> {
  return locale === "en"
    ? getCachedEnglishLandingMenuPreviewPayload(experienceId)
    : getCachedFrenchLandingMenuPreviewPayload(experienceId);
}
