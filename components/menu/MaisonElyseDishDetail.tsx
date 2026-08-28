"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type {
  DishModelViewerCopy,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import {
  isCurrencyConversionAvailable,
  type MenuExchangeRates
} from "@/lib/currency/formatMenuPrice";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import type { PublicMenuLocale } from "@/lib/menu/publicMenuSettings";
import {
  getMaisonElyseCategoryKind,
  getMaisonElyseCategoryLabel,
  getMaisonElyseEditorialCopy,
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
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  formatTrouvableDishPrice,
  normalizeTrouvableCurrency,
  type TrouvableCurrency
} from "./trouvableMenuControls";
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

const LazyDishModelViewer = dynamic<DishModelViewerProps>(loadDishModelViewer, {
  ssr: false,
  loading: () => null
});

type MaisonElyseDishDetailProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  query?: PublicMenuContextQuery;
  displayMode?: "public" | "phone-preview";
  locale?: Locale;
  config?: MenuUiConfig;
  currency?: TrouvableCurrency;
  exchangeRates?: MenuExchangeRates;
  onBackToMenu?: () => void;
};

const DETAIL_COPY = {
  fr: {
    badgesAria: "Badges du plat",
    ariaDetail: "Détail du plat",
    dishImageAlt: (dishName: string) => `Image du plat ${dishName}`,
    fallbackImage: "Image du plat à venir",
    fallbackList: "À préciser avec l'équipe en salle.",
    note: "Note du chef",
    openAr: "Ouvrir l'aperçu AR",
    show3d: "Voir en 3D",
    title3d: "Voir le plat en 3D",
    topNavAria: "Navigation fiche plat"
  },
  en: {
    badgesAria: "Dish badges",
    ariaDetail: "Dish details",
    dishImageAlt: (dishName: string) => `Dish image: ${dishName}`,
    fallbackImage: "Dish image coming soon",
    fallbackList: "Ask the dining room team for details.",
    note: "Chef's note",
    openAr: "Open AR preview",
    show3d: "View in 3D",
    title3d: "View the dish in 3D",
    topNavAria: "Dish navigation"
  }
} as const;

function localeLanguage(locale: string): string {
  try {
    return new Intl.Locale(locale).language.toLowerCase();
  } catch {
    return locale.toLowerCase().split("-")[0] ?? "fr";
  }
}

function getStoredMenuCurrency(
  settings: PublicMenu["settings"]
): TrouvableCurrency | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(TROUVABLE_CURRENCY_STORAGE_KEY);
    return stored ? normalizeTrouvableCurrency(stored, settings) : null;
  } catch {
    return null;
  }
}

function resolveAvailableDishCurrency({
  dish,
  exchangeRates,
  menu,
  requestedCurrency
}: {
  dish: PublicMenuDish;
  exchangeRates?: MenuExchangeRates;
  menu: PublicMenu;
  requestedCurrency?: TrouvableCurrency | string;
}): TrouvableCurrency {
  const defaultCurrency = normalizeTrouvableCurrency(undefined, menu.settings);
  const normalizedRequested = normalizeTrouvableCurrency(
    requestedCurrency,
    menu.settings
  );
  const candidates = Array.from(
    new Set<TrouvableCurrency>([
      normalizedRequested,
      defaultCurrency,
      ...menu.settings.supportedCurrencies,
      dish.priceCurrency
    ])
  );
  const baseCurrency =
    exchangeRates?.base ?? dish.baseCurrency ?? menu.settings.baseCurrency;

  return (
    candidates.find((targetCurrency) =>
      isCurrencyConversionAvailable({
        sourceCurrency: dish.priceCurrency || menu.settings.baseCurrency,
        targetCurrency,
        baseCurrency,
        rates: exchangeRates?.rates
      })
    ) ?? dish.priceCurrency
  );
}

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

