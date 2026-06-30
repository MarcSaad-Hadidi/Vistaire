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
import {
  buildPublicDishPath,
  getGoogleReviewCta
} from "@/lib/menu/publicMenuCore";
import { buildPublicMenuPath } from "@/lib/owner/menuUrlCore";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import { isSafe3dAssetUrl } from "@/lib/dish3dManifest";
import styles from "./TrouvablePremiumMenuExperience.module.css";

const ALLOWED_3D_CDN_ORIGINS = (process.env.NEXT_PUBLIC_VISTAIRE_3D_CDN_ORIGINS ?? "")
  .split(/[,\s]+/)
  .map((entry) => entry.trim().replace(/\/+$/, ""))
  .filter(Boolean);

type TrouvableDishDetailExperienceProps = {
  menu: PublicMenu;
  dish: PublicMenuDish;
  context?: string;
  query?: PublicMenuContextQuery;
};

type DishModelViewerComponent = ComponentType<DishModelViewerProps>;
type SwipeStart = {
  x: number;
  y: number;
} | null;

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

function detailTags(dish: PublicMenuDish): string[] {
  const tags = dish.ingredients.length > 0 ? dish.ingredients : dish.tags;
  return tags.filter(Boolean).slice(0, 8);
}

export function TrouvableDishDetailExperience({
  menu,
  dish,
  context = "",
  query
}: TrouvableDishDetailExperienceProps) {
  const [activeDish, setActiveDish] = useState(dish);
  const [swipeStart, setSwipeStart] = useState<SwipeStart>(null);
  const [showModelViewer, setShowModelViewer] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [ModelViewerComponent, setModelViewerComponent] =
    useState<DishModelViewerComponent | null>(null);
  const [modelViewerLoadFailed, setModelViewerLoadFailed] = useState(false);
  const menuHref = buildPublicMenuPath(menu.slug, query);
  const sectionDishes = useMemo(
    () => menu.dishes.filter((candidate) => candidate.category === activeDish.category),
    [activeDish.category, menu.dishes]
  );
  const activeIndex = sectionDishes.findIndex(
    (candidate) => candidate.id === activeDish.id
  );
  const hasModel = hasPublic3d(activeDish);
  const tags = detailTags(activeDish);
  const googleReviewCta = getGoogleReviewCta(menu.googleReview);
  const reviewRestaurantName = menu.name.trim() || "Trouvable";

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
      setShowReviewSheet(false);
      window.history.replaceState(
        null,
        "",
        buildPublicDishPath(menu.slug, nextDish.slug, query)
      );
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!swipeStart || event.pointerType === "mouse") return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    setSwipeStart(null);
    if (Math.abs(deltaX) < 46 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    selectAdjacentDish(deltaX < 0 ? 1 : -1);
  }

  return (
    <main
      className={`${styles.page} ${styles.standaloneDetailPage}`}
      onPointerDown={(event) => {
        if (event.pointerType !== "mouse") {
          setSwipeStart({ x: event.clientX, y: event.clientY });
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setSwipeStart(null)}
    >
      <nav className={styles.detailNav} aria-label="Navigation fiche plat">
        <Link className={styles.detailBack} href={menuHref} prefetch={false}>
          ←
        </Link>
        <span>TROUVABLE</span>
      </nav>

      {sectionDishes.length > 1 ? (
        <>
          <button
            type="button"
            className={`${styles.dishArrow} ${styles.dishArrowLeft}`}
            aria-label="Plat précédent"
            onClick={() => selectAdjacentDish(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className={`${styles.dishArrow} ${styles.dishArrowRight}`}
            aria-label="Plat suivant"
            onClick={() => selectAdjacentDish(1)}
          >
            ›
          </button>
        </>
      ) : null}

      <article className={styles.standaloneDetailCard}>
        <div className={styles.detailVisual}>
          {activeDish.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`Photo de ${activeDish.name}`} src={activeDish.imageUrl} />
          ) : (
            <span>{menu.name.slice(0, 1)}</span>
          )}
        </div>

        <section className={styles.detailBody} aria-label="Fiche plat">
          <p className={styles.detailRestaurantName}>{context || menu.name}</p>
          <h1 id="trouvable-dish-title">{activeDish.name}</h1>
          {activeDish.priceLabel ? (
            <strong className={styles.detailPrice}>{activeDish.priceLabel}</strong>
          ) : null}
          <button type="button" className={styles.moreDetailsButton}>
            <span aria-hidden="true">i</span>
            More details
          </button>
          {activeDish.description ? <p>{activeDish.description}</p> : null}

          {tags.length > 0 ? (
            <ul className={styles.detailTagCloud} aria-label="Ingrédients">
              {tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}

          {hasModel ? (
            <button
              type="button"
              className={styles.modelCta}
              aria-controls="trouvable-public-model"
              aria-expanded={showModelViewer}
              onClick={() => setShowModelViewer((isVisible) => !isVisible)}
            >
              VOIR EN 3D
            </button>
          ) : (
            <p className={styles.modelUnavailable}>Vue 3D non disponible pour ce plat.</p>
          )}

          {showModelViewer ? (
            <div className={styles.inlineModelViewer} id="trouvable-public-model">
              {ModelViewerComponent ? (
                <ModelViewerComponent
                  dish={modelViewerDishFromPublicDish(activeDish)}
                  minimalChrome
                  quietChrome
                  onReturnToDish={() => setShowModelViewer(false)}
                />
              ) : modelViewerLoadFailed ? (
                <div className={styles.modelLoading} role="status">
                  Vue 3D temporairement indisponible.
                </div>
              ) : (
                <div className={styles.modelLoading} role="status">
                  Préparation de la vue immersive...
                </div>
              )}
            </div>
          ) : null}

          <button
            type="button"
            className={styles.reviewTrigger}
            aria-haspopup="dialog"
            onClick={() => setShowReviewSheet(true)}
          >
            <span aria-hidden="true">★</span>
            TAP TO REVIEW
          </button>
        </section>
      </article>

      {showReviewSheet ? (
        <div
          className={`${styles.overlay} ${styles.reviewOverlay}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trouvable-route-review-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowReviewSheet(false);
          }}
        >
          <section className={styles.reviewSheet} tabIndex={-1}>
            <button
              type="button"
              className={styles.reviewClose}
              aria-label="Fermer l'avis"
              onClick={() => setShowReviewSheet(false)}
            >
              x
            </button>
            <div className={styles.reviewDishGhost} aria-hidden="true">
              {activeDish.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={activeDish.imageUrl} />
              ) : null}
            </div>
            <div className={styles.reviewPanel}>
              <h2 id="trouvable-route-review-title">Votre expérience compte</h2>
              <p className={styles.reviewIntro}>
                Partagez votre expérience chez {reviewRestaurantName}. Votre avis Google
                aide l&apos;équipe à mieux comprendre chaque visite et à se faire découvrir.
              </p>
              {googleReviewCta ? (
                <a
                  className={styles.reviewPostButton}
                  data-google-review-action="true"
                  href={googleReviewCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Laisser un avis Google
                </a>
              ) : (
                <button className={styles.reviewPostButton} type="button" disabled>
                  Laisser un avis Google
                </button>
              )}
              {!googleReviewCta ? (
                <p className={styles.reviewNote}>
                  Lien Google Review non configuré pour ce restaurant.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
