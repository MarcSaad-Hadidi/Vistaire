"use client";

import { useMemo, useState } from "react";
import { AdminDishAvailabilityControl } from "@/components/admin/AdminDishAvailabilityControl";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";

type DishFilter =
  | "all"
  | "available"
  | "unavailable"
  | "missing-price"
  | "missing-description"
  | "missing-photo"
  | "immersive";

const FILTERS: Array<{ id: DishFilter; label: string }> = [
  { id: "all", label: "Tous" },
  { id: "available", label: "Disponibles" },
  { id: "unavailable", label: "Indisponibles" },
  { id: "missing-price", label: "Prix manquant" },
  { id: "missing-description", label: "Description manquante" },
  { id: "missing-photo", label: "Photo manquante" },
  { id: "immersive", label: "3D/AR" }
];

function matchesFilter(dish: AdminMenuDish, filter: DishFilter): boolean {
  switch (filter) {
    case "available":
      return dish.available;
    case "unavailable":
      return !dish.available;
    case "missing-price":
      return dish.priceCents <= 0 || !dish.priceLabel;
    case "missing-description":
      return !dish.description;
    case "missing-photo":
      return !dish.hasPhoto;
    case "immersive":
      return dish.hasImmersive;
    default:
      return true;
  }
}

export function AdminDishWorklist({ dishes }: { dishes: AdminMenuDish[] }) {
  const [filter, setFilter] = useState<DishFilter>("all");
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const currentDishes = useMemo(
    () =>
      dishes.map((dish) => ({
        ...dish,
        available: availability[dish.id] ?? dish.available
      })),
    [availability, dishes]
  );
  const visibleDishes = currentDishes.filter((dish) => matchesFilter(dish, filter) && `${dish.name} ${dish.category}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));

  return (
    <section aria-labelledby="admin-dishes-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-champagne/80">
            Carte actuelle
          </p>
          <h2 id="admin-dishes-title" className="mt-2 font-display text-2xl text-cream sm:text-3xl">
            Disponibilité des plats
          </h2>
        </div>
        <p className="text-sm text-[#b9aa95]">{dishes.length} plat{dishes.length > 1 ? "s" : ""}</p>
      </div>

      <label className="mt-5 grid gap-2 text-sm text-[#d8c9b4]" htmlFor="admin-dish-search">
        Rechercher un plat ou une catégorie
        <input id="admin-dish-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 rounded-xl border border-white/15 bg-black/20 px-4 text-cream outline-none focus-visible:ring-2 focus-visible:ring-champagne" />
      </label>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filtrer les plats">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            aria-pressed={filter === item.id}
            className="min-h-11 shrink-0 rounded-full border border-white/15 bg-black/10 px-4 text-xs font-semibold text-[#d8c9b4] transition hover:border-champagne/40 aria-pressed:border-champagne/55 aria-pressed:bg-champagne/10 aria-pressed:text-cream"
            onClick={() => setFilter(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {visibleDishes.map((dish) => {
          const missingPrice = dish.priceCents <= 0 || !dish.priceLabel;
          const missingDescription = !dish.description;
          const missingPhoto = !dish.hasPhoto;
          return (
            <article
              key={dish.id}
              data-admin-dish-row={dish.id}
              data-available={dish.available}
              data-immersive={dish.hasImmersive}
              data-missing-description={missingDescription}
              data-missing-photo={missingPhoto}
              data-missing-price={missingPrice}
              className="grid min-w-0 gap-4 rounded-[13px] border border-white/[0.12] bg-black/[0.09] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 font-semibold text-cream [overflow-wrap:anywhere]">
                    {dish.name}
                  </h3>
                  <span className="rounded-full border border-white/15 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-[#c8b9a3]">
                    {dish.available ? "Disponible" : "Indisponible"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#a99a86] [overflow-wrap:anywhere]">
                  {dish.category} · {dish.priceLabel || "Prix manquant"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#897b69]">
                  {missingDescription ? <span>Description manquante</span> : null}
                  {missingPhoto ? <span>Photo manquante</span> : null}
                  {dish.hasImmersive ? <span>3D/AR</span> : null}
                </div>
              </div>
              <AdminDishAvailabilityControl
                dishId={dish.id}
                dishName={dish.name}
                initialAvailable={dish.available}
                onAvailabilityChange={(available) =>
                  setAvailability((current) => ({ ...current, [dish.id]: available }))
                }
              />
            </article>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">{visibleDishes.length} résultat{visibleDishes.length > 1 ? "s" : ""} affiché{visibleDishes.length > 1 ? "s" : ""}.</p>
      {visibleDishes.length === 0 ? (
        <p role="status" aria-live="polite" className="mt-4 rounded-[13px] border border-white/10 bg-black/[0.08] p-4 text-sm text-[#b9aa95]">
          Aucun plat ne correspond à ce filtre.
        </p>
      ) : null}
    </section>
  );
}
