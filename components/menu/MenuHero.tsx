"use client";

import type { Restaurant } from "@/lib/demoMenuData";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type MenuHeroProps = {
  restaurant: Restaurant;
};

export function MenuHero({ restaurant }: MenuHeroProps) {
  const { isPhoneSimulation } = useDemoSimulation();

  /** En simulation téléphone, l’identité est dans la carte (DemoMenuClient) pour rester au-dessus des filtres. */
  if (isPhoneSimulation) {
    return null;
  }

  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-[#0a0806] to-[#080706] px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,184,121,0.1),transparent_50%)]" />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-champagne/85 sm:text-xs">
          La carte
        </p>
        <div className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-full border border-champagne/30 bg-espresso/80 font-display text-lg text-cream shadow-champagne sm:mt-4 sm:h-14 sm:w-14 sm:text-xl">
          {restaurant.logoMonogram}
        </div>
        <h1 className="mt-3 font-display text-[clamp(1.65rem,5.5vw,2.75rem)] font-normal leading-[1.06] text-cream sm:mt-4">
          {restaurant.name}
        </h1>
        <p className="mt-2 text-sm leading-snug text-[#d1c2aa] sm:text-base">
          {restaurant.tagline}
        </p>
        <p className="mt-2 text-xs text-[#8f806e]">{restaurant.location}</p>
      </div>
    </header>
  );
}
