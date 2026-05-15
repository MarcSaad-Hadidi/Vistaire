"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLenisRef } from "@/components/SmoothScrollProvider";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";

type DemoExperienceShellProps = {
  children: ReactNode;
};

/**
 * Desktop : carte pleine largeur.
 * Option « Simuler mobile » : cadre téléphone avec scroll interne.
 * Appareil mobile réel : pas de cadre, défilement document natif.
 */
export function DemoExperienceShell({ children }: DemoExperienceShellProps) {
  const { isRealMobile, simulateMobile, setSimulateMobile } = useDemoSimulation();
  const lenisRef = useLenisRef();

  const showPhoneChrome = !isRealMobile && simulateMobile;

  useEffect(() => {
    const lock = simulateMobile && !isRealMobile;
    if (!lock) return undefined;

    const lenis = lenisRef?.current ?? null;
    lenis?.stop();

    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevOverscroll;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;

      lenis?.start();
      window.scrollTo(0, scrollY);
      lenis?.scrollTo(scrollY, { immediate: true, force: true });
      void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        ScrollTrigger.refresh();
      });
    };
  }, [simulateMobile, isRealMobile, lenisRef]);

  return (
    <div
      className="min-h-screen bg-[#080706]"
      data-lenis-prevent
      data-demo-root
    >
      {!isRealMobile ? (
        <div className="hidden bg-[#060504] py-2.5 pl-4 pr-2 sm:pl-6 sm:pr-4 md:block">
          <div className="flex w-full justify-end">
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
                ? "Quitter l’aperçu mobile"
                : "Afficher l’aperçu mobile"}
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
                <div className="min-w-0 px-4 pb-10 pt-4 sm:px-4">
                  {children}
                </div>
              </div>
            </div>
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
