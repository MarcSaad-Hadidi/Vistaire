"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  DishModelViewerCopy,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import type { PublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import {
  getMaisonElyseCategoryLabel,
  getMaisonElyseTextDirection,
  resolveMaisonElyseCopy
} from "@/lib/menu/maisonElyseLocalization";
type Locale = PublicMenuLocale;
import { AllergenDisclosure } from "./AllergenDisclosure";
import {
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import {
  getPublicMenuAnalyticsContext,
  trackPublicMenuEvent
} from "@/lib/analytics/client";
import { maisonElyseThemeStyle } from "@/lib/menu/maisonElyseTheme";
import styles from "./MaisonElyseDishDetail.module.css";

const MODEL_VIEWER_ID = "maison-elyse-dish-model-viewer";
const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const loadDishModelViewer = () =>
  import("@/components/dish/DishModelViewer").then(
    (mod) => mod.DishModelViewer
  );

const LazyDishModelViewerFr = dynamic<DishModelViewerProps>(
  loadDishModelViewer,
  {
    ssr: false,
    loading: () => (
      <div className={styles.modelLoading} role="status" aria-live="polite">
        Préparation de la vue immersive...
      </div>
    )
  }
);

const LazyDishModelViewerEn = dynamic<DishModelViewerProps>(
  loadDishModelViewer,
  {
    ssr: false,
    loading: () => (
      <div className={styles.modelLoading} role="status" aria-live="polite">
        Preparing the immersive view...
      </div>
    )
  }
);

type MaisonElyseDishDetailProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  query?: PublicMenuContextQuery;
  displayMode?: "public" | "phone-preview";
  locale?: Locale;
  config?: MenuUiConfig;
  onBackToMenu?: () => void;
};

const DETAIL_COPY: Record<
  "fr" | "en",
  {
    allergens: string;
    ariaDetail: string;
    badgesAria: string;
    backToMenu: string;
    dishImageAlt: (dishName: string) => string;
    fallbackImage: string;
    fallbackList: string;
    hide3d: string;
    hidePreview: string;
    immersiveBody3d: string;
    immersiveBodyAr: string;
    immersiveKicker: string;
    immersivePreview3d: string;
    immersivePreviewAr: string;
    ingredients: string;
    noCategory: string;
    note: string;
    options: string;
    openAr: string;
    show3d: string;
    title3d: string;
    titleAr: string;
    topNavAria: string;
    unavailableBadge: string;
    recommendedBadge: string;
  }
> = {
  fr: {
    badgesAria: "Badges du plat",
    allergens: "Allergènes",
    ariaDetail: "Détail du plat",
    backToMenu: "Retour à la carte",
    dishImageAlt: (dishName) => `Image du plat ${dishName}`,
    fallbackImage: "Image du plat à venir",
    fallbackList: "À préciser avec l'équipe en salle.",
    hide3d: "Masquer la 3D",
    hidePreview: "Masquer l'aperçu",
    immersiveBody3d: "La vue 3D se lance uniquement après votre action.",
    immersiveBodyAr:
      "Une fois le plat chargé, vous pouvez le placer devant vous sur un téléphone compatible.",
    immersiveKicker: "Aperçu immersif",
    immersivePreview3d: "Aperçu disponible sans chargement initial.",
    immersivePreviewAr: "Le bouton AR apparaît après le chargement du plat.",
    ingredients: "Ingrédients",
    noCategory: "La carte",
    note: "Note du chef",
    options: "Options",
    openAr: "Ouvrir l'aperçu AR",
    show3d: "Voir en 3D",
    title3d: "Voir le plat en 3D",
    titleAr: "Réalité augmentée",
    topNavAria: "Navigation fiche plat",
    unavailableBadge: "Indisponible",
    recommendedBadge: "Recommandé"
  },
  en: {
    badgesAria: "Dish badges",
    allergens: "Allergens",
    ariaDetail: "Dish details",
    backToMenu: "Back to menu",
    dishImageAlt: (dishName) => `Dish image: ${dishName}`,
    fallbackImage: "Dish image coming soon",
    fallbackList: "Ask the dining room team for details.",
    hide3d: "Hide 3D",
    hidePreview: "Hide preview",
    immersiveBody3d: "The 3D view only loads after your action.",
    immersiveBodyAr:
      "Once the dish has loaded, you can place it in front of you on a compatible phone.",
    immersiveKicker: "Immersive preview",
    immersivePreview3d: "Preview available without initial loading.",
    immersivePreviewAr: "The AR button appears after the dish loads.",
    ingredients: "Ingredients",
    noCategory: "Menu",
    note: "Chef's note",
    options: "Options",
    openAr: "Open AR preview",
    show3d: "View in 3D",
    title3d: "View the dish in 3D",
    titleAr: "Augmented reality",
    topNavAria: "Dish navigation",
    unavailableBadge: "Unavailable",
    recommendedBadge: "Recommended"
  }
};

