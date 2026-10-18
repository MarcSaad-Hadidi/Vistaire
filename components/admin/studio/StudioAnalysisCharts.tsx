"use client";
import { Tooltip as NativeTooltip } from "recharts";
import { useState } from "react";
import {
  Root,
  PieChart,
  PieSeries,
  Legend,
  Tooltip,
  ScatterChart,
  ScatterSeries,
  ScatterTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  RadarSeries,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  SankeyChart,
  SankeyLink,
  SankeyNode,
  SankeyNodeLabel,
  ResponsiveContainer,
} from "@kind-ui/charts";
import "@kind-ui/charts/styles.css";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import { useStudioLocale } from "./studioLocale";
import styles from "./Studio.module.css";
import visual from "./StudioAnalysisWorkspace.module.css";

export type StudioAnalysisMetric = "views" | "three" | "ar";
export type StudioAnalysisFamily =
  "composition" | "scatter" | "flow" | "profile";
const palette = [
  "var(--chart-current)",
  "var(--chart-three)",
  "var(--chart-ar)",
  "var(--chart-previous)",
  "#c58b64",
  "#89925e",
];
const categoryKey = (name: string) =>
  `category-${Array.from(name)
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("-")}`;

export function StudioAnalysisCharts({
  data,
  family,
  metric = "views",
  category = "all",
  onCategoryChange,
  onMetricChange,
  onDishOpen,
}: {
  data: AdminDashboardData;
  family?: StudioAnalysisFamily;
  metric?: StudioAnalysisMetric;
  category?: string;
  onCategoryChange?: (category: string) => void;
  onMetricChange?: (metric: StudioAnalysisMetric) => void;
  onDishOpen?: (dish: AdminMenuDish) => void;
}) {
  const { t, locale, number: fmt } = useStudioLocale();
  const [flowNode, setFlowNode] = useState<string | null>(null);
  const [flowInspection, setFlowInspection] = useState<{
    id: string;
    kind: string;
  } | null>(null);
  const [profileSelection, setProfileSelection] = useState([
    "current",
    "previous",
  ]);
  const [inspected, setInspected] = useState<string | null>(null);
  if (
    data.analytics.kind !== "real" ||
    data.analytics.panels.ranking.kind !== "supported" ||
    !data.dishStatistics
  )
    return null;
  const allCategories = [
    ...new Set(data.menu.dishes.map((dish) => dish.category)),
  ];
  const color = (name: string) =>
    palette[Math.max(0, allCategories.indexOf(name)) % palette.length];
  const dishes = data.menu.dishes.flatMap((dish) => {
    const stats = data.dishStatistics?.[dish.id];
    return stats && (category === "all" || dish.category === category)
      ? [{ ...stats, ...dish, value: stats[metric] }]
      : [];
  });
  const categories = allCategories
    .filter((name) => category === "all" || category === name)
    .map((name) => {
      const rows = dishes.filter((dish) => dish.category === name);
      return {
        key: categoryKey(name),
        name,
        value: rows.reduce((sum, row) => sum + row.value, 0),
        views: rows.reduce((sum, row) => sum + row.views, 0),
        three: rows.reduce((sum, row) => sum + row.three, 0),
        ar: rows.reduce((sum, row) => sum + row.ar, 0),
        previousViews: rows.every((row) => row.previousViews !== null)
          ? rows.reduce((sum, row) => sum + (row.previousViews ?? 0), 0)
          : null,
      };
    });
  const total = categories.reduce((sum, row) => sum + row.value, 0);
  const prior = categories.every((row) => row.previousViews !== null)
    ? categories.reduce((sum, row) => sum + (row.previousViews ?? 0), 0)
    : null;
  const label =
    metric === "views"
      ? t("Consultations")
      : metric === "three"
        ? t("Clics 3D")
        : t("Clics AR");
  const config = Object.fromEntries(
    categories.map((row) => [
      row.key,
      { label: row.name, color: color(row.name) },
    ]),
  );
  const hovered = categories.find((row) => row.key === inspected);
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
  const composition = (
    <div className={styles.chart}>
      <Root
        config={config}
        interaction={{
          kind: "category",
          mode: "focus",
          eligibleKeys: categories.map((row) => row.key),
          selected: null,
          onSelectionChange: (key: string | null) => {
            const selected = categories.find((row) => row.key === key);
            if (selected) onCategoryChange?.(selected.name);
          },
          markActivation: "matching-legend",
        }}
      >
        <div className={visual.pieStage}>
          <PieChart
            responsive
            style={{ width: "100%", height: 290 }}
            animate={{ revealDurationMs: 550 }}
            accessibilityLayer
            aria-label={`${label} · ${t("Répartition par catégorie")}`}
          >
            <PieSeries
              data={categories}
              dataKey="value"
              nameKey="name"
              categoryKey="key"
              interactionBinding="root"
              innerRadius="63%"
              outerRadius="88%"
              paddingAngle={categories.length > 1 ? 2 : 0}
              stroke="var(--surface)"
              strokeWidth={3}
              onMouseEnter={(row) =>
                setInspected(row.key == null ? null : String(row.key))
              }
              onMouseLeave={() => setInspected(null)}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as
                  (typeof categories)[number] | undefined;
                return active && row ? (
                  <div className={visual.tooltip}>
                    <strong>{row.name}</strong>
                    <div>
                      <span>{label}</span>
                      <b>{fmt(row.value)}</b>
                    </div>
                    <small>
                      {total
                        ? ((100 * row.value) / total).toLocaleString(locale, {
                            maximumFractionDigits: 1,
                          })
                        : 0}{" "}
                      %
                    </small>
                  </div>
                ) : null;
              }}
            />
          </PieChart>
          <div className={visual.pieCenter} aria-hidden="true">
            <strong>{fmt(hovered?.value ?? total)}</strong>
            <span>{hovered?.name ?? label}</span>
          </div>
        </div>
        <Legend className={visual.pieLegend}>
          {({ key, label: name, marker }) => {
            const row = categories.find((item) => item.key === key)!;
            return (
              <>
                {marker}
                <span>{name}</span>
                <strong>{fmt(row.value)}</strong>
                <small>
                  {total
                    ? ((row.value / total) * 100).toLocaleString(locale, {
                        maximumFractionDigits: 1,
                      })
                    : 0}{" "}
                  %
                </small>
              </>
            );
          }}
        </Legend>
      </Root>
      {category !== "all" && onCategoryChange && (
        <button
          type="button"
          className={visual.reset}
          onClick={() => onCategoryChange("all")}
        >
          {locale === "en" ? "All categories" : "Toutes les catégories"}
        </button>
      )}
      {table}
    </div>
  );
  const scatter = (
    <div className={styles.chart}>
      <Root config={config}>
        <ScatterChart
          responsive
          style={{ width: "100%", height: 310 }}
          accessibilityLayer
          aria-label={
            locale === "en"
              ? "Dish views and 3D clicks"
              : "Consultations et clics 3D par plat"
          }
          margin={{ top: 20, right: 24, bottom: 18, left: 4 }}
        >
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" />
          <XAxis
            type="number"
            dataKey="views"
            name={t("Consultations")}
            domain={[0, "auto"]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="three"
            name={t("Clics 3D")}
            domain={[0, "auto"]}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            allowDecimals={false}
            width={46}
            axisLine={false}
            tickLine={false}
          />
          <ScatterTooltip<(typeof dishes)[number]>
            pointLabel={(row) => row.name}
          />
          {categories.map((row) => (
            <ScatterSeries
              key={row.key}
              seriesKey={row.key}
              data={dishes.filter((dish) => dish.category === row.name)}
              name={row.name}
              fill={color(row.name)}
              onClick={(point) => {
                const dish = data.menu.dishes.find(
                  (item) => item.id === point.payload?.id,
                );
                if (dish) onDishOpen?.(dish);
              }}
            />
          ))}
        </ScatterChart>
        <Legend />
      </Root>
      <p className={visual.axisCaption}>
        {t("Consultations")} → · {t("Clics 3D")} ↑
      </p>
      <details className={styles.dataDisclosure}>
        <summary>{t("Voir les chiffres par plat")}</summary>
        <div className={styles.tableScroll}>
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
                  <td>
                    {onDishOpen ? (
                      <button onClick={() => onDishOpen(row)}>
                        {row.name}
                      </button>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td>{fmt(row.views)}</td>
                  <td>{fmt(row.three)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
  const nodes = [
    ...categories.map((row) => ({ id: row.key, name: row.name })),
    { id: "views", name: t("Consultations") },
    { id: "three", name: t("Clics 3D") },
    { id: "ar", name: t("Clics AR") },
  ];
  const effectiveFlowNode = nodes.some((node) => node.id === flowNode)
    ? flowNode
    : null;
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
  const describeFlow = (id: string, kind: string) => {
    const link = kind === "link" ? links.find((item) => item.id === id) : null;
    if (link)
      return `${nodes.find((node) => node.id === link.source)?.name} → ${nodes.find((node) => node.id === link.target)?.name} · ${fmt(link.value)}`;
    const node = nodes.find((item) => item.id === id);
    const value = Math.max(
      links
        .filter((item) => item.source === id)
        .reduce((sum, item) => sum + item.value, 0),
      links
        .filter((item) => item.target === id)
        .reduce((sum, item) => sum + item.value, 0),
    );
    return node ? `${node.name} · ${fmt(value)}` : "";
  };
  const flowReadout = flowInspection
    ? describeFlow(flowInspection.id, flowInspection.kind)
    : "";
  const flow = (
    <div className={styles.chart}>
      <Root
        config={flowConfig}
        interaction={{
          kind: "node",
          mode: "focus",
          eligibleKeys: nodes.map((node) => node.id),
          selected: effectiveFlowNode,
          onSelectionChange: setFlowNode,
        }}
      >
        <ResponsiveContainer width="100%" height={330}>
          <SankeyChart
            data={{ nodes, links }}
            nodeConfig={flowConfig}
            interactionBinding="root"
            animate={{ revealDurationMs: 550 }}
            nodeWidth={10}
            nodePadding={18}
            margin={{ top: 24, bottom: 24, left: 85, right: 85 }}
            onMouseEnter={(item, kind) =>
              setFlowInspection({ id: item.payload.id, kind })
            }
            onClick={(item, kind) =>
              setFlowInspection({ id: item.payload.id, kind })
            }
            link={(props) => (
              <SankeyLink
                {...props}
                opacity={
                  !effectiveFlowNode ||
                  props.payload.source.id === effectiveFlowNode ||
                  props.payload.target.id === effectiveFlowNode
                    ? 0.55
                    : 0.12
                }
              />
            )}
            node={(props) => (
              <>
                <SankeyNode
                  {...props}
                  opacity={
                    !effectiveFlowNode ||
                    props.payload.id === effectiveFlowNode ||
                    links.some(
                      (link) =>
                        (link.source === effectiveFlowNode &&
                          link.target === props.payload.id) ||
                        (link.target === effectiveFlowNode &&
                          link.source === props.payload.id),
                    )
                      ? 1
                      : 0.3
                  }
                  rectProps={{
                    tabIndex: 0,
                    role: "button",
                    "aria-label": describeFlow(props.payload.id, "node"),
                    "aria-pressed": effectiveFlowNode === props.payload.id,
                    onFocus: () =>
                      setFlowInspection({ id: props.payload.id, kind: "node" }),
                    onKeyDown: (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setFlowNode((current) =>
                          current === props.payload.id
                            ? null
                            : props.payload.id,
                        );
                        setFlowInspection({
                          id: props.payload.id,
                          kind: "node",
                        });
                      }
                    },
                  }}
                />
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
          >
            <NativeTooltip
              content={({ active }) =>
                active && flowReadout ? (
                  <div className={visual.tooltip}>{flowReadout}</div>
                ) : null
              }
            />
          </SankeyChart>
        </ResponsiveContainer>
        <p className={visual.axisCaption} role="status" aria-live="polite">
          {flowReadout ||
            (locale === "en"
              ? "Hover or touch a connection to inspect its source, destination and count"
              : "Survolez ou touchez un lien pour lire sa source, sa destination et son volume")}
        </p>
        <details className={styles.dataDisclosure}>
          <summary>
            {locale === "en" ? "Explore connections" : "Explorer les liens"}
          </summary>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("Catégorie")}</th>
                  <th>{locale === "en" ? "Event" : "Événement"}</th>
                  <th>{locale === "en" ? "Count" : "Nombre"}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td>
                      <button
                        type="button"
                        aria-pressed={effectiveFlowNode === link.source}
                        onClick={() => {
                          setFlowNode(String(link.source));
                          setFlowInspection({ id: link.id, kind: "link" });
                        }}
                      >
                        {nodes.find((node) => node.id === link.source)?.name}
                      </button>
                    </td>
                    <td>
                      {nodes.find((node) => node.id === link.target)?.name}
                    </td>
                    <td>{fmt(link.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={visual.flowActions}>
            {onCategoryChange &&
              categories.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => onCategoryChange(row.name)}
                >
                  {locale === "en" ? "Filter" : "Filtrer"} · {row.name}
                </button>
              ))}
            {onMetricChange &&
              (["views", "three", "ar"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onMetricChange(key)}
                >
                  {flowConfig[key].label} ↗
                </button>
              ))}
          </div>
        </details>
      </Root>
      <p className={visual.axisCaption}>
        {locale === "en"
          ? "Event volumes, not a customer journey or conversion funnel"
          : "Volumes d’événements, sans parcours client ni conversion"}
      </p>
    </div>
  );
  const comparable = metric === "views" && prior !== null && prior > 0;
  const radar = categories.map((row) => ({
    name: row.name,
    current: total ? (row.value / total) * 100 : 0,
    previous:
      comparable && row.previousViews !== null
        ? (row.previousViews / prior) * 100
        : null,
  }));
  const profileKeys = comparable ? ["current", "previous"] : ["current"];
  const selectedProfileKeys = profileSelection.filter((key) =>
    profileKeys.includes(key),
  );
  const profile = (
    <div className={styles.chart}>
      {categories.length >= 3 && total > 0 ? (
        <Root
          interaction={{
            kind: "series",
            mode: "visibility",
            eligibleKeys: profileKeys,
          }}
          visibleSeries={
            selectedProfileKeys.length ? selectedProfileKeys : ["current"]
          }
          onVisibleSeriesChange={(next) => {
            if (next.length) setProfileSelection(next);
          }}
          config={{
            current: {
              label: t("Actuel"),
              color: "var(--chart-current)",
              formatValue: (value) =>
                `${Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })} %`,
            },
            ...(comparable
              ? {
                  previous: {
                    label: t("Précédent"),
                    color: "var(--chart-previous)",
                    formatValue: (value: unknown) =>
                      `${Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })} %`,
                  },
                }
              : {}),
          }}
        >
          <RadarChart
            responsive
            style={{ width: "100%", height: 320 }}
            data={radar}
            outerRadius="67%"
            accessibilityLayer
            aria-label={
              locale === "en" ? "Category shares" : "Part des catégories"
            }
            animate={{ revealDurationMs: 550 }}
          >
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fill: "var(--muted)", fontSize: 10 }}
            />
            <PolarRadiusAxis
              domain={[0, "auto"]}
              tick={{ fill: "var(--muted)", fontSize: 9 }}
            />
            <RadarSeries
              seriesKey="current"
              dataKey="current"
              fill="var(--chart-current)"
              stroke="var(--chart-current)"
              fillOpacity={0.15}
            />
            {comparable && (
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
          <Legend
            aria-label={
              locale === "en"
                ? "Show or hide a period"
                : "Afficher ou masquer une période"
            }
          />
        </Root>
      ) : (
        <p className={visual.axisCaption}>
          {locale === "en"
            ? "Select at least three categories to compare their profiles"
            : "Sélectionnez au moins trois catégories pour comparer leurs profils"}
        </p>
      )}
      {!comparable && (
        <p className={visual.axisCaption}>{t("Précédent")} : N/A</p>
      )}
      {table}
    </div>
  );
  const parts = { composition, scatter, flow, profile };
  return family ? (
    parts[family]
  ) : (
    <div className={styles.twoColumns}>
      {Object.entries(parts).map(([key, chart]) => (
        <section key={key} className={styles.panel}>
          {chart}
        </section>
      ))}
    </div>
  );
}
