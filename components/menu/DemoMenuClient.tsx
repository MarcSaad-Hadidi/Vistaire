"use client";

import { useMemo, useState } from "react";
import type { Category, CurrencyCode, Dish } from "@/lib/demoMenuData";
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
  const { isRealMobile, simulateMobile, isPhoneSimulation } = useDemoSimulation();
  const [activeSlug, setActiveSlug] = useState<string>(MENU_ALL_CATEGORY_SLUG);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<MenuFilterState>(defaultMenuFilterState);

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

  return (
    <section
      className={
        isPhoneSimulation
          ? "overflow-hidden rounded-xl border border-white/9 bg-[#050403]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "overflow-hidden rounded-2xl border border-white/10 bg-[#070504]/85 shadow-[0_12px_60px_rgba(0,0,0,0.25)]"
      }
      aria-label="Carte du restaurant"
    >
      <div
        className={
          isPhoneSimulation
            ? "space-y-2.5 border-b border-white/8 px-3 py-2.5"
            : "space-y-3 border-b border-white/8 px-4 py-4 sm:px-5"
        }
      >
        <MenuSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          compact={compactControls}
        />
        <MenuFilterBar
          filters={filters}
          onChange={setFilters}
          compact={compactControls}
        />
        {(searchActive || filterActive) && (
          <p
            className="text-[10px] text-[#6a5c4e] sm:text-[11px]"
            aria-live="polite"
          >
            {filteredDishes.length} résultat
            {filteredDishes.length === 1 ? "" : "s"} ·{" "}
            <span className="text-[#8f806e]">{activeCategoryLabel}</span>
          </p>
        )}
      </div>

      <CategoryTabs
        tabs={categoryTabs}
        activeSlug={activeSlug}
        onSelect={setActiveSlug}
        stickyMode={categoryStickyMode}
      />

      {filteredDishes.length === 0 ? (
        <div
          className="px-4 py-10 text-center sm:px-5 sm:py-14"
          role="status"
          aria-live="polite"
        >
          <p className="font-display text-lg text-cream sm:text-xl">
            Aucun plat ne correspond à votre recherche.
          </p>
          <p className="mt-2 text-sm text-[#9a8b78]">
            Essayez d’autres mots-clés, une autre catégorie ou réinitialisez les
            filtres.
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
                onClick={() => setFilters(defaultMenuFilterState())}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-champagne/30 bg-champagne/8 px-5 text-sm font-medium text-champagne transition hover:bg-champagne/12 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              >
                Réinitialiser les filtres
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
