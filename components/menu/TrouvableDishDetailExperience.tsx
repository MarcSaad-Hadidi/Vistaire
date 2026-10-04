"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";
import {
  buildPublicDishPath,
  type PublicMenu,
  type PublicMenuContextQuery,
  type PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import {
  trackPublicMenuEvent
} from "@/lib/analytics/client";
import { hasPublicMenu3d } from "@/lib/menu/hasPublicMenu3d";
import { formatTrouvableDishPrice } from "./trouvableMenuControls";
import { GoogleReviewCard } from "./GoogleReviewCard";
import {
  getDishSwipeScrollTop,
  isDishSwipeGuardedTarget,
  resolveDishSwipeGesture
} from "@/lib/menu/dishReviewSwipe";
import { PremiumDishDetailsSheet } from "./PremiumDishDetailsSheet";
import { getTrouvablePaletteSource } from "@/lib/menu/trouvableMenuExperience";
import {
  TrouvableDishDetailSurface,
  TrouvableImmersivePanelBody,
  useTrouvableImmersiveExperience
} from "./TrouvableDishDetailSurface";
import { useTrouvablePreferences } from "./useTrouvablePreferences";
import styles from "./TrouvablePremiumMenuExperience.module.css";

type TrouvableDishDetailExperienceProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  context?: string;
  exchangeRates: MenuExchangeRates;
  query?: PublicMenuContextQuery;
  config?: MenuUiConfig;
  typographyClassName?: string;
};

type SwipeStart = {
  x: number;
  y: number;
  pointerId: number;
  scrollTop: number;
} | null;
type DishDetailSubSheet = "details" | null;