function categoryLabel(dish: PublicMenuDish, locale: PublicMenuLocale): string {
  return (
    getMaisonElyseCategoryLabel(
      {
        label: cleanDisplayText(dish.category),
        slug: dish.categorySlug
      },
      locale
    ) || resolveMaisonElyseCopy(locale).copy.activeCategoryAll
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

function dishBadges(dish: PublicMenuDish, copy: DetailCopy): string[] {
  const badges: string[] = [];
  const tagText = normalizeText(dish.tags.join(" "));
  const categoryKind = getMaisonElyseCategoryKind({
    label: dish.category,
    slug: dish.categorySlug
  });

  if (
    dish.isSignature ||
    categoryKind === "signature" ||
    tagText.includes("signature")
  ) {
    badges.push(copy.signatureBadge);
  }
  if (
    dish.isRecommended ||
    tagText.includes("recommande") ||
    tagText.includes("recommended")
  ) {
    badges.push(copy.recommendedBadge);
  }
  if (hasReal3d(dish)) badges.push("3D");
  if (hasRealAr(dish)) badges.push("AR");
  if (!dish.available) badges.push(copy.unavailableBadge);

  return Array.from(new Set(badges)).slice(0, 5);
}

function displayList(items: string[]): string[] {
  return items
    .map((item) => cleanDisplayText(item))
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

type DetailCopy = {
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
  recommendedBadge: string;
  signatureBadge: string;
  show3d: string;
  title3d: string;
  titleAr: string;
  topNavAria: string;
  unavailableBadge: string;
  modelViewer: Required<DishModelViewerCopy>;
};

function buildDetailCopy(
  locale: PublicMenuLocale,
  localizedUiCopy?: Record<string, unknown>
): DetailCopy {
  const language = localeLanguage(locale);
  const maisonDefault = language === "fr" ? DETAIL_COPY.fr : language === "en" ? DETAIL_COPY.en : null;
  const resolvedResult = resolveMaisonElyseCopy(locale, localizedUiCopy);
  const resolved = resolvedResult.copy;
  const neutral = resolveMaisonElyseCopy(locale).copy;
  const sharedOrMaison = <T,>(value: T, neutralValue: T, maisonValue: T): T =>
    maisonDefault && Object.is(value, neutralValue) ? maisonValue : value;
  const editorial = getMaisonElyseEditorialCopy(locale);

  return {
    allergens: resolved.allergens,
    ariaDetail: maisonDefault
      ? sharedOrMaison(resolved.details, neutral.details, maisonDefault.ariaDetail)
      : resolved.details,
    badgesAria: maisonDefault
      ? sharedOrMaison(resolved.tags, neutral.tags, maisonDefault.badgesAria)
      : resolved.tags,
    backToMenu: editorial.detailBackToMenu,
    dishImageAlt: maisonDefault
      ? sharedOrMaison(resolved.modelAlt, neutral.modelAlt, maisonDefault.dishImageAlt)
      : resolved.modelAlt,
    fallbackImage: maisonDefault
      ? sharedOrMaison(resolved.detailFallback, neutral.detailFallback, maisonDefault.fallbackImage)
      : resolved.detailFallback,
    fallbackList: maisonDefault
      ? sharedOrMaison(resolved.detailFallback, neutral.detailFallback, maisonDefault.fallbackList)
      : resolved.detailFallback,
    hide3d: resolved.modelViewer.close,
    hidePreview: resolved.close,
    immersiveBody3d: resolved.modelViewer.slowNetworkBody,
    immersiveBodyAr: resolved.modelViewer.arHelp,
    immersiveKicker: resolved.immersiveFilterLabel,
    immersivePreview3d: resolved.modelViewer.slowNetworkBody,
    immersivePreviewAr: resolved.modelViewer.arIosHandoff,
    ingredients: resolved.ingredients,
    noCategory: resolved.activeCategoryAll,
    note: maisonDefault
      ? sharedOrMaison(
          resolved.detailHouseNoteLabel,
          neutral.detailHouseNoteLabel,
          maisonDefault.note
        )
      : resolved.detailHouseNoteLabel,
    modelViewer: {
      loadingTitle: resolved.modelPreparing,
      ...resolved.modelViewer,
      modelAlt: resolved.modelAlt
    },
    options: resolved.options,
    openAr: maisonDefault
      ? sharedOrMaison(resolved.viewAr, neutral.viewAr, maisonDefault.openAr)
      : resolved.viewAr,
    recommendedBadge: resolved.recommendation,
    signatureBadge: resolved.signature,
    show3d: maisonDefault
      ? sharedOrMaison(resolved.threeD, neutral.threeD, maisonDefault.show3d)
      : resolved.threeD,
    title3d: maisonDefault
      ? sharedOrMaison(resolved.threeD, neutral.threeD, maisonDefault.title3d)
      : resolved.threeD,
    titleAr: resolved.modelViewer.safariTitle,
    topNavAria: maisonDefault
      ? sharedOrMaison(resolved.details, neutral.details, maisonDefault.topNavAria)
      : resolved.details,
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
  currency,
  exchangeRates,
  onBackToMenu
}: MaisonElyseDishDetailProps) {
  const copy = buildDetailCopy(locale, menu.localizedUiCopy);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const explicitCurrency = currency ?? query?.currency;
  const [storedCurrency, setStoredCurrency] = useState<TrouvableCurrency | null>(null);
  const analyticsContext = getPublicMenuAnalyticsContext(menu);
  const restaurantName = cleanDisplayText(menu.name) || "Restaurant";
  const dishName = cleanDisplayText(dish.name);
  const dishDescription = cleanDisplayText(dish.description);
  const textDirection = getMaisonElyseTextDirection(locale);
  const activeCurrency = resolveAvailableDishCurrency({
    dish,
    exchangeRates,
    menu,
    requestedCurrency: explicitCurrency ?? storedCurrency ?? undefined
  });
  const effectiveQuery: PublicMenuContextQuery =
    explicitCurrency || storedCurrency
      ? { ...(query ?? {}), currency: activeCurrency }
      : { ...(query ?? {}) };
  const menuHref = buildFullMenuHref(menu, effectiveQuery);
  const priceLabel = formatTrouvableDishPrice(
    dish,
    activeCurrency,
    locale,
    exchangeRates
  );
  const displayCategory = categoryLabel(dish, locale);
  const has3d = hasReal3d(dish);
  const hasAr = hasRealAr(dish);
  const canOpenImmersive = displayMode === "public" && (has3d || hasAr);
  const badges = dishBadges(dish, copy);
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

  useEffect(() => {
    if (displayMode !== "public" || explicitCurrency) return;
    const frameId = window.requestAnimationFrame(() => {
      const stored = getStoredMenuCurrency(menu.settings);
      if (!stored) return;
      const resolvedStored = resolveAvailableDishCurrency({
        dish,
        exchangeRates,
        menu,
        requestedCurrency: stored
      });
      setStoredCurrency(resolvedStored);
      if (resolvedStored !== stored) {
        try {
          window.localStorage.setItem(
            TROUVABLE_CURRENCY_STORAGE_KEY,
            resolvedStored
          );
        } catch {
          // The sanitized in-memory fallback remains authoritative for this visit.
        }
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [dish, displayMode, exchangeRates, explicitCurrency, menu]);

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
      dir="ltr"
      lang={locale}
      data-text-direction={textDirection}
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
            <span dir={textDirection}>{copy.backToMenu}</span>
          </button>
        ) : (
          <Link href={menuHref} prefetch={false}>
            <span dir={textDirection}>{copy.backToMenu}</span>
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
              <p dir={textDirection}>{copy.fallbackImage}</p>
            </div>
          ) : null}
        </div>

        <section className={styles.content} aria-label={copy.ariaDetail}>
          <header className={styles.heading} dir={textDirection}>
            <p className={styles.kicker}>{displayCategory}</p>
            <h1>{dishName}</h1>
            {priceLabel ? (
              <p className={styles.price}>{priceLabel}</p>
            ) : null}
            {dishDescription ? (
              <p className={styles.description}>{dishDescription}</p>
            ) : null}
          </header>

          {badges.length > 0 ? (
            <div className={styles.badges} aria-label={copy.badgesAria}>
              {badges.map((badge) => (
                <span key={badge} dir="auto">{badge}</span>
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
                <div dir={textDirection}>
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
                  <span dir={textDirection}>{actionLabel}</span>
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
                    <small dir={textDirection}>
                      {hasAr ? copy.immersivePreviewAr : copy.immersivePreview3d}
                    </small>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          <div className={styles.detailSections}>
            <section dir={textDirection}>
              <h2>{copy.ingredients}</h2>
              <DetailList emptyText={copy.fallbackList} items={ingredients} />
            </section>

            <AllergenDisclosure dish={dish} locale={locale} />

            <section dir={textDirection}>
              <h2>{copy.options}</h2>
              <DetailList emptyText={copy.fallbackList} items={options} />
            </section>

            {houseNote ? (
              <section className={styles.houseNote} dir={textDirection}>
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
