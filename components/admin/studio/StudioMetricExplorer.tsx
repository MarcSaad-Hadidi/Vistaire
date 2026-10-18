"use client";
/** Approved Sauge Noire v29 metric explorer (Nee / mx-*), recovered from
 * https://sauge-noire-dashboard-demo.plumtuna4.chatgpt.site/.
 * Presentation only: existing server aggregates, never the reference demo model.
 */
import { useState } from "react";
import { ArrowRight, ArrowUpDown } from "lucide-react";
import type { AdminMetricSeriesId } from "@/lib/admin/analyticsState";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { StudioMetricTabs } from "./StudioControls";
import { StudioNumber } from "./StudioNumber";
import { StudioTrend } from "./StudioCharts";
import { useStudioLocale } from "./studioLocale";
import styles from "./Studio.module.css";
import css from "./StudioMetricExplorer.module.css";

type Sort = "delta" | "current";
const labels: Record<AdminMetricSeriesId, string> = {
  dishOpened: "Consultations de plats",
  three: "Clics 3D",
  ar: "Clics AR",
  menuOpened: "Ouvertures du menu",
  searches: "Recherches",
  immersive: "Clics 3D et AR",
};
const sumKnown = (values: (number | null)[]) =>
  values.length && values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + value!, 0)
    : null;
const deltaTone = (value: number | null) =>
  value === null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";

/** Temporal totals remain menu-wide. Dish history is available only for views. */
export function createStudioMetricExplorerData(
  data: AdminDashboardData,
  metric: AdminMetricSeriesId,
  sort: Sort = "delta",
) {
  const real = data.analytics.kind === "real" ? data.analytics : null;
  if (!real || real.panels.currentDaily.kind !== "supported") return null;
  const source = real.metricSeries[metric];
  if (!source.current.length) return null;
  const comparisonAvailable =
    real.panels.dailyComparison.kind === "supported" &&
    source.previous.length === source.current.length;
  const series = { ...source, previous: comparisonAvailable ? source.previous : [] };
  const total = series.current.reduce((sum, point) => sum + point.value, 0);
  const previous = comparisonAvailable
    ? series.previous.reduce((sum, point) => sum + point.value, 0)
    : null;
  const delta = previous === null ? null : total - previous;
  const categories = [...new Set(data.menu.dishes.map((dish) => dish.category))];
  const dishes =
    metric !== "menuOpened" && metric !== "searches" &&
    real.panels.ranking.kind === "supported" && data.dishStatistics
      ? data.menu.dishes.map((dish) => {
          const stats = data.dishStatistics?.[dish.id];
          const current = stats
            ? metric === "dishOpened" ? stats.views
              : metric === "immersive" ? stats.three + stats.ar
                : stats[metric as "three" | "ar"]
            : null;
          const prior = comparisonAvailable && metric === "dishOpened"
            ? (stats?.previousViews ?? null) : null;
          return {
            dish,
            current,
            previous: prior,
            delta: current === null || prior === null ? null : current - prior,
            color: `var(--chart-category-${categories.indexOf(dish.category) % 6})`,
          };
        })
      : [];
  const dishComparisonAvailable = dishes.some((dish) => dish.delta !== null);
  const value = (row: (typeof dishes)[number]) =>
    sort === "delta" && dishComparisonAvailable
      ? row.delta === null ? -Infinity : Math.abs(row.delta)
      : (row.current ?? -Infinity);
  dishes.sort((a, b) => value(b) - value(a) || a.dish.name.localeCompare(b.dish.name));
  const dishCurrent = sumKnown(dishes.map((row) => row.current));
  const dishPrevious = sumKnown(dishes.map((row) => row.previous));
  return {
    metric,
    total,
    previous,
    delta,
    deltaPercent: delta === null || previous === 0 || previous === null ? null : delta / previous * 100,
    length: series.current.length,
    from: series.current[0].bucket,
    to: series.current.at(-1)!.bucket,
    previousFrom: series.previous[0]?.bucket ?? null,
    previousTo: series.previous.at(-1)?.bucket ?? null,
    comparisonAvailable,
    dishComparisonAvailable,
    series,
    dishes,
    dishTotals: {
      current: dishCurrent,
      previous: dishPrevious,
      delta: dishCurrent === null || dishPrevious === null ? null : dishCurrent - dishPrevious,
    },
  };
}

