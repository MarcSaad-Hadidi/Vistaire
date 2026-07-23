"use client";

import type { Allergen } from "@/lib/demoMenuData";
import {
  defaultMenuFilterState,
  hasActiveFilters,
  type MenuFilterState
} from "@/lib/menuQuery";

const ALLERGEN_OPTIONS: { value: Allergen | ""; label: string }[] = [
  { value: "", label: "Tous les plats" },
  { value: "gluten", label: "Déclaré sans gluten" },
  { value: "dairy", label: "Déclaré sans produits laitiers" },
  { value: "nuts", label: "Déclaré sans fruits à coque" },
  { value: "shellfish", label: "Déclaré sans crustacés" },
  { value: "eggs", label: "Déclaré sans œufs" },
  { value: "sesame", label: "Déclaré sans sésame" },
  { value: "soy", label: "Déclaré sans soja" },
  { value: "fish", label: "Déclaré sans poisson" }
];

type MenuFilterBarProps = {
  filters: MenuFilterState;
  onChange: (next: MenuFilterState, filterName?: string) => void;
  compact?: boolean;
};

type ToggleKey = keyof Pick<
  MenuFilterState,
  "signatureOnly" | "recommendedOnly" | "availableOnly" | "with3dOnly"
>;

type FilterChip = {
  key: ToggleKey;
  /** Libellé long (desktop) — fallback si `compactLabel` est absent. */
  label: string;
  /** Libellé compact (simulation téléphone et mobile réel). */
  compactLabel?: string;
};

const FILTER_CHIPS: FilterChip[] = [
  { key: "signatureOnly", label: "Signature" },
  { key: "recommendedOnly", label: "Recommandés" },
  { key: "availableOnly", label: "Disponibles" },
  { key: "with3dOnly", label: "Avec vue 3D", compactLabel: "3D" }
];

export function MenuFilterBar({
  filters,
  onChange,
  compact
}: MenuFilterBarProps) {
  const toggle = (key: ToggleKey) => {
    onChange({ ...filters, [key]: !filters[key] }, key);
  };

  const active = hasActiveFilters(filters);

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-3"
          : "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      }
    >
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-start gap-x-1.5 gap-y-1.5"
            : "flex flex-wrap items-center gap-1.5"
        }
      >
        <span className="sr-only">Filtres rapides</span>
        {FILTER_CHIPS.map((chip) => {
          const pressed = filters[chip.key];
          const label = compact && chip.compactLabel ? chip.compactLabel : chip.label;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggle(chip.key)}
              aria-pressed={pressed}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 pb-[7px] pt-[5px] text-[11px] font-medium leading-[1.2] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne ${
                pressed
                  ? "border-champagne/50 bg-champagne/[0.13] text-cream ring-1 ring-champagne/20"
                  : "border-white/[0.1] bg-black/40 text-[#b9aa94] hover:border-white/18 hover:bg-black/48"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className={
          compact
            ? "flex flex-col gap-2"
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
            }, v === "" ? "allergens_reset" : `exclude_${v}`);
          }}
          className={
            compact
              ? "min-h-[40px] w-full rounded-xl border border-white/[0.11] bg-black/50 px-3.5 py-2 text-[13px] text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none focus:border-champagne/35 focus:ring-1 focus:ring-champagne/22"
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
            onClick={() => onChange(defaultMenuFilterState(), "reset_filters")}
            className={
              compact
                ? "text-left text-[11px] font-medium text-champagne/90 underline decoration-champagne/30 underline-offset-2 transition hover:text-champagne"
                : "shrink-0 text-xs font-medium text-champagne/90 underline decoration-champagne/30 underline-offset-4 transition hover:text-champagne sm:text-sm"
            }
          >
            Réinitialiser
          </button>
        ) : null}
      </div>
    </div>
  );
}
