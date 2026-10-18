"use client";
import { useStudioLocale } from "./studioLocale";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, SlidersHorizontal } from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { resolveAvailabilityForSource } from "../availability/availabilityMutation";
import { AdminDishThumbnail } from "../AdminDishThumbnail";
import styles from "./Studio.module.css";
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
}: {
  data: AdminDashboardData;
  canWrite: boolean;
  demo?: boolean;
  onDish: (dish: AdminMenuDish) => void;
  onSchedule: (dish: AdminMenuDish) => void;
}) {
  const { t, locale, number } = useStudioLocale();
  const router = useRouter();
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
  const visible = data.menu.dishes.filter(
    (dish) =>
      (!query ||
        `${dish.name} ${dish.category}`
          .toLocaleLowerCase("fr-CA")
          .includes(query.toLocaleLowerCase("fr-CA"))) &&
      (!category || dish.category === category) &&
      (status === "all" ||
        (status === "available" ? available(dish) : !available(dish))),
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
      {!canWrite && (
        <p className={styles.notice}>
          {t(
            demo
              ? "Cette démonstration ne modifie aucun restaurant. Les disponibilités sont en lecture seule."
              : "Accès en lecture seule. Un QR admin autorisé est nécessaire pour modifier les plats.",
          )}
        </p>
      )}
      {feedback && (
        <StudioToast
          message={feedback}
          error={error}
          onClose={() => setFeedback("")}
        />
      )}
      <section className={styles.panel} aria-label={t("Les plats")}>
        <div className={styles.filterBar}>
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
            options={[
              { value: "", label: t("Toutes les catégories") },
              ...[
                ...new Set(data.menu.dishes.map((dish) => dish.category)),
              ].map((value) => ({ value, label: value })),
            ]}
          />
          <StudioCombobox
            value={status}
            onChange={(value) => {
              setStatus(value);
              setSelected([]);
            }}
            label={t("Disponibilité")}
            options={[
              { value: "all", label: t("Tous les plats") },
              { value: "available", label: t("Disponibles") },
              { value: "unavailable", label: t("Indisponibles") },
            ]}
          />
        </div>
        <div className={styles.selectionHead}>
          <StudioCheckbox
            checked={all}
            disabled={!visible.length || pending || !canWrite}
            label={t("Tout sélectionner")}
            onCheckedChange={() =>
              setSelected(all ? [] : visible.map((dish) => dish.id))
            }
          >
            {t("Tout sélectionner")}{" "}
            <span role="status" aria-live="polite">
              ({visible.length})
            </span>
          </StudioCheckbox>
          {picked.length > 0 && (
            <div
              className={styles.batchActions}
              aria-label={t("Actions groupées")}
            >
              <strong>
                {picked.length}
                {t("sélectionné")}
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
                className={styles.dishRow}
                data-admin-menu-dish
                data-dish-id={dish.id}
                data-category-id={dish.categorySlug ?? dish.category}
                data-available={isAvailable}
              >
                <div className={styles.dishSelect}>
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
                <div className={styles.dishIdentity}>
                  <AdminDishThumbnail
                    name={dish.name}
                    thumbnailUrl={dish.thumbnailUrl}
                    imageUrl={dish.imageUrl}
                    compact
                    sizes="48px"
                  />
                  <div>
                    <h3>
                      <button
                        className={styles.dishName}
                        onClick={() =>
                          onDish({ ...dish, available: isAvailable })
                        }
                      >
                        {dish.name}
                      </button>
                    </h3>
                    <small>
                      {dish.category} · {dish.priceLabel}
                    </small>
                  </div>
                </div>
                <dl className={styles.dishStats}>
                  <div>
                    <dt>{t("Consultations")}</dt>
                    <dd>
                      {number(stats?.views)}
                      <small
                        className={styles.delta}
                        data-direction={
                          stats?.changeRate == null
                            ? "neutral"
                            : stats.changeRate >= 0
                              ? "up"
                              : "down"
                        }
                      >
                        {stats?.changeRate == null
                          ? t("Évolution N/A")
                          : `${stats.changeRate > 0 ? "+" : ""}${Math.round(stats.changeRate * 100)} %`}
                      </small>
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
                <div className={styles.dishAvailability}>
                  <div>
                    <span
                      className={styles.status}
                      data-status={isAvailable ? "available" : "unavailable"}
                    >
                      {isAvailable ? t("Disponible") : t("Indisponible")}
                    </span>
                    <small className={styles.muted}>
                      {committed[dish.id]?.source === data
                        ? t("Modifié manuellement")
                        : t("Disponibilité enregistrée")}
                    </small>
                  </div>
                  <div className={styles.dishControls}>
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
    </>
  );
}
