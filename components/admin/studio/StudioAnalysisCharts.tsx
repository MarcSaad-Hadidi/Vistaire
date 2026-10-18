"use client";
import { useStudioLocale } from "./studioLocale";
import {
  Root,
  PieChart,
  PieSeries,
  Legend,
  Tooltip,
  ScatterChart,
  ScatterSeries,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  RadarSeries,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  SankeyChart,
  SankeyNode,
  SankeyNodeLabel,
  ResponsiveContainer,
} from "@kind-ui/charts";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import styles from "./Studio.module.css";

const colors = [
  "var(--chart-current)",
  "var(--chart-three)",
  "var(--chart-ar)",
  "var(--chart-previous)",
  "#db2777",
  "#0d9488",
];

export function StudioAnalysisCharts({ data }: { data: AdminDashboardData }) {
  const {t,number:fmt}=useStudioLocale();
  const evidence =
    data.analytics.kind === "real" &&
    data.analytics.panels.ranking.kind === "supported";
  if (!evidence || !data.dishStatistics) return null;
  const dishes = data.menu.dishes.flatMap((dish) => {
    const stats = data.dishStatistics?.[dish.id];
    return stats
      ? [{ ...stats, name: dish.name, category: dish.category, id: dish.id }]
      : [];
  });
  const grouped = new Map<
    string,
    {
      name: string;
      views: number;
      three: number;
      ar: number;
      previousViews: number | null;
    }
  >();
  for (const dish of dishes) {
    const row = grouped.get(dish.category) ?? {
      name: dish.category,
      views: 0,
      three: 0,
      ar: 0,
      previousViews: dish.previousViews === null ? null : 0,
    };
    row.views += dish.views;
    row.three += dish.three;
    row.ar += dish.ar;
    if (row.previousViews !== null && dish.previousViews !== null)
      row.previousViews += dish.previousViews;
    grouped.set(dish.category, row);
  }
  const categories = [...grouped.values()].map((row, index) => ({
    ...row,
    key: `category-${index}`,
  }));
  const total = categories.reduce((sum, row) => sum + row.views, 0);
  const prior = categories.reduce(
    (sum, row) => sum + (row.previousViews ?? 0),
    0,
  );
  const config = Object.fromEntries(
    categories.map((row, index) => [
      row.key,
      { label: row.name, color: colors[index % colors.length] },
    ]),
  );
  const radar = categories.map((row) => ({
    name: row.name,
    current: total ? (row.views / total) * 100 : 0,
    previous:
      prior && row.previousViews !== null
        ? (row.previousViews / prior) * 100
        : null,
  }));
  const nodes = [
    ...categories.map((row) => ({ id: row.key, name: row.name })),
    { id: "views", name: t("Consultations") },
    { id: "three", name: t("Clics 3D") },
    { id: "ar", name: t("Clics AR") },
  ];
  const links = categories.flatMap((row) =>
    (["views", "three", "ar"] as const)
      .filter((key) => row[key] > 0)
      .map((key) => ({
        id: `${row.key}-${key}`,
        source: row.key,
        target: key,
        value: row[key],
      })),
  );
  const flowConfig = {
    ...config,
    views: { label: t("Consultations"), color: "var(--chart-current)" },
    three: { label: t("Clics 3D"), color: "var(--chart-three)" },
    ar: { label: t("Clics AR"), color: "var(--chart-ar)" },
  };
  const table = (
    <details className={styles.dataDisclosure}>
      <summary>{t("Voir les chiffres par catégorie")}</summary>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("Catégorie")}</th>
              <th>{t("Consultations")}</th>
              <th>{t("Clics 3D")}</th>
              <th>{t("Clics AR")}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{fmt(row.views)}</td>
                <td>{fmt(row.three)}</td>
                <td>{fmt(row.ar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
  return (
    <div className={styles.twoColumns}>
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div>
            <h2>{t("Répartition par catégorie")}</h2>
            <p>{t("Part des consultations des plats actuels du menu")}</p>
          </div>
        </header>
        <div className={`${styles.chartBody} ${styles.chart}`}>
          <Root
            config={config}
            interaction={{
              kind: "category",
              mode: "focus",
              eligibleKeys: categories.map((row) => row.key),
              markActivation: "matching-legend",
            }}
          >
            <PieChart
              responsive
              style={{ width: "100%", height: 280 }}
              accessibilityLayer
              aria-label={t("Consultations par catégorie")}
            >
              <PieSeries
                data={categories}
                dataKey="views"
                nameKey="name"
                categoryKey="key"
                interactionBinding="root"
                innerRadius="60%"
                outerRadius="85%"
                paddingAngle={2}
                stroke="var(--surface)"
                strokeWidth={3}
              />
              <Tooltip />
            </PieChart>
            <Legend>
              {({ key, label, marker }) => (
                <>
                  {marker}
                  <span>{label}</span>
                  <strong>
                    {fmt(categories.find((row) => row.key === key)?.views ?? 0)}
                  </strong>
                </>
              )}
            </Legend>
          </Root>
        </div>
        {table}
      </section>
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div>
            <h2>{t("Consultations et clics 3D")}</h2>
            <p>{t("Un point par plat · volumes, sans preuve de conversion")}</p>
          </div>
        </header>
        <div className={`${styles.chartBody} ${styles.chart}`}>
          <Root
            config={{ dishes: { label: t("Plats"), color: "var(--chart-three)" } }}
          >
            <ScatterChart
              responsive
              style={{ width: "100%", height: 300 }}
              accessibilityLayer
              margin={{ top: 20, right: 24, bottom: 20, left: 0 }}
            >
              <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" />
              <XAxis
                type="number"
                dataKey="views"
                name={t("Consultations")}
                domain={[0, "auto"]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                type="number"
                dataKey="three"
                name={t("Clics 3D")}
                domain={[0, "auto"]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                allowDecimals={false}
                width={44}
              />
              <Tooltip />
              <ScatterSeries
                seriesKey="dishes"
                data={dishes}
                name={t("Plats")}
                fill="var(--chart-three)"
              />
            </ScatterChart>
          </Root>
        </div>
        <details className={styles.dataDisclosure}>
          <summary>{t("Voir les chiffres par plat")}</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("Plat")}</th>
                <th>{t("Consultations")}</th>
                <th>{t("Clics 3D")}</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{fmt(row.views)}</td>
                  <td>{fmt(row.three)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div>
            <h2>{t("Catégories et événements")}</h2>
            <p>{t("La largeur représente le nombre d’événements")}</p>
          </div>
        </header>
        <div className={`${styles.chartBody} ${styles.chart}`}>
          <Root config={flowConfig}>
            <ResponsiveContainer width="100%" height={320}>
              <SankeyChart
                data={{ nodes, links }}
                nodeConfig={flowConfig}
                nodeWidth={10}
                nodePadding={16}
                margin={{ top: 20, bottom: 20, left: 90, right: 85 }}
                node={(props) => (
                  <>
                    <SankeyNode {...props} />
                    <SankeyNodeLabel
                      node={props}
                      data={{ nodes, links }}
                      nodeConfig={flowConfig}
                      side={
                        String(props.payload.id).startsWith("category-")
                          ? "left"
                          : "right"
                      }
                      fontSize={10}
                      fill="var(--ink)"
                    />
                  </>
                )}
              />
            </ResponsiveContainer>
          </Root>
        </div>
        {table}
      </section>
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div>
            <h2>{t("Le profil des catégories")}</h2>
            <p>{t("Part des consultations par période, en pourcentage")}</p>
          </div>
        </header>
        {categories.length >= 3 && total > 0 ? (
          <div className={`${styles.chartBody} ${styles.chart}`}>
            <Root
              config={{
                current: { label: t("Actuel"), color: "var(--chart-current)" },
                ...(prior > 0
                  ? {
                      previous: {
                        label: t("Précédent"),
                        color: "var(--chart-previous)",
                      },
                    }
                  : {}),
              }}
            >
              <RadarChart
                responsive
                style={{ width: "100%", height: 320 }}
                data={radar}
                outerRadius="70%"
                accessibilityLayer
              >
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fill: "var(--muted)", fontSize: 10 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--muted)", fontSize: 10 }}
                />
                <RadarSeries
                  seriesKey="current"
                  dataKey="current"
                  fill="var(--chart-current)"
                  stroke="var(--chart-current)"
                  fillOpacity={0.15}
                />
                {prior > 0 && (
                  <RadarSeries
                    seriesKey="previous"
                    dataKey="previous"
                    fill="var(--chart-previous)"
                    stroke="var(--chart-previous)"
                    fillOpacity={0.08}
                    strokeDasharray="4 4"
                  />
                )}
                <Tooltip />
              </RadarChart>
              <Legend />
            </Root>
          </div>
        ) : (
          <div className={styles.empty}>
            <p>{t("Trois catégories avec des consultations sont nécessaires pour comparer leur profil.")}</p>
          </div>
        )}
        {table}
      </section>
    </div>
  );
}
