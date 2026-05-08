"use client";

import type { Allergen } from "@/lib/demoMenuData";
import {
  defaultMenuFilterState,
  hasActiveFilters,
  type MenuFilterState
} from "@/lib/menuQuery";

const ALLERGEN_OPTIONS: { value: Allergen | ""; label: string }[] = [
  { value: "", label: "Sans filtre allergène" },
  { value: "gluten", label: "Sans gluten" },
  { value: "dairy", label: "Sans lactose / laitiers" },
  { value: "nuts", label: "Sans fruits à coque" },
  { value: "shellfish", label: "Sans crustacés" },
  { value: "eggs", label: "Sans œufs" },
  { value: "sesame", label: "Sans sésame" },
  { value: "soy", label: "Sans soja" },
  { value: "fish", label: "Sans poisson" }
];

type MenuFilterBarProps = {
  filters: MenuFilterState;
  onChange: (next: MenuFilterState) => void;
  compact?: boolean;
};

export function MenuFilterBar({
  filters,
  onChange,
  compact
}: MenuFilterBarProps) {
  const toggle = (key: keyof Pick<MenuFilterState, "signatureOnly" | "recommendedOnly" | "availableOnly">) => {
    onChange({ ...filters, [key]: !filters[key] });
  };

  const active = hasActiveFilters(filters);

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-2"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="sr-only">Filtres rapides</span>
        <button
          type="button"
          onClick={() => toggle("signatureOnly")}
          aria-pressed={filters.signatureOnly}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
            filters.signatureOnly
              ? "border-champagne/55 bg-champagne/14 text-cream"
              : "border-white/10 bg-black/35 text-[#b9aa94] hover:border-white/18"
          }`}
        >
          Signature
        </button>
        <button
          type="button"
          onClick={() => toggle("recommendedOnly")}
          aria-pressed={filters.recommendedOnly}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
            filters.recommendedOnly
              ? "border-champagne/55 bg-champagne/14 text-cream"
              : "border-white/10 bg-black/35 text-[#b9aa94] hover:border-white/18"
          }`}
        >
          Recommandés
        </button>
        <button
          type="button"
          onClick={() => toggle("availableOnly")}
          aria-pressed={filters.availableOnly}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
            filters.availableOnly
              ? "border-champagne/55 bg-champagne/14 text-cream"
              : "border-white/10 bg-black/35 text-[#b9aa94] hover:border-white/18"
          }`}
        >
          Disponibles
        </button>
      </div>

      <div
        className={
          compact
            ? "flex flex-col gap-1.5"
            : "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
        }
      >
        <label className="sr-only" htmlFor="menu-demo-allergen-filter">
          Filtrer par préférence alimentaire
        </label>
        <select
          id="menu-demo-allergen-filter"
          value={filters.excludeAllergen ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...filters,
              excludeAllergen: v === "" ? null : (v as Allergen)
            });
          }}
          className={
            compact
              ? "min-h-8 w-full rounded-md border border-white/10 bg-black/45 px-2 py-1 text-[11px] text-cream outline-none focus:border-champagne/35 focus:ring-1 focus:ring-champagne/25"
              : "min-h-9 min-w-[12rem] rounded-lg border border-white/12 bg-black/40 px-3 py-1.5 text-xs text-cream outline-none focus:border-champagne/35 focus:ring-2 focus:ring-champagne/20 sm:text-sm"
          }
        >
          {ALLERGEN_OPTIONS.map((opt) => (
            <option key={opt.value || "none"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {active ? (
          <button
            type="button"
            onClick={() => onChange(defaultMenuFilterState())}
            className={
              compact
                ? "text-left text-[11px] font-medium text-champagne/90 underline decoration-champagne/30 underline-offset-2 transition hover:text-champagne"
                : "shrink-0 text-xs font-medium text-champagne/90 underline decoration-champagne/30 underline-offset-4 transition hover:text-champagne sm:text-sm"
            }
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>
    </div>
  );
}
