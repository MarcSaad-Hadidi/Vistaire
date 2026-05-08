"use client";

import Link from "next/link";
import type { Dish } from "@/lib/demoMenuData";
import { getRestaurant } from "@/lib/demoMenuData";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";
import { formatPrice } from "@/lib/formatPrice";
import { AllergenBadge } from "@/components/dish/AllergenBadge";
import { DishModelViewer } from "@/components/dish/DishModelViewer";
import { DishDetailHero } from "@/components/dish/DishDetailHero";

type DishDetailProps = {
  dish: Dish;
};

export function DishDetail({ dish }: DishDetailProps) {
  const restaurant = getRestaurant();
  const unavailable = !dish.isAvailable;
  const { isRealMobile, isPhoneSimulation } = useDemoSimulation();
  const immersive = isRealMobile || isPhoneSimulation;

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
              Recommandé par le chef
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
            Ingrédients principaux
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
              Accompagnements proposés
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

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href="#plat-3d"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/18 bg-white/6 px-5 text-center text-sm font-semibold text-cream transition hover:border-champagne/35 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto sm:min-w-[180px]"
          >
            Voir en 3D
          </a>
          <a
            href="#recommandation-chef"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-champagne/26 bg-champagne/8 px-5 text-center text-sm font-semibold text-champagne transition hover:border-champagne/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:w-auto sm:min-w-[220px]"
          >
            Découvrir la recommandation du chef
          </a>
        </div>
      </div>

      <div
        id="plat-3d"
        className="mx-auto mt-12 max-w-3xl scroll-mt-28 px-4 sm:px-6"
      >
        <h2 className="mb-3 text-center font-display text-xl text-cream sm:text-2xl">
          Aperçu 3D / réalité augmentée
        </h2>
        <DishModelViewer dish={dish} />
      </div>
    </article>
  );
}
