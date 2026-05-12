"use client";

import Image from "next/image";
import Link from "next/link";
import type { CurrencyCode, Dish } from "@/lib/demoMenuData";
import { getDishCardImageObjectPosition } from "@/lib/demoMenuData";
import { trackMenuEvent } from "@/lib/analytics/client";
import { dishHas3dModel } from "@/lib/menuQuery";
import { formatPrice } from "@/lib/formatPrice";
import { AllergenBadge } from "@/components/dish/AllergenBadge";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type DishCardProps = {
  dish: Dish;
  currency: CurrencyCode;
  priorityImage?: boolean;
};

function DishCardHeroImage({
  dish,
  variant,
  unavailable,
  priorityImage
}: {
  dish: Dish;
  variant: "phone" | "desktop";
  unavailable: boolean;
  priorityImage: boolean;
}) {
  const objectPosition = getDishCardImageObjectPosition(dish);
  const base =
    variant === "phone"
      ? "relative aspect-[4/3] min-h-[152px] w-full shrink-0 overflow-hidden bg-[#12100e]"
      : "relative aspect-[4/3] min-h-[180px] w-full shrink-0 overflow-hidden bg-[#14100c] sm:min-h-[200px]";

  return (
    <div className={base}>
      {dish.image ? (
        <>
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src={dish.image}
              alt={`Photo du plat : ${dish.name}`}
              fill
              priority={priorityImage}
              loading={priorityImage ? "eager" : undefined}
              sizes={
                variant === "phone"
                  ? "(max-width: 480px) 92vw, 380px"
                  : "(max-width: 768px) 100vw, (max-width: 1280px) 45vw, 420px"
              }
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              style={{ objectPosition }}
              quality={90}
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10"
            aria-hidden
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a1f18] via-[#16100c] to-[#080706]">
          <div
            className={`pointer-events-none absolute bottom-0 rounded-full bg-champagne/9 blur-xl ${
              variant === "phone"
                ? "-left-4 h-24 w-24"
                : "-left-6 h-32 w-32 bg-champagne/10"
            }`}
          />
          {variant === "desktop" ? (
            <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-white/[0.04] blur-2xl" />
          ) : null}
          <span
            className={`absolute font-display tracking-wide text-white/12 ${
              variant === "phone"
                ? "bottom-2.5 right-2.5 text-sm"
                : "bottom-3 right-3 text-lg"
            }`}
          >
            MÉ
          </span>
        </div>
      )}
      {unavailable ? (
        variant === "phone" ? (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/35 to-transparent px-2.5 pb-2 pt-6">
            <p className="text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-[#e8dcc8]">
              Indisponible
            </p>
          </div>
        ) : (
          <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8dcc8]">
            Indisponible
          </p>
        )
      ) : null}
    </div>
  );
}

