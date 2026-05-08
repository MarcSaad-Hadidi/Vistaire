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

export function CategoryTabs({
  tabs,
  activeSlug,
  onSelect,
  stickyMode
}: CategoryTabsProps) {
  const isViewportInner = stickyMode === "viewportInner";
  const isPageHeader = stickyMode === "pageHeader";
  const sticky = isViewportInner || isPageHeader;

  const shell = !sticky
    ? "relative z-20 border-b border-white/8 bg-[#080706] py-2"
    : isViewportInner
      ? "sticky top-0 z-30 border-b border-white/10 bg-[#080706]/98 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md supports-[backdrop-filter]:bg-[#080706]/90"
      : "sticky top-16 z-30 border-b border-white/10 bg-[#080706]/96 py-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-[#080706]/88";

  const rowClass = isViewportInner
    ? "flex gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 py-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-0.5 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2.5 sm:px-0 lg:flex-wrap lg:justify-center lg:overflow-visible";

  const chipClass = (selected: boolean) =>
    isViewportInner
      ? `min-h-[31px] shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium leading-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal ${
          selected
            ? "border-champagne/60 bg-champagne/16 text-cream shadow-[0_0_0_1px_rgba(217,184,121,0.12)]"
            : "border-white/10 bg-black/40 text-[#c4b5a0] hover:border-white/18 hover:text-cream"
        }`
      : `min-h-10 shrink-0 rounded-full border px-4 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal sm:min-h-11 sm:px-5 sm:text-sm ${
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
