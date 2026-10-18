"use client";

import { useEffect, useRef } from "react";
import { trackPublicMenuEvent, trackPublicMenuSessionStarted } from "@/lib/analytics/client";
import type { PublicMenu, PublicMenuDish } from "@/lib/menu/publicMenuCore";

/** Only visible, foreground reading time. No URLs, query text or user identity. */
export function useVisibleMenuAnalytics(menu: PublicMenu, enabled: boolean, dish?: PublicMenuDish | null) {
  const rootRef = useRef<HTMLElement | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || typeof IntersectionObserver === "undefined") return;
    const pageType = dish ? "dish" : "menu";
    const identity = `${menu.source}:${menu.restaurantId}:${menu.menuId}:${pageType}:${dish?.slug ?? ""}`;
    let intersecting = false;
    let started: number | null = null;
    let pageHidden = false;
    const visibleItems = new Map<Element, PublicMenuDish>();
    const emit = (eventName: Parameters<typeof trackPublicMenuEvent>[1]["eventName"], item = dish, metadata = {}) =>
      trackPublicMenuEvent(menu, { eventName, dishSlug: item?.slug, categorySlug: item?.categorySlug, metadata: { pageType, ...metadata } });
    const isActive = () => !pageHidden && document.visibilityState === "visible" && document.hasFocus() && !root.closest('[aria-hidden="true"], [inert], [hidden], [data-transition-preview="true"]');
    const once = (key: string, action: () => void) => {
      if (seen.current.has(key)) return;
      seen.current.add(key);
      action();
    };
    const flush = () => {
      if (started === null) return;
      const durationMs = Math.min(1_800_000, Math.round(performance.now() - started));
      started = null;
      if (durationMs > 0) {
        emit("session_duration", dish, { durationMs });
        if (dish) emit("dish_dwell", dish, { durationMs });
      }
    };
    const sync = () => {
      if (!isActive() || !intersecting) { flush(); return; }
      if (started === null) started = performance.now();
      once(identity, () => {
        trackPublicMenuSessionStarted(menu);
        emit(dish ? "dish_opened" : "menu_opened");
      });
      for (const [element, item] of visibleItems) {
        if (element.closest('[aria-hidden="true"], [inert], [hidden], [data-transition-preview="true"], [data-sauge-flip-page-index]')) continue;
        once(`${identity}:list`, () => emit("menu_list_viewed", null));
        once(`${identity}:item:${item.slug}`, () => emit("dish_visible", item));
        if (item.categorySlug) once(`${identity}:category:${item.categorySlug}`, () => emit("category_viewed", item));
      }
    };
    const itemFor = (element: Element) => {
      const slug = element.getAttribute("data-analytics-dish");
      const href = element.getAttribute("href")?.split("?")[0];
      return menu.dishes.find(item => item.slug === slug || (href && href === `/menu/${encodeURIComponent(menu.slug)}/dishes/${encodeURIComponent(item.slug)}`));
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === root) intersecting = entry.isIntersecting;
        else {
          const item = itemFor(entry.target);
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && item) visibleItems.set(entry.target, item);
          else visibleItems.delete(entry.target);
        }
      }
      sync();
    }, { threshold: [0, 0.5] });
    observer.observe(root);
    const observed = new Set<Element>();
    const scan = () => {
      if (!dish) for (const element of root.querySelectorAll('[data-analytics-dish], a[href]')) {
        if (!observed.has(element) && itemFor(element)) { observed.add(element); observer.observe(element); }
      }
      for (const element of observed) if (!root.contains(element)) { observer.unobserve(element); observed.delete(element); visibleItems.delete(element); }
      sync();
    };
    scan();
    const mutation = new MutationObserver(scan);
    mutation.observe(root.closest("[data-sauge-reading-surface], [data-sauge-flip-page-index]") ?? root, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-hidden", "inert", "hidden", "data-transition-preview"] });
    const ancestors = new MutationObserver(sync);
    for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
      ancestors.observe(ancestor, { attributes: true, attributeFilter: ["aria-hidden", "inert", "hidden", "data-transition-preview"] });
    }
    const click = (event: Event) => {
      if (dish || !isActive()) return;
      const element = (event.target as Element).closest('[data-analytics-dish], a[href]');
      const item = element && itemFor(element);
      if (item) emit("dish_selected", item);
    };
    const interval = window.setInterval(() => { flush(); sync(); }, 30_000);
    const hide = () => { pageHidden = true; flush(); };
    const show = () => { pageHidden = false; sync(); };
    root.addEventListener("click", click);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("blur", flush);
    window.addEventListener("focus", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      flush(); observer.disconnect(); mutation.disconnect(); ancestors.disconnect();
      window.clearInterval(interval);
      root.removeEventListener("click", click);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("blur", flush);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, [menu, enabled, dish]);
  return rootRef;
}
