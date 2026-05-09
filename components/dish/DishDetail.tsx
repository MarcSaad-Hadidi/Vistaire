"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Dish } from "@/lib/demoMenuData";
import { getRestaurant } from "@/lib/demoMenuData";
import { dishHas3dModel } from "@/lib/menuQuery";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";
import { formatPrice } from "@/lib/formatPrice";
import { AllergenBadge } from "@/components/dish/AllergenBadge";
import {
  DishModelViewer,
  type DishModelViewerHandle
} from "@/components/dish/DishModelViewer";
import { DishDetailHero } from "@/components/dish/DishDetailHero";

type DishDetailProps = {
  dish: Dish;
};

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

export function DishDetail({ dish }: DishDetailProps) {
  const restaurant = getRestaurant();
  const unavailable = !dish.isAvailable;
  const has3d = dishHas3dModel(dish);
  const { isRealMobile, isPhoneSimulation } = useDemoSimulation();
  const immersive = isRealMobile || isPhoneSimulation;
  const [showPlat3d, setShowPlat3d] = useState(false);
  const [desktopArHint, setDesktopArHint] = useState(false);
  const [phoneSimulationArHint, setPhoneSimulationArHint] = useState(false);
  const [heroArDeferredHint, setHeroArDeferredHint] = useState(false);
  const plat3dAnchorRef = useRef<HTMLDivElement | null>(null);
  const modelViewerRef = useRef<DishModelViewerHandle | null>(null);
  const canExpectMobileUi = immersive;

  /** Précharge model-viewer pour réduire la fenêtre où le lecteur n’est pas prêt. */
  useEffect(() => {
    if (!has3d) return;
    void import("@google/model-viewer");
  }, [has3d]);

  const showAndScrollToPlat3d = useCallback(() => {
    setShowPlat3d(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = plat3dAnchorRef.current;
        if (el) scrollToPlat3dAnchor(el);
      });
    });
  }, []);

  const handleVoir3dClick = useCallback(() => {
    setDesktopArHint(false);
    setPhoneSimulationArHint(false);
    setHeroArDeferredHint(false);
    showAndScrollToPlat3d();
  }, [showAndScrollToPlat3d]);

  const handleVoirDevantMoiClick = useCallback(() => {
    if (!canExpectMobileUi) {
      flushSync(() => setShowPlat3d(true));
      setDesktopArHint(true);
      setPhoneSimulationArHint(false);
      setHeroArDeferredHint(false);
      requestAnimationFrame(() => {
        const el = plat3dAnchorRef.current;
        if (el) scrollToPlat3dAnchor(el);
      });
      return;
    }

    if (!isRealMobile) {
      flushSync(() => setShowPlat3d(true));
      setDesktopArHint(false);
      setPhoneSimulationArHint(true);
      setHeroArDeferredHint(false);
      requestAnimationFrame(() => {
        const el = plat3dAnchorRef.current;
        if (el) scrollToPlat3dAnchor(el);
      });
      return;
    }

    setDesktopArHint(false);
    setPhoneSimulationArHint(false);

    if (!showPlat3d) {
      flushSync(() => setShowPlat3d(true));
    }

    const status = modelViewerRef.current?.requestAr() ?? "deferred";

    if (status === "launched") {
      setHeroArDeferredHint(false);
      return;
    }

    if (status === "unsupported") {
      setHeroArDeferredHint(false);
      requestAnimationFrame(() => {
        const el = plat3dAnchorRef.current;
        if (el) scrollToPlat3dAnchor(el);
      });
      return;
    }

    setHeroArDeferredHint(true);
    requestAnimationFrame(() => {
      const el = plat3dAnchorRef.current;
      if (el) scrollToPlat3dAnchor(el);
    });
  }, [canExpectMobileUi, isRealMobile, showPlat3d]);

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
          Retour au menu
        </Link>
      </div>

      <DishDetailHero
        dish={dish}
        unavailable={unavailable}
        logoMonogram={restaurant.logoMonogram}
        immersive={immersive}
      />

      <div
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
          <div className="mt-8 space-y-3">
            {desktopArHint ? (
              <p
                className="rounded-2xl border border-champagne/25 bg-champagne/10 px-4 py-3 text-sm leading-relaxed text-[#eadcc6]"
                role="status"
                aria-live="polite"
              >
                La réalité augmentée est prévue sur smartphone. Explorez le plat en 3D
                ci-dessous — ou ouvrez cette page sur votre téléphone pour « Voir devant
                moi ».
              </p>
            ) : null}
            {phoneSimulationArHint ? (
              <p
                className="rounded-2xl border border-champagne/25 bg-champagne/10 px-4 py-3 text-sm leading-relaxed text-[#eadcc6]"
                role="status"
                aria-live="polite"
              >
                Aperçu bureau : lancez l’AR depuis le bouton sous le modèle 3D
                ci-dessous. Sur votre téléphone, « Voir devant moi » démarre
                directement lorsque l’appareil la prend en charge.
              </p>
            ) : null}
            {heroArDeferredHint ? (
              <p
                className="rounded-2xl border border-champagne/25 bg-champagne/10 px-4 py-3 text-sm leading-relaxed text-[#eadcc6]"
                role="status"
                aria-live="polite"
              >
                Le lecteur ou le modèle finalise son chargement. Touchez « Ouvrir en
                réalité augmentée » dans l’encadré ci-dessous pour lancer l’AR — ce
                geste est requis sur certains navigateurs.
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-champagne/50 bg-champagne px-5 text-center text-sm font-semibold text-[#17100a] shadow-[0_12px_34px_rgba(217,184,121,0.18)] transition hover:bg-[#e3c785] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto sm:min-w-[190px]"
                onClick={handleVoirDevantMoiClick}
              >
                Voir devant moi
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/18 bg-white/6 px-5 text-center text-sm font-semibold text-cream transition hover:border-champagne/35 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto sm:min-w-[170px]"
                onClick={handleVoir3dClick}
              >
                Voir en 3D
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showPlat3d ? (
        <section
          id="plat-3d"
          ref={plat3dAnchorRef}
          aria-label="Présentation du plat"
          className={`mx-auto max-w-3xl scroll-mt-28 px-4 motion-safe:transition-opacity motion-safe:duration-300 sm:px-6 ${
            immersive ? "mt-10" : "mt-12"
          }`}
        >
          <DishModelViewer ref={modelViewerRef} dish={dish} minimalChrome />
        </section>
      ) : null}
    </article>
  );
}
