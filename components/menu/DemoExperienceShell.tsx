"use client";

import type { ReactNode } from "react";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type DemoExperienceShellProps = {
  children: ReactNode;
};

/**
 * Desktop : menu plein écran large par défaut.
 * Option « Simuler mobile » : mockup téléphone avec scroll interne (prévisualisation seulement).
 * Vrai téléphone : pas de mockup, page naturelle (scroll document).
 */
export function DemoExperienceShell({ children }: DemoExperienceShellProps) {
  const { isRealMobile, simulateMobile, setSimulateMobile } = useDemoSimulation();

  const showPhoneChrome = !isRealMobile && simulateMobile;

  return (
    <div
      className="min-h-screen bg-[#080706]"
      data-lenis-prevent
      data-demo-root
    >
      {!isRealMobile ? (
        <div className="bg-[#060504] px-4 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-medium text-[#5c5248] sm:text-[11px]">
              <span className="sr-only">Mode démonstration : </span>
              Prévisualisation bureau — activez la simulation pour voir le rendu téléphone.
            </p>
            <button
              type="button"
              onClick={() => setSimulateMobile(!simulateMobile)}
              className={`inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-[#080706] ${
                simulateMobile
                  ? "border-champagne/50 bg-champagne/12 text-champagne"
                  : "border-white/16 bg-black/35 text-cream hover:border-champagne/35"
              }`}
              aria-pressed={simulateMobile}
            >
              {simulateMobile
                ? "Quitter la simulation téléphone"
                : "Simuler l’expérience mobile"}
            </button>
          </div>
        </div>
      ) : null}

      {showPhoneChrome ? (
        <div className="flex justify-center px-3 pb-12 pt-5 sm:px-8">
          <div className="relative w-full max-w-[418px]">
            <div
              className="pointer-events-none absolute -inset-1 rounded-[3rem] bg-gradient-to-b from-white/10 to-transparent opacity-40 blur-sm"
              aria-hidden
            />
            {/* Coque légèrement plus fine = plus de largeur utile (~392px zone utile) */}
            <div className="relative rounded-[2.85rem] border-[11px] border-[#161618] bg-[#0c0c0e] shadow-[0_40px_100px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.07]">
              <div
                className="absolute left-1/2 top-2.5 z-10 h-6 w-[40%] -translate-x-1/2 rounded-full bg-black/88"
                aria-hidden
              />
              <div
                className="phone-mockup-scroll phone-mockup-scroll--premium max-h-[min(82vh,820px)] overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-[2.35rem] bg-[#080706] [-webkit-overflow-scrolling:touch]"
                data-lenis-prevent
                data-phone-mockup-scroll
              >
                <div className="px-3.5 pb-10 pt-3 sm:px-4">
                  {children}
                </div>
              </div>
            </div>
            <p className="mt-5 text-center text-xs text-[#6a5c4e]">
              Prévisualisation format téléphone — l’expérience réelle sur mobile
              utilise tout l’écran.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          {children}
        </div>
      )}
    </div>
  );
}
