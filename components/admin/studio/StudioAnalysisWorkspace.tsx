"use client";
import { useState, type ReactNode } from "react";
import {
  BarChart,
  BarSeries,
  Root,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type SeriesConfig,
} from "@kind-ui/charts";
import { ArrowUpRight, ChartNoAxesCombined, Table2 } from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { StudioTrend, StudioHeatmap } from "./StudioCharts";
import {
  StudioAnalysisCharts,
  type StudioAnalysisMetric,
} from "./StudioAnalysisCharts";
import { StudioCombobox, StudioMetricTabs } from "./StudioControls";
import { useStudioLocale } from "./studioLocale";
import styles from "./Studio.module.css";
import css from "./StudioAnalysisWorkspace.module.css";

type BarRow = {
  id: string;
  name: string;
  value: number;
  three?: number;
  ar?: number;
};
function AnalysisBars({
  rows,
  label,
  immersive = false,
  onSelect,
  horizontal = false,
}: {
  rows: BarRow[];
  label: string;
  immersive?: boolean;
  horizontal?: boolean;
  onSelect?: (id: string) => void;
}) {
  const { t, number, locale } = useStudioLocale();
  const config: SeriesConfig = immersive
    ? {
        three: { label: t("Clics 3D"), color: "var(--chart-three)" },
        ar: { label: t("Clics AR"), color: "var(--chart-ar)" },
      }
    : { value: { label, color: "var(--chart-current)" } };
  const act = (row: BarRow) => onSelect?.(row.id);
  return (
    <div className={styles.chart}>
      <Root config={config}>
        <BarChart
          data={rows}
          responsive
          height={horizontal ? Math.max(240, rows.length * 44) : 270}
          layout={horizontal ? "vertical" : "horizontal"}
          animate={{ revealDurationMs: 550 }}
          accessibilityLayer
          aria-label={label}
          margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid
            horizontal={!horizontal}
            vertical={horizontal}
            stroke="var(--line)"
            strokeDasharray="2 5"
          />
          <XAxis
            type={horizontal ? "number" : "category"}
            {...(horizontal
              ? { domain: [0, "auto"] as [number, "auto"] }
              : { dataKey: "name" })}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type={horizontal ? "category" : "number"}
            {...(horizontal
              ? {
                  dataKey: "name",
                  width: 105,
                  tickFormatter: (name: string) =>
                    name.length > 17 ? name.slice(0, 16) + "…" : name,
                }
              : { width: 40 })}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as BarRow | undefined;
              return active && row ? (
                <div className={css.tooltip}>
                  <strong>{row.name}</strong>
                  {immersive ? (
                    <>
                      <div>
                        <span>{t("Clics 3D")}</span>
                        <b>{number(row.three)}</b>
                      </div>
                      <div>
                        <span>{t("Clics AR")}</span>
                        <b>{number(row.ar)}</b>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span>{label}</span>
                      <b>{number(row.value)}</b>
                    </div>
                  )}
                </div>
              ) : null;
            }}
          />
          {immersive ? (
            <>
              <BarSeries
                dataKey="three"
                stackId="immersive"
                maxBarSize={20}
                onClick={(row) => {
                  const source = row.payload as BarRow | undefined;
                  if (source) act(source);
                }}
              />
              <BarSeries
                dataKey="ar"
                stackId="immersive"
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={20}
                onClick={(row) => {
                  const source = row.payload as BarRow | undefined;
                  if (source) act(source);
                }}
              />
            </>
          ) : (
            <BarSeries
              dataKey="value"
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={28}
              onClick={(row) => {
                const source = row.payload as BarRow | undefined;
                if (source) act(source);
              }}
            />
          )}
        </BarChart>
        {immersive && <Legend />}
      </Root>
      <details className={styles.dataDisclosure}>
        <summary>{t("Voir les chiffres")}</summary>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{locale === "en" ? "Item" : "Élément"}</th>
                {immersive ? (
                  <>
                    <th>{t("Clics 3D")}</th>
                    <th>{t("Clics AR")}</th>
                  </>
                ) : (
                  <th>{label}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {onSelect ? (
                      <button onClick={() => act(row)}>
                        {row.name}
                        <ArrowUpRight size={12} />
                      </button>
                    ) : (
                      row.name
                    )}
                  </td>
                  {immersive ? (
                    <>
                      <td>{number(row.three)}</td>
                      <td>{number(row.ar)}</td>
                    </>
                  ) : (
                    <td>{number(row.value)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function AnalysisPanel({
  index,
  title,
  eyebrow,
  children,
  span = 6,
}: {
  index: string;
  title: string;
  eyebrow: string;
  children: ReactNode;
  span?: 4 | 6 | 8 | 12;
}) {
  return (
    <section className={`${styles.panel} ${css.panel}`} data-span={span}>
      <header className={styles.panelHead}>
        <div>
          <p className={css.eyebrow}>
            {index} / {eyebrow}
          </p>
          <h2>{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

export function StudioAnalysisWorkspace({
  data,
  onDishOpen,
}: {
  data: AdminDashboardData;
  onDishOpen?: (dish: AdminMenuDish) => void;
}) {
  const { t, locale, number, date } = useStudioLocale();
  const [category, setCategory] = useState("all");
  const [metric, setMetric] = useState<StudioAnalysisMetric>("views");
  const [view, setView] = useState<"charts" | "table">("charts");
  const real = data.analytics.kind === "real" ? data.analytics : null;
  const hasRanking =
    real?.panels.ranking.kind === "supported" && Boolean(data.dishStatistics);
  const categories = [
    ...new Set(data.menu.dishes.map((dish) => dish.category)),
  ];
  const dishes = hasRanking
    ? data.menu.dishes.flatMap((dish) => {
        const stats = data.dishStatistics?.[dish.id];
        return stats && (category === "all" || dish.category === category)
          ? [{ ...dish, ...stats }]
          : [];
      })
    : [];
  const labels = {
    views: t("Consultations"),
    three: t("Clics 3D"),
    ar: t("Clics AR"),
  };
  const metricSeries = metric === "views" ? "dishOpened" : metric;
  const totals = dishes.reduce(
    (sum, dish) => ({
      views: sum.views + dish.views,
      three: sum.three + dish.three,
      ar: sum.ar + dish.ar,
    }),
    { views: 0, three: 0, ar: 0 },
  );
  const ranked = [...dishes].sort((a, b) => b[metric] - a[metric]);
  const top = ranked[0];
  const heatmap =
    real?.panels.hourWeekday.kind === "supported"
      ? real.panels.hourWeekday.data
      : null;
  const weekdays =
    locale === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const dayRows = heatmap
    ? weekdays.map((name, index) => ({
        id: String(index),
        name,
        value: heatmap
          .filter((cell) => cell.weekdayUtc === (index + 1) % 7)
          .reduce((sum, cell) => sum + cell.count, 0),
      }))
    : [];
  const hourRows = heatmap
    ? Array.from({ length: 12 }, (_, index) => ({
        id: String(index * 2),
        name: `${index * 2} h`,
        value: heatmap
          .filter(
            (cell) => cell.hourUtc >= index * 2 && cell.hourUtc < index * 2 + 2,
          )
          .reduce((sum, cell) => sum + cell.count, 0),
      }))
    : [];
  const globalScope =
    locale === "en"
      ? "Entire menu · all recorded events · UTC"
      : "Menu entier · tous les événements enregistrés · UTC";
  const open = (id: string) => {
    const dish = data.menu.dishes.find((item) => item.id === id);
    if (dish) onDishOpen?.(dish);
  };
  if (!real)
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>
          <h2>
            {t(
              data.analytics.kind === "unavailable"
                ? "Données indisponibles"
                : "Pas encore assez de données",
            )}
          </h2>
          <p>
            {t(
              data.analytics.kind === "unavailable"
                ? "La lecture est incomplète. Réessayez plus tard ; aucun chiffre partiel n’est présenté comme un total."
                : "Les premiers chiffres apparaîtront lorsque suffisamment de consultations auront été enregistrées.",
            )}
          </p>
        </div>
      </section>
    );
  return (
    <div className={css.workspace}>
      <div className={css.filters}>
        {hasRanking && (
          <StudioCombobox
            value={category}
            onChange={setCategory}
            options={[
              {
                value: "all",
                label:
                  locale === "en" ? "All categories" : "Toutes les catégories",
              },
              ...categories.map((name) => ({ value: name, label: name })),
            ]}
            label={t("Catégorie")}
          />
        )}
        <StudioMetricTabs
          value={metric}
          onChange={(value) => setMetric(value as StudioAnalysisMetric)}
          options={Object.entries(labels).map(([value, label]) => ({
            value,
            label,
          }))}
          label={locale === "en" ? "Primary metric" : "Mesure principale"}
        />
        <button
          type="button"
          className={css.resetFilters}
          onClick={() => {
            setCategory("all");
            setMetric("views");
          }}
        >
          {locale === "en" ? "Reset" : "Réinitialiser"}
        </button>
        <div
          role="group"
          aria-label={
            locale === "en" ? "Analysis display" : "Affichage des analyses"
          }
          className={css.viewTabs}
        >
          <button
            type="button"
            aria-pressed={view === "charts"}
            onClick={() => setView("charts")}
          >
            <ChartNoAxesCombined size={15} />
            <span>{locale === "en" ? "Charts" : "Graphiques"}</span>
          </button>
          <button
            type="button"
            aria-pressed={view === "table"}
            onClick={() => setView("table")}
          >
            <Table2 size={15} />
            <span>{locale === "en" ? "Data" : "Données"}</span>
          </button>
        </div>
      </div>
      <p className={css.scope}>
        {locale === "en"
          ? "The category filter applies to dish and category charts. Time-based charts always cover the entire menu."
          : "Le filtre catégorie s’applique aux plats et aux catégories. Les graphiques temporels portent toujours sur le menu entier."}
      </p>
      {hasRanking && (
        <div className={css.summary}>
          {(["views", "three", "ar"] as const).map((key) => (
            <button key={key} onClick={() => setMetric(key)}>
              <span>{labels[key]}</span>
              <strong>{number(totals[key])}</strong>
              <small>
                {locale === "en" ? "Selected dishes" : "Plats sélectionnés"}
              </small>
            </button>
          ))}
          {top && (
            <button className={css.takeaway} onClick={() => onDishOpen?.(top)}>
              <span>
                {locale === "en" ? "Leading dish" : "En tête"} ·{" "}
                {labels[metric].toLowerCase()}
              </span>
              <strong>{top.name}</strong>
              <small>
                {number(top[metric])} ·{" "}
                {locale === "en" ? "View dish" : "Voir le plat"} ↗
              </small>
            </button>
          )}
        </div>
      )}
      {view === "table" && !hasRanking ? (
        <section className={styles.panel}>
          <div className={styles.empty}>
            <h2>{t("Pas encore assez de données")}</h2>
            <p>
              {locale === "en"
                ? "Dish-level statistics are not available for this period. Time-based charts remain available in Charts view."
                : "Les statistiques par plat ne sont pas disponibles pour cette période. Les graphiques temporels restent accessibles dans la vue Graphiques."}
            </p>
          </div>
        </section>
      ) : view === "table" ? (
        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <h2>
              {locale === "en"
                ? "Dishes, in numbers"
                : "Les plats, en chiffres"}
            </h2>
          </header>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("Plat")}</th>
                  <th>{t("Catégorie")}</th>
                  <th>{labels.views}</th>
                  <th>{labels.three}</th>
                  <th>{labels.ar}</th>
                  <th>
                    {t("Précédent")} · {labels.views}
                  </th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      <button onClick={() => onDishOpen?.(dish)}>
                        {dish.name}
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                    <td>{dish.category}</td>
                    <td>{number(dish.views)}</td>
                    <td>{number(dish.three)}</td>
                    <td>{number(dish.ar)}</td>
                    <td>
                      {dish.previousViews === null
                        ? "N/A"
                        : number(dish.previousViews)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={css.scope}>
            {locale === "en"
              ? "Category-filtered dish counts. Previous values are available for views only."
              : "Chiffres des plats de la catégorie sélectionnée. L’historique par plat est disponible pour les consultations uniquement."}
          </p>
        </section>
      ) : (
        <div className={css.grid}>
          <AnalysisPanel
            index="01"
            title={
              locale === "en"
                ? "How is interest changing?"
                : "Comment l’intérêt évolue-t-il ?"
            }
            eyebrow={
              locale === "en"
                ? "DAILY TREND · ENTIRE MENU"
                : "ÉVOLUTION QUOTIDIENNE · MENU ENTIER"
            }
            span={8}
          >
            <div className={css.trendTotal}>
              <strong>
                {number(
                  real.metricSeries[metricSeries].current.reduce(
                    (sum, row) => sum + row.value,
                    0,
                  ),
                )}
              </strong>
              <span>{labels[metric]}</span>
            </div>
            <div className={styles.chartBody}>
              <StudioTrend
                series={real.metricSeries[metricSeries]}
                label={labels[metric]}
                comparison={real.panels.dailyComparison.kind === "supported"}
              />
            </div>
          </AnalysisPanel>
          {hasRanking && (
            <>
              <AnalysisPanel
                index="02"
                title={
                  locale === "en"
                    ? "Which categories attract attention?"
                    : "Quelles familles attirent ?"
                }
                eyebrow={
                  locale === "en"
                    ? "CATEGORY DISTRIBUTION"
                    : "RÉPARTITION PAR CATÉGORIE"
                }
                span={4}
              >
                <StudioAnalysisCharts
                  data={data}
                  family="composition"
                  metric={metric}
                  category={category}
                  onCategoryChange={setCategory}
                />
              </AnalysisPanel>
              <AnalysisPanel
                index="03"
                title={
                  locale === "en"
                    ? "Which dishes catch the eye?"
                    : "Quels plats captent le regard ?"
                }
                eyebrow={
                  locale === "en" ? "DISH RANKING" : "CLASSEMENT DES PLATS"
                }
              >
                <div className={styles.chartBody}>
                  <AnalysisBars
                    rows={ranked.map((dish) => ({
                      id: dish.id,
                      name: dish.name,
                      value: dish[metric],
                    }))}
                    label={labels[metric]}
                    horizontal
                    onSelect={open}
                  />
                </div>
              </AnalysisPanel>
              <AnalysisPanel
                index="04"
                title={
                  locale === "en"
                    ? "Which dishes invite exploration?"
                    : "Quels plats invitent à explorer ?"
                }
                eyebrow={
                  locale === "en"
                    ? "3D + AR INTERACTIONS"
                    : "INTERACTIONS 3D + AR"
                }
              >
                <div className={styles.chartBody}>
                  <AnalysisBars
                    rows={[...dishes]
                      .sort((a, b) => b.three + b.ar - a.three - a.ar)
                      .map((dish) => ({
                        id: dish.id,
                        name: dish.name,
                        value: dish.three + dish.ar,
                        three: dish.three,
                        ar: dish.ar,
                      }))}
                    label={t("Clics 3D et AR")}
                    immersive
                    horizontal
                    onSelect={open}
                  />
                </div>
              </AnalysisPanel>
            </>
          )}
          {heatmap && (
            <AnalysisPanel
              index="05"
              title={
                locale === "en"
                  ? "Which days are busiest?"
                  : "Quels jours concentrent l’activité ?"
              }
              eyebrow={globalScope}
              span={4}
            >
              <div className={styles.chartBody}>
                <AnalysisBars
                  rows={dayRows}
                  label={
                    locale === "en"
                      ? "Recorded events"
                      : "Événements enregistrés"
                  }
                />
              </div>
            </AnalysisPanel>
          )}
          {hasRanking && (
            <AnalysisPanel
              index="06"
              title={
                locale === "en"
                  ? "From views to exploration"
                  : "Du regard à l’exploration"
              }
              eyebrow={
                locale === "en"
                  ? "VIEWS × 3D CLICKS"
                  : "CONSULTATIONS × CLICS 3D"
              }
              span={8}
            >
              <div className={styles.chartBody}>
                <StudioAnalysisCharts
                  data={data}
                  family="scatter"
                  metric={metric}
                  category={category}
                  onDishOpen={onDishOpen}
                />
              </div>
            </AnalysisPanel>
          )}
          {heatmap && (
            <>
              <AnalysisPanel
                index="07"
                title={
                  locale === "en"
                    ? "When does activity build?"
                    : "Quand l’activité se concentre-t-elle ?"
                }
                eyebrow={globalScope}
                span={8}
              >
                <div className={styles.chartBody}>
                  <StudioHeatmap cells={heatmap} />
                </div>
              </AnalysisPanel>
              <AnalysisPanel
                index="08"
                title={locale === "en" ? "At what time?" : "À quelles heures ?"}
                eyebrow={globalScope}
                span={4}
              >
                <div className={styles.chartBody}>
                  <AnalysisBars
                    rows={hourRows}
                    label={
                      locale === "en"
                        ? "Recorded events"
                        : "Événements enregistrés"
                    }
                  />
                </div>
              </AnalysisPanel>
            </>
          )}
          {hasRanking && (
            <>
              <AnalysisPanel
                index="09"
                title={
                  locale === "en"
                    ? "Where do interactions go?"
                    : "Où vont les interactions ?"
                }
                eyebrow={
                  locale === "en"
                    ? "CATEGORIES → EVENT TYPES"
                    : "CATÉGORIES → TYPES D’ÉVÉNEMENTS"
                }
                span={8}
              >
                <div className={styles.chartBody}>
                  <StudioAnalysisCharts
                    data={data}
                    family="flow"
                    metric={metric}
                    category={category}
                    onCategoryChange={setCategory}
                    onMetricChange={setMetric}
                  />
                </div>
              </AnalysisPanel>
              {categories.length >= 3 && category === "all" && (
                <AnalysisPanel
                  index="10"
                  title={
                    locale === "en"
                      ? "The category profile"
                      : "Le profil des catégories"
                  }
                  eyebrow={
                    locale === "en" ? "RELATIVE SHARES" : "PARTS RELATIVES"
                  }
                  span={4}
                >
                  <StudioAnalysisCharts
                    data={data}
                    family="profile"
                    metric={metric}
                    category={category}
                  />
                </AnalysisPanel>
              )}
            </>
          )}
          {real.panels.searches.kind === "supported" &&
            real.panels.searches.data.length > 0 && (
              <AnalysisPanel
                index="+"
                title={t("Recherches fréquentes")}
                eyebrow={
                  locale === "en"
                    ? "ENTIRE MENU · NON-PERSONAL TERMS"
                    : "MENU ENTIER · TERMES NON PERSONNELS"
                }
                span={12}
              >
                <div className={css.searches}>
                  {real.panels.searches.data.slice(0, 10).map((row) => (
                    <div key={row.term}>
                      <span>{row.term}</span>
                      <meter
                        min={0}
                        max={Math.max(
                          ...(real.panels.searches.kind === "supported"
                            ? real.panels.searches.data.map(
                                (item) => item.count,
                              )
                            : [1]),
                        )}
                        value={row.count}
                        aria-label={row.term}
                      />
                      <strong>{number(row.count)}</strong>
                    </div>
                  ))}
                </div>
              </AnalysisPanel>
            )}
        </div>
      )}
      <footer className={css.source}>
        {locale === "en"
          ? "Recorded menu events. No sales estimates or unique-person attribution. Hours are UTC. Comparisons require usable prior data."
          : "Événements enregistrés sur le menu. Aucune estimation de ventes ni attribution à des personnes uniques. Horaires en UTC. Les comparaisons nécessitent un historique exploitable."}{" "}
        {date(real.observationWindow.startInclusive)} —{" "}
        {date(
          new Date(
            Date.parse(real.observationWindow.endExclusive) - 1,
          ).toISOString(),
        )}
      </footer>
    </div>
  );
}
