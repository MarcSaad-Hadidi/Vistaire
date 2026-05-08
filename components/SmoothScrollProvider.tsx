"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject
} from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const LenisRefContext = createContext<RefObject<Lenis | null> | null>(null);
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_SCROLL_MEDIA_QUERY = "(max-width: 767px)";

/** Référence vers l’instance Lenis globale (pour stop/start hors du provider). */
export function useLenisRef(): RefObject<Lenis | null> | null {
  return useContext(LenisRefContext);
}

type SmoothScrollProviderProps = {
  children: ReactNode;
};

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const prefersReducedMotion = window.matchMedia(
      REDUCED_MOTION_MEDIA_QUERY
    ).matches;

    const mobileScrollQuery = window.matchMedia(MOBILE_SCROLL_MEDIA_QUERY);

    const resetScrollBeforeReload = () => {
      lenisRef.current?.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    };

    let removeDesktopScroll: (() => void) | null = null;
    let removeMobileScroll: (() => void) | null = null;

    const attachNativeScrollUpdates = () => {
      const onScroll = () => {
        ScrollTrigger.update();
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
      };
    };

    const startDesktopLenis = () => {
      const lenis = new Lenis({
        duration: prefersReducedMotion ? 0.01 : 0.72,
        easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
        smoothWheel: !prefersReducedMotion,
        wheelMultiplier: 0.78,
        touchMultiplier: 1
      });

      lenisRef.current = lenis;

      lenis.scrollTo(0, { immediate: true, force: true });
      lenis.on("scroll", ScrollTrigger.update);

      const update = (time: number) => {
        lenis.raf(time * 1000);
      };

      gsap.ticker.add(update);
      gsap.ticker.lagSmoothing(0);

      return () => {
        gsap.ticker.remove(update);
        lenis.destroy();
        lenisRef.current = null;
      };
    };

    const applyScrollMode = (useNativeMobile: boolean) => {
      removeDesktopScroll?.();
      removeMobileScroll?.();
      removeDesktopScroll = null;
      removeMobileScroll = null;

      if (useNativeMobile) {
        removeMobileScroll = attachNativeScrollUpdates();
      } else {
        removeDesktopScroll = startDesktopLenis();
      }

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });
    };

    applyScrollMode(mobileScrollQuery.matches);

    const onViewportChange = (event: MediaQueryListEvent) => {
      applyScrollMode(event.matches);
    };

    if (typeof mobileScrollQuery.addEventListener === "function") {
      mobileScrollQuery.addEventListener("change", onViewportChange);
    } else {
      mobileScrollQuery.addListener(onViewportChange);
    }

    window.addEventListener("beforeunload", resetScrollBeforeReload);
    ScrollTrigger.refresh();

    return () => {
      window.removeEventListener("beforeunload", resetScrollBeforeReload);
      window.history.scrollRestoration = previousScrollRestoration;

      if (typeof mobileScrollQuery.removeEventListener === "function") {
        mobileScrollQuery.removeEventListener("change", onViewportChange);
      } else {
        mobileScrollQuery.removeListener(onViewportChange);
      }

      removeDesktopScroll?.();
      removeMobileScroll?.();
    };
  }, []);

  return (
    <LenisRefContext.Provider value={lenisRef}>{children}</LenisRefContext.Provider>
  );
}
