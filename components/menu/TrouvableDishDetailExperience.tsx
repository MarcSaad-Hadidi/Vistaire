"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent
} from "react";
import type {
  PublicMenu,
  PublicMenuContextQuery,
  PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuUiConfig } from "@/lib/menu/menuUiConfig";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import {
  buildPublicDishPath,
  getGoogleReviewCta
} from "@/lib/menu/publicMenuCore";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import type {
  ArFallbackReason,
  DishModelViewerProps
} from "@/components/dish/DishModelViewer";
import {
  getPublicMenuAnalyticsContext,
  trackPublicMenuEvent
} from "@/lib/analytics/client";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  copyTextToClipboard,
  detectArHandoffPlatform,
  type ArHandoffPlatform
} from "@/lib/menu/arBrowserHandoff";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  TROUVABLE_LOCALE_STORAGE_KEY,
  TROUVABLE_THEME_STORAGE_KEY,
  formatTrouvableDishPrice,
  getTrouvableTextDirection,
  normalizeTrouvableCurrency,
  normalizeTrouvableReadyLocaleForSettings,
  normalizeTrouvableTheme,
  resolveTrouvableCopy,
  type TrouvableCurrency,
  type TrouvableLocale,
  type TrouvableTheme
} from "./trouvableMenuControls";
import { trackGoogleReviewClick } from "./googleReviewTracking";
import {
  getDishSwipeScrollTop,
  resolveDishSwipeGesture
} from "@/lib/menu/dishReviewSwipe";
import { PremiumDishDetailsSheet } from "./PremiumDishDetailsSheet";
import { getTrouvablePaletteSource } from "@/lib/menu/trouvableMenuExperience";
import { TrouvableDishDetailSurface } from "./TrouvableDishDetailSurface";
import { useTrouvableDocumentLanguage } from "./useTrouvableDocumentLanguage";
import styles from "./TrouvablePremiumMenuExperience.module.css";

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean);

type TrouvableDishDetailExperienceProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  context?: string;
  exchangeRates: MenuExchangeRates;
  query?: PublicMenuContextQuery;
  config?: MenuUiConfig;
  typographyClassName?: string;
};

type DishModelViewerComponent = ComponentType<DishModelViewerProps>;
type ArCopyStatus = "idle" | "copying" | "success" | "error";
type SwipeStart = {
  x: number;
  y: number;
  pointerId: number;
  scrollTop: number;
} | null;
type DishDetailSubSheet = "details" | "review" | null;
const AR_COPY_STATUS_RESET_MS = 4_000;

function hasPublic3d(dish: PublicMenuDish): boolean {
  return (
    isSafe3dAssetUrl(
      dish.webModel3dUrl || dish.model3dUrl,
      ALLOWED_3D_CDN_ORIGINS,
      "web"
    ) ||
    isSafe3dAssetUrl(dish.arModel3dUrl, ALLOWED_3D_CDN_ORIGINS, "arLite")
  );
}

function modelViewerDishFromPublicDish(
  dish: PublicMenuDish
): DishModelViewerProps["dish"] {
  return {
    slug: dish.slug,
    categorySlug: dish.category,
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

function BrowserHandoffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 8h17M7 6h.01M10 6h.01M13 6h.01" />
      <path d="m8 14 2.2 2.2L16 10.4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="11" height="12" rx="1.8" />
      <path d="M16 8V5.8A1.8 1.8 0 0 0 14.2 4H5.8A1.8 1.8 0 0 0 4 5.8v10.4A1.8 1.8 0 0 0 5.8 18H8" />
    </svg>
  );
}

function isDishSwipeGuardedTarget(
  target: EventTarget | null,
  swipeRoot?: Element
): boolean {
  if (!(target instanceof Element)) return true;
  if (
    target.closest(
      [
        "model-viewer",
        "canvas",
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[data-no-dish-swipe]"
      ].join(",")
    )
  ) {
    return true;
  }

  const dialogTarget = target.closest(["dialog", "[role='dialog']"].join(","));
  if (!dialogTarget) return false;
  return !(swipeRoot && (dialogTarget === swipeRoot || dialogTarget.contains(swipeRoot)));
}

