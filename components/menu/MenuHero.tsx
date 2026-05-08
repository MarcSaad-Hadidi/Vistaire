"use client";

import type { Restaurant } from "@/lib/demoMenuData";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type MenuHeroProps = {
  restaurant: Restaurant;
};

export function MenuHero({ restaurant }: MenuHeroProps) {
  const { isPhoneSimulation } = useDemoSimulation();

  if (isPhoneSimulation) {
    return (
      <header className="relative overflow-hidden bg-gradient-to-b from-[#0c0a08] to-[#080706] pb-4 pt-1">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,184,121,0.08),transparent_52%)]" />
        <div className="relative mx-auto max-w-none text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-champagne/80">
            Menu digital interactif
          </p>
          <div className="mx-auto mt-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-champagne/32 bg-espresso/90 font-display text-base text-cream shadow-[0_6px_28px_rgba(0,0,0,0.35)]">
            {restaurant.logoMonogram}
          </div>
          <h1 className="mt-2.5 font-display text-[1.35rem] font-normal leading-[1.12] tracking-tight text-cream">
            {restaurant.name}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[19rem] text-[13px] leading-snug text-[#cfc1ab]">
            {restaurant.tagline}
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-[#8f806e]">
            {restaurant.location}
          </p>
        </div>
      </header>
    );
  }

  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-[#0a0806] to-[#080706] px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,184,121,0.1),transparent_50%)]" />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-champagne/85 sm:text-xs">
          Menu digital interactif
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
