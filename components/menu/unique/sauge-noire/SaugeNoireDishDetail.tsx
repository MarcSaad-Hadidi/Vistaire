"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  getAllergenDisplayGroups,
  customAllergensFromLegacyValues
} from "@/lib/menu/allergens";
import type { Locale } from "@/lib/i18n";
import {
  buildPublicDishPath,
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import {
  getVisiblePublicMenuCategories,
  getPublicMenuCategoryGroups
} from "@/lib/menu/publicMenuCore";
import { formatMenuPrice, type MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import type { UniqueMenuRendererModuleProps } from "@/lib/menu/uniqueMenuRendererRegistry";
import { AllergenWarning } from "@/components/menu/AllergenDisclosure";
import { SaugeNoireBotanical } from "./SaugeNoireBotanical";
import { SaugeNoireBookHeader, SectionPage } from "./SaugeNoireBookMenu";
import { SaugeNoireFlipPage } from "./SaugeNoireFlipPage";
import { SaugeNoirePageFlipExperiment } from "./SaugeNoirePageFlipExperiment";
import { useSaugeNoireTransition } from "./SaugeNoireTransitionCoordinator";
import styles from "./SaugeNoireDishDetail.module.css";

type DishDetailProps = UniqueMenuRendererModuleProps & { dish: PublicMenuDish };
type DishCopyLocale = "fr" | "en" | "es" | "it" | "ar";
type DishTurnDirection = "next" | "previous";
type DishPageTurnState = {
  dishId: string;
  direction: DishTurnDirection;
  targetDish: PublicMenuDish;
  href: string;
  targetPageIndex: 0 | 2;
};

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const LazyDishModelViewer = dynamic<DishModelViewerProps>(
  () =>
    import("@/components/dish/DishModelViewer").then(
      (mod) => mod.DishModelViewer
    ),
  {
    ssr: false,
    loading: () => <div className={styles.modelLoading}>Préparation de la vue immersive…</div>
  }
);

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

function modelViewerDishFromPublicDish(dish: PublicMenuDish): DishModelViewerProps["dish"] {
  return {
    slug: dish.slug,
    categorySlug: dish.categorySlug ?? dish.category,
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

function formatPrice(
  dish: PublicMenuDish,
  currency: string,
  locale: Locale,
  exchangeRates?: MenuExchangeRates
): string {
  return formatMenuPrice({
    priceCents: dish.priceCents,
    sourceCurrency: dish.priceCurrency,
    targetCurrency: currency,
    locale,
    rates: exchangeRates?.rates,
    baseCurrency: exchangeRates?.base ?? dish.baseCurrency,
    displayPriceMode: dish.displayPriceMode,
    fallbackLabel: dish.priceLabel
  });
}

function copyLocale(locale: string): DishCopyLocale {
  const language = locale.trim().toLowerCase().split(/[-_]/)[0];
  if (language === "fr") return "fr";
  if (language === "es") return "es";
  if (language === "it") return "it";
  if (language === "ar") return "ar";
  return "en";
}

function localizedCategoryLabel(category: string, locale: string): string {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("cocktail") && normalized.includes("signature")) {
    const language = copyLocale(locale);
    if (language === "fr") return "Cocktail signature";
    if (language === "es") return "Cóctel de autor";
    if (language === "it") return "Cocktail d'autore";
    if (language === "ar") return "كوكتيل مميز";
    return "Signature cocktail";
  }
  if (normalized.includes("signature")) {
    const language = copyLocale(locale);
    if (language === "fr") return "Plat signature";
    if (language === "es") return "Plato de autor";
    if (language === "it") return "Piatto d'autore";
    if (language === "ar") return "طبق مميز";
    return "Signature dish";
  }
  return category;
}

function categoryPageIndex(menu: PublicMenu, dish: PublicMenuDish): number {
  const categories = getVisiblePublicMenuCategories(menu.dishes);
  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categoryId = categories.find((category) =>
    (groups.get(category.id) ?? []).some((item) => item.id === dish.id)
  )?.id;
  const index = categories.findIndex((category) => category.id === categoryId);
  return index >= 0 ? index + 2 : 1;
}

function categorySheetForDish(menu: PublicMenu, dish: PublicMenuDish) {
  const categories = getVisiblePublicMenuCategories(menu.dishes);
  const groups = getPublicMenuCategoryGroups(menu.dishes);
  const categoryIndex = Math.max(0, categoryPageIndex(menu, dish) - 2);
  const category = categories[categoryIndex] ?? categories[0];
  return {
    category,
    dishes: category ? groups.get(category.id) ?? [] : [],
    pageNumber: categoryIndex
  };
}

function buildMenuHref(
  menu: PublicMenu,
  dish: PublicMenuDish,
  query: PublicMenuContextQuery | undefined,
  currency: string
): string {
  return buildPublicMenuPath(menu.slug, {
    ...query,
    currency,
    view: `sauge-${categoryPageIndex(menu, dish)}`
  });
}

function stopDishSwipePropagation(event: React.PointerEvent<HTMLElement>) {
  event.stopPropagation();
}

type SaugeNoireDishSheetCopy = {
  back: string;
  ingredients: string;
  allergens: string;
  options: string;
  accord: string;
  noAllergens: string;
  confirmAllergens: string;
  show3d: string;
  hide3d: string;
  previous: string;
  next: string;
  menu: string;
};

type SaugeNoireDishSheetProps = {
  menu: PublicMenu;
  query?: PublicMenuContextQuery;
  locale: Locale;
  publicLocale: string;
  exchangeRates?: MenuExchangeRates;
  dish: PublicMenuDish;
  copy: SaugeNoireDishSheetCopy;
  isPreview: boolean;
  onDishLinkClick?: (
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    direction: DishTurnDirection
  ) => void;
  onMenuLinkClick?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
};

function SaugeNoireDish3dSection({
  dish,
  copy
}: {
  dish: PublicMenuDish;
  copy: SaugeNoireDishSheetCopy;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const preservedScrollTopRef = useRef<number | null>(null);

  const getScrollContainer = useCallback(() => {
    return buttonRef.current?.closest<HTMLElement>(
      '[data-sauge-flip-page-index], [data-page-flip-fallback]'
    ) ?? null;
  }, []);

  const restoreScroll = useCallback(() => {
    const preservedScrollTop = preservedScrollTopRef.current;
    const scrollContainer = getScrollContainer();
    if (preservedScrollTop === null || !scrollContainer) return;
    if (scrollContainer.scrollTop !== preservedScrollTop) {
      scrollContainer.scrollTop = preservedScrollTop;
    }
  }, [getScrollContainer]);

  useLayoutEffect(() => {
    if (preservedScrollTopRef.current === null) return;
    restoreScroll();
    const frame = window.requestAnimationFrame(() => {
      restoreScroll();
      if (!isOpen) {
        preservedScrollTopRef.current = null;
        buttonRef.current?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, restoreScroll]);

  const toggleViewer = useCallback(() => {
    preservedScrollTopRef.current = getScrollContainer()?.scrollTop ?? 0;
    setIsOpen((current) => !current);
  }, [getScrollContainer]);

  const closeViewer = useCallback(() => {
    preservedScrollTopRef.current = getScrollContainer()?.scrollTop ?? 0;
    setIsOpen(false);
  }, [getScrollContainer]);

  return (
    <section className={styles.modelSection} aria-label={copy.show3d} data-no-page-flip="true">
      <button
        ref={buttonRef}
        type="button"
        className={styles.modelButton}
        onClick={toggleViewer}
        aria-expanded={isOpen}
      >
        <CubeIcon />
        {isOpen ? copy.hide3d : copy.show3d}
      </button>
      {isOpen ? (
        <div
          className={styles.modelStage}
          data-no-page-flip="true"
          onPointerDown={stopDishSwipePropagation}
          onPointerMove={stopDishSwipePropagation}
          onPointerUp={stopDishSwipePropagation}
          onPointerCancel={stopDishSwipePropagation}
        >
          <LazyDishModelViewer
            dish={modelViewerDishFromPublicDish(dish)}
            minimalChrome
            quietChrome
            onViewerMounted={restoreScroll}
            onReturnToDish={closeViewer}
          />
        </div>
      ) : null}
    </section>
  );
}

export function SaugeNoireDishSheet({
  menu,
  query,
  locale,
  publicLocale,
  exchangeRates,
  dish,
  copy,
  isPreview,
  onDishLinkClick,
  onMenuLinkClick
}: SaugeNoireDishSheetProps) {
  const currency = query?.currency ?? menu.settings.defaultCurrency;
  const dishCount = Math.max(menu.dishes.length, 1);
  const targetDishIndex = menu.dishes.findIndex((item) => item.id === dish.id);
  const targetPreviousDish = menu.dishes[(targetDishIndex - 1 + dishCount) % dishCount] ?? dish;
  const targetNextDish = menu.dishes[(targetDishIndex + 1) % dishCount] ?? dish;
  const targetMenuHref = buildMenuHref(menu, dish, query, currency);
  const targetCategory = localizedCategoryLabel(dish.category, publicLocale);
  const targetPreviousHref = buildPublicDishPath(menu.slug, targetPreviousDish.slug, {
    ...query,
    lang: publicLocale,
    currency,
    view: `sauge-${categoryPageIndex(menu, targetPreviousDish)}`
  });
  const targetNextHref = buildPublicDishPath(menu.slug, targetNextDish.slug, {
    ...query,
    lang: publicLocale,
    currency,
    view: `sauge-${categoryPageIndex(menu, targetNextDish)}`
  });
  const targetGroups = getAllergenDisplayGroups(dish, publicLocale);
  const targetCustomAllergens = customAllergensFromLegacyValues(
    dish.customAllergens ?? dish.allergenLegacyValues ?? dish.allergens
  );
  const targetAllergenText = [
    ...targetGroups.contains,
    ...targetCustomAllergens
  ].join(", ") || (targetGroups.unknownCount > 0 ? copy.confirmAllergens : copy.noAllergens);
  const targetCanOpen3d = !isPreview && hasReal3d(dish);

  return (
    <article
      className={`${styles.paper} ${isPreview ? styles.transitionPreview : ""}`}
      data-transition-preview={isPreview ? "true" : undefined}
      aria-hidden={isPreview || undefined}
    >
      <DishDetailHeader
        href={targetMenuHref}
        category={targetCategory}
        backLabel={copy.back}
        isPreview={isPreview}
        onClick={isPreview ? undefined : onMenuLinkClick}
      />
      <section className={styles.detailContent}>
        <p className={styles.categoryKicker}>{targetCategory}{isSignatureLabel(dish, publicLocale) ? "  ·  " : ""}{isSignatureLabel(dish, publicLocale)}</p>
        <h1>{dish.name.toUpperCase()}</h1>
        <Rule />
        <div className={styles.detailPhoto} data-photo-slot={dish.slug}>
          {dish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dish.imageUrl}
              alt={`Image du plat ${dish.name}`}
              draggable={false}
            />
          ) : null}
        </div>
        <p className={styles.detailPrice}>{formatPrice(dish, currency, locale, exchangeRates)}</p>
        <Rule />
        <p className={styles.description}>{dish.description}</p>
        <div className={styles.detailRows}>
          <DetailRow label={copy.ingredients} value={dish.ingredients.join(", ")} variant="detailIngredients" />
          <DetailRow label={copy.allergens} value={targetAllergenText} variant="detailAllergens" />
          <DetailRow label={copy.options} value={dish.options.join(", ") || copy.confirmAllergens} variant="detailAccord" />
        </div>
        {targetCanOpen3d ? (
          <SaugeNoireDish3dSection dish={dish} copy={copy} />
        ) : null}
        <AllergenWarning locale={publicLocale} localizedUiCopy={menu.localizedUiCopy} />
        <div className={styles.detailSwipeNav}>
          <p>{copy.next}</p>
          <div className={styles.detailDoubleArrowControl}>
            <Link
              className={`${styles.detailArrowHit} ${styles.detailArrowHitPrevious}`}
              href={targetPreviousHref}
              prefetch={false}
              aria-label={copy.previous}
              tabIndex={isPreview ? -1 : undefined}
              onClick={isPreview ? undefined : (event) => onDishLinkClick?.(event, targetPreviousHref, "previous")}
            />
            <DoubleArrow />
            <Link
              className={`${styles.detailArrowHit} ${styles.detailArrowHitNext}`}
              href={targetNextHref}
              prefetch={false}
              aria-label={copy.next}
              tabIndex={isPreview ? -1 : undefined}
              onClick={isPreview ? undefined : (event) => onDishLinkClick?.(event, targetNextHref, "next")}
            />
          </div>
        </div>
        <Link
          className={styles.menuLink}
          href={targetMenuHref}
          prefetch={false}
          tabIndex={isPreview ? -1 : undefined}
          onClick={isPreview ? undefined : (event) => onMenuLinkClick?.(event, targetMenuHref)}
        >
          {copy.menu}
        </Link>
      </section>
    </article>
  );
}

const DISH_COPY: Record<DishCopyLocale, SaugeNoireDishSheetCopy> = {
  fr: {
    back: "Retour à",
    ingredients: "INGRÉDIENTS",
    allergens: "ALLERGÈNES",
    options: "OPTIONS",
    accord: "ACCORD",
    noAllergens: "aucun allergène majeur déclaré",
    confirmAllergens: "à confirmer avec l’équipe en salle",
    show3d: "VOIR EN 3D",
    hide3d: "MASQUER LA 3D",
    previous: "Balayez vers le plat précédent",
    next: "Balayez pour tourner vers le prochain plat",
    menu: "La Carte"
  },
  en: {
    back: "Back to",
    ingredients: "INGREDIENTS",
    allergens: "ALLERGENS",
    options: "OPTIONS",
    accord: "PAIRING",
    noAllergens: "no major allergens declared",
    confirmAllergens: "please confirm with the dining room team",
    show3d: "VIEW IN 3D",
    hide3d: "HIDE 3D",
    previous: "Swipe to the previous dish",
    next: "Swipe to turn to the next dish",
    menu: "The Menu"
  },
  es: {
    back: "Volver a",
    ingredients: "INGREDIENTES",
    allergens: "ALÉRGENOS",
    options: "OPCIONES",
    accord: "MARIDAJE",
    noAllergens: "no se han declarado alérgenos principales",
    confirmAllergens: "confirma con el equipo de sala",
    show3d: "VER EN 3D",
    hide3d: "OCULTAR 3D",
    previous: "Desliza hacia el plato anterior",
    next: "Desliza para ver el siguiente plato",
    menu: "El menú"
  },
  it: {
    back: "Torna a",
    ingredients: "INGREDIENTI",
    allergens: "ALLERGENI",
    options: "OPZIONI",
    accord: "ABBINAMENTO",
    noAllergens: "nessun allergene principale dichiarato",
    confirmAllergens: "conferma con il personale di sala",
    show3d: "VEDI IN 3D",
    hide3d: "NASCONDI 3D",
    previous: "Scorri verso il piatto precedente",
    next: "Scorri per il prossimo piatto",
    menu: "Il menu"
  },
  ar: {
    back: "العودة إلى",
    ingredients: "المكونات",
    allergens: "مسببات الحساسية",
    options: "الخيارات",
    accord: "التوافق",
    noAllergens: "لم يتم الإعلان عن مسببات حساسية رئيسية",
    confirmAllergens: "يرجى التأكيد مع فريق الصالة",
    show3d: "عرض ثلاثي الأبعاد",
    hide3d: "إخفاء العرض ثلاثي الأبعاد",
    previous: "مرّر للطبق السابق",
    next: "مرّر للانتقال إلى الطبق التالي",
    menu: "القائمة"
  }
};

export function SaugeNoireDishSheetCopyForLocale(locale: string): SaugeNoireDishSheetCopy {
  return DISH_COPY[copyLocale(locale)];
}

export function SaugeNoireDishDetail({
  menu,
  query,
  locale = "fr",
  exchangeRates,
  dish
}: DishDetailProps) {
  const currency = query?.currency ?? menu.settings.defaultCurrency;
  const publicLocale = query?.lang ?? locale;
  const selectedCopyLocale = copyLocale(publicLocale);
  const routeTransition = useSaugeNoireTransition();
  const beginRouteTransition = routeTransition?.beginTransition;
  const notifyRouteDestinationReady = routeTransition?.notifyDestinationReady;
  const detailSurfaceRef = useRef<HTMLDivElement>(null);
  const [activeDish, setActiveDish] = useState(dish);
  const currentDishRef = useRef(activeDish);
  const [recenterToken, setRecenterToken] = useState(0);
  const navigationInFlightRef = useRef(false);
  const pageTurnRef = useRef<DishPageTurnState | null>(null);
  const dishFlipPhaseRef = useRef({
    started: false,
    reachedTarget: false,
    returnedToRead: false,
    navigationStarted: false
  });
  const routeTransitionIdRef = useRef(0);
  const renderDishPaperRef = useRef<
    ((targetDish: PublicMenuDish, isPreview: boolean) => ReactNode) | null
  >(null);
  const preservedScrollTopRef = useRef<number | null>(null);
  const [pageTurn, setPageTurn] = useState<DishPageTurnState | null>(null);
  useEffect(() => {
    document.title = `${activeDish.name} | ${menu.name} | Vistaire`;
  }, [activeDish.name, menu.name]);

  useEffect(() => {
    const routeSlug = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).at(-1) ?? "");
    if (routeSlug !== dish.slug || currentDishRef.current.id === dish.id) return;
    currentDishRef.current = dish;
    setActiveDish(dish);
    setPageTurn(null);
    setRecenterToken((current) => current + 1);
  }, [dish]);

  useEffect(() => {
    const syncFromHistory = () => {
      const routeSlug = decodeURIComponent(
        window.location.pathname.split("/").filter(Boolean).at(-1) ?? ""
      );
      const historyDish = menu.dishes.find((item) => item.slug === routeSlug);
      if (!historyDish || historyDish.id === currentDishRef.current.id) return;
      navigationInFlightRef.current = false;
      pageTurnRef.current = null;
      currentDishRef.current = historyDish;
      setPageTurn(null);
      setActiveDish(historyDish);
      setRecenterToken((current) => current + 1);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, [menu.dishes]);

  useEffect(() => {
    navigationInFlightRef.current = false;
    pageTurnRef.current = null;
    dishFlipPhaseRef.current = {
      started: false,
      reachedTarget: false,
      returnedToRead: false,
      navigationStarted: false
    };
    preservedScrollTopRef.current = null;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const currentPage = Array.from(
      detailSurfaceRef.current?.querySelectorAll<HTMLElement>(
        '[class*="pageFlipPage"], [class*="pageFlipFallback"]'
      ) ?? []
    ).find((page) => page.querySelector('article:not([data-transition-preview="true"])'));
    currentPage?.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      navigationInFlightRef.current = false;
    };
  }, [activeDish.id]);

  useEffect(() => {
    const preservedScrollTop = preservedScrollTopRef.current;
    if (preservedScrollTop === null) return;

    let frame = 0;
    const restoreCurrentScroll = () => {
      const pages = Array.from(
        detailSurfaceRef.current?.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]') ?? []
      ).filter((page) => !page.closest('[data-sauge-flip-clone="true"]'));
      // PageFlip can reset every physical sheet while it prepares the fold.
      // Keep the reading position on the original sheets during the transition.
      for (const page of pages) {
        if (page.scrollHeight > page.clientHeight && page.scrollTop !== preservedScrollTop) {
          page.scrollTop = preservedScrollTop;
        }
      }

      if (navigationInFlightRef.current) {
        frame = requestAnimationFrame(restoreCurrentScroll);
      }
    };

    frame = requestAnimationFrame(restoreCurrentScroll);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pageTurn?.targetDish.id]);
  const copy = useMemo(() => ({
    fr: {
        back: "Retour à",
        ingredients: "INGRÉDIENTS",
        allergens: "ALLERGÈNES",
        options: "OPTIONS",
        accord: "ACCORD",
        noAllergens: "aucun allergène majeur déclaré",
        confirmAllergens: "à confirmer avec l’équipe en salle",
        show3d: "VOIR EN 3D",
        hide3d: "MASQUER LA 3D",
        previous: "Balayez vers le plat précédent",
        next: "Balayez pour tourner vers le prochain plat",
        menu: "La Carte"
      },
    en: {
        back: "Back to",
        ingredients: "INGREDIENTS",
        allergens: "ALLERGENS",
        options: "OPTIONS",
        accord: "PAIRING",
        noAllergens: "no major allergens declared",
        confirmAllergens: "please confirm with the dining room team",
        show3d: "VIEW IN 3D",
        hide3d: "HIDE 3D",
        previous: "Swipe to the previous dish",
        next: "Swipe to turn to the next dish",
        menu: "The Menu"
      },
    es: {
      back: "Volver a",
      ingredients: "INGREDIENTES",
      allergens: "ALÉRGENOS",
      options: "OPCIONES",
      accord: "MARIDAJE",
      noAllergens: "no se han declarado alérgenos principales",
      confirmAllergens: "confirma con el equipo de sala",
      show3d: "VER EN 3D",
      hide3d: "OCULTAR 3D",
      previous: "Desliza hacia el plato anterior",
      next: "Desliza para ver el siguiente plato",
      menu: "El menú"
    },
    it: {
      back: "Torna a",
      ingredients: "INGREDIENTI",
      allergens: "ALLERGENI",
      options: "OPZIONI",
      accord: "ABBINAMENTO",
      noAllergens: "nessun allergene principale dichiarato",
      confirmAllergens: "conferma con il personale di sala",
      show3d: "VEDI IN 3D",
      hide3d: "NASCONDI 3D",
      previous: "Scorri verso il piatto precedente",
      next: "Scorri per il prossimo piatto",
      menu: "Il menu"
    },
    ar: {
      back: "العودة إلى",
      ingredients: "المكونات",
      allergens: "مسببات الحساسية",
      options: "الخيارات",
      accord: "التوافق",
      noAllergens: "لم يتم الإعلان عن مسببات حساسية رئيسية",
      confirmAllergens: "يرجى التأكيد مع فريق الصالة",
      show3d: "عرض ثلاثي الأبعاد",
      hide3d: "إخفاء العرض ثلاثي الأبعاد",
      previous: "مرّر للطبق السابق",
      next: "مرّر للانتقال إلى الطبق التالي",
      menu: "القائمة"
    }
  }[selectedCopyLocale]), [selectedCopyLocale]);
  const currentDishIndex = menu.dishes.findIndex((item) => item.id === activeDish.id);
  const dishCount = Math.max(menu.dishes.length, 1);
  const previousDish =
    menu.dishes[(currentDishIndex - 1 + dishCount) % dishCount] ?? activeDish;
  const nextDish =
    menu.dishes[(currentDishIndex + 1) % dishCount] ?? activeDish;
  const buildDishHref = useCallback((targetDish: PublicMenuDish) => {
    const dishQuery = {
      ...query,
      lang: publicLocale,
      currency,
      view: `sauge-${categoryPageIndex(menu, targetDish)}`
    };
    return buildPublicDishPath(menu.slug, targetDish.slug, dishQuery);
  }, [currency, menu, publicLocale, query]);
  const requestDishNavigation = useCallback((
    href: string,
    direction: DishTurnDirection,
    targetDish: PublicMenuDish
  ) => {
    if (navigationInFlightRef.current) return;
    navigationInFlightRef.current = true;
    const preservedScrollTop = Array.from(
      detailSurfaceRef.current?.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]') ?? []
    ).find(
      (page) =>
        !page.closest('[aria-hidden="true"]') &&
        page.querySelector('article:not([data-transition-preview="true"])')
    )?.scrollTop ?? 0;
    preservedScrollTopRef.current = preservedScrollTop;
    for (const page of Array.from(
      detailSurfaceRef.current?.querySelectorAll<HTMLElement>('[class*="pageFlipPage"]') ?? []
    ).filter((page) => !page.closest('[data-sauge-flip-clone="true"]'))) {
      if (page.scrollHeight > page.clientHeight && page.scrollTop !== preservedScrollTop) {
        page.scrollTop = preservedScrollTop;
      }
    }
    setPageTurn({
      dishId: currentDishRef.current.id,
      direction,
      targetDish,
      href,
      targetPageIndex: direction === "next" ? 2 : 0
    });
    pageTurnRef.current = {
      dishId: currentDishRef.current.id,
      direction,
      targetDish,
      href,
      targetPageIndex: direction === "next" ? 2 : 0
    };
    dishFlipPhaseRef.current = {
      started: false,
      reachedTarget: false,
      returnedToRead: false,
      navigationStarted: false
    };
  }, []);

  const handleDishLinkClick = useCallback((
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    direction: DishTurnDirection
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const pageFlipState = detailSurfaceRef.current
      ?.querySelector<HTMLElement>("[data-page-flip-state]")
      ?.getAttribute("data-page-flip-state");
    if (pageFlipState !== "ready") return;
    event.preventDefault();
    requestDishNavigation(
      href,
      direction,
      direction === "next"
        ? menu.dishes[(currentDishIndex + 1) % dishCount] ?? currentDishRef.current
        : menu.dishes[(currentDishIndex - 1 + dishCount) % dishCount] ?? currentDishRef.current
    );
  }, [currentDishIndex, detailSurfaceRef, dishCount, menu, requestDishNavigation]);

  const commitDish = useCallback(() => {
    const turn = pageTurnRef.current;
    const phase = dishFlipPhaseRef.current;
    if (
      !turn ||
      turn.dishId !== currentDishRef.current.id ||
      !navigationInFlightRef.current ||
      phase.navigationStarted ||
      !phase.started ||
      !phase.reachedTarget ||
      !phase.returnedToRead
    ) {
      return;
    }
    phase.navigationStarted = true;
    navigationInFlightRef.current = false;
    pageTurnRef.current = null;
    currentDishRef.current = turn.targetDish;
    setActiveDish(turn.targetDish);
    setPageTurn(null);
    setRecenterToken((current) => current + 1);
    window.history.pushState(window.history.state, "", turn.href);
  }, []);

  const handleDetailPageFlip = useCallback((index: number) => {
    const turn = pageTurnRef.current;
    if (
      !turn ||
      turn.dishId !== currentDishRef.current.id ||
      index !== turn.targetPageIndex ||
      !navigationInFlightRef.current
    ) {
      return;
    }
    dishFlipPhaseRef.current.reachedTarget = true;
    commitDish();
  }, [commitDish]);

  const handleDetailPageFlipState = useCallback((state: string) => {
    if (state === "flipping") {
      dishFlipPhaseRef.current.started = true;
      return;
    }
    if (state !== "read" || !dishFlipPhaseRef.current.started) return;
    dishFlipPhaseRef.current.returnedToRead = true;
    commitDish();
  }, [commitDish]);

  const handleDetailSwipe = useCallback((direction: "next" | "previous") => {
    const currentIndex = currentDishRef.current.id === activeDish.id
      ? currentDishIndex
      : menu.dishes.findIndex((item) => item.id === currentDishRef.current.id);
    const safeIndex = currentIndex < 0 ? 0 : currentIndex;
    const count = Math.max(menu.dishes.length, 1);
    requestDishNavigation(
      direction === "next"
        ? buildDishHref(menu.dishes[(safeIndex + 1) % count] ?? currentDishRef.current)
        : buildDishHref(menu.dishes[(safeIndex - 1 + count) % count] ?? currentDishRef.current),
      direction,
      direction === "next"
        ? menu.dishes[(safeIndex + 1) % count] ?? currentDishRef.current
        : menu.dishes[(safeIndex - 1 + count) % count] ?? currentDishRef.current
    );
  }, [activeDish.id, buildDishHref, currentDishIndex, menu.dishes, requestDishNavigation]);

  const currentDetailScrollTop = useCallback((): number => {
    const currentPage = Array.from(
      detailSurfaceRef.current?.querySelectorAll<HTMLElement>(
        '[class*="pageFlipPage"], [class*="pageFlipFallback"]'
      ) ?? []
    ).find(
      (page) =>
        !page.closest('[aria-hidden="true"]') &&
        page.querySelector('article:not([data-transition-preview="true"])')
    );
    return currentPage?.scrollTop ?? 0;
  }, []);

  const handleMenuLinkClick = useCallback((
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const pageFlipState = detailSurfaceRef.current
      ?.querySelector<HTMLElement>("[data-page-flip-state]")
      ?.getAttribute("data-page-flip-state");
    if (pageFlipState !== "ready") return;

    const categorySheet = categorySheetForDish(menu, activeDish);
    if (!categorySheet.category) return;

    if (!beginRouteTransition) return;
    routeTransitionIdRef.current += 1;
    const started = beginRouteTransition({
      id: `detail-to-menu-${routeTransitionIdRef.current}-${activeDish.id}`,
      href,
      direction: "previous",
      sourceScrollTop: currentDetailScrollTop(),
      source: renderDishPaperRef.current?.(activeDish, true) ?? null,
      destination: (
        <>
          <SaugeNoireBookHeader
            locales={menu.settings.supportedLocales}
            currencies={menu.settings.supportedCurrencies}
            activeLocale={publicLocale}
            activeCurrency={currency}
            onLocaleChange={() => undefined}
            onCurrencyChange={() => undefined}
            showContentsLink
            contentsLabel={copy.menu}
            onContents={() => undefined}
            isPreview
          />
          <SectionPage
            menu={menu}
            category={categorySheet.category}
            dishes={categorySheet.dishes}
            pageNumber={categorySheet.pageNumber}
            locale={locale}
            localeTag={publicLocale}
            currency={currency}
            copy={{
              menu: copy.menu,
              swipePage: copy.next,
              previous: copy.previous,
              next: copy.next
            }}
            query={query}
            exchangeRates={exchangeRates}
            onPrevious={() => undefined}
            onNext={() => undefined}
            isPreview
          />
        </>
      )
    });
    if (started) event.preventDefault();
  }, [activeDish, beginRouteTransition, copy.menu, copy.next, copy.previous, currentDetailScrollTop, currency, exchangeRates, locale, menu, publicLocale, query]);

  const renderDishPaper = useCallback((targetDish: PublicMenuDish, isPreview: boolean) => {
    return (
      <SaugeNoireDishSheet
        menu={menu}
        query={query}
        locale={locale}
        publicLocale={publicLocale}
        exchangeRates={exchangeRates}
        dish={targetDish}
        copy={copy}
        isPreview={isPreview}
        onDishLinkClick={isPreview ? undefined : handleDishLinkClick}
        onMenuLinkClick={isPreview ? undefined : handleMenuLinkClick}
      />
    );
  }, [copy, exchangeRates, handleDishLinkClick, handleMenuLinkClick, locale, menu, publicLocale, query]);

  useEffect(() => {
    renderDishPaperRef.current = renderDishPaper;
  }, [renderDishPaper]);

  const activePageTurn = pageTurn?.dishId === activeDish.id ? pageTurn : null;
  const previousPageDish =
    activePageTurn?.direction === "previous" ? activePageTurn.targetDish : previousDish;
  const nextPageDish =
    activePageTurn?.direction === "next" ? activePageTurn.targetDish : nextDish;
  const detailFlipPages = useMemo(
    () => [
      <SaugeNoireFlipPage density="soft" index={0} key="previous-page">
        {renderDishPaper(previousPageDish, true)}
      </SaugeNoireFlipPage>,
      <SaugeNoireFlipPage density="soft" index={1} key="current-page">
        {renderDishPaper(activeDish, false)}
      </SaugeNoireFlipPage>,
      <SaugeNoireFlipPage density="soft" index={2} key="next-page">
        {renderDishPaper(nextPageDish, true)}
      </SaugeNoireFlipPage>
    ],
    [activeDish, nextPageDish, previousPageDish, renderDishPaper]
  );

  return (
    <main className={styles.detailPage} data-testid="sauge-noire-dish-detail">
      <aside className={styles.rail} aria-hidden="true">
        <div className={styles.railPattern} />
        <div className={`${styles.railFastener} ${styles.railFastenerTop}`}><i /><span /><i /></div>
        <div className={`${styles.railFastener} ${styles.railFastenerBottom}`}><i /><span /><i /></div>
      </aside>
      <div className={styles.detailSurface} ref={detailSurfaceRef} data-detail-page-flip="true">
        <SaugeNoirePageFlipExperiment
          pages={detailFlipPages}
          pageIndex={activePageTurn?.targetPageIndex ?? 1}
          startPage={1}
          onPageFlip={handleDetailPageFlip}
          onChangeState={handleDetailPageFlipState}
          onReady={notifyRouteDestinationReady}
          onError={notifyRouteDestinationReady}
          onSwipe={handleDetailSwipe}
          interceptSwipe
          resetKey={`sauge-detail-book-${menu.slug}`}
          recenterPage={1}
          recenterToken={recenterToken}
          protectInteractiveTargets
          showCover={false}
          renderOnlyPageLengthChange={false}
          fallback={renderDishPaper(activeDish, false)}
        />
      </div>
    </main>
  );
}

function DishDetailHeader({
  href,
  category,
  backLabel,
  isPreview,
  onClick
}: {
  href: string;
  category: string;
  backLabel: string;
  isPreview: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <header className={styles.detailHeader} aria-hidden={isPreview || undefined}>
      <Link
        className={styles.backLink}
        href={href}
        prefetch={false}
        tabIndex={isPreview ? -1 : undefined}
        onClick={isPreview ? undefined : (event) => onClick?.(event, href)}
      >
        <span aria-hidden="true">{"\u2190"}</span> {backLabel} {category}
      </Link>
      <div className={styles.brandMark} aria-label="Sauge Noire">
        <span>S</span>
        <span>N</span>
      </div>
    </header>
  );
}

function isSignatureLabel(dish: PublicMenuDish, locale: string): string {
  const signature = dish.isSignature || dish.tags.some((tag) => tag.toLowerCase().includes("signature"));
  return signature && !isCocktailSignatureCategory(dish.category)
    ? localizedCategoryLabel("signature", locale)
    : "";
}

function isCocktailSignatureCategory(category: string): boolean {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("cocktail") && normalized.includes("signature");
}

function DetailRow({ label, value, variant }: {
  label: string;
  value: string;
  variant: "detailIngredients" | "detailAllergens" | "detailAccord";
}) {
  return (
    <div className={styles.detailRow}>
      <SaugeNoireBotanical variant={variant} className={styles.detailBotanical} />
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function Rule() {
  return <span className={styles.rule} aria-hidden="true"><i /></span>;
}

function DoubleArrow() {
  return (
    <svg className={styles.doubleArrow} viewBox="0 0 48 20" aria-hidden="true" focusable="false">
      <path d="M1 10h46M7 4l-6 6 6 6M41 4l6 6-6 6" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg className={styles.cubeIcon} viewBox="0 0 32 32" aria-hidden="true">
      <path d="m16 3 12 7v13l-12 6-12-6V10l12-7Zm0 0v13m12-6-12 6m-12-6 12 6m0 0v13" />
    </svg>
  );
}
