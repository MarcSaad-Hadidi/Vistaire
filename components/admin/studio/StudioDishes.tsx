"use client";
import { useStudioLocale } from "./studioLocale";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, SlidersHorizontal } from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { resolveAvailabilityForSource } from "../availability/availabilityMutation";
import { AdminDishThumbnail } from "../AdminDishThumbnail";
import styles from "./Studio.module.css";
import dishesStyles from "./StudioDishes.module.css";
import {
  StudioSearch,
  StudioCombobox,
  StudioSwitch,
  StudioCheckbox,
  StudioToast,
} from "./StudioControls";

export function StudioDishes({
  data,
  canWrite,
  demo = false,
  onDish,
  onSchedule,
  onPlanning,
}: {
  data: AdminDashboardData;
  canWrite: boolean;
  demo?: boolean;
  onDish: (dish: AdminMenuDish) => void;
  onSchedule: (dish: AdminMenuDish) => void;
  onPlanning: () => void;
}) {
  const { t, locale, number } = useStudioLocale();
  const router = useRouter();
  const percent = new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const [committed, setCommitted] = useState<
    Record<
      string,
      { base: boolean; value: boolean; source: AdminDashboardData }
    >
  >({});
  const lock = useRef(false);
  const live = useRef(true);
  const source = useRef(data);
  useEffect(() => {
    source.current = data;
  }, [data]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const available = (dish: AdminMenuDish) =>
    resolveAvailabilityForSource(
      dish.available,
      data,
      committed[dish.id]?.source,
      committed[dish.id],
    );
  const availableCount = data.menu.dishes.filter(available).length;
  // A partial statistics payload cannot establish the menu's share of views.
  const totalViews = data.menu.dishes.every(
    (dish) => data.dishStatistics?.[dish.id] != null,
  )
    ? data.menu.dishes.reduce(
        (total, dish) => total + data.dishStatistics![dish.id].views,
        0,
      )
    : null;
  const visible = data.menu.dishes
    .filter(
      (dish) =>
        (!query ||
          `${dish.name} ${dish.category}`
            .toLocaleLowerCase("fr-CA")
            .includes(query.toLocaleLowerCase("fr-CA"))) &&
        (!category || dish.category === category) &&
        (status === "all" ||
          (status === "available" ? available(dish) : !available(dish))),
    )
    .sort(
      (a, b) =>
        (data.dishStatistics?.[b.id]?.views ?? -1) -
        (data.dishStatistics?.[a.id]?.views ?? -1),
    );
  const picked = selected.filter((id) =>
    visible.some((dish) => dish.id === id),
  );
  const all = visible.length > 0 && picked.length === visible.length;
  async function update(dishes: AdminMenuDish[], value: boolean) {
    if (lock.current || !canWrite) return;
    lock.current = true;
    setPending(true);
    setFeedback("");
    setError(false);
    const initial = source.current;
    let succeeded = 0;
    const failed: string[] = [];
    for (const dish of dishes) {
      try {
        const response = await fetch(
          `/admin/api/dishes/${encodeURIComponent(dish.id)}/availability`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ available: value }),
          },
        );
        const result = await response.json();
        if (
          !response.ok ||
          result.ok !== true ||
          result.dishId !== dish.id ||
          result.available !== value
        )
          throw new Error(result.error || t("Mise à jour refusée"));
        succeeded++;
        if (live.current && source.current === initial)
          setCommitted((previous) => ({
            ...previous,
            [dish.id]: { base: dish.available, value, source: initial },
          }));
      } catch {
        failed.push(dish.name);
      }
    }
    lock.current = false;
    if (!live.current) return;
    setPending(false);
    setSelected([]);
    setError(failed.length > 0);
    setFeedback(
      failed.length
        ? `${succeeded} plat(s) mis à jour. Échec pour ${failed.join(", ")}. Réessayez les plats concernés.`
        : `${succeeded} plat${succeeded > 1 ? "s" : ""} ${value ? "disponible" : "indisponible"}${succeeded > 1 ? "s" : ""}.`,
    );
    router.refresh();
  }
  return (
    <>
      {feedback && (
        <StudioToast
          message={feedback}
          error={error}
          onClose={() => setFeedback("")}
        />
      )}
      <div
        className={dishesStyles.availabilitySummary}
        data-studio-availability-summary
      >
        <button
          type="button"
          className={dishesStyles.availabilityCount}
          aria-label={
            locale === "en"
              ? "Show available dishes"
              : "Afficher les plats disponibles"
          }
          onClick={() => {
            setQuery("");
            setCategory("");
            setStatus("available");
            setSelected([]);
          }}
        >
          <strong>
            {number(availableCount)} / {number(data.menu.dishes.length)}
          </strong>
        </button>
        <div>
          <span>
            {locale === "en"
              ? "dishes available on the menu"
              : "plats disponibles dans la carte"}
          </span>
          <p>
            {locale === "en"
              ? demo
                ? "Demo · read-only availability"
                : "Current availability recorded in the menu"
              : demo
                ? "Démonstration · disponibilités en lecture seule"
                : "Disponibilités actuelles enregistrées dans le menu"}
          </p>
        </div>
        <button type="button" onClick={onPlanning}>
          {locale === "en" ? "View scheduling" : "Voir le planning"}
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
      <section
        className={`${styles.panel} ${dishesStyles.workspace}`}
        aria-label={t("Les plats")}
      >
        <div className={dishesStyles.filterBar}>
          <StudioSearch
            value={query}
            onChange={(value) => {
              setQuery(value);
              setSelected([]);
            }}
            label={t("Rechercher un plat")}
            placeholder={t("Rechercher un plat…")}
          />
          <StudioCombobox
            value={category}
            onChange={(value) => {
              setCategory(value);
              setSelected([]);
            }}
            label={t("Catégorie")}
            searchIcon
            options={[
              { value: "", label: t("Toutes les catégories") },
              ...[
                ...new Set(data.menu.dishes.map((dish) => dish.category)),
              ].map((value) => ({ value, label: value })),
            ]}
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setSelected([]);
            }}
            aria-label={t("Disponibilité")}
          >
            <option value="all">{t("Tous les plats")}</option>
            <option value="available">{t("Disponibles")}</option>
            <option value="unavailable">{t("Indisponibles")}</option>
          </select>
        </div>
        <div className={dishesStyles.selectionHead}>
          <StudioCheckbox
            checked={all}
            disabled={!visible.length || pending || !canWrite}
            label={t("Tout sélectionner")}
            onCheckedChange={() =>
              setSelected(all ? [] : visible.map((dish) => dish.id))
            }
          >
            {locale === "en"
              ? "Select displayed dishes"
              : "Sélectionner les plats affichés"}
          </StudioCheckbox>
          {picked.length > 0 && (
            <div
              className={dishesStyles.batchActions}
              aria-label={t("Actions groupées")}
            >
              <strong>
                {picked.length} {t("sélectionné")}
                {picked.length > 1 ? "s" : ""}
              </strong>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  update(
                    visible.filter((dish) => picked.includes(dish.id)),
                    true,
                  )
                }
              >
                {t("Rendre disponibles")}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  update(
                    visible.filter((dish) => picked.includes(dish.id)),
                    false,
                  )
                }
              >
                {t("Rendre indisponibles")}
              </button>
            </div>
          )}
          {totalViews != null && (
            <span>
              {locale === "en" ? "Sorted by views" : "Triés par consultations"}
            </span>
          )}
          <span
            className={dishesStyles.srOnly}
            role="status"
            aria-live="polite"
          >
            {number(visible.length)}{" "}
            {locale === "en" ? "dishes displayed" : "plats affichés"}
          </span>
        </div>
        {!visible.length ? (
          <div className={styles.empty}>
            <SlidersHorizontal size={25} />
            <strong role="status">{t("Aucun plat trouvé")}</strong>
            <p>{t("Essayez une autre recherche ou catégorie.")}</p>
            <button
              onClick={() => {
                setQuery("");
                setCategory("");
                setStatus("all");
              }}
            >
              {t("Effacer les filtres")}
            </button>
          </div>
        ) : (
          visible.map((dish) => {
            const stats = data.dishStatistics?.[dish.id];
            const isAvailable = available(dish);
            return (
              <article
                key={dish.id}
                className={dishesStyles.dishRow}
                id={`dish-${dish.id}`}
                data-admin-menu-dish
                data-dish-id={dish.id}
                data-category-id={dish.categorySlug ?? dish.category}
                data-available={isAvailable}
              >
                <div className={dishesStyles.dishSelect}>
                  <StudioCheckbox
                    checked={picked.includes(dish.id)}
                    disabled={pending || !canWrite}
                    label={`${locale === "en" ? "Select" : "Sélectionner"} ${dish.name}`}
                    onCheckedChange={() =>
                      setSelected((previous) =>
                        previous.includes(dish.id)
                          ? previous.filter((id) => id !== dish.id)
                          : [...previous, dish.id],
                      )
                    }
                  />
                </div>
                <div className={dishesStyles.dishIdentity}>
                  <AdminDishThumbnail
                    name={dish.name}
                    thumbnailUrl={dish.thumbnailUrl}
                    imageUrl={dish.imageUrl}
                    compact
                    sizes="45px"
                  />
                  <div>
                    <h3>
                      <button
                        className={dishesStyles.dishName}
                        onClick={() =>
                          onDish({ ...dish, available: isAvailable })
                        }
                      >
                        {dish.name}
                      </button>
                    </h3>
                    <small>{dish.category}</small>
                  </div>
                </div>
                <dl className={dishesStyles.dishStats}>
                  <div>
                    <dt>{t("Consultations")}</dt>
                    <dd>{number(stats?.views)}</dd>
                  </div>
                  <div>
                    <dt>{t("Évolution")}</dt>
                    <dd
                      className={dishesStyles.delta}
                      data-direction={
                        stats?.changeRate == null
                          ? "neutral"
                          : stats.changeRate > 0
                            ? "up"
                            : stats.changeRate < 0
                              ? "down"
                              : "neutral"
                      }
                    >
                      {stats?.changeRate == null
                        ? "N/A"
                        : `${stats.changeRate > 0 ? "↗ +" : stats.changeRate < 0 ? "↘ " : ""}${percent.format(stats.changeRate)}`}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {locale === "en" ? "Share of views" : "Part des vues"}
                    </dt>
                    <dd>
                      {stats && totalViews != null && totalViews > 0
                        ? percent.format(stats.views / totalViews)
                        : "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Clics 3D")}</dt>
                    <dd>{number(stats?.three)}</dd>
                  </div>
                  <div>
                    <dt>{t("Clics AR")}</dt>
                    <dd>{number(stats?.ar)}</dd>
                  </div>
                </dl>
                <div className={dishesStyles.dishAvailability}>
                  <div>
                    <span
                      className={dishesStyles.status}
                      data-status={isAvailable ? "available" : "unavailable"}
                    >
                      {isAvailable ? t("Disponible") : t("Indisponible")}
                    </span>
                    <p className={dishesStyles.sub}>
                      {committed[dish.id]?.source === data
                        ? t("Modifié manuellement")
                        : t("Disponibilité enregistrée")}
                    </p>
                  </div>
                  {data.schedulingStatus === "available" && (
                    <p className={dishesStyles.nextStatus}>
                      {locale === "en"
                        ? "A manual change takes priority over schedules"
                        : "Une modification manuelle prime sur les horaires"}
                    </p>
                  )}
                  <div className={dishesStyles.dishControls}>
                    <StudioSwitch
                      checked={isAvailable}
                      disabled={pending || !canWrite}
                      label={`${locale === "en" ? "Availability of" : "Disponibilité de"} ${dish.name}`}
                      onCheckedChange={(value) => update([dish], value)}
                    />
                    <button disabled={pending} onClick={() => onSchedule(dish)}>
                      <CalendarClock size={15} />
                      {t("Planifier")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>
      {!canWrite && (
        <p className={dishesStyles.notice}>
          {t(
            demo
              ? "Cette démonstration ne modifie aucun restaurant. Les disponibilités sont en lecture seule."
              : "Accès en lecture seule. Un QR admin autorisé est nécessaire pour modifier les plats.",
          )}
        </p>
      )}
    </>
  );
}
