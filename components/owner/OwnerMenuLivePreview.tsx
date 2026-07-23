"use client";

import { MaisonElyseQrMenu } from "@/components/menu/MaisonElyseQrMenu";
import { TrouvablePremiumMenuExperience } from "@/components/menu/TrouvablePremiumMenuExperience";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import { normalizeLocale } from "@/lib/i18n";
import { buildMenuUiConfigForRestaurant, type MenuAppearanceSelection } from "@/lib/menu/menuAppearance";
import type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";
import type { PublicMenuSettings } from "@/lib/menu/publicMenuSettings";
import { formatPriceCentsForMenu, parsePriceToCents } from "@/lib/owner/price";
import type { DraftDish, DraftSection } from "./restaurantCreatePreviewTypes";

type OwnerMenuLivePreviewProps = {
  restaurantName: string;
  slug: string;
  publicMenuSettings: PublicMenuSettings;
  appearance: MenuAppearanceSelection;
  sections: DraftSection[];
  dishes: DraftDish[];
};

function previewSlug(value: string, fallback: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function buildPreviewDish(
  draft: DraftDish,
  section: DraftSection,
  index: number,
  settings: PublicMenuSettings
): PublicMenuDish {
  const parsedPrice = parsePriceToCents(draft.price);
  const priceCents = parsedPrice.ok ? parsedPrice.cents : 2800;
  const displayPriceMode = parsedPrice.ok ? draft.displayPriceMode : "integer";
  const imageUrl = draft.imageUrl.trim();
  const name = draft.name.trim() || "Plat signature";
  const description = draft.description.trim() || "Préparé à la minute";

  return {
    id: draft.id || `preview-dish-${index}`,
    slug: previewSlug(name, `preview-dish-${index}`),
    name,
    description,
    categoryId: section.id,
    category: section.name,
    categorySlug: previewSlug(section.name, section.id),
    categoryDescription: section.description,
    priceLabel: formatPriceCentsForMenu(priceCents, settings.baseCurrency, {
      displayPriceMode
    }),
    priceCents,
    priceCurrency: settings.baseCurrency,
    baseCurrency: settings.baseCurrency,
    displayPriceMode,
    imageUrl,
    thumbnailUrl: imageUrl,
    hasPhoto: Boolean(imageUrl),
    photoStatus: imageUrl ? "ready" : draft.photoStatus,
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
    modelStatus: "missing",
    available: draft.available,
    isSignature: draft.tags.some((tag) => tag.toLowerCase() === "signature"),
    isRecommended: draft.tags.some((tag) => tag.toLowerCase() === "recommande"),
    ingredients: draft.ingredients,
    allergens: draft.allergens,
    options: draft.options,
    houseNote: draft.chefNote,
    tags: draft.tags
  };
}

function buildPreviewMenu({
  restaurantName,
  slug,
  publicMenuSettings,
  sections,
  dishes
}: Pick<OwnerMenuLivePreviewProps, "restaurantName" | "slug" | "publicMenuSettings" | "sections" | "dishes">): PublicMenu {
  const previewSections = sections.length > 0
    ? sections
    : [{ id: "preview-section", name: "Votre première section", description: "" }];
  const previewDishes = previewSections.flatMap((section, sectionIndex) => {
    const sectionDishes = dishes.filter((dish) => dish.section === section.name);
    return sectionDishes.length > 0
      ? sectionDishes.map((dish, dishIndex) =>
          buildPreviewDish(dish, section, sectionIndex * 100 + dishIndex, publicMenuSettings)
        )
      : [
          buildPreviewDish(
            {
              id: `${section.id}-preview-dish`,
              name: "Plat signature",
              section: section.name,
              price: "28",
              displayPriceMode: "integer",
              description: "Ajoutez vos informations à l'étape Plats.",
              imageUrl: "",
              ingredients: [],
              allergens: [],
              allergenDeclarations: [],
              tags: [],
              options: [],
              chefNote: "",
              available: true,
              photoStatus: "missing"
            },
            section,
            sectionIndex * 100,
            publicMenuSettings
          )
        ];
  });

  return {
    restaurantId: "owner-preview",
    menuId: "owner-preview-menu",
    menuName: "Aperçu owner",
    slug: previewSlug(slug, "owner-preview"),
    name: restaurantName.trim() || "Votre restaurant",
    location: "",
    cuisineType: "",
    googleReview: { enabled: false, googleReviewUrl: "" },
    settings: publicMenuSettings,
    publicMenuStyleExplicit: true,
    source: "demo",
    dishes: previewDishes
  };
}

export function OwnerMenuLivePreview({
  restaurantName,
  slug,
  publicMenuSettings,
  appearance,
  sections,
  dishes
}: OwnerMenuLivePreviewProps) {
  const menu = buildPreviewMenu({
    restaurantName,
    slug,
    publicMenuSettings,
    sections,
    dishes
  });
  const config = buildMenuUiConfigForRestaurant({
    name: menu.name,
    slug: menu.slug,
    appearance,
    publicMenuSettings
  });
  const exchangeRates: MenuExchangeRates = {
    base: publicMenuSettings.baseCurrency,
    rates: Object.fromEntries(
      publicMenuSettings.supportedCurrencies.map((currency) => [currency, 1])
    ),
    provider: "owner-preview"
  };
  const locale = normalizeLocale(publicMenuSettings.defaultLocale);

  if (appearance.template === "maison-elyse") {
    return (
      <MaisonElyseQrMenu
        displayMode="phone-preview"
        menu={menu}
        config={config}
        locale={locale}
        query={{ lang: publicMenuSettings.defaultLocale, view: "carte" }}
        showGoogleReview={false}
      />
    );
  }

  return (
    <TrouvablePremiumMenuExperience
      displayMode="phone-preview"
      menu={menu}
      config={config}
      context="Aperçu owner"
      exchangeRates={exchangeRates}
      query={{ lang: publicMenuSettings.defaultLocale }}
    />
  );
}
