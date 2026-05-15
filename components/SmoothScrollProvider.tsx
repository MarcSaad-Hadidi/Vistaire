"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject
} from "react";
import { usePathname } from "next/navigation";

type LenisInstance = import("lenis").default;

const LenisRefContext =
  createContext<RefObject<LenisInstance | null> | null>(null);
const REDUCED_MOTION_MEDIA_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_SCROLL_MEDIA_QUERY = "(max-width: 767px)";

function prefersNativeScrollDesktop(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  return /Brave/i.test(ua) || /Firefox\//i.test(ua);
}

export function useLenisRef(): RefObject<LenisInstance | null> | null {
  return useContext(LenisRefContext);
}

type SmoothScrollProviderProps = {
  children: ReactNode;
};

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<LenisInstance | null>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const setupSmoothScroll = async () => {
      const [{ default: Lenis }, { default: gsap }, { ScrollTrigger }] =
        await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger")
        ]);

      if (cancelled) return undefined;

      gsap.registerPlugin(ScrollTrigger);

      const previousScrollRestoration = window.history.scrollRestoration;
      const isLanding = pathname === "/";

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
          duration: prefersReducedMotion ? 0.01 : 0.58,
          easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
          smoothWheel: !prefersReducedMotion,
          wheelMultiplier: 0.88,
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
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
          lenisRef.current = null;
        };
      };

      const applyScrollMode = () => {
        removeDesktopScroll?.();
        removeMobileScroll?.();
        removeDesktopScroll = null;
        removeMobileScroll = null;

        if (isLanding) {
          requestAnimationFrame(() => {
            ScrollTrigger.refresh();
          });
          return;
        }

        const isMobileViewport = mobileScrollQuery.matches;
        const useLenis = !isMobileViewport && !prefersNativeScrollDesktop();

        if (useLenis) {
          removeDesktopScroll = startDesktopLenis();
        } else {
          removeMobileScroll = attachNativeScrollUpdates();
        }

        requestAnimationFrame(() => {
          ScrollTrigger.refresh();
        });
      };

      applyScrollMode();

      const onViewportChange = () => {
        applyScrollMode();
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
    };

    void setupSmoothScroll().then((teardown) => {
      if (cancelled) {
        teardown?.();
        return;
      }

      cleanup = teardown ?? null;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [pathname]);

  return (
    <LenisRefContext.Provider value={lenisRef}>{children}</LenisRefContext.Provider>
  );
}