function cleanDisplayText(value: string): string {
  return value
    .replaceAll("Ãƒâ€°", "É")
    .replaceAll("ÃƒÂ©", "é")
    .replaceAll("ÃƒÂ¨", "è")
    .replaceAll("ÃƒÂª", "ê")
    .replaceAll("ÃƒÂ´", "ô")
    .replaceAll("ÃƒÂ¢", "â")
    .replaceAll("ÃƒÂ®", "î")
    .replaceAll("ÃƒÂ¯", "ï")
    .replaceAll("ÃƒÂ§", "ç")
    .replaceAll("Ã‰", "É")
    .replaceAll("Ã©", "é")
    .replaceAll("Ã¨", "è")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã´", "ô")
    .replaceAll("Ã¢", "â")
    .replaceAll("Ã®", "î")
    .replaceAll("Ã¯", "ï")
    .replaceAll("Ã§", "ç")
    .replaceAll("Â·", "·")
    .trim();
}

function normalizeText(value: string): string {
  return cleanDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function localeLanguage(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split("-")[0] ?? "fr";
  }
}

function categoryLabel(category: string, locale: PublicMenuLocale): string {
  const cleaned = cleanDisplayText(category);
  return (
    getMaisonElyseCategoryLabel(cleaned, locale) ||
    DETAIL_COPY[localeLanguage(locale) === "fr" ? "fr" : "en"].noCategory
  );
}

function hasReal3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite")
  );
}

function hasRealAr(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite") ||
    isSafe3dAssetUrl(
      dish.arUsdzUrl || dish.usdzUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "iosUsdz"
    )
  );
}

function dishBadges(dish: PublicMenuDish, locale: PublicMenuLocale, copy: DetailCopy): string[] {
  const badges: string[] = [];
  const tagText = normalizeText(dish.tags.join(" "));

  if (tagText.includes("signature")) badges.push("Signature");
  if (tagText.includes("recommande") || tagText.includes("recommended")) {
    badges.push(copy.recommendedBadge);
  }
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push(copy.unavailableBadge);

  return Array.from(new Set(badges)).slice(0, 5);
}

function displayList(
  items: string[]
): string[] {
  return items
    .map((item) => {
      return cleanDisplayText(item);
    })
    .filter(Boolean);
}

function modelViewerDishFromPublicDish(
  dish: PublicMenuDish
): DishModelViewerProps["dish"] {
  return {
    slug: dish.slug,
    categorySlug: dish.categorySlug ?? slugify(dish.category),
    name: dish.name,
    model3dUrl: dish.model3dUrl,
    webModel3dUrl: dish.webModel3dUrl,
    arModel3dUrl: dish.arModel3dUrl,
    arUsdzUrl: dish.arUsdzUrl || dish.usdzUrl,
    image: dish.imageUrl,
    imageObjectPosition: "center",
    imageObjectPositionDetail: "center"
  };
}

function buildFullMenuHref(
  menu: PublicMenu,
  query?: PublicMenuContextQuery
): string {
  const menuHref = buildPublicMenuPath(menu.slug, query);
  const [pathname, rawSearch = ""] = menuHref.split("?");
  const params = new URLSearchParams(rawSearch);
  params.set("view", "carte");

  return `${pathname}?${params.toString()}`;
}

function scrollToModelViewer(): void {
  if (typeof window === "undefined") return;

  window.requestAnimationFrame(() => {
    document.getElementById(MODEL_VIEWER_ID)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth"
    });
  });
}

