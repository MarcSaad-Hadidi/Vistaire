"use client";

import type { Category } from "@/lib/demoMenuData";

export type CategoryStickyMode = "off" | "pageHeader" | "viewportInner";

export type MenuCategoryTab = Pick<Category, "id" | "slug" | "name">;

type CategoryTabsProps = {
  tabs: MenuCategoryTab[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  stickyMode: CategoryStickyMode;
};

/**
 * Stratégie d’affichage :
 * - Mockup téléphone (`viewportInner`) : grille wrappée et centrée — toutes les
 *   catégories visibles d’un coup (généralement sur 2 lignes), aucun scroll.
 * - Mobile réel (`pageHeader`) : sticky sous le header, wrap centré aussi.
 * - Desktop (`off`) : ligne centrée wrappée à grand écran.
 *
 * Le scroll horizontal a été retiré : il ne tenait pas la largeur utile du
 * téléphone simulé et donnait toujours une impression de barre tronquée.
 */
export function CategoryTabs({
  tabs,
  activeSlug,
  onSelect,
  stickyMode
}: CategoryTabsProps) {
  const isViewportInner = stickyMode === "viewportInner";
  const isPageHeader = stickyMode === "pageHeader";

  const shell = isViewportInner
    ? "relative z-20 min-w-0 border-b border-white/[0.08] bg-[#080706] px-3 py-3"
    : isPageHeader
      ? "sticky top-16 z-30 min-w-0 border-b border-white/10 bg-[#080706]/96 px-3 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-[#080706]/88"
      : "relative z-20 min-w-0 border-b border-white/8 bg-[#080706] px-4 py-3 sm:px-5";

  const rowClass = isViewportInner
    ? "flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-2"
    : isPageHeader
      ? "flex w-full min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-2 sm:gap-x-2"
      : "flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5";

  /**
   * Chips : `leading-[1.2]` (et `pb-` légèrement supérieur à `pt-`) pour laisser
   * respirer les descendantes (« g » de signatures, « p » de Plats, etc.) sans
   * agrandir visuellement la pill. Pas de `truncate` : `overflow: hidden`
   * combiné à un line-height serré coupait le bas des lettres.
   */
  const chipClass = (selected: boolean) =>
    isViewportInner
      ? `inline-flex min-h-[34px] max-w-full items-center justify-center whitespace-nowrap rounded-full border px-3 pb-[7px] pt-[5px] text-[12px] font-medium leading-[1.2] tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal ${
          selected
            ? "border-champagne/55 bg-champagne/[0.15] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-champagne/25"
            : "border-white/[0.12] bg-black/45 text-[#d1c2aa] hover:border-white/22 hover:bg-black/55 hover:text-cream"
        }`
      : `inline-flex max-w-full items-center justify-center whitespace-nowrap rounded-full border px-3.5 pb-[7px] pt-[5px] text-[12.5px] font-medium leading-[1.2] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:px-4 sm:pb-[8px] sm:pt-[6px] sm:text-sm ${
          selected
            ? "border-champagne/55 bg-champagne/14 text-cream shadow-sm"
            : "border-white/12 bg-black/35 text-[#c9b79d] hover:border-white/22 hover:text-cream"
        }`;

  return (
    <div className={shell} data-lenis-prevent>
      <div className={rowClass} role="tablist" aria-label="Catégories du menu">
        {tabs.map((tab) => {
          const selected = tab.slug === activeSlug;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.slug}`}
              id={`tab-${tab.slug}`}
              className={chipClass(selected)}
              onClick={() => onSelect(tab.slug)}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
