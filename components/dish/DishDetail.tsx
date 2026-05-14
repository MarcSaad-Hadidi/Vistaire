"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dish } from "@/lib/demoMenuData";
import { getRestaurant } from "@/lib/demoMenuData";
import { trackMenuEvent } from "@/lib/analytics/client";
import { dishHasImmersiveAsset } from "@/lib/menuQuery";
import {
  prefetchUsdzForQuickLook,
  type QuickLookPrefetchState
} from "@/lib/dishAssetWarmup";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";
import { formatPrice } from "@/lib/formatPrice";
import { AllergenBadge } from "@/components/dish/AllergenBadge";
import type { DishModelViewerProps } from "@/components/dish/DishModelViewer";
import { DishDetailHero } from "@/components/dish/DishDetailHero";

type DishDetailProps = {
  dish: Dish;
};

let modelViewerWarmupPromise: Promise<unknown> | null = null;

function canWarmModelViewer(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;

  if (connection?.saveData) return false;
  if (/^(slow-2g|2g)$/i.test(connection?.effectiveType ?? "")) return false;
  return true;
}

function warmModelViewerOnIntent() {
  if (!canWarmModelViewer()) return;
  modelViewerWarmupPromise ??= import("@/components/dish/DishModelViewer").then(
    (mod) => {
      mod.configureModelViewerAssetDecoders();
      return import("@google/model-viewer");
    }
  ).catch(() => {
    modelViewerWarmupPromise = null;
  });
  void modelViewerWarmupPromise;
}

function DelayedModelViewerImportFallback() {
  return (
    <div
      className="relative isolate flex h-[min(58vh,420px)] min-h-[280px] w-full flex-col justify-end overflow-hidden rounded-2xl border border-white/[0.14] bg-[#10100e] px-5 py-6 text-left shadow-[inset_0_1px_0_rgba(217,184,121,0.08)] sm:h-[min(65vh,460px)] sm:min-h-[340px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#211810] via-[#100c08] to-[#070605]" />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_18%,rgba(217,184,121,0.16),transparent_48%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="font-display text-lg leading-tight text-cream sm:text-xl">
          Préparation de la vue immersive...
        </p>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#d6c7af] sm:text-sm">
          Le modèle se charge selon la qualité du réseau.
        </p>
        <div className="mt-5 h-px w-full overflow-hidden rounded-full bg-white/12">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-transparent via-champagne to-transparent" />
        </div>
      </div>
    </div>
  );
}

const LazyDishModelViewer = dynamic<DishModelViewerProps>(
  () => import("@/components/dish/DishModelViewer").then((mod) => mod.DishModelViewer),
  {
    ssr: false,
    loading: () => <DelayedModelViewerImportFallback />
  }
);

/**
 * Défile jusqu’à la section 3D : dans le mockup téléphone le scrollable est un
 * conteneur interne (`data-phone-mockup-scroll`), pas le viewport.
 */
