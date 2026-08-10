"use client";

import { useMemo, useState } from "react";
import { AdminStatusBadge, AdminToggle } from "@/components/admin/system/AdminPresentationPrimitives";
import type { RestaurateurPreviewCopy } from "@/lib/restaurateurPreview/copy";
import type { RestaurateurPreviewFixture, RestaurateurPreviewLocale } from "@/lib/restaurateurPreview/types";
import { PublicPreviewDishImage } from "./PublicPreviewDishImage";
import styles from "./VistaireRestaurateurDashboardPreview.module.css";

type AvailabilityFilter = "all" | "available" | "unavailable";

export function RestaurateurPreviewAvailability({
  availableById,
  copy,
  fixture,
  locale,
  onToggle
}: {
  availableById: Record<string, boolean>;
  copy: RestaurateurPreviewCopy;
  fixture: RestaurateurPreviewFixture;
  locale: RestaurateurPreviewLocale;
  onToggle: (dishId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AvailabilityFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase(locale === "fr" ? "fr-CA" : "en-CA");
  const categoryMap = useMemo(() => new Map(fixture.categories.map((category) => [category.id, category])), [fixture.categories]);
  const availableCount = Object.values(availableById).filter(Boolean).length;
  const number = new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" });

  return (
    <section className={styles.availabilityPage} aria-labelledby="demo-availability-title">
      <header className={styles.availabilityHeader}>
        <div>
          <p>{copy.availabilityEyebrow}</p>
          <h2 id="demo-availability-title">{copy.availabilityTitle}</h2>
          <span>{copy.availabilityBody}</span>
        </div>
        <div className={styles.availabilityMetrics}>
          {[
            ["total", copy.totalDishes, fixture.dishes.length],
            ["available", copy.availableDishes, availableCount],
            ["unavailable", copy.unavailableDishes, fixture.dishes.length - availableCount]
          ].map(([id, label, value]) => (
            <article data-demo-availability-metric={id} key={id}>
              <span>{label}</span><strong>{value}</strong>
            </article>
          ))}
        </div>
      </header>
      <div className={styles.availabilityControls}>
        <label>
          <span>{copy.searchLabel}</span>
          <input aria-label={copy.searchLabel} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} type="search" value={query} />
        </label>
        <div aria-label={copy.filtersLabel} className={styles.filters} role="group">
          {(["all", "available", "unavailable"] as AvailabilityFilter[]).map((id) => (
            <button aria-pressed={filter === id} data-demo-filter={id} key={id} onClick={() => setFilter(id)} type="button">{copy.filters[id]}</button>
          ))}
        </div>
      </div>
      <div className={styles.dishList}>
        {fixture.dishes.map((dish) => {
          const isAvailable = availableById[dish.id];
          const name = locale === "fr" ? dish.name : dish.nameEn;
          const category = categoryMap.get(dish.categoryId)!;
          const matchesQuery = !normalizedQuery || `${name} ${category.label[locale]}`.toLocaleLowerCase(locale === "fr" ? "fr-CA" : "en-CA").includes(normalizedQuery);
          const matchesFilter = filter === "all" || (filter === "available" ? isAvailable : !isAvailable);
          const visible = matchesQuery && matchesFilter;
          return (
            <article data-available={isAvailable} data-demo-dish hidden={!visible} key={dish.id}>
              <PublicPreviewDishImage alt="" sizes="72px" src={dish.imageSrc} />
              <div className={styles.dishIdentity}>
                <h3>{name}</h3>
                <p>{category.label[locale]}</p>
              </div>
              <strong className={styles.dishPrice}>{number.format(dish.priceCents / 100)}</strong>
              <AdminStatusBadge tone={isAvailable ? "available" : "unavailable"}>{isAvailable ? copy.available : copy.unavailable}</AdminStatusBadge>
              <AdminToggle checked={isAvailable} label={(isAvailable ? copy.toggleOn : copy.toggleOff).replace("{dish}", name)} onClick={() => onToggle(dish.id)} />
            </article>
          );
        })}
        <p className={styles.emptyState} hidden={fixture.dishes.some((dish) => {
          const name = locale === "fr" ? dish.name : dish.nameEn;
          const category = categoryMap.get(dish.categoryId)!;
          const isAvailable = availableById[dish.id];
          return (!normalizedQuery || `${name} ${category.label[locale]}`.toLocaleLowerCase(locale === "fr" ? "fr-CA" : "en-CA").includes(normalizedQuery)) && (filter === "all" || (filter === "available" ? isAvailable : !isAvailable));
        })}>{copy.noDishes}</p>
      </div>
    </section>
  );
}