function DetailList({ emptyText, items }: { emptyText: string; items: string[] }) {
  if (!items.length) return <p>{emptyText}</p>;

  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

type DetailCopy = (typeof DETAIL_COPY)["fr"] & {
  modelViewer: Required<DishModelViewerCopy>;
};

function buildDetailCopy(
  locale: PublicMenuLocale,
  localizedUiCopy?: Record<string, unknown>
): DetailCopy {
  const language = localeLanguage(locale);
  const fallback = DETAIL_COPY[language === "fr" ? "fr" : "en"];
  const resolvedResult = resolveMaisonElyseCopy(locale, localizedUiCopy);
  const resolved = resolvedResult.copy;
  const neutral = resolveMaisonElyseCopy(locale).copy;
  const preserveMaisonDefaults =
    resolvedResult.resolution.builtInLocale === (language === "fr" ? "fr" : "en");
  const sharedOrMaison = <T,>(value: T, neutralValue: T, maisonValue: T): T =>
    preserveMaisonDefaults && Object.is(value, neutralValue) ? maisonValue : value;
  return {
    ...fallback,
    allergens: resolved.allergens,
    ariaDetail: sharedOrMaison(resolved.details, neutral.details, fallback.ariaDetail),
    // Maison Élyse keeps its restaurant-specific return label. The shared
    // Trouvable copy says “Retour au menu”, while this experience's contract
    // is the more specific “Retour à la carte” (with the matching English
    // “Back to menu” fallback).
    dishImageAlt: sharedOrMaison(resolved.modelAlt, neutral.modelAlt, fallback.dishImageAlt),
    fallbackImage: resolved.detailFallback,
    fallbackList: resolved.detailFallback,
    hide3d: resolved.modelViewer.close,
    hidePreview: resolved.close,
    immersiveBody3d: resolved.modelViewer.slowNetworkBody,
    immersiveBodyAr: resolved.modelViewer.arHelp,
    immersiveKicker: resolved.immersiveFilterLabel,
    immersivePreview3d: resolved.modelViewer.slowNetworkBody,
    immersivePreviewAr: resolved.modelViewer.arIosHandoff,
    ingredients: resolved.ingredients,
    noCategory: resolved.activeCategoryAll,
    note: sharedOrMaison(
      resolved.detailHouseNoteLabel,
      neutral.detailHouseNoteLabel,
      fallback.note
    ),
    modelViewer: {
      loadingTitle: resolved.modelPreparing,
      ...resolved.modelViewer,
      modelAlt: resolved.modelAlt
    },
    options: resolved.options,
    openAr: sharedOrMaison(resolved.viewAr, neutral.viewAr, fallback.openAr),
    recommendedBadge: resolved.recommendation,
    show3d: sharedOrMaison(resolved.threeD, neutral.threeD, fallback.show3d),
    title3d: sharedOrMaison(resolved.threeD, neutral.threeD, fallback.title3d),
    titleAr: resolved.modelViewer.safariTitle,
    topNavAria: sharedOrMaison(resolved.details, neutral.details, fallback.topNavAria),
    unavailableBadge: resolved.soldOut
  };
}

export function MaisonElyseDishDetail({
  menu,
  dish,
  query,
  displayMode = "public",
  locale = "fr-CA",
  config,
  onBackToMenu
}: MaisonElyseDishDetailProps) {
  const copy = buildDetailCopy(locale, menu.localizedUiCopy);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const analyticsContext = getPublicMenuAnalyticsContext(menu);
  const menuHref = buildFullMenuHref(menu, query);
  const restaurantName = cleanDisplayText(menu.name) || "Restaurant";
  const dishName = cleanDisplayText(dish.name);
  const dishDescription = cleanDisplayText(dish.description);
  const displayCategory = categoryLabel(dish.category, locale);
  const has3d = hasReal3d(dish);
  const hasAr = hasRealAr(dish);
  const canOpenImmersive = displayMode === "public" && (has3d || hasAr);
  const badges = dishBadges(dish, locale, copy);
  const ingredients = displayList(dish.ingredients);
  const options = displayList(dish.options);
  const houseNote = cleanDisplayText(dish.houseNote);
  const actionLabel = showModelViewer
    ? has3d
      ? copy.hide3d
      : copy.hidePreview
    : has3d
      ? copy.show3d
      : copy.openAr;
  const LazyDishModelViewer =
    localeLanguage(locale) === "fr"
      ? LazyDishModelViewerFr
      : LazyDishModelViewerEn;

  useEffect(() => {
    if (displayMode !== "public") return;
    trackPublicMenuEvent(menu, {
      eventName: "dish_opened",
      dishSlug: dish.slug,
      categorySlug: dish.categorySlug ?? slugify(dish.category)
    });
  }, [displayMode, dish.category, dish.categorySlug, dish.slug, menu]);

  function toggleModelViewer() {
    setShowModelViewer((isVisible) => {
      const nextVisible = !isVisible;
      if (nextVisible) scrollToModelViewer();
      return nextVisible;
    });
  }

  return (
    <main
      dir={getMaisonElyseTextDirection(locale)}
      lang={locale}
      data-public-dish-renderer={
        displayMode === "public" ? "maison-elyse" : undefined
      }
      className={`${styles.page} ${
        displayMode === "phone-preview" ? styles.phonePreview : ""
      }`}
      style={maisonElyseThemeStyle(config)}
    >
      <nav className={styles.topNav} aria-label={copy.topNavAria}>
        {onBackToMenu ? (
          <button type="button" onClick={onBackToMenu}>
            {copy.backToMenu}
          </button>
        ) : (
          <Link href={menuHref} prefetch={false}>
            {copy.backToMenu}
          </Link>
        )}
        <span>{restaurantName}</span>
      </nav>

      <article className={styles.article}>
        <div
          aria-label={dish.imageUrl ? copy.dishImageAlt(dishName) : undefined}
          className={styles.hero}
          role={dish.imageUrl ? "img" : undefined}
          style={
            dish.imageUrl
              ? ({ "--dish-image": `url("${dish.imageUrl}")` } as CSSProperties)
              : undefined
          }
        >
          {!dish.imageUrl ? (
            <div className={styles.imageFallback}>
              <span>{restaurantName.slice(0, 1)}</span>
              <p>{copy.fallbackImage}</p>
            </div>
          ) : null}
        </div>

        <section className={styles.content} aria-label={copy.ariaDetail}>
          <header className={styles.heading}>
            <p className={styles.kicker}>{displayCategory}</p>
            <h1>{dishName}</h1>
            {dish.priceLabel ? (
              <p className={styles.price}>{dish.priceLabel}</p>
            ) : null}
            {dishDescription ? (
              <p className={styles.description}>{dishDescription}</p>
            ) : null}
          </header>

          {badges.length > 0 ? (
            <div className={styles.badges} aria-label={copy.badgesAria}>
              {badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          ) : null}

          {canOpenImmersive ? (
            <section
              aria-labelledby="maison-elyse-immersive-heading"
              className={`${styles.modelPanel} ${
                showModelViewer ? styles.modelPanelOpen : ""
              }`}
            >
              <div className={styles.modelPanelHeader}>
                <div>
                  <p className={styles.kicker}>{copy.immersiveKicker}</p>
                  <h2 id="maison-elyse-immersive-heading">
                    {has3d ? copy.title3d : copy.titleAr}
                  </h2>
                  <p>
                    {hasAr ? copy.immersiveBodyAr : copy.immersiveBody3d}
                  </p>
                </div>
                <button
                  aria-controls={MODEL_VIEWER_ID}
                  aria-expanded={showModelViewer}
                  className={styles.primaryAction}
                  onClick={toggleModelViewer}
                  type="button"
                >
                  {actionLabel}
                </button>
              </div>

              <div className={styles.modelStage} id={MODEL_VIEWER_ID}>
                {showModelViewer ? (
                  <LazyDishModelViewer
                    analyticsContext={analyticsContext ?? undefined}
                    copy={copy.modelViewer}
                    dish={modelViewerDishFromPublicDish(dish)}
                    minimalChrome
                    quietChrome
                    onReturnToDish={() => setShowModelViewer(false)}
                  />
                ) : (
                  <div className={styles.modelPreview} aria-hidden="true">
                    <span>{has3d ? "3D" : "AR"}</span>
                    <small>
                      {hasAr ? copy.immersivePreviewAr : copy.immersivePreview3d}
                    </small>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <div className={styles.detailSections}>
            <section>
              <h2>{copy.ingredients}</h2>
              <DetailList emptyText={copy.fallbackList} items={ingredients} />
            </section>

            <AllergenDisclosure dish={dish} locale={locale} />

            <section>
              <h2>{copy.options}</h2>
              <DetailList emptyText={copy.fallbackList} items={options} />
            </section>

            {houseNote ? (
              <section className={styles.houseNote}>
                <h2>{copy.note}</h2>
                <p>{houseNote}</p>
              </section>
            ) : null}
          </div>
        </section>
      </article>

    </main>
  );
}