function scrollToPlat3dAnchor(target: HTMLElement) {
  const scroller = target.closest("[data-phone-mockup-scroll]");
  const margin = 12;
  if (scroller instanceof HTMLElement) {
    const top =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      margin;
    scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return;
  }
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function refreshVisibleModelViewerLayout() {
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

const VIEW_3D_BUTTON_CLASS =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-champagne/50 bg-champagne px-5 text-center text-sm font-semibold text-[#17100a] shadow-[0_12px_34px_rgba(217,184,121,0.18)] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto sm:min-w-[190px]";

function getQuickLookPreparationLabel(
  state: QuickLookPrefetchState
): string {
  if (state === "preparing") return "Préparation de la vue AR...";
  if (state === "ready") return "Vue AR prête";
  return "";
}

export function DishDetail({ dish }: DishDetailProps) {
  const restaurant = getRestaurant();
  const unavailable = !dish.isAvailable;
  const has3d = dishHasImmersiveAsset(dish);
  const { isRealMobile, isPhoneSimulation } = useDemoSimulation();
  const immersive = isRealMobile || isPhoneSimulation;
  const [showPlat3d, setShowPlat3d] = useState(false);
  const [hasMountedPlat3d, setHasMountedPlat3d] = useState(false);
  const [quickLookPrefetchState, setQuickLookPrefetchState] =
    useState<QuickLookPrefetchState>("idle");
  const plat3dAnchorRef = useRef<HTMLDivElement | null>(null);
  const viewStartRef = useRef(0);
  const shouldPrefetchQuickLook = dish.slug === "homard-bisque";
  const quickLookPreparationLabel = shouldPrefetchQuickLook
    ? getQuickLookPreparationLabel(quickLookPrefetchState)
    : "";

  useEffect(() => {
    viewStartRef.current = Date.now();
    trackMenuEvent({
      eventName: "dish_opened",
      dishSlug: dish.slug,
      categorySlug: dish.categorySlug
    });

    return () => {
      trackMenuEvent({
        eventName: "session_duration",
        dishSlug: dish.slug,
        metadata: {
          durationMs: Date.now() - viewStartRef.current
        }
      });
    };
  }, [dish.categorySlug, dish.slug]);

  useEffect(() => {
    if (!shouldPrefetchQuickLook) return undefined;

    return prefetchUsdzForQuickLook(dish, setQuickLookPrefetchState);
  }, [dish, shouldPrefetchQuickLook]);

  const showAndScrollToPlat3d = useCallback(() => {
    setHasMountedPlat3d(true);
    setShowPlat3d(true);
    refreshVisibleModelViewerLayout();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = plat3dAnchorRef.current;
        if (el) scrollToPlat3dAnchor(el);
        refreshVisibleModelViewerLayout();
      });
    });
  }, []);

  const handleModelModuleWarmup = useCallback(() => {
    warmModelViewerOnIntent();
  }, []);

  const handleReturnToDish = useCallback(() => {
    setShowPlat3d(false);
    requestAnimationFrame(() => {
      const el = document.getElementById("dish-main-info");
      if (el) scrollToPlat3dAnchor(el);
    });
  }, []);

  const handleVoir3dClick = useCallback(() => {
    warmModelViewerOnIntent();
    showAndScrollToPlat3d();
    window.setTimeout(() => {
      trackMenuEvent({
        eventName: "dish_3d_clicked",
        dishSlug: dish.slug,
        categorySlug: dish.categorySlug
      });
    }, 0);
  }, [dish, showAndScrollToPlat3d]);

  return (
    <article className={immersive ? "pb-24 pt-2.5" : "pb-24 pt-4 sm:pt-5"}>
      <div
        className={
          immersive
            ? "mx-auto max-w-3xl px-4 sm:px-5"
            : "mx-auto max-w-3xl px-4 sm:px-6"
        }
      >
        <Link
          href="/demo"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-champagne/95 transition hover:text-champagne focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal"
        >
          <span aria-hidden>←</span>
          Retour au menu client
        </Link>
      </div>

      <DishDetailHero
        dish={dish}
        unavailable={unavailable}
        logoMonogram={restaurant.logoMonogram}
        immersive={immersive}
      />

      <div
        id="dish-main-info"
        className={`mx-auto max-w-3xl px-4 sm:px-6 ${
          immersive ? "mt-6 sm:mt-7" : "mt-7 sm:mt-8"
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {dish.isSignature ? (
            <span className="rounded-full border border-champagne/50 bg-champagne/12 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-champagne">
              Signature
            </span>
          ) : null}
          {dish.isRecommended ? (
            <span className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-cream">
              Recommandé
            </span>
          ) : null}
          {has3d ? (
            <span
              className="rounded-full border border-champagne/40 bg-black/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-champagne/95"
              aria-label="Plat avec vue 3D"
            >
              Vue 3D
            </span>
          ) : null}
        </div>

        <h1 className="mt-5 font-display text-[clamp(1.75rem,5.5vw,2.65rem)] font-normal leading-[1.08] text-cream">
          {dish.name}
        </h1>

        <p className="mt-3 font-display text-2xl tabular-nums text-champagne sm:text-3xl">
          {formatPrice(dish.price, restaurant.currency)}
        </p>

        <p className="mt-3 text-sm text-[#a89882]">
          Préparation estimée · {dish.preparationTime}
        </p>

        <p className="mt-6 text-base leading-relaxed text-[#d8caba] sm:text-lg">
          {dish.description}
        </p>

        <section className="mt-8" aria-labelledby="ingredients-heading">
          <h2
            id="ingredients-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/90"
          >
            Ingrédients
          </h2>
          <ul className="mt-3 grid gap-2 text-[#d1c2aa] sm:grid-cols-2">
            {dish.ingredients.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-champagne/60" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {dish.allergens.length > 0 ? (
          <section className="mt-8" aria-labelledby="allergens-heading">
            <h2
              id="allergens-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/90"
            >
              Allergènes
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {dish.allergens.map((allergen) => (
                <AllergenBadge key={allergen} allergen={allergen} />
              ))}
            </div>
          </section>
        ) : null}

        {dish.options.length > 0 ? (
          <section className="mt-8" aria-labelledby="options-heading">
            <h2
              id="options-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/90"
            >
              Options
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#d1c2aa]">
              {dish.options.map((option) => (
                <li key={option}>· {option}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {dish.sides.length > 0 ? (
          <section className="mt-8" aria-labelledby="sides-heading">
            <h2
              id="sides-heading"
              className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/90"
            >
              Accompagnements
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#d1c2aa]">
              {dish.sides.map((side) => (
                <li key={side}>· {side}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section
          id="recommandation-chef"
          className="mt-8 scroll-mt-28 rounded-2xl border border-champagne/20 bg-black/30 p-5 sm:p-6"
          aria-labelledby="chef-heading"
        >
          <h2
            id="chef-heading"
            className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/90"
          >
            Mot du chef
          </h2>
          <p className="mt-3 text-base italic leading-relaxed text-[#e8dcc8]">
            « {dish.chefRecommendation} »
          </p>
        </section>

        {has3d ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div>
              <button
                type="button"
                className={VIEW_3D_BUTTON_CLASS}
                onPointerEnter={handleModelModuleWarmup}
                onFocus={handleModelModuleWarmup}
                onClick={handleVoir3dClick}
              >
                Voir en 3D
              </button>
              {quickLookPreparationLabel ? (
                <p
                  className="mt-2 text-center text-xs font-medium text-champagne/80 sm:text-left"
                  aria-live="polite"
                >
                  {quickLookPreparationLabel}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {hasMountedPlat3d ? (
        <section
          id="plat-3d"
          ref={plat3dAnchorRef}
          aria-label="Présentation du plat"
          hidden={!showPlat3d}
          className={`mx-auto max-w-3xl scroll-mt-28 px-4 motion-safe:transition-opacity motion-safe:duration-300 sm:px-6 ${
            immersive ? "mt-10" : "mt-12"
          }`}
        >
          <LazyDishModelViewer
            dish={dish}
            minimalChrome
            onReturnToDish={handleReturnToDish}
          />
        </section>
      ) : null}
    </article>
  );
}
