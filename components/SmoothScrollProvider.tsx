"use client";

import { useLayoutEffect, type ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type SmoothScrollProviderProps = {
  children: ReactNode;
};

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const previousScrollRestoration = window.history.scrollRestoration;

    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1,
      easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
      smoothWheel: true,
      wheelMultiplier: 0.72,
      touchMultiplier: 1.2
    });

    lenis.scrollTo(0, { immediate: true, force: true });
    lenis.on("scroll", ScrollTrigger.update);

    const update = (time: number) => {
      lenis.raf(time * 1000);
    };

    const resetScrollBeforeReload = () => {
      lenis.scrollTo(0, { immediate: true, force: true });
      window.scrollTo(0, 0);
    };

    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();
    window.addEventListener("beforeunload", resetScrollBeforeReload);

    return () => {
      window.removeEventListener("beforeunload", resetScrollBeforeReload);
      window.history.scrollRestoration = previousScrollRestoration;
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, []);

  return children;
}
