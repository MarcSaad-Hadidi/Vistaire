"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type PointerEvent
} from "react";
import type {
  PublicMenu,
  PublicMenuContextQuery,
  PublicMenuDish
} from "@/lib/menu/publicMenuCore";
import type { MenuExchangeRates } from "@/lib/currency/formatMenuPrice";
import {
  buildPublicDishPath,
  getGoogleReviewCta
} from "@/lib/menu/publicMenuCore";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import {
  TROUVABLE_CURRENCY_STORAGE_KEY,
  TROUVABLE_LOCALE_STORAGE_KEY,
  TROUVABLE_THEME_STORAGE_KEY,
  formatTrouvableDishPrice,
  getTrouvableCopy,
  normalizeTrouvableCurrency,
  normalizeTrouvableLocaleForSettings,
  normalizeTrouvableTheme,
  type TrouvableCurrency,
  type TrouvableLocale,
  type TrouvableTheme
} from "./trouvableMenuControls";
import { trackGoogleReviewClick } from "./googleReviewTracking";
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
  typographyClassName?: string;
};

type DishModelViewerComponent = ComponentType<DishModelViewerProps>;
type SwipeStart = {
  x: number;
  y: number;
  pointerId: number;
} | null;
type DishDetailSubSheet = "details" | "review" | null;

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
  typographyClassName = ""
}: TrouvableDishDetailExperienceProps) {
  const [activeDish, setActiveDish] = useState(dish);
  const [swipeStart, setSwipeStart] = useState<SwipeStart>(null);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const [activeSubSheet, setActiveSubSheet] = useState<DishDetailSubSheet>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<TrouvableLocale>(() =>
    normalizeTrouvableLocaleForSettings(query?.lang, menu.settings)
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
  const copy = getTrouvableCopy(selectedLocale);
  const localizedQuery = useMemo<PublicMenuContextQuery>(
    () => ({
      ...(query ?? {}),
      lang: selectedLocale
    }),
    [query, selectedLocale]
  );
  const menuHref = buildPublicMenuPath(menu.slug, localizedQuery);
  const sectionDishes = useMemo(
    () => menu.dishes.filter((candidate) => candidate.category === activeDish.category),
    [activeDish.category, menu.dishes]
  );
  const activeIndex = sectionDishes.findIndex(
    (candidate) => candidate.id === activeDish.id
  );
  const hasModel = hasPublic3d(activeDish);
  const visibleTags = activeDish.tags.filter(Boolean).slice(0, 8);
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
  const googleReviewCta = getGoogleReviewCta(menu.googleReview);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      setActiveDish(dish);
      setShowModelViewer(false);
      setActiveSubSheet(null);
      setReviewRating(0);
      setReviewText("");
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [dish]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const queryLocale = query?.lang?.toString().trim()
        ? normalizeTrouvableLocaleForSettings(query.lang, menu.settings)
        : null;
      const storedLocale = window.localStorage.getItem(TROUVABLE_LOCALE_STORAGE_KEY);
      const storedCurrency = window.localStorage.getItem(
        TROUVABLE_CURRENCY_STORAGE_KEY
      );
      const storedTheme = window.localStorage.getItem(TROUVABLE_THEME_STORAGE_KEY);

      setSelectedLocale(
        queryLocale ??
          (storedLocale
            ? normalizeTrouvableLocaleForSettings(storedLocale, menu.settings)
            : normalizeTrouvableLocaleForSettings(undefined, menu.settings))
      );
      setSelectedCurrency(normalizeTrouvableCurrency(storedCurrency, menu.settings));
      setSelectedTheme(normalizeTrouvableTheme(storedTheme, menu.settings));
      if (queryLocale) {
        window.localStorage.setItem(TROUVABLE_LOCALE_STORAGE_KEY, queryLocale);
      }
      setPreferencesLoaded(true);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [menu.settings, query?.lang]);

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

  function selectAdjacentDish(direction: 1 | -1) {
    if (sectionDishes.length < 2) return;
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = (safeIndex + direction + sectionDishes.length) % sectionDishes.length;
    const nextDish = sectionDishes[nextIndex];
    if (nextDish) {
      setActiveDish(nextDish);
      setShowModelViewer(false);
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

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!swipeStart || event.pointerType === "mouse") return;
    const start = swipeStart;
    setSwipeStart(null);
    if (
      activeSubSheet ||
      start.pointerId !== event.pointerId ||
      isDishSwipeGuardedTarget(event.target, event.currentTarget)
    ) {
      return;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentDish(deltaX < 0 ? 1 : -1);
  }

  return (
    <main
      className={`${styles.page} ${styles.standaloneDetailPage} ${typographyClassName}`.trim()}
      data-user-theme={selectedTheme}
      onPointerDown={(event) => {
        if (
          event.pointerType !== "mouse" &&
          !activeSubSheet &&
          !isDishSwipeGuardedTarget(event.target, event.currentTarget)
        ) {
          setSwipeStart({
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId
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
        <span>TROUVABLE</span>
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
        <div
          className={`${styles.detailVisual} ${
            activeDish.imageUrl ? styles.hasDishImage : ""
          }`}
        >
          {activeDish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`Photo de ${activeDish.name}`} src={activeDish.imageUrl} />
          ) : (
            <span>{menu.name.slice(0, 1)}</span>
          )}
        </div>

        <section className={styles.detailBody} aria-label={copy.moreDetails}>
          <p className={styles.detailRestaurantName}>{context || menu.name}</p>
          <h1 id="trouvable-dish-title">{activeDish.name}</h1>
          {activePrice ? (
            <strong className={styles.detailPrice}>{activePrice}</strong>
          ) : null}
          <button
            type="button"
            className={styles.moreDetailsButton}
            aria-expanded={activeSubSheet === "details"}
            aria-controls={moreDetailsId}
            onClick={() => setActiveSubSheet("details")}
          >
            <span aria-hidden="true">i</span>
            {copy.moreDetails}
          </button>

          {hasModel ? (
            <button
              type="button"
              className={styles.modelCta}
              aria-controls="trouvable-public-model"
              aria-expanded={showModelViewer}
              onClick={() => setShowModelViewer((isVisible) => !isVisible)}
            >
              {copy.threeD}
            </button>
          ) : (
            <p className={styles.modelUnavailable}>{copy.immersiveUnavailable}</p>
          )}

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
                    minimalChrome
                    quietChrome
                    onReturnToDish={() => setShowModelViewer(false)}
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
              <p className={styles.arBrowserHelp}>
                {copy.arBrowserHelp}{" "}
                <Link href={browserDishHref} target="_blank" rel="noopener noreferrer">
                  {copy.arBrowserLink}
                </Link>
              </p>
            </>
          ) : null}

          <button
            type="button"
            className={styles.reviewTrigger}
            aria-haspopup="dialog"
            onClick={() => {
              setReviewRating(0);
              setReviewText("");
              setActiveSubSheet("review");
            }}
          >
            <span aria-hidden="true">★</span>
            {copy.review}
          </button>
        </section>
      </article>

      {activeSubSheet === "details" ? (
        <div
          className={`${styles.overlay} ${styles.stackedOverlay}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trouvable-route-details-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveSubSheet(null);
          }}
          data-no-dish-swipe="true"
        >
          <section
            id={moreDetailsId}
            className={`${styles.sheet} ${styles.detailsSubSheet}`}
            tabIndex={-1}
          >
            <header className={styles.sheetHeader}>
              <div>
                <p>{activeDish.name}</p>
                <h2 id="trouvable-route-details-title">{copy.moreDetails}</h2>
              </div>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={copy.closeDetail}
                onClick={() => setActiveSubSheet(null)}
              >
                x
              </button>
            </header>
            {activeDish.description ? (
              <p className={styles.moreDetailsText}>{activeDish.description}</p>
            ) : null}
            {visibleTags.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.tags}</h3>
                <ul>
                  {visibleTags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {activeDish.ingredients.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.ingredients}</h3>
                <ul>
                  {activeDish.ingredients.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {activeDish.allergens.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.allergens}</h3>
                <ul>
                  {activeDish.allergens.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {activeDish.options.length > 0 ? (
              <section className={styles.detailList}>
                <h3>{copy.options}</h3>
                <ul>
                  {activeDish.options.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
            {activeDish.houseNote ? (
              <section className={styles.houseNote}>
                <h3>{copy.houseNote}</h3>
                <p>{activeDish.houseNote}</p>
              </section>
            ) : null}
          </section>
        </div>
      ) : null}

      {activeSubSheet === "review" ? (
        <div
          className={`${styles.overlay} ${styles.reviewOverlay} ${styles.stackedOverlay}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trouvable-route-review-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveSubSheet(null);
          }}
          data-no-dish-swipe="true"
        >
          <section className={styles.reviewSheet} tabIndex={-1}>
            <button
              type="button"
              className={styles.reviewClose}
              aria-label={copy.reviewClose}
              onClick={() => setActiveSubSheet(null)}
            >
              x
            </button>
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
