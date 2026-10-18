"use client";
/** Approved Sauge Noire v29 data workspace: dataWorkspaceProps + mounted React
 * DataWorkspace and sn-data-* styles, https://sauge-noire-dashboard-demo.plumtuna4.chatgpt.site/.
 * Reuses the deployed structure with existing Studio data and BeUI input. No demo model.
 */
import { useId, useMemo, useState } from "react";
import {
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  sortFn_basic,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Download,
  X,
} from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import type { StudioAnalysisMetric } from "./StudioAnalysisCharts";
import { StudioSearch } from "./StudioControls";
import { useStudioLocale } from "./studioLocale";
import css from "./StudioAnalysisTables.module.css";

type Value = string | number | null;
type Row = { id: string; label: string; [key: string]: Value };
type Column = {
  id: string;
  label: string;
  format?: "number" | "percent" | "delta";
  primary?: boolean;
  sortKey?: string;
};
type Dataset = {
  id: string;
  label: string;
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  emptyReason?: string;
};
type Locale = "fr" | "en";
// The feature registry matches the approved v29 mounted TanStack workspace.
const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});
const sumKnown = (values: (number | null)[]) =>
  values.every((value) => value !== null)
    ? values.reduce<number>((sum, value) => sum + value!, 0)
    : null;
const change = (value: number | null, previous: number | null) =>
  value === null || previous === null || previous === 0
    ? null
    : (value / previous - 1) * 100;
const share = (value: number | null, total: number | null) =>
  value === null || total === null || total === 0
    ? null
    : (value / total) * 100;
