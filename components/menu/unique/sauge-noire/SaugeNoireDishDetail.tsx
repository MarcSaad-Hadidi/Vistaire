"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { SaugeNoireFlipPage } from "./SaugeNoireFlipPage";
import { SaugeNoirePageFlipExperiment } from "./SaugeNoirePageFlipExperiment";
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
  const router = useRouter();
  const detailSurfaceRef = useRef<HTMLDivElement>(null);
  const navigationInFlightRef = useRef(false);
  const preservedScrollTopRef = useRef<number | null>(null);
  const [pageTurn, setPageTurn] = useState<DishPageTurnState | null>(null);
  const [showModelViewerDishId, setShowModelViewerDishId] = useState<string | null>(null);
  const showModelViewer = showModelViewerDishId === dish.id;

  useEffect(() => {
    navigationInFlightRef.current = false;
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
  }, [dish.id]);

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
  const copy = {
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
  }[selectedCopyLocale];
  const currentDishIndex = menu.dishes.findIndex((item) => item.id === dish.id);
  const dishCount = Math.max(menu.dishes.length, 1);
  const previousDish = menu.dishes[(currentDishIndex - 1 + dishCount) % dishCount] ?? dish;
  const nextDish =
    menu.dishes[(currentDishIndex + 1) % dishCount] ?? dish;
  const buildDishHref = (targetDish: PublicMenuDish) => {
    const dishQuery = {
      ...query,
      lang: publicLocale,
      currency,
      view: `sauge-${categoryPageIndex(menu, targetDish)}`
    };
    return buildPublicDishPath(menu.slug, targetDish.slug, dishQuery);
  };
  const previousHref = buildDishHref(previousDish);
  const detailHref = buildDishHref(nextDish);

  function requestDishNavigation(
    href: string,
    direction: DishTurnDirection,
    targetDish: PublicMenuDish
  ) {
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
    setShowModelViewerDishId(null);
    setPageTurn({
      dishId: dish.id,
      direction,
      targetDish,
      href,
      targetPageIndex: direction === "next" ? 2 : 0
    });
  }

  function handleDishLinkClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    direction: DishTurnDirection
  ) {
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
    event.preventDefault();
    requestDishNavigation(
      href,
      direction,
      direction === "next" ? nextDish : previousDish
    );
  }

  function handleDetailPageFlip(index: number) {
    if (
      !pageTurn ||
      pageTurn.dishId !== dish.id ||
      index !== pageTurn.targetPageIndex ||
      !navigationInFlightRef.current
    ) {
      return;
    }
    navigationInFlightRef.current = false;
    router.push(pageTurn.href);
  }

  function handleDetailSwipe(direction: "next" | "previous") {
    requestDishNavigation(
      direction === "next" ? detailHref : previousHref,
      direction,
      direction === "next" ? nextDish : previousDish
    );
  }

  function renderDishPaper(targetDish: PublicMenuDish, isPreview: boolean) {
    const targetGroups = getAllergenDisplayGroups(targetDish, publicLocale);
    const targetCustomAllergens = customAllergensFromLegacyValues(
      targetDish.customAllergens ?? targetDish.allergenLegacyValues ?? targetDish.allergens
    );
    const targetAllergenText = [
      ...targetGroups.contains,
      ...targetCustomAllergens
    ].join(", ") || (targetGroups.unknownCount > 0 ? copy.confirmAllergens : copy.noAllergens);
    const targetMenuHref = buildMenuHref(menu, targetDish, query, currency);
    const targetCategory = localizedCategoryLabel(targetDish.category, publicLocale);
    const targetDishIndex = menu.dishes.findIndex((item) => item.id === targetDish.id);
    const targetPreviousDish = menu.dishes[(targetDishIndex - 1 + dishCount) % dishCount] ?? targetDish;
    const targetNextDish = menu.dishes[(targetDishIndex + 1) % dishCount] ?? targetDish;
    const targetPreviousHref = buildDishHref(targetPreviousDish);
    const targetNextHref = buildDishHref(targetNextDish);
    const targetCanOpen3d = !isPreview && hasReal3d(targetDish);
    const targetShowModelViewer = !isPreview && targetDish.id === dish.id && showModelViewer;
    const turnClass = !isPreview
      ? ""
      : styles.transitionPreview;

    return (
      <article
        className={`${styles.paper} ${turnClass}`}
        data-transition-preview={isPreview ? "true" : undefined}
        aria-hidden={isPreview || undefined}
      >
        <DishDetailHeader
          href={targetMenuHref}
          category={targetCategory}
          backLabel={copy.back}
          isPreview={isPreview}
        />
        <section className={styles.detailContent}>
          <p className={styles.categoryKicker}>{targetCategory}{isSignatureLabel(targetDish, publicLocale) ? "  \u00b7  " : ""}{isSignatureLabel(targetDish, publicLocale)}</p>
          <h1>{targetDish.name.toUpperCase()}</h1>
          <Rule />
          <div className={styles.detailPhoto} data-photo-slot={targetDish.slug}>
            {targetDish.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={targetDish.imageUrl}
                alt={`Image du plat ${targetDish.name}`}
                draggable={false}
              />
            ) : null}
          </div>
          <p className={styles.detailPrice}>{formatPrice(targetDish, currency, locale, exchangeRates)}</p>
          <Rule />
          <p className={styles.description}>{targetDish.description}</p>
          <div className={styles.detailRows}>
            <DetailRow label={copy.ingredients} value={targetDish.ingredients.join(", ")} variant="detailIngredients" />
            <DetailRow label={copy.allergens} value={targetAllergenText} variant="detailAllergens" />
            <DetailRow label={copy.options} value={targetDish.options.join(", ") || copy.confirmAllergens} variant="detailAccord" />
          </div>
          {targetCanOpen3d ? (
            <section className={styles.modelSection} aria-label={copy.show3d} data-no-page-flip="true">
              <button
                type="button"
                className={styles.modelButton}
                onClick={() => setShowModelViewerDishId((visibleDishId) => visibleDishId === targetDish.id ? null : targetDish.id)}
                aria-expanded={targetShowModelViewer}
              >
                <CubeIcon />
                {targetShowModelViewer ? copy.hide3d : copy.show3d}
              </button>
              {targetShowModelViewer ? (
                <div
                  className={styles.modelStage}
                  data-no-page-flip="true"
                  onPointerDown={stopDishSwipePropagation}
                  onPointerMove={stopDishSwipePropagation}
                  onPointerUp={stopDishSwipePropagation}
                  onPointerCancel={stopDishSwipePropagation}
                >
                  <LazyDishModelViewer
                    dish={modelViewerDishFromPublicDish(targetDish)}
                    minimalChrome
                    quietChrome
                    onReturnToDish={() => setShowModelViewerDishId(null)}
                  />
                </div>
              ) : null}
            </section>
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
                onClick={isPreview ? undefined : (event) => handleDishLinkClick(event, targetPreviousHref, "previous")}
              />
              <DoubleArrow />
              <Link
                className={`${styles.detailArrowHit} ${styles.detailArrowHitNext}`}
                href={targetNextHref}
                prefetch={false}
                aria-label={copy.next}
                onClick={isPreview ? undefined : (event) => handleDishLinkClick(event, targetNextHref, "next")}
              />
            </div>
          </div>
          <Link className={styles.menuLink} href={targetMenuHref} prefetch={false}>{copy.menu}</Link>
        </section>
      </article>
    );
  }

  const activePageTurn = pageTurn?.dishId === dish.id ? pageTurn : null;
  const previousPageDish =
    activePageTurn?.direction === "previous" ? activePageTurn.targetDish : previousDish;
  const nextPageDish =
    activePageTurn?.direction === "next" ? activePageTurn.targetDish : nextDish;
  const detailFlipPages = [
    <SaugeNoireFlipPage density="soft" index={0} key="previous-page">
      {renderDishPaper(previousPageDish, true)}
    </SaugeNoireFlipPage>,
    <SaugeNoireFlipPage density="soft" index={1} key="current-page">
      {renderDishPaper(dish, false)}
    </SaugeNoireFlipPage>,
    <SaugeNoireFlipPage density="soft" index={2} key="next-page">
      {renderDishPaper(nextPageDish, true)}
    </SaugeNoireFlipPage>
  ];

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
          onSwipe={handleDetailSwipe}
          interceptSwipe
          resetKey={dish.id}
          protectInteractiveTargets
          showCover={false}
          fallback={renderDishPaper(dish, false)}
        />
      </div>
      <div className={`${styles.brandMark} ${styles.detailFloatingBrandMark}`} aria-label="Sauge Noire">
        <span>S</span><span>N</span>
      </div>
    </main>
  );
}

function DishDetailHeader({
  href,
  category,
  backLabel,
  isPreview
}: {
  href: string;
  category: string;
  backLabel: string;
  isPreview: boolean;
}) {
  return (
    <header className={styles.detailHeader} aria-hidden={isPreview || undefined}>
      <Link className={styles.backLink} href={href} prefetch={false}>
        <span aria-hidden="true">{"\u2190"}</span> {backLabel} {category}
      </Link>
    </header>
  );
}

function isSignatureLabel(dish: PublicMenuDish, locale: string): string {
  const signature = dish.isSignature || dish.tags.some((tag) => tag.toLowerCase().includes("signature"));
  return signature ? localizedCategoryLabel("signature", locale) : "";
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