export function TrouvableDishDetailExperience({
  menu,
  dish,
  context = "",
  exchangeRates,
  query,
  config,
  typographyClassName = ""
}: TrouvableDishDetailExperienceProps) {
  const [activeDish, setActiveDish] = useState(dish);
  const swipeStartRef = useRef<SwipeStart>(null);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const [activeSubSheet, setActiveSubSheet] = useState<DishDetailSubSheet>(null);
  const {
    selectedLocale,
    selectedCurrency,
    selectedTheme,
    localizedQuery,
    copy,
    copyResolution,
    textDirection
  } = useTrouvablePreferences(menu, query);
  const immersiveExperience = useTrouvableImmersiveExperience(
    buildPublicDishPath(menu.slug, activeDish.slug, localizedQuery),
    showModelViewer
  );
  const { resetArHandoffState } = immersiveExperience;
  useEffect(() => {
    trackPublicMenuEvent(menu, {
      eventName: "dish_opened",
      dishSlug: activeDish.slug,
      categorySlug: activeDish.categorySlug
    });
  }, [activeDish.categorySlug, activeDish.slug, menu]);
  const menuHref = buildPublicMenuPath(menu.slug, localizedQuery);
  const activeCategoryKey = activeDish.categoryId || activeDish.category;
  const sectionDishes = useMemo(
    () =>
      menu.dishes.filter(
        (candidate) => (candidate.categoryId || candidate.category) === activeCategoryKey
      ),
    [activeCategoryKey, menu.dishes]
  );
  const activeIndex = sectionDishes.findIndex(
    (candidate) => candidate.id === activeDish.id
  );
  const hasModel = hasPublicMenu3d(activeDish);
  const activePrice = formatTrouvableDishPrice(
    activeDish,
    selectedCurrency,
    selectedLocale,
    exchangeRates
  );
  const moreDetailsId = `trouvable-dish-more-details-${activeDish.slug}`;

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setActiveDish(dish);
      setShowModelViewer(false);
      setActiveSubSheet(null);
      resetArHandoffState();
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dish, resetArHandoffState]);

  function toggleModelViewer() {
    resetArHandoffState();
    setShowModelViewer((isVisible) => {
      if (!isVisible) {
        trackPublicMenuEvent(menu, {
          eventName: "dish_3d_clicked",
          dishSlug: activeDish.slug,
          categorySlug: activeDish.categorySlug
        });
      }
      return !isVisible;
    });
  }

  function selectAdjacentDish(direction: 1 | -1) {
    if (sectionDishes.length < 2) return;
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = (safeIndex + direction + sectionDishes.length) % sectionDishes.length;
    const nextDish = sectionDishes[nextIndex];
    if (nextDish) {
      setActiveDish(nextDish);
      setShowModelViewer(false);
      resetArHandoffState();
      setActiveSubSheet(null);
      window.history.replaceState(
        null,
        "",
        buildPublicDishPath(menu.slug, nextDish.slug, localizedQuery)
      );
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const start = swipeStartRef.current;
    if (!start || event.pointerType === "mouse") return;
    swipeStartRef.current = null;
    if (
      activeSubSheet ||
      showModelViewer ||
      start.pointerId !== event.pointerId ||
      isDishSwipeGuardedTarget(event.target, event.currentTarget)
    ) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const scrollDelta =
      getDishSwipeScrollTop(event.currentTarget) - start.scrollTop;
    const gesture = resolveDishSwipeGesture(deltaX, deltaY, scrollDelta);
    if (gesture === "next" || gesture === "previous") {
      selectAdjacentDish(gesture === "next" ? 1 : -1);
    }
  }

  const paletteSource = getTrouvablePaletteSource(menu);

  return (
    <main
      data-public-dish-renderer="trouvable"
      data-menu-context={context}
      className={`${styles.page} ${styles.standaloneDetailPage} ${typographyClassName}`.trim()}
      style={
        config && paletteSource === "restaurant"
          ? ({
              "--menu-bg": config.palette.background,
              "--menu-surface": config.palette.surface,
              "--menu-text": config.palette.text,
              "--menu-muted": config.palette.muted,
              "--menu-accent": config.palette.accent,
              "--menu-accent-2": config.palette.accent2,
              "--menu-accent-3": config.palette.accent3,
              "--menu-border": config.palette.border,
              "--menu-success": config.palette.success,
              "--menu-warning": config.palette.warning,
              "--menu-danger": config.palette.danger
            } as CSSProperties)
          : undefined
      }
      lang={selectedLocale}
      data-text-direction={textDirection}
      data-palette-source={paletteSource}
      data-user-theme={selectedTheme}
      data-copy-built-in-locale={copyResolution.builtInLocale}
      data-copy-dynamic-source={copyResolution.dynamicSource}
      data-copy-neutral-fallback={copyResolution.usedNeutralFallback ? "true" : "false"}
      data-copy-complete={copyResolution.uiCopyComplete ? "true" : "false"}
      data-locale-public-ready={
        copyResolution.uiCopyComplete && !copyResolution.usedNeutralFallback
          ? "true"
          : "false"
      }
      data-menu-translation-status={menu.translationStatus?.status ?? ""}
      data-menu-ready-locales={menu.settings.supportedLocales.join(",")}
      data-menu-blocked-locales={
        menu.translationLocales
          ?.filter(
            (item) => item.status !== "source" && item.status !== "up_to_date"
          )
          .map((item) => `${item.locale}:${item.status}`)
          .join(",") ?? ""
      }
      data-menu-blocked-locale-reasons={
        menu.translationLocales
          ?.filter(
            (item) => item.status !== "source" && item.status !== "up_to_date"
          )
          .map((item) =>
            [
              item.locale,
              item.status,
              item.entityType,
              item.entityLabel ?? item.entityId,
              item.field,
              item.reason
            ]
              .filter(Boolean)
              .join(":")
          )
          .join("|") ?? ""
      }
      data-copy-missing-keys={copyResolution.missingKeys.length}
      data-copy-ignored-keys={copyResolution.ignoredKeys.length}
      onPointerDown={(event) => {
        if (
          event.pointerType !== "mouse" &&
          !activeSubSheet &&
          !showModelViewer &&
          !isDishSwipeGuardedTarget(event.target, event.currentTarget)
        ) {
          swipeStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
            scrollTop: getDishSwipeScrollTop(event.currentTarget)
          };
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
    >
      <nav className={styles.detailNav} aria-label={copy.backToMenu}>
        <Link
          className={styles.detailBack}
          href={menuHref}
          prefetch={false}
          aria-label={copy.backToMenu}
        >
          ←
        </Link>
        <span>{menu.name}</span>
      </nav>

      {sectionDishes.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.dishArrow} ${styles.dishArrowLeft}`}
            aria-label={copy.previousDish}
            onClick={() => selectAdjacentDish(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.dishArrow} ${styles.dishArrowRight}`}
            aria-label={copy.nextDish}
            onClick={() => selectAdjacentDish(1)}
          >
            ›
          </button>
        </>
      ) : null}

      <article className={styles.standaloneDetailCard}>
        <TrouvableDishDetailSurface
          copy={copy}
          detailsExpanded={activeSubSheet === "details"}
          detailsId={moreDetailsId}
          dish={activeDish}
          eyebrow={context || menu.name}
          hasModel={hasModel}
          headingLevel="h1"
          locale={selectedLocale}
          menuName={menu.name}
          modelControlsId="trouvable-public-model"
          modelExpanded={showModelViewer}
          onOpenDetails={() => setActiveSubSheet("details")}
          onToggleModel={toggleModelViewer}
          price={activePrice}
          secondaryEyebrow={activeDish.category}
          showImmersiveUnavailable
          textDirection={textDirection}
          titleId="trouvable-dish-title"
        >

          {showModelViewer ? (
            <TrouvableImmersivePanelBody
              experience={immersiveExperience}
              copy={copy}
              dish={activeDish}
              menu={menu}
              modelControlsId="trouvable-public-model"
              onReturnToDish={() => {
                setShowModelViewer(false);
                resetArHandoffState();
              }}
            />
          ) : null}

        </TrouvableDishDetailSurface>
      </article>

      {activeSubSheet === "details" ? (
        <PremiumDishDetailsSheet
          dish={activeDish}
          copy={copy}
          locale={selectedLocale}
          sheetId={moreDetailsId}
          titleId="trouvable-route-details-title"
          onClose={() => setActiveSubSheet(null)}
          userTheme={selectedTheme}
        />
      ) : null}

      <GoogleReviewCard
        dishSlug={activeDish.slug}
        googleReview={menu.googleReview}
        locale={selectedLocale}
        localizedUiCopy={menu.localizedUiCopy}
        menuId={menu.menuId}
        restaurantId={menu.restaurantId}
        restaurantName={menu.name}
        source={menu.source}
      />
    </main>
  );
}