const normalize = (value: Value | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

/** Only aggregates evidence already released by the server. Temporal data remains menu-wide. */
export function createStudioAnalysisDatasets(
  data: AdminDashboardData,
  category = "all",
  metric: StudioAnalysisMetric = "views",
  locale: Locale = "fr",
): Dataset[] {
  const text = (fr: string, en: string) => (locale === "en" ? en : fr);
  const real = data.analytics.kind === "real" ? data.analytics : null;
  const ranking =
    real?.panels.ranking.kind === "supported" && Boolean(data.dishStatistics);
  const comparison = real?.panels.dailyComparison.kind === "supported";
  const allCategories = [
    ...new Set(data.menu.dishes.map((dish) => dish.category)),
  ];
  const color = (name: string) =>
    `var(--chart-category-${Math.max(0, allCategories.indexOf(name)) % 6})`;
  const labels = {
    views: text("Consultations", "Views"),
    three: text("Clics 3D", "3D clicks"),
    ar: text("Clics AR", "AR clicks"),
  };
  const metrics: Column[] = (["views", "three", "ar"] as const).map((id) => ({
    id,
    label: labels[id],
    format: "number",
  }));
  const compareColumns: Column[] = [
    { ...metrics.find((column) => column.id === metric)!, primary: true },
    {
      id: "previousMetric",
      label: text("Précédent", "Previous"),
      format: "number",
    },
    { id: "change", label: text("Évolution", "Change"), format: "delta" },
    ...metrics.filter((column) => column.id !== metric),
  ];
  const dishes = ranking
    ? data.menu.dishes
        .filter((dish) => category === "all" || dish.category === category)
        .map((dish) => {
          const stats = data.dishStatistics?.[dish.id];
          return {
            id: dish.id,
            label: dish.name,
            dishId: dish.id,
            category: dish.category,
            color: color(dish.category),
            views: stats?.views ?? null,
            three: stats?.three ?? null,
            ar: stats?.ar ?? null,
            previousViews: comparison ? (stats?.previousViews ?? null) : null,
          };
        })
    : [];
  const withComparison = (row: (typeof dishes)[number]) => {
    const previousMetric = metric === "views" ? row.previousViews : null;
    return {
      ...row,
      previousMetric,
      change: change(row[metric], previousMetric),
    };
  };
  const categories = ranking
    ? allCategories
        .filter((name) => category === "all" || category === name)
        .map((name) => {
          const rows = dishes.filter((dish) => dish.category === name);
          return {
            id: name,
            label: name,
            color: color(name),
            views: sumKnown(rows.map((row) => row.views)),
            three: sumKnown(rows.map((row) => row.three)),
            ar: sumKnown(rows.map((row) => row.ar)),
            previousViews: sumKnown(rows.map((row) => row.previousViews)),
          };
        })
    : [];
  const currentTotal = sumKnown(categories.map((row) => row[metric]));
  const previousTotal =
    comparison && metric === "views"
      ? sumKnown(categories.map((row) => row.previousViews))
      : null;
  const metricSeries = metric === "views" ? "dishOpened" : metric;
  const dateFormat = new Intl.DateTimeFormat(
    locale === "en" ? "en-CA" : "fr-CA",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
  const threeByDay = new Map(
    real?.metricSeries.three.current.map((point) => [
      point.bucket,
      point.value,
    ]),
  );
  const arByDay = new Map(
    real?.metricSeries.ar.current.map((point) => [point.bucket, point.value]),
  );
  const daily: Row[] =
    real?.panels.currentDaily.kind === "supported"
      ? real.metricSeries.dishOpened.current.map((point, index) => {
          const values = {
            views: point.value,
            three: threeByDay.get(point.bucket) ?? null,
            ar: arByDay.get(point.bucket) ?? null,
          };
          const previousMetric = comparison
            ? (real.metricSeries[metricSeries].previous[index]?.value ?? null)
            : null;
          return {
            id: point.bucket,
            label: dateFormat.format(new Date(point.bucket)),
            sortDate: point.bucket,
            ...values,
            previousMetric,
            change: change(values[metric], previousMetric),
          };
        })
      : [];
  const weekdays =
    locale === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const heatmap =
    real?.panels.hourWeekday.kind === "supported"
      ? real.panels.hourWeekday.data
      : null;
  const hours: Row[] = heatmap
    ? weekdays.flatMap((day, index) =>
        Array.from({ length: 12 }, (_, slot) => ({
          id: `${index}-${slot}`,
          label: `${day} · ${slot * 2} h–${slot * 2 + 2} h`,
          events: heatmap
            .filter(
              (cell) =>
                cell.weekdayUtc === (index + 1) % 7 &&
                cell.hourUtc >= slot * 2 &&
                cell.hourUtc < slot * 2 + 2,
            )
            .reduce((sum, cell) => sum + cell.count, 0),
        })),
      )
    : [];
  const days = real
    ? Math.ceil(
        (Date.parse(real.observationWindow.endExclusive) -
          Date.parse(real.observationWindow.startInclusive)) /
          86400000,
      )
    : 0;
  const unavailable = text(
    "Données indisponibles pour cette période : la source est incomplète.",
    "Data is unavailable for this period: the source is incomplete.",
  );
  const insufficient = text(
    "Volume insuffisant pour afficher les statistiques par plat.",
    "Insufficient evidence to display dish-level statistics.",
  );
  const rankReason =
    (!real && data.analytics.kind === "unavailable") ||
    real?.panels.ranking.kind === "unavailable"
      ? unavailable
      : insufficient;
  const historyNote =
    metric === "views"
      ? ""
      : text(" · Historique précédent N/A", " · Previous history N/A");
  return [
    {
      id: "dishes",
      label: text("Plats", "Dishes"),
      title: text("Les plats, en chiffres", "Dishes, in numbers"),
      description: `${days} ${text(days === 1 ? "jour" : "jours", days === 1 ? "day" : "days")} · ${text("sélection active", "active selection")}${historyNote}`,
      columns: [
        { id: "label", label: text("Plat", "Dish") },
        ...compareColumns,
      ],
      rows: dishes.map(withComparison),
      emptyReason: ranking ? undefined : rankReason,
    },
    {
      id: "daily",
      label: text("Par jour", "By day"),
      title: text("La lecture quotidienne", "The daily picture"),
      description: text(
        "Toutes les dates de la sélection · Menu entier · UTC",
        "All selected dates · Entire menu · UTC",
      ),
      columns: [
        { id: "label", label: "Date", sortKey: "sortDate" },
        ...compareColumns,
      ],
      rows: daily,
      emptyReason:
        data.analytics.kind === "unavailable" ||
        real?.panels.currentDaily.kind === "unavailable"
          ? unavailable
          : text(
              "Aucun événement daté disponible.",
              "No dated events are available.",
            ),
    },
    {
      id: "hours",
      label: text("Horaires", "Hours"),
      title: text("Les tranches horaires", "Time slots"),
      description: text(
        "Menu entier · tous les événements enregistrés · UTC",
        "Entire menu · all recorded events · UTC",
      ),
      columns: [
        { id: "label", label: text("Jour et heure", "Day and time") },
        {
          id: "events",
          label: text("Événements", "Events"),
          format: "number",
          primary: true,
        },
      ],
      rows: hours,
      emptyReason:
        data.analytics.kind === "unavailable" ||
        real?.panels.hourWeekday.kind === "unavailable"
          ? unavailable
          : text(
              "Aucun événement horodaté disponible.",
              "No timestamped events are available.",
            ),
    },
    {
      id: "categories",
      label: text("Catégories", "Categories"),
      title: text("Répartition des événements", "Event breakdown"),
      description: `${text("Volumes par catégorie", "Volumes by category")}${historyNote}`,
      columns: [
        { id: "label", label: text("Catégorie", "Category") },
        ...compareColumns,
      ],
      rows: categories.map((row) => {
        const previousMetric = metric === "views" ? row.previousViews : null;
        return {
          ...row,
          previousMetric,
          change: change(row[metric], previousMetric),
        };
      }),
      emptyReason: ranking ? undefined : rankReason,
    },
    {
      id: "comparison",
      label: text("Comparaison", "Comparison"),
      title: text("Profil comparé des catégories", "Category comparison"),
      description:
        comparison && metric === "views"
          ? `${labels[metric]} · ${text("périodes de même durée", "equal-duration periods")}`
          : text(
              metric !== "views"
                ? "Comparaison N/A : historique 3D/AR par catégorie indisponible"
                : "Comparaison N/A : historique précédent insuffisant",
              metric !== "views"
                ? "Comparison N/A: category 3D/AR history unavailable"
                : "Comparison N/A: insufficient previous history",
            ),
      columns: [
        { id: "label", label: text("Catégorie", "Category") },
        {
          id: "currentCount",
          label: text("Actuel", "Current"),
          format: "number",
          primary: true,
        },
        {
          id: "current",
          label: text("Part actuelle", "Current share"),
          format: "percent",
        },
        {
          id: "previousCount",
          label: text("Précédent", "Previous"),
          format: "number",
        },
        {
          id: "previous",
          label: text("Part précédente", "Previous share"),
          format: "percent",
        },
      ],
      rows: categories.map((row) => ({
        id: row.id,
        label: row.label,
        color: row.color,
        currentCount: row[metric],
        current: share(row[metric], currentTotal),
        previousCount:
          comparison && metric === "views" ? row.previousViews : null,
        previous: share(row.previousViews, previousTotal),
      })),
      emptyReason: ranking ? undefined : rankReason,
    },
  ];
}

function SortIcon({ direction }: { direction?: "asc" | "desc" }) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
  return <Icon size={14} aria-hidden />;
}
function Identity({ row, rank }: { row: Row; rank: number }) {
  return (
    <>
      <span className={css["row-number"]} aria-hidden>
        {String(rank).padStart(2, "0")}
      </span>
      <span className={css["identity-text"]}>
        <span className={css.value}>{row.label}</span>
        {row.category ? (
          <small>
            {row.color && (
              <span
                className={css.color}
                style={{ backgroundColor: String(row.color) }}
                aria-hidden
              />
            )}
            {row.category}
          </small>
        ) : row.color ? (
          <span
            className={`${css.color} ${css["identity-marker"]}`}
            style={{ backgroundColor: String(row.color) }}
            aria-hidden
          />
        ) : null}
      </span>
    </>
  );
}
function DataValue({
  value,
  column,
}: {
  value: Value | undefined;
  column: Column;
}) {
  const { locale } = useStudioLocale();
  const missing =
    value === null ||
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value));
  const delta = column.format === "delta";
  const formatter = new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
    maximumFractionDigits: 1,
    ...(column.format === "percent" || delta
      ? {
          style: "percent",
          ...(delta ? { signDisplay: "exceptZero" as const } : {}),
        }
      : {}),
  });
  const text = missing
    ? "N/A"
    : typeof value === "number"
      ? formatter.format(
          column.format === "percent" || delta ? value / 100 : value,
        )
      : value;
  const tone =
    missing || value === 0
      ? "neutral"
      : Number(value) > 0
        ? "positive"
        : "negative";
  return (
    <span
      className={`${css.value} ${delta ? css.delta : ""} ${missing ? css.missing : ""}`}
      data-delta={delta ? tone : undefined}
      data-direction={
        delta && !missing
          ? Number(value) > 0
            ? "up"
            : Number(value) < 0
              ? "down"
              : "flat"
          : undefined
      }
    >
      {text}
    </span>
  );
}