export function StudioMetricExplorer({
  data,
  initialMetric,
  onDishOpen,
}: {
  data: AdminDashboardData;
  initialMetric: AdminMetricSeriesId;
  onDishOpen: (dish: AdminMenuDish) => void;
}) {
  const { t, locale, number, date } = useStudioLocale();
  const text = (fr: string, en: string) => locale === "en" ? en : fr;
  const [metric, setMetric] = useState(initialMetric);
  const [sort, setSort] = useState<Sort>("delta");
  const selected = createStudioMetricExplorerData(data, metric, sort);
  if (!selected) return (
    <div className={css.explorer} role="status">
      <p>{t(data.analytics.kind === "unavailable" ? "Données indisponibles" : "Pas encore assez de données")}</p>
    </div>
  );
  const format = (value: number | null) => number(value ?? undefined);
  const difference = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : ""}${number(value)}`;
  const roundedPercent = selected.deltaPercent === null
    ? null : Math.sign(selected.deltaPercent) * Math.round(Math.abs(selected.deltaPercent) * 10) / 10;
  const percent = roundedPercent === null ? "N/A"
    : `${roundedPercent > 0 ? "+" : ""}${new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { maximumFractionDigits: 1 }).format(roundedPercent)} %`;
  const options = [
    { value: "dishOpened", label: t("Consultations") },
    { value: "three", label: "3D" },
    { value: "ar", label: "AR" },
    { value: "menuOpened", label: "Menu" },
    { value: "searches", label: t("Recherches") },
    ...(initialMetric === "immersive" ? [{ value: "immersive", label: "3D + AR" }] : []),
  ];
  const largestChange = [...selected.dishes]
    .filter((row) => row.delta !== null && row.delta !== 0)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))[0];
  const method = {
    menuOpened: text("Les ouvertures du menu ne sont pas attribuées aux plats.", "Menu opens are not attributed to dishes."),
    searches: text("Les recherches ne sont pas attribuées aux plats.", "Searches are not attributed to dishes."),
    three: text("Les clics 3D comptent des actions sur le bouton, sans garantir le chargement de l’expérience.", "3D clicks count button actions without guaranteeing the experience loaded."),
    ar: text("Les clics AR comptent des actions sur le bouton de réalité augmentée.", "AR clicks count actions on the augmented reality button."),
    dishOpened: text("Une consultation correspond à l’ouverture d’une fiche de plat.", "A view corresponds to opening a dish detail."),
    immersive: text("Les clics 3D et AR comptent les actions sur les deux boutons, sans garantir le chargement de l’expérience.", "3D and AR clicks count actions on both buttons without guaranteeing the experience loaded."),
  }[metric];
  return (
    <div className={css.explorer} data-studio-metric-explorer={metric}>
      <div className={css.context}>
        <span>{text("Menu entier · UTC", "Entire menu · UTC")}</span>
        <span>{date(selected.from)} – {date(selected.to)}</span>
      </div>
      <StudioMetricTabs
        label={text("Mesure à explorer", "Metric to explore")}
        value={metric}
        onChange={(value) => setMetric(value as AdminMetricSeriesId)}
        options={options}
      />
      <section className={css.summary} aria-label={text("Comparaison de périodes", "Period comparison")}>
        <div className={css.total}>
          <span>{t(labels[metric])}</span>
          <strong><StudioNumber value={selected.total} /></strong>
          <span>{selected.length} {text(selected.length === 1 ? "jour" : "jours", selected.length === 1 ? "day" : "days")} · {text("données du menu", "menu data")}</span>
        </div>
        <div>
          <span>{t("Période précédente")}</span>
          <strong>{format(selected.previous)}</strong>
          <span>{selected.previousFrom && selected.previousTo
            ? `${date(selected.previousFrom)} – ${date(selected.previousTo)}`
            : text("Historique précédent indisponible", "Previous history unavailable")}</span>
        </div>
        <div>
          <span>{text("Écart exact", "Exact difference")}</span>
          <strong data-delta={deltaTone(selected.delta)}>{difference(selected.delta)}</strong>
          <span data-delta={deltaTone(roundedPercent)}>{percent}</span>
        </div>
      </section>
      <section className={`${styles.panel} ${css.trend}`} aria-label={text("Évolution de la mesure sélectionnée", "Selected metric trend")}>
        <StudioTrend key={metric} series={selected.series} label={t(labels[metric])} comparison={selected.comparisonAvailable} />
      </section>
      {selected.dishes.length > 0 && (
        <section className={`${styles.panel} ${css.contribution}`} aria-label={text("Contributions des plats", "Dish contributions")}>
          <header>
            <div>
              <span className={css.overline}>{selected.dishComparisonAvailable
                ? text("COMPRENDRE LA VARIATION", "UNDERSTAND THE CHANGE")
                : text("DÉTAIL DE LA MESURE", "METRIC BREAKDOWN")}</span>
              <h3>{selected.dishComparisonAvailable
                ? text("D’où vient l’écart ?", "Where is the difference?")
                : text("L’activité par plat", "Activity by dish")}</h3>
            </div>
            <label className={css.sort}>
              <ArrowUpDown size={15} aria-hidden />
              <span className={styles.srOnly}>{text("Trier les contributions", "Sort contributions")}</span>
              <select value={selected.dishComparisonAvailable ? sort : "current"} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="delta" disabled={!selected.dishComparisonAvailable}>{text("Par variation", "By change")}</option>
                <option value="current">{text("Par volume actuel", "By current volume")}</option>
              </select>
            </label>
          </header>
          <p className={css.narrative}>
            {t(labels[metric])} : {number(selected.total)}{selected.delta !== null
              ? <> · <span data-delta={deltaTone(selected.delta)}>{difference(selected.delta)}</span> {text("par rapport à la période précédente", "compared with the previous period")}</>
              : <> · {text("comparaison précédente indisponible", "previous comparison unavailable")}</>}.
            {largestChange && <> {text("Plus grand écart absolu parmi les plats affichés", "Largest absolute change among displayed dishes")} : {largestChange.dish.name} (<span data-delta={deltaTone(largestChange.delta)}>{difference(largestChange.delta)}</span>).</>}
            {!selected.dishComparisonAvailable && <> {text("L’historique par plat n’est pas disponible pour cette mesure.", "Dish-level history is unavailable for this metric.")}</>}
            {" "}{text("Le tableau couvre les plats actuels du menu ; son total peut différer du total de la période.", "The table covers current menu dishes; its total may differ from the period total.")}
          </p>
          <div className={css.tableWrap}>
            <table className={css.table}>
              <thead><tr>
                <th scope="col">{t("Plat")}</th>
                <th scope="col">{t("Actuel")}</th>
                <th scope="col">{t("Précédent")}</th>
                <th scope="col">{text("Écart", "Difference")}</th>
              </tr></thead>
              <tbody>{selected.dishes.map((row) => (
                <tr key={row.dish.id}>
                  <th scope="row"><button type="button" onClick={() => onDishOpen(row.dish)}>
                    <i aria-hidden style={{ background: row.color }} />
                    <span>{row.dish.name}<small>{row.dish.category}</small></span>
                    <ArrowRight size={15} aria-hidden />
                  </button></th>
                  <td data-label={t("Actuel")}>{format(row.current)}</td>
                  <td data-label={t("Précédent")}>{format(row.previous)}</td>
                  <td data-label={text("Écart", "Difference")}><b data-delta={deltaTone(row.delta)}>{difference(row.delta)}</b></td>
                </tr>
              ))}</tbody>
              <tfoot><tr>
                <th scope="row">{text("Total des plats affichés", "Displayed dish total")}</th>
                <td>{format(selected.dishTotals.current)}</td>
                <td>{format(selected.dishTotals.previous)}</td>
                <td><span data-delta={deltaTone(selected.dishTotals.delta)}>{difference(selected.dishTotals.delta)}</span></td>
              </tr></tfoot>
            </table>
          </div>
        </section>
      )}
      <details className={css.method}>
        <summary>{text("À propos de cette mesure", "About this metric")}</summary>
        <p>{method} {text("Les chiffres sont des événements, sans mesure de visiteurs uniques ni de ventes. Un écart est une différence entre périodes, pas une explication causale. Les périodes et l’évolution sont celles du menu entier, en UTC. Les comparaisons non étayées restent N/A.", "Figures count events, not unique visitors or sales. A difference between periods is not a causal explanation. Periods and trends cover the entire menu, in UTC. Unsupported comparisons remain N/A.")}</p>
      </details>
    </div>
  );
}