export function TrouvableDishDetailExperience({
  menu,
  dish,
  context = "",
  exchangeRates,
  query,
  config,
  typographyClassName = ""
}: TrouvableDishDetailExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeDish, setActiveDish] = useState(dish);
  const [swipeStart, setSwipeStart] = useState<SwipeStart>(null);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const [activeSubSheet, setActiveSubSheet] = useState<DishDetailSubSheet>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<TrouvableLocale>(() =>
    normalizeTrouvableReadyLocaleForSettings(
      query?.lang,
      menu.settings,
      menu.localizedUiCopy
    )
  );
  const [selectedCurrency, setSelectedCurrency] =
    useState<TrouvableCurrency>(() =>
      normalizeTrouvableCurrency(undefined, menu.settings)
    );
  const [selectedTheme, setSelectedTheme] = useState<TrouvableTheme>(() =>
    normalizeTrouvableTheme(undefined, menu.settings)
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [ModelViewerComponent, setModelViewerComponent] =
    useState<DishModelViewerComponent | null>(null);
  const [modelViewerLoadFailed, setModelViewerLoadFailed] = useState(false);
  const [showArBrowserHelp, setShowArBrowserHelp] = useState(false);
  const [arHandoffPlatform] = useState<ArHandoffPlatform>(() => {
    if (typeof navigator === "undefined") return "other";
    const navigatorWithData = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    return detectArHandoffPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      userAgentDataPlatform: navigatorWithData.userAgentData?.platform
    });
  });
  const [arCopyStatus, setArCopyStatus] = useState<ArCopyStatus>("idle");
  const [manualDishUrl, setManualDishUrl] = useState("");
  const manualDishUrlRef = useRef<HTMLInputElement | null>(null);
  const arCopyResetTimeoutRef = useRef<number | null>(null);
  const { copy, resolution: copyResolution } = resolveTrouvableCopy(
    selectedLocale,
    menu.localizedUiCopy
  );
  const textDirection = getTrouvableTextDirection(selectedLocale);
  useTrouvableDocumentLanguage(selectedLocale, textDirection);
  const localizedQuery = useMemo<PublicMenuContextQuery>(
    () => ({
      ...(query ?? {}),
      lang: selectedLocale
    }),
    [query, selectedLocale]
  );

  useEffect(
    () => () => {
      if (arCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(arCopyResetTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (arCopyStatus !== "error" || !manualDishUrl) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const input = manualDishUrlRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [arCopyStatus, manualDishUrl]);

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
  const hasModel = hasPublic3d(activeDish);
  const activePrice = formatTrouvableDishPrice(
    activeDish,
    selectedCurrency,
    selectedLocale,
    exchangeRates
  );
  const moreDetailsId = `trouvable-dish-more-details-${activeDish.slug}`;
  const browserDishHref = buildPublicDishPath(
    menu.slug,
    activeDish.slug,
    localizedQuery
  );
  const platformCopy = copy.arBrowserFallback[arHandoffPlatform];
  const arBrowserFallbackTitleId = `trouvable-ar-browser-fallback-${activeDish.slug}`;
  const manualDishUrlId = `trouvable-ar-manual-url-${activeDish.slug}`;

  const resetArHandoffState = useCallback(() => {
    if (arCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(arCopyResetTimeoutRef.current);
      arCopyResetTimeoutRef.current = null;
    }
    setShowArBrowserHelp(false);
    setArCopyStatus("idle");
    setManualDishUrl("");
  }, []);

  function selectManualDishUrl() {
    const input = manualDishUrlRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  }

  async function copyDishUrl() {
    if (arCopyStatus === "copying") return;
    if (arCopyResetTimeoutRef.current !== null) {
      window.clearTimeout(arCopyResetTimeoutRef.current);
      arCopyResetTimeoutRef.current = null;
    }

    const absoluteDishUrl = new URL(
      browserDishHref,
      window.location.origin
    ).toString();
    setArCopyStatus("copying");
    const copied = await copyTextToClipboard(absoluteDishUrl);

    if (copied) {
      setManualDishUrl("");
      setArCopyStatus("success");
      arCopyResetTimeoutRef.current = window.setTimeout(() => {
        arCopyResetTimeoutRef.current = null;
        setArCopyStatus("idle");
      }, AR_COPY_STATUS_RESET_MS);
      return;
    }

    setManualDishUrl(absoluteDishUrl);
    setArCopyStatus("error");
  }
  const googleReviewCta = getGoogleReviewCta(menu.googleReview);

  const replaceLocaleInUrl = useCallback(
    (nextLocale: TrouvableLocale) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("lang", nextLocale);
      const queryString = params.toString();
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(nextPath, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setActiveDish(dish);
      setShowModelViewer(false);
      setActiveSubSheet(null);
      resetArHandoffState();
      setReviewRating(0);
      setReviewText("");
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dish, resetArHandoffState]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const queryLocale = query?.lang?.toString().trim()
        ? normalizeTrouvableReadyLocaleForSettings(
            query.lang,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;
      const storedLocale = window.localStorage.getItem(TROUVABLE_LOCALE_STORAGE_KEY);
      const storedCurrency = window.localStorage.getItem(
        TROUVABLE_CURRENCY_STORAGE_KEY
      );
      const storedTheme = window.localStorage.getItem(TROUVABLE_THEME_STORAGE_KEY);
      const defaultLocale = normalizeTrouvableReadyLocaleForSettings(
        undefined,
        menu.settings,
        menu.localizedUiCopy
      );
      const activeServerLocale = normalizeTrouvableReadyLocaleForSettings(
        menu.activeLocale,
        menu.settings,
        menu.localizedUiCopy
      );
      const normalizedStoredLocale = storedLocale
        ? normalizeTrouvableReadyLocaleForSettings(
            storedLocale,
            menu.settings,
            menu.localizedUiCopy
          )
        : null;

      if (
        !queryLocale &&
        normalizedStoredLocale &&
        normalizedStoredLocale !== defaultLocale &&
        normalizedStoredLocale !== activeServerLocale
      ) {
        replaceLocaleInUrl(normalizedStoredLocale);
        return;
      }

      setSelectedLocale(
        queryLocale ??
          normalizedStoredLocale ??
          defaultLocale
      );
      setSelectedCurrency(normalizeTrouvableCurrency(storedCurrency, menu.settings));
      setSelectedTheme(normalizeTrouvableTheme(storedTheme, menu.settings));
      if (queryLocale) {
        window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, queryLocale);
      }
      setPreferencesLoaded(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    menu.activeLocale,
    menu.localizedUiCopy,
    menu.settings,
    query?.lang,
    replaceLocaleInUrl
  ]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, selectedLocale);
    window.localStorage.setItem(TROUVABLE_CURRENCY_STORAGE_KEY, selectedCurrency);
    window.localStorage.setItem(TROUVABLE_THEME_STORAGE_KEY, selectedTheme);
  }, [preferencesLoaded, selectedCurrency, selectedLocale, selectedTheme]);

  useEffect(() => {
    if (!showModelViewer || ModelViewerComponent || modelViewerLoadFailed) return;

    let cancelled = false;
    import("@/components/dish/DishModelViewer")
      .then((mod) => {
        if (!cancelled) {
          setModelViewerComponent(() => mod.DishModelViewer);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModelViewerLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ModelViewerComponent, modelViewerLoadFailed, showModelViewer]);

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
      setReviewRating(0);
      setReviewText("");
      window.history.replaceState(
        null,
        "",
        buildPublicDishPath(menu.slug, nextDish.slug, localizedQuery)
      );
    }
  }

  function openReviewSheet() {
    setReviewRating(0);
    setReviewText("");
    setActiveSubSheet("review");
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!swipeStart || event.pointerType === "mouse") return;
    const start = swipeStart;
    setSwipeStart(null);
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
    if (gesture === "reviewOpen") {
      openReviewSheet();
      return;
    }
    if (gesture === "next" || gesture === "previous") {
      selectAdjacentDish(gesture === "next" ? 1 : -1);
    }
  }

  useEffect(() => {
    if (activeSubSheet !== "review") return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setActiveSubSheet(null);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeSubSheet]);

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
          setSwipeStart({
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
            scrollTop: getDishSwipeScrollTop(event.currentTarget)
          });
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setSwipeStart(null)}
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
          hasModel={hasModel}
          headingLevel="h1"
          locale={selectedLocale}
          menuName={menu.name}
          modelControlsId="trouvable-public-model"
          modelExpanded={showModelViewer}
          onOpenDetails={() => setActiveSubSheet("details")}
          onOpenReview={openReviewSheet}
          onToggleModel={toggleModelViewer}
          price={activePrice}
          showImmersiveUnavailable
          textDirection={textDirection}
          titleId="trouvable-dish-title"
        >

          {showModelViewer ? (
            <>
              <div
                className={styles.inlineModelViewer}
                id="trouvable-public-model"
                data-no-dish-swipe="true"
              >
                  {ModelViewerComponent ? (
                    <ModelViewerComponent
                      dish={modelViewerDishFromPublicDish(activeDish)}
                      analyticsContext={getPublicMenuAnalyticsContext(menu) ?? undefined}
                    minimalChrome
                    quietChrome
                    copy={{
                      loadingTitle: copy.modelPreparing,
                      ...copy.modelViewer,
                      modelAlt: copy.modelAlt
                    }}
                    onReturnToDish={() => {
                      setShowModelViewer(false);
                      resetArHandoffState();
                    }}
                    onArFallbackNeeded={(reason: ArFallbackReason) => {
                      if (reason === "missing-ios-usdz") {
                        resetArHandoffState();
                        return;
                      }
                      setShowArBrowserHelp(true);
                    }}
                    onArFallbackCleared={resetArHandoffState}
                  />
                ) : modelViewerLoadFailed ? (
                  <div className={styles.modelLoading} role="status">
                    {copy.modelUnavailable}
                  </div>
                ) : (
                  <div className={styles.modelLoading} role="status">
                    {copy.modelPreparing}
                  </div>
                )}
              </div>
              {showArBrowserHelp ? (
                <aside
                  className={styles.arBrowserFallback}
                  aria-labelledby={arBrowserFallbackTitleId}
                  dir="auto"
                >
                  <span className={styles.arBrowserFallbackIcon} aria-hidden="true">
                    <BrowserHandoffIcon />
                  </span>
                  <div className={styles.arBrowserFallbackContent}>
                    <h3 id={arBrowserFallbackTitleId}>{platformCopy.title}</h3>
                    <p>{platformCopy.body}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.arCopyButton}
                    onClick={() => void copyDishUrl()}
                    disabled={arCopyStatus === "copying"}
                  >
                    <CopyIcon />
                    {platformCopy.action}
                  </button>
                  {arCopyStatus === "success" ? (
                    <p className={styles.arCopyStatus} role="status" aria-live="polite">
                      {platformCopy.success}
                    </p>
                  ) : null}
                  {arCopyStatus === "error" ? (
                    <div className={styles.arManualCopy}>
                      <p
                        className={styles.arCopyStatus}
                        role="alert"
                        aria-live="assertive"
                      >
                        {copy.arBrowserFallback.copyError}
                      </p>
                      <label htmlFor={manualDishUrlId}>
                        {copy.arBrowserFallback.manualCopyLabel}
                      </label>
                      <input
                        ref={manualDishUrlRef}
                        id={manualDishUrlId}
                        type="url"
                        readOnly
                        value={manualDishUrl}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className={styles.arSelectLinkButton}
                        onClick={selectManualDishUrl}
                      >
                        {copy.arBrowserFallback.selectLink}
                      </button>
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </>
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

      {activeSubSheet === "review" ? (
        <div
          className={`${styles.overlay} ${styles.reviewOverlay} ${styles.stackedOverlay}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trouvable-route-review-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActiveSubSheet(null);
          }}
          data-no-dish-swipe="true"
        >
          <section className={styles.reviewSheet} tabIndex={-1}>
            <div className={styles.reviewDishGhost} aria-hidden="true">
              {activeDish.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={activeDish.imageUrl} />
              ) : (
                <span>{activeDish.name.slice(0, 1)}</span>
              )}
            </div>
            <div className={styles.reviewPanel}>
              <h2 id="trouvable-route-review-title">{copy.reviewTitle}</h2>
              <div className={styles.reviewStars} aria-label={copy.reviewStars}>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    aria-label={`${rating} ${copy.reviewStars}`}
                    aria-pressed={reviewRating >= rating}
                    onClick={() => setReviewRating(rating)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <label className={styles.reviewTextarea}>
                <span>{copy.reviewComment}</span>
                <textarea
                  maxLength={300}
                  placeholder={copy.reviewPlaceholder}
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                />
              </label>
              {googleReviewCta ? (
                <a
                  className={styles.reviewPostButton}
                  data-google-review-action="true"
                  href={googleReviewCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackGoogleReviewClick({
                      dishSlug: activeDish.slug,
                      menuId: menu.menuId,
                      restaurantId: menu.restaurantId,
                      source: menu.source
                    })
                  }
                >
                  {copy.reviewPost}
                </a>
            ) : (
              <button className={styles.reviewPostButton} type="button" disabled>
                {copy.reviewPost}
              </button>
            )}
            {!googleReviewCta ? (
              <p className={styles.reviewNote}>{copy.reviewMissing}</p>
            ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
