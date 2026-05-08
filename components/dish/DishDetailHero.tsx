"use client";

import Image from "next/image";
import type { Dish } from "@/lib/demoMenuData";
import { getDishDetailImageObjectPosition } from "@/lib/demoMenuData";

type DishDetailHeroProps = {
  dish: Dish;
  unavailable: boolean;
  logoMonogram: string;
  immersive: boolean;
};

/**
 * Hero photo fiche plat : desktop en ratio type 4/3 (moins « bannière ») ;
 * mobile / simulation : hauteur immersif inchangée (dvh, sans vw écran).
 */
export function DishDetailHero({
  dish,
  unavailable,
  logoMonogram,
  immersive
}: DishDetailHeroProps) {
  const objectPosition = getDishDetailImageObjectPosition(dish);

  const outer = immersive
    ? "mt-3 w-full max-w-none px-0"
    : "mx-auto mt-5 w-full max-w-[min(940px,calc(100%-2rem))] px-4 sm:px-6 lg:max-w-[920px]";

  const frame = immersive
    ? "relative isolate h-[clamp(356px,min(76dvh,520px),520px)] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#14100c] shadow-[0_32px_90px_rgba(0,0,0,0.48)] ring-1 ring-white/[0.07]"
    : "relative isolate aspect-[4/3] w-full max-h-[min(76vh,720px)] overflow-hidden rounded-2xl border border-white/10 bg-[#14100c] shadow-[0_28px_92px_rgba(0,0,0,0.38)] lg:rounded-[1.35rem] lg:shadow-[0_36px_100px_rgba(0,0,0,0.42)]";

  const sizes = immersive
    ? "(max-width: 428px) 100vw, 420px"
    : "(max-width: 980px) 92vw, 920px";

  return (
    <div className={outer}>
      <div className={frame}>
        {dish.image ? (
          <>
            <Image
              src={dish.image}
              alt={`Photo du plat : ${dish.name}`}
              fill
              priority
              sizes={sizes}
              className="object-cover"
              style={{ objectPosition }}
              quality={92}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-black/12"
              aria-hidden
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#2a1f18] via-[#16100c] to-[#080706]" />
            <div className="pointer-events-none absolute -right-16 top-20 h-56 w-56 rounded-full bg-champagne/15 blur-3xl" />
            <p className="absolute bottom-8 left-8 font-display text-5xl text-white/12 sm:text-7xl">
              {logoMonogram}
            </p>
          </>
        )}
        {unavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <p className="rounded-full border border-white/20 bg-black/60 px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-cream">
              Momentanément indisponible
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