function DatasetPanel({
  dataset,
  metric,
  contextKey,
  onDishOpen,
  onExport,
}: {
  dataset: Dataset;
  metric: StudioAnalysisMetric;
  contextKey: string;
  onDishOpen?: (id: string) => void;
  onExport?: () => void;
}) {
  const { locale, number } = useStudioLocale();
  const text = (fr: string, en: string) => (locale === "en" ? en : fr);
  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [sortingState, setSortingState] = useState<{
    metric: StudioAnalysisMetric;
    value: SortingState;
  } | null>(null);
  const [pageState, setPageState] = useState<{
    key: string;
    value: PaginationState;
  }>({ key: contextKey, value: { pageIndex: 0, pageSize: 15 } });
  const columns = dataset.columns;
  const primary =
    columns.find((column) => column.primary) ??
    columns.find((column) => column.id === metric) ??
    columns.find((column) => column.format);
  const delta = columns.find(
    (column) => column.format === "delta" && column.id !== primary?.id,
  );
  const secondary = columns
    .slice(1)
    .filter((column) => column.id !== primary?.id && column.id !== delta?.id);
  const sorting = useMemo<SortingState>(
    () =>
      sortingState?.metric === metric
        ? sortingState.value
        : columns.some((column) => column.id === metric)
          ? [{ id: metric, desc: true }]
          : [],
    [sortingState, columns, metric],
  );
  const pagination = useMemo(
    () =>
      pageState.key === contextKey
        ? pageState.value
        : { pageIndex: 0, pageSize: 15 },
    [pageState, contextKey],
  );
  const columnDefinitions = useMemo<ColumnDef<typeof features, Row>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.label,
        accessorFn: (row) =>
          row[column.id] === null ||
          (typeof row[column.id] === "number" &&
            !Number.isFinite(row[column.id]))
            ? undefined
            : row[column.id],
        sortFn: column.sortKey
          ? (a, b) =>
              String(a.original[column.sortKey!]).localeCompare(
                String(b.original[column.sortKey!]),
              )
          : column.format
            ? sortFn_basic
            : sortFn_alphanumeric,
        sortUndefined: "last",
        sortDescFirst: false,
      })),
    [columns],
  );
  const table = useTable({
    features,
    data: dataset.rows,
    columns: columnDefinitions,
    state: { globalFilter: query, sorting, pagination },
    onGlobalFilterChange: setQuery,
    onSortingChange: (updater) => {
      setSortingState({
        metric,
        value: typeof updater === "function" ? updater(sorting) : updater,
      });
      setPageState({ key: contextKey, value: { pageIndex: 0, pageSize: 15 } });
    },
    onPaginationChange: (updater) =>
      setPageState((previous) => {
        const current =
          previous.key === contextKey
            ? previous.value
            : { pageIndex: 0, pageSize: 15 };
        return {
          key: contextKey,
          value: typeof updater === "function" ? updater(current) : updater,
        };
      }),
    globalFilterFn: (row, columnId, value: string) =>
      normalize(row.getValue<Value>(columnId)).includes(
        normalize(value).trim(),
      ) ||
      (columnId === "label" &&
        normalize(row.original.category).includes(normalize(value).trim())),
    enableMultiSort: false,
    enableSortingRemoval: false,
    autoResetPageIndex: true,
    getRowId: (row) => row.id,
  });
  const visible = table.getRowModel().rows.map((row) => row.original);
  const resultCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const page = Math.min(pagination.pageIndex, pageCount - 1);
  const sort = sorting[0] ?? { id: "", desc: false };
  const first = resultCount ? page * 15 + 1 : 0;
  const last = resultCount
    ? Math.min(first + visible.length - 1, resultCount)
    : 0;
  const setSort = (id: string, desc: boolean) =>
    table.setSorting(id ? [{ id, desc }] : []);
  const search = (value: string) => {
    setQuery(value);
    table.setPageIndex(0);
  };
  const empty = (
    <div className={css.empty}>
      <strong>
        {query
          ? text("Aucun résultat", "No results")
          : text("Aucune donnée", "No data")}
      </strong>
      <p>
        {query
          ? text(
              "Essayez un autre nom ou effacez votre recherche.",
              "Try another name or clear your search.",
            )
          : (dataset.emptyReason ??
            text(
              "Les données apparaîtront ici dès qu’elles seront disponibles.",
              "Data will appear here when it becomes available.",
            ))}
      </p>
    </div>
  );
  return (
    <section
      className={css.panel}
      aria-labelledby={titleId}
      data-dataset={dataset.id}
    >
      <div className={css.heading}>
        <div className={css["heading-copy"]}>
          <div className={css.eyebrow}>
            {text("Données détaillées", "Detailed data")}
            <span className={css.total}>
              {number(dataset.rows.length)}{" "}
              {text(
                dataset.rows.length === 1 ? "ligne" : "lignes",
                dataset.rows.length === 1 ? "row" : "rows",
              )}
            </span>
          </div>
          <h2 id={titleId}>{dataset.title}</h2>
          <p id={descriptionId}>{dataset.description}</p>
        </div>
        {onExport && (
          <button
            type="button"
            className={css.export}
            aria-label={text(
              "Exporter toutes les données de la période sélectionnée",
              "Export all data for the selected period",
            )}
            onClick={onExport}
          >
            <Download size={16} aria-hidden />
            <span>{text("Exporter la période", "Export period")}</span>
          </button>
        )}
      </div>
      <div className={css.filterbar}>
        <div className={`${css["search-wrap"]} ${css.search}`}>
          <StudioSearch
            value={query}
            onChange={search}
            label={`${text("Rechercher dans", "Search")} ${dataset.label}`}
            placeholder={text(
              "Rechercher dans les données…",
              "Search the data…",
            )}
          />
          {query && (
            <button
              type="button"
              className={css.clear}
              aria-label={text("Effacer la recherche", "Clear search")}
              onClick={() => search("")}
            >
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
        <span
          className={css["result-count"]}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {number(resultCount)}{" "}
          {text(
            resultCount === 1 ? "résultat" : "résultats",
            resultCount === 1 ? "result" : "results",
          )}
          {query
            ? text(resultCount === 1 ? " trouvé" : " trouvés", " found")
            : ""}
        </span>
        <div className={css["mobile-sort"]}>
          <label htmlFor={searchId}>{text("Trier par", "Sort by")}</label>
          <select
            id={searchId}
            aria-label={text("Trier les données", "Sort data")}
            value={sort.id}
            onChange={(event) => setSort(event.target.value, false)}
          >
            <option value="">
              {text("Ordre d’origine", "Original order")}
            </option>
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={css.button}
            disabled={!sort.id}
            aria-label={
              sort.desc
                ? text("Trier par ordre croissant", "Sort ascending")
                : text("Trier par ordre décroissant", "Sort descending")
            }
            onClick={() => setSort(sort.id, !sort.desc)}
          >
            <SortIcon direction={sort.desc ? "desc" : "asc"} />
          </button>
        </div>
      </div>
      <div
        className={css.scroll}
        tabIndex={0}
        role="region"
        aria-label={`${text("Tableau", "Table")} ${dataset.label}, ${text("défilement horizontal", "horizontal scrolling")}`}
      >
        <table
          className={css.table}
          aria-label={dataset.title}
          aria-describedby={descriptionId}
        >
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.id}
                  scope="col"
                  data-column={column.id}
                  className={`${index === 0 ? css.identity : css.numeric} ${column.id === primary?.id ? css.primary : ""}`}
                  aria-sort={
                    sort.id === column.id
                      ? sort.desc
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    className={css["header-sort"]}
                    aria-label={`${text("Trier par", "Sort by")} ${column.label}, ${sort.id === column.id && !sort.desc ? text("ordre décroissant", "descending") : text("ordre croissant", "ascending")}`}
                    onClick={table
                      .getColumn(column.id)
                      ?.getToggleSortingHandler()}
                  >
                    <span>{column.label}</span>
                    <SortIcon
                      direction={
                        sort.id === column.id
                          ? sort.desc
                            ? "desc"
                            : "asc"
                          : undefined
                      }
                    />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((row, index) => (
                <tr key={row.id} data-row-id={row.id}>
                  {columns.map((column, columnIndex) =>
                    columnIndex === 0 ? (
                      <th
                        key={column.id}
                        scope="row"
                        className={css.identity}
                        data-column={column.id}
                      >
                        {row.dishId !== undefined && onDishOpen ? (
                          <button
                            type="button"
                            className={`${css.dish} ${css.name}`}
                            data-dish-id={row.dishId}
                            onClick={() => onDishOpen(String(row.dishId))}
                          >
                            <Identity row={row} rank={first + index} />
                            <ArrowRight size={15} aria-hidden />
                          </button>
                        ) : (
                          <div className={css.name}>
                            <Identity row={row} rank={first + index} />
                          </div>
                        )}
                      </th>
                    ) : (
                      <td
                        key={column.id}
                        data-column={column.id}
                        data-label={column.label}
                        className={`${css.numeric} ${column.id === primary?.id ? css.primary : ""}`}
                      >
                        <DataValue value={row[column.id]} column={column} />
                      </td>
                    ),
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ol
        className={css["mobile-list"]}
        aria-label={dataset.title}
        start={first || 1}
      >
        {visible.length ? (
          visible.map((row, index) => {
            const canOpenDish = row.dishId !== undefined && Boolean(onDishOpen);
            const hasDetails = secondary.length > 0 || canOpenDish;
            const summary = (
              <>
                <span className={css["mobile-identity"]}>
                  <Identity row={row} rank={first + index} />
                </span>
                {primary && (
                  <span
                    className={css["mobile-primary"]}
                    data-column={primary.id}
                  >
                    <DataValue value={row[primary.id]} column={primary} />
                    <span className={css["mobile-primary-label"]}>
                      {primary.label}
                    </span>
                    {delta && (
                      <span className={css["mobile-change"]}>
                        <span className={css["sr-only"]}>{delta.label} : </span>
                        <DataValue value={row[delta.id]} column={delta} />
                      </span>
                    )}
                  </span>
                )}
                {hasDetails && (
                  <ChevronDown
                    className={css["mobile-chevron"]}
                    size={15}
                    aria-hidden
                  />
                )}
              </>
            );
            return (
              <li key={row.id} data-row-id={row.id}>
                {hasDetails ? (
                  <details className={css["mobile-details"]}>
                    <summary className={css["mobile-summary"]}>
                      {summary}
                      <span className={css["sr-only"]}>
                        {text(", détails", ", details")}
                      </span>
                    </summary>
                    <div className={css["mobile-expanded"]}>
                      <dl>
                        {secondary.map((column) => (
                          <div key={column.id}>
                            <dt>{column.label}</dt>
                            <dd data-column={column.id}>
                              <DataValue
                                value={row[column.id]}
                                column={column}
                              />
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {canOpenDish && (
                        <button
                          type="button"
                          className={css["mobile-dish"]}
                          data-dish-id={row.dishId}
                          onClick={() => onDishOpen?.(String(row.dishId))}
                        >
                          {text("Voir le plat", "View dish")}
                          <ArrowRight size={15} aria-hidden />
                        </button>
                      )}
                    </div>
                  </details>
                ) : (
                  <div className={css["mobile-summary"]}>{summary}</div>
                )}
              </li>
            );
          })
        ) : (
          <li>{empty}</li>
        )}
      </ol>
      <div className={css.pagination}>
        <span>
          {number(first)}–{number(last)} {text("sur", "of")}{" "}
          {number(resultCount)}
        </span>
        <div className={css["page-controls"]}>
          <button
            type="button"
            className={css.button}
            aria-label={text("Page précédente", "Previous page")}
            disabled={!table.getCanPreviousPage() || !resultCount}
            onClick={() => table.previousPage()}
          >
            <ArrowLeft size={16} aria-hidden />
          </button>
          <span className={css["page-status"]}>
            Page {page + 1} {text("sur", "of")} {pageCount}
          </span>
          <button
            type="button"
            className={css.button}
            aria-label={text("Page suivante", "Next page")}
            disabled={!table.getCanNextPage() || !resultCount}
            onClick={() => table.nextPage()}
          >
            <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}

export function StudioAnalysisTables({
  data,
  category = "all",
  metric = "views",
  onDishOpen,
  onExport,
}: {
  data: AdminDashboardData;
  category?: string;
  metric?: StudioAnalysisMetric;
  onDishOpen?: (dish: AdminMenuDish) => void;
  onExport?: () => void;
}) {
  const { locale } = useStudioLocale();
  const [active, setActive] = useState("dishes");
  const datasets = useMemo(
    () => createStudioAnalysisDatasets(data, category, metric, locale),
    [data, category, metric, locale],
  );
  const selected = datasets.find((dataset) => dataset.id === active)!;
  const real = data.analytics.kind === "real" ? data.analytics : null;
  const contextKey = `${category}:${metric}:${real?.observationWindow.startInclusive}:${real?.observationWindow.endExclusive}`;
  return (
    <div
      className={css.workspace}
      data-analysis-tables
      data-table-library="@tanstack/react-table@9.2.8"
    >
      <div className={css.toolbar}>
        <div
          className={css.datasets}
          role="group"
          aria-label={locale === "en" ? "Dataset" : "Jeu de données"}
        >
          {datasets.map((dataset, index) => (
            <button
              key={dataset.id}
              type="button"
              className={css.dataset}
              aria-label={dataset.label}
              aria-pressed={dataset.id === active}
              onClick={() => setActive(dataset.id)}
            >
              <span className={css["dataset-index"]} aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{dataset.label}</span>
            </button>
          ))}
        </div>
      </div>
      <DatasetPanel
        key={selected.id}
        dataset={selected}
        metric={metric}
        contextKey={contextKey}
        onDishOpen={
          onDishOpen
            ? (id) => {
                const dish = data.menu.dishes.find((item) => item.id === id);
                if (dish) onDishOpen(dish);
              }
            : undefined
        }
        onExport={onExport}
      />
    </div>
  );
}