export function DishCard({ dish, currency, priorityImage = false }: DishCardProps) {
  const { isPhoneSimulation } = useDemoSimulation();
  const unavailable = !dish.isAvailable;
  const has3d = dishHas3dModel(dish);

  if (isPhoneSimulation) {
    return (
      <article
        className={`group isolate overflow-hidden rounded-xl bg-gradient-to-b from-[#15110e]/98 to-[#080706] shadow-[0_0_0_1px_rgba(255,255,255,0.055),0_8px_32px_rgba(0,0,0,0.38)] ${
          unavailable ? "opacity-[0.82]" : ""
        }`}
      >
        <DishCardHeroImage
          dish={dish}
          variant="phone"
          unavailable={unavailable}
          priorityImage={priorityImage}
        />

        <div className="flex flex-col gap-2 p-3 pt-2.5">
          <div className="flex flex-wrap gap-1">
            {dish.isSignature ? (
              <span className="rounded border border-champagne/35 bg-champagne/[0.08] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-champagne">
                Signature
              </span>
            ) : null}
            {dish.isRecommended ? (
              <span className="rounded border border-white/14 bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-cream/95">
                Recommandé
              </span>
            ) : null}
            {has3d ? (
              <span
                className="rounded border border-champagne/30 bg-black/45 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-champagne/95"
                aria-label="Plat avec vue 3D"
              >
                3D
              </span>
            ) : null}
          </div>

          <h2 className="font-display text-[15px] font-normal leading-[1.3] text-cream [overflow-wrap:anywhere] [hyphens:auto]">
            <span className="line-clamp-3">{dish.name}</span>
          </h2>

          <p className="font-display text-[1.06rem] tabular-nums leading-none text-champagne">
            {formatPrice(dish.price, currency)}
          </p>

          <p className="line-clamp-2 text-[12px] leading-[1.42] text-[#b0a08c]">
            {dish.shortDescription}
          </p>

          {dish.allergens.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {dish.allergens.map((allergen) => (
                <AllergenBadge key={allergen} allergen={allergen} compact />
              ))}
            </div>
          ) : null}

          <div className="pt-0.5">
            {unavailable ? (
              <span
                className="inline-flex min-h-9 w-full cursor-not-allowed items-center justify-center rounded-lg bg-white/[0.03] text-[11px] font-semibold text-white/32 ring-1 ring-inset ring-white/12"
                aria-label={`${dish.name} indisponible`}
              >
                Indisponible
              </span>
            ) : (
              <Link
                href={`/demo/dishes/${dish.slug}`}
                prefetch={false}
                onClick={() =>
                  trackMenuEvent({
                    eventName: "cta_clicked",
                    dishSlug: dish.slug,
                    ctaName: "dish_card_open"
                  })
                }
                className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-champagne/[0.12] text-[11px] font-semibold text-cream ring-1 ring-inset ring-champagne/35 transition active:bg-champagne/[0.18] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#080706]"
                aria-label={`Voir le plat — ${dish.name}`}
              >
                Voir le plat
              </Link>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-[#16100d]/95 to-[#0a0806] shadow-[0_8px_40px_rgba(0,0,0,0.28)] transition hover:border-champagne/22 ${
        unavailable ? "opacity-[0.78]" : ""
      }`}
    >
      <DishCardHeroImage
        dish={dish}
        variant="desktop"
        unavailable={unavailable}
        priorityImage={priorityImage}
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          {dish.isSignature ? (
            <span className="rounded-md border border-champagne/40 bg-champagne/[0.09] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-champagne">
              Signature
            </span>
          ) : null}
          {dish.isRecommended ? (
            <span className="rounded-md border border-white/16 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cream/95">
              Recommandé
            </span>
          ) : null}
          {has3d ? (
            <span
              className="rounded-md border border-champagne/35 bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-champagne/95"
              aria-label="Plat avec vue 3D"
            >
              3D
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 font-display text-[1.05rem] font-normal leading-snug text-cream sm:text-[1.12rem]">
            {dish.name}
          </h2>
          <p className="shrink-0 font-display text-lg tabular-nums leading-none text-champagne sm:text-xl">
            {formatPrice(dish.price, currency)}
          </p>
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-[13px] leading-snug text-[#b8a892]">
          {dish.shortDescription}
        </p>

        {dish.allergens.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {dish.allergens.map((allergen) => (
              <AllergenBadge key={allergen} allergen={allergen} />
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          {unavailable ? (
            <span
              className="inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/8 bg-white/[0.04] text-center text-xs font-semibold text-white/35"
              aria-label={`${dish.name} indisponible`}
            >
              Indisponible
            </span>
          ) : (
            <Link
              href={`/demo/dishes/${dish.slug}`}
              prefetch={false}
              onClick={() =>
                trackMenuEvent({
                  eventName: "cta_clicked",
                  dishSlug: dish.slug,
                  ctaName: "dish_card_open"
                })
              }
              className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-champagne/40 bg-champagne/[0.1] text-center text-xs font-semibold text-cream transition hover:border-champagne/55 hover:bg-champagne/[0.16] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0806]"
              aria-label={`Voir le plat — ${dish.name}`}
            >
              Voir le plat
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
