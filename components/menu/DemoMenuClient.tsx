"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, CurrencyCode, Dish } from "@/lib/demoMenuData";
import { getRestaurant } from "@/lib/demoMenuData";
import { trackMenuEvent } from "@/lib/analytics/client";
import {
  applyMenuFilters,
  defaultMenuFilterState,
  dishMatchesSearch,
  hasActiveFilters,
  MENU_ALL_CATEGORY_SLUG,
  type MenuFilterState
} from "@/lib/menuQuery";
import { useDemoSimulation } from "@/components/menu/DemoSimulationContext";
import type { CategoryStickyMode } from "@/components/menu/CategoryTabs";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { DishGrid } from "@/components/menu/DishGrid";
import { MenuFilterBar } from "@/components/menu/MenuFilterBar";
import { MenuSearchBar } from "@/components/menu/MenuSearchBar";
import { prepareDemoAssetOrigin } from "@/lib/dishAssetWarmup";

type DemoMenuClientProps = {
  categories: Category[];
  dishes: Dish[];
  currency: CurrencyCode;
};

export function DemoMenuClient({
  categories,
  dishes,
  currency
}: DemoMenuClientProps) {
  const restaurant = getRestaurant();
  const { isRealMobile, simulateMobile, isPhoneSimulation } = useDemoSimulation();
  const [activeSlug, setActiveSlug] = useState<string>(MENU_ALL_CATEGORY_SLUG);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<MenuFilterState>(defaultMenuFilterState);

  useEffect(() => {
    prepareDemoAssetOrigin();
    trackMenuEvent({ eventName: "session_started" });
    trackMenuEvent({ eventName: "menu_opened" });
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return undefined;

    const timeoutId = window.setTimeout(() => {
      trackMenuEvent({
        eventName: "search_used",
        searchQuery: query
      });
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleCategorySelect = useCallback(
    (slug: string) => {
      setActiveSlug(slug);
      if (slug !== activeSlug) {
        trackMenuEvent({
          eventName: "category_viewed",
          categorySlug: slug
        });
      }
    },
    [activeSlug]
  );

  const handleFiltersChange = useCallback(
    (next: MenuFilterState, filterName = "filter_change") => {
      setFilters(next);
      trackMenuEvent({
        eventName: "filter_used",
        filterName
      });
    },
    []
  );

  const useStickyTabs = isRealMobile || simulateMobile;

  const categoryStickyMode: CategoryStickyMode = isPhoneSimulation
    ? "viewportInner"
    : useStickyTabs
      ? "pageHeader"
      : "off";

  const compactControls = isPhoneSimulation;

  const categoryTabs = useMemo(
    () => [
      {
        id: "tab-tous",
        slug: MENU_ALL_CATEGORY_SLUG,
        name: "Tous"
      },
      ...categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name
      }))
    ],
    [categories]
  );

  const activeCategoryLabel =
    categoryTabs.find((t) => t.slug === activeSlug)?.name ?? "Tous";

  const filteredDishes = useMemo(() => {
    let list =
      activeSlug === MENU_ALL_CATEGORY_SLUG
        ? dishes
        : dishes.filter((dish) => dish.categorySlug === activeSlug);
    list = list.filter((dish) => dishMatchesSearch(dish, searchQuery));
    return applyMenuFilters(list, filters);
  }, [activeSlug, dishes, filters, searchQuery]);

  const filterActive = hasActiveFilters(filters);
  const searchActive = searchQuery.trim().length > 0;

  const toolbar = (
    <>
      <MenuSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        compact={compactControls}
      />
      <MenuFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        compact={compactControls}
      />
      {(searchActive || filterActive) && (
        <p
          className={
            isPhoneSimulation
              ? "text-[10px] leading-relaxed text-[#6a5c4e]"
              : "text-[10px] text-[#6a5c4e] sm:text-[11px]"
          }
          aria-live="polite"
        >
          {filteredDishes.length} résultat
          {filteredDishes.length === 1 ? "" : "s"} ·{" "}
          <span className="text-[#8f806e]">{activeCategoryLabel}</span>
        </p>
      )}
    </>
  );

  return (
    <section
      className={
        isPhoneSimulation
          ? "min-w-0 overflow-clip rounded-xl border border-white/9 bg-[#050403]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#070504]/85 shadow-[0_12px_60px_rgba(0,0,0,0.25)]"
      }
      aria-label="Carte du restaurant"
    >
      {isPhoneSimulation ? (
        <>
          <header className="relative border-b border-white/[0.06] bg-gradient-to-b from-[#0c0a08] via-[#080706] to-[#080706] px-4 pb-5 pt-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,184,121,0.085),transparent_55%)]" />
            <div className="relative text-center">
              <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-champagne/80">
                Menu client
              </p>
              <div className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-full border border-champagne/35 bg-espresso/90 font-display text-base text-cream shadow-[0_6px_28px_rgba(0,0,0,0.35)]">
                {restaurant.logoMonogram}
              </div>
              <h1 className="mt-3 font-display text-[1.3rem] font-normal leading-[1.12] tracking-tight text-cream">
                {restaurant.name}
              </h1>
              <p className="mx-auto mt-2 max-w-[19rem] text-[13px] leading-relaxed text-[#cfc1ab]">
                {restaurant.tagline}
              </p>
              <p className="mt-2.5 text-[11px] leading-relaxed text-[#8f806e]">
                {restaurant.location}
              </p>
            </div>
          </header>

          <CategoryTabs
            tabs={categoryTabs}
            activeSlug={activeSlug}
            onSelect={handleCategorySelect}
            stickyMode={categoryStickyMode}
          />

          <div className="menu-deck-toolbar border-t border-white/[0.06] bg-[#070504]/75 px-4 py-4">
            <div className="flex flex-col gap-3.5">{toolbar}</div>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3 border-b border-white/8 px-4 py-4 sm:px-5">
            {toolbar}
          </div>

          <CategoryTabs
            tabs={categoryTabs}
            activeSlug={activeSlug}
            onSelect={handleCategorySelect}
            stickyMode={categoryStickyMode}
          />
        </>
      )}

      {filteredDishes.length === 0 ? (
        <div
          className="px-4 py-10 text-center sm:px-5 sm:py-14"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-lg text-cream sm:text-xl">
            Aucun plat ne correspond à votre sélection.
          </p>
          <p className="mt-2 text-sm text-[#9a8b78]">
            Élargissez vos critères ou réinitialisez.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {searchActive ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-medium text-cream transition hover:border-champagne/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              >
                Effacer la recherche
              </button>
            ) : null}
            {filterActive ? (
              <button
                type="button"
                onClick={() =>
                  handleFiltersChange(defaultMenuFilterState(), "reset_filters")
                }
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-champagne/30 bg-champagne/8 px-5 text-sm font-medium text-champagne transition hover:bg-champagne/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <DishGrid
          dishes={filteredDishes}
          currency={currency}
          categorySlug={activeSlug}
        />
      )}
    </section>
  );
}
