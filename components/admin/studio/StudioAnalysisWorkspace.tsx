"use client";
import { useState, type ReactNode } from "react";
import { Cell } from "recharts";
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
import { StudioNumber } from "./StudioNumber";
import { selectStudioTemporalMetrics } from "../../../lib/admin/studioTemporalData";
import { StudioAnalysisTables } from "./StudioAnalysisTables";
import {
  StudioAnalysisCharts,
  studioCategoryPalette,
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
  fill?: string;
};
function wrapChartLabel(name: string): string[] {
  return name.split(/\s+/).reduce<string[]>((lines, word) => {
    const last = lines.length - 1;
    if (last < 0 || lines[last].length + word.length + 1 > 23) lines.push(word);
    else lines[last] += ` ${word}`;
    return lines;
  }, []);
}
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
  const [visible, setVisible] = useState(["three", "ar"]);
  const config: SeriesConfig = immersive
    ? {
        three: { label: t("Clics 3D"), color: "var(--chart-three)" },
        ar: { label: t("Clics AR"), color: "var(--chart-ar)" },
      }
    : { value: { label, color: "var(--chart-current)" } };
  const rowHeight = Math.max(
    44,
    ...rows.map((row) => wrapChartLabel(row.name).length * 13 + 16),
  );
  const act = (row: BarRow) => onSelect?.(row.id);
  return (
    <div className={styles.chart}>
      <Root
        config={config}
        interaction={{
          kind: "series",
          mode: "visibility",
          eligibleKeys: immersive ? ["three", "ar"] : ["value"],
        }}
        visibleSeries={immersive ? visible : ["value"]}
        onVisibleSeriesChange={(next) => {
          if (next.length && immersive) setVisible(next);
        }}
      >
        {immersive && (
          <Legend
            className={css.immersionLegend}
            aria-label={t("Afficher ou masquer une période")}
          >
            {({ key, label: name, marker }) => (
              <>
                {marker}
                <span>{name}</span>
                <strong>
                  {number(
                    rows.reduce(
                      (sum, row) =>
                        sum +
                        (key === "three" ? (row.three ?? 0) : (row.ar ?? 0)),
                      0,
                    ),
                  )}
                </strong>
              </>
            )}
          </Legend>
        )}
        <BarChart
          data={rows}
          responsive
          height={horizontal ? Math.max(240, rows.length * rowHeight) : 270}
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
                  width: 148,
                  interval: 0,
                }
              : { width: 40 })}
            allowDecimals={false}
            tick={
              horizontal
                ? ({ x, y, payload }) => {
                    const lines = wrapChartLabel(String(payload.value));
                    return (
                      <text
                        x={Number(x) - 5}
                        y={Number(y)}
                        textAnchor="end"
                        fill="var(--muted)"
                        fontSize={11}
                        data-studio-bar-label={payload.value}
                      >
                        <title>{payload.value}</title>
                        {lines.map((line, index) => (
                          <tspan
                            key={index}
                            x={Number(x) - 5}
                            dy={
                              index === 0
                                ? -((lines.length - 1) * 13) / 2 + 4
                                : 13
                            }
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    );
                  }
                : { fontSize: 10, fill: "var(--muted)" }
            }
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
            >
              {rows.map((row) => (
                <Cell key={row.id} fill={row.fill ?? "var(--chart-current)"} />
              ))}
            </BarSeries>
          )}
        </BarChart>
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
  span?: 4 | 5 | 6 | 7 | 8 | 12;
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
  onExport,
  view,
  onViewChange: setView,
}: {
  data: AdminDashboardData;
  onDishOpen?: (dish: AdminMenuDish) => void;
  onExport?: () => void;
  view: "charts" | "table";
  onViewChange: (view: "charts" | "table") => void;
}) {
  const { t, locale, number, date } = useStudioLocale();
  const [category, setCategory] = useState("all");
  const [metric, setMetric] = useState<StudioAnalysisMetric>("views");
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
  const metricSeries: "dishOpened" | "three" | "ar" =
    metric === "views" ? "dishOpened" : metric;
  const temporalPresent = data.temporalAnalytics !== undefined;
  const temporal = selectStudioTemporalMetrics(data.temporalAnalytics, {
    metric,
    dishIds:
      category === "all"
        ? undefined
        : data.menu.dishes
            .filter((dish) => dish.category === category)
            .map((dish) => dish.id),
  });
  const timezone = temporalPresent ? temporal.timezone : "UTC";
  const trendSeries = temporalPresent
    ? {
        id: metricSeries as "dishOpened" | "three" | "ar",
        current: temporal.current.map((point) => ({
          ...point,
          timestampLabel: point.bucket,
        })),
        previous: temporal.previous.map((point) => ({
          ...point,
          timestampLabel: point.bucket,
        })),
      }
    : real?.metricSeries[metricSeries];
  const trendAvailable = temporalPresent
    ? temporal.total !== null
    : Boolean(trendSeries);
  const trendTotal = temporalPresent
    ? temporal.total
    : (trendSeries?.current.reduce((sum, row) => sum + row.value, 0) ?? null);
  const trendComparison = temporalPresent
    ? temporal.previousTotal !== null
    : real?.panels.dailyComparison.kind === "supported";
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
  const heatmap = temporalPresent
    ? temporal.total !== null
      ? temporal.hours.map((cell) => ({
          weekdayUtc: cell.weekday,
          hourUtc: cell.hour,
          count: cell.count,
        }))
      : null
    : real?.panels.hourWeekday.kind === "supported"
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
        fill: index === 6 ? "var(--chart-day-7)" : studioCategoryPalette[index],
        value: heatmap
          .filter((cell) => cell.weekdayUtc === (index + 1) % 7)
          .reduce((sum, cell) => sum + cell.count, 0),
      }))
    : [];
  const hourRows = heatmap
    ? Array.from({ length: 12 }, (_, index) => ({
        id: String(index * 2),
        name: `${index * 2}–${index * 2 + 2} h`,
        fill: studioCategoryPalette[index % studioCategoryPalette.length],
        value: heatmap
          .filter(
            (cell) => cell.hourUtc >= index * 2 && cell.hourUtc < index * 2 + 2,
          )
          .reduce((sum, cell) => sum + cell.count, 0),
      }))
    : [];
  const globalScope = temporalPresent
    ? `${category === "all" ? (locale === "en" ? "Entire menu" : "Menu entier") : category} · ${labels[metric]} · ${timezone}`
    : locale === "en"
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
      <div className={css.periodCaption}>
        <span>
          {date(real.observationWindow.startInclusive)} –{" "}
          {date(
            new Date(
              Date.parse(real.observationWindow.endExclusive) - 1,
            ).toISOString(),
          )}{" "}
          ·{" "}
          {Math.round(
            (Date.parse(real.observationWindow.endExclusive) -
              Date.parse(real.observationWindow.startInclusive)) /
              86400000,
          )}{" "}
          {locale === "en" ? "days" : "jours"}
        </span>
        <span>
          {trendComparison ? (
            <>
              vs {date(real.observationWindow.comparisonStartInclusive)} –{" "}
              {date(
                new Date(
                  Date.parse(real.observationWindow.comparisonEndExclusive) - 1,
                ).toISOString(),
              )}
            </>
          ) : locale === "en" ? (
            "Previous period: N/A"
          ) : (
            "Période précédente : N/A"
          )}
        </span>
      </div>
      <div className={css.filters}>
        {hasRanking && (
          <StudioCombobox
            showLabel
            searchIcon
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
          options={[
            { value: "views", label: labels.views },
            { value: "three", label: "3D" },
            { value: "ar", label: "AR" },
          ]}
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
        <button
          type="button"
          className={css.viewToggle}
          aria-pressed={view === "table"}
          onClick={() => setView(view === "table" ? "charts" : "table")}
        >
          {view === "table" ? (
            <ChartNoAxesCombined size={15} />
          ) : (
            <Table2 size={15} />
          )}
          <span>
            {view === "table"
              ? locale === "en"
                ? "Chart view"
                : "Vue graphique"
              : locale === "en"
                ? "Table view"
                : "Vue tableau"}
          </span>
        </button>
      </div>

      {hasRanking && view === "charts" && (
        <div className={css.summary}>
          {(["views", "three", "ar"] as const).map((key) => (
            <button key={key} onClick={() => setMetric(key)}>
              <span>{labels[key]}</span>
              <strong>
                <StudioNumber value={totals[key]} />
              </strong>
            </button>
          ))}
          {top && (
            <button className={css.takeaway} onClick={() => onDishOpen?.(top)}>
              <span>
                {locale === "en" ? "Leading dish" : "En tête"} ·{" "}
                {labels[metric].toLowerCase()}
              </span>
              <strong>{top.name}</strong>
            </button>
          )}
        </div>
      )}
      {view === "table" ? (
        <StudioAnalysisTables
          data={data}
          category={category}
          metric={metric}
          onDishOpen={onDishOpen}
          onExport={onExport}
        />
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
              temporalPresent
                ? globalScope
                : locale === "en"
                  ? "DAILY TREND · ENTIRE MENU · UTC"
                  : "ÉVOLUTION QUOTIDIENNE · MENU ENTIER · UTC"
            }
            span={8}
          >
            <div className={css.trendTotal}>
              <strong>
                {trendTotal === null ? "N/A" : number(trendTotal)}
              </strong>
              <span>{labels[metric]}</span>
            </div>
            <div className={styles.chartBody} data-analysis-body>
              {trendAvailable && trendSeries ? (
                <StudioTrend
                  series={trendSeries}
                  label={labels[metric]}
                  comparison={trendComparison}
                  timezone={timezone}
                />
              ) : (
                <p className={styles.empty}>
                  {locale === "en"
                    ? "Temporal data unavailable for this selection."
                    : "Données temporelles indisponibles pour cette sélection."}
                </p>
              )}
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
                <div className={styles.chartBody} data-analysis-body>
                  <StudioAnalysisCharts
                    data={data}
                    family="composition"
                    metric={metric}
                    category={category}
                    onCategoryChange={setCategory}
                  />
                </div>
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
                <div className={styles.chartBody} data-analysis-body>
                  <AnalysisBars
                    rows={ranked.map((dish) => ({
                      id: dish.id,
                      name: dish.name,
                      value: dish[metric],
                      fill: studioCategoryPalette[
                        categories.indexOf(dish.category) %
                          studioCategoryPalette.length
                      ],
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
                    : "Où commence l’immersion ?"
                }
                eyebrow={
                  locale === "en" ? "3D + AR INTERACTIONS" : "CLICS 3D ET AR"
                }
              >
                <div className={styles.chartBody} data-analysis-body>
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
                  : "Quel jour fait la différence ?"
              }
              eyebrow={globalScope}
              span={5}
            >
              <div className={styles.chartBody} data-analysis-body>
                <AnalysisBars
                  rows={dayRows}
                  label={
                    temporalPresent
                      ? labels[metric]
                      : locale === "en"
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
                  : "Le regard devient-il exploration ?"
              }
              eyebrow={
                locale === "en"
                  ? "VIEWS × 3D CLICKS"
                  : "CONSULTATIONS × CLICS 3D"
              }
              span={7}
            >
              <div className={styles.chartBody} data-analysis-body>
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
                    : "Quand votre carte est-elle explorée ?"
                }
                eyebrow={globalScope}
                span={7}
              >
                <div className={styles.chartBody} data-analysis-body>
                  <StudioHeatmap cells={heatmap} timezone={timezone} />
                </div>
              </AnalysisPanel>
              <AnalysisPanel
                index="08"
                title={
                  locale === "en"
                    ? "At what time?"
                    : "La soirée change-t-elle le rythme ?"
                }
                eyebrow={globalScope}
                span={5}
              >
                <div className={styles.chartBody} data-analysis-body>
                  <AnalysisBars
                    rows={hourRows}
                    horizontal
                    label={
                      temporalPresent
                        ? labels[metric]
                        : locale === "en"
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
                    : "Comment se répartissent les événements ?"
                }
                eyebrow={
                  locale === "en"
                    ? "CATEGORIES → EVENT TYPES"
                    : "CATÉGORIES → TYPES D’ÉVÉNEMENTS"
                }
                span={7}
              >
                <div className={styles.chartBody} data-analysis-body>
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
                      : "Le profil de votre carte évolue-t-il ?"
                  }
                  eyebrow={
                    locale === "en"
                      ? "RELATIVE SHARES"
                      : "PARTS COMPARÉES PAR CATÉGORIE · %"
                  }
                  span={5}
                >
                  <div className={styles.chartBody} data-analysis-body>
                    <StudioAnalysisCharts
                      data={data}
                      family="profile"
                      metric={metric}
                      category={category}
                    />
                  </div>
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
      <p className={css.scope}>
        {temporalPresent
          ? locale === "en"
            ? `Dish metrics follow the selected category. Daily and hourly grouping: ${timezone}; observation windows: UTC.`
            : `Les indicateurs des plats suivent la catégorie sélectionnée. Regroupement des jours et heures : ${timezone}; fenêtres d’observation : UTC.`
          : locale === "en"
            ? "The category filter applies to dish and category charts. Time-based charts always cover the entire menu (UTC)."
            : "Le filtre catégorie s’applique aux plats et aux catégories. Les graphiques temporels portent toujours sur le menu entier (UTC)."}
      </p>
      <footer className={css.source}>
        {locale === "en"
          ? "Recorded menu events. No sales estimates or unique-person attribution. Comparisons require usable prior data."
          : "Événements enregistrés sur le menu. Aucune estimation de ventes ni attribution à des personnes uniques. Les comparaisons nécessitent un historique exploitable."}{" "}
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
