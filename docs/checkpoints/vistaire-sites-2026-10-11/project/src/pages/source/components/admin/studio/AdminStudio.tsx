"use client";
import { useStudioLocale } from "./studioLocale";
import Link from "next/link";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Utensils,
  CalendarDays,
  Download,
  Sun,
  Moon,
  ExternalLink,
  Copy,
  LogOut,
  ArrowUpRight,
  Eye,
  Box,
  ScanLine,
  MousePointerClick,
  AlertCircle,
  Expand,
} from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminDashboardRange } from "@/lib/admin/dashboardRange";
import type { AdminMenuDish } from "@/lib/admin/menuReadiness";
import type { AdminMetricSeriesId } from "@/lib/admin/analyticsState";
import { StudioTrend, StudioBars, StudioHeatmap } from "./StudioCharts";
import { StudioAnalysisCharts } from "./StudioAnalysisCharts";
import { StudioDishes } from "./StudioDishes";
import { StudioDialog } from "./StudioDialog";
import { StudioExportDialog } from "./StudioExportDialog";
import styles from "./Studio.module.css";
import { useStudioTheme } from "./studioTheme";
import { setPublicTheme } from "@/lib/publicTheme";

export type StudioPage = "overview" | "insights" | "dishes" | "planning";
const basePages = [
  {
    id: "overview",
    label: "Vue d’ensemble",
    href: "/admin",
    Icon: LayoutDashboard,
  },
  {
    id: "insights",
    label: "Analyses",
    href: "/admin/insights",
    Icon: ChartNoAxesCombined,
  },
  {
    id: "dishes",
    label: "Les plats",
    href: "/admin/availability",
    Icon: Utensils,
  },
  {
    id: "planning",
    label: "Planning",
    href: "/admin/planning",
    Icon: CalendarDays,
  },
] as const;
const baseMetrics = [
  {
    id: "menu-opens",
    series: "menuOpened",
    label: "Ouvertures du menu",
    Icon: MousePointerClick,
  },
  {
    id: "dish-opens",
    series: "dishOpened",
    label: "Consultations de plats",
    Icon: Eye,
  },
  { id: "three", series: "three", label: "Clics 3D", Icon: Box },
  { id: "ar", series: "ar", label: "Clics AR", Icon: ScanLine },
  { id: "immersive", series: "immersive", label: "Clics 3D et AR", Icon: Box },
  { id: "searches", series: "searches", label: "Recherches", Icon: ScanLine },
] as const;
function Delta({ rate }: { rate: number | null | undefined }) {
 const {t}=useStudioLocale();
  return (
    <span
      className={styles.delta}
      data-direction={
        rate == null || rate === 0 ? "neutral" : rate > 0 ? "up" : "down"
      }
    >
      {rate == null
        ? t("Comparaison N/A")
        : `${rate > 0 ? "+" : ""}${Math.round(rate * 100)} %`}{" "}
      <span className={styles.muted}>
        {rate == null ? "" : t("vs période précédente")}
      </span>
    </span>
  );
}
function Evidence({ data }: { data: AdminDashboardData }) {
 const {t}=useStudioLocale();
  return (
    <div className={styles.empty}>
      <AlertCircle size={26} />
      <strong>
        {data.analytics.kind === "unavailable"
          ? t("Données indisponibles")
          : t("Pas encore assez de données")}
      </strong>
      <p>
        {data.analytics.kind === "unavailable"
          ? t("La lecture est incomplète. Réessayez plus tard ; aucun chiffre partiel n’est présenté comme un total.")
          : t("Les premiers chiffres apparaîtront lorsque suffisamment de consultations auront été enregistrées.")}
      </p>
    </div>
  );
}

export function AdminStudio({
  data,
  range,
  page,
  canWrite = false,
  demo = false,
  demoRanges = ["today-utc", "7d", "30d"],
  onPageChange,
  onRangeChange,
}: {
  data: AdminDashboardData;
  range: AdminDashboardRange;
  page: StudioPage;
  canWrite?: boolean;
  demo?: boolean;
  demoRanges?: AdminDashboardRange[];
  onPageChange?: (page: StudioPage) => void;
  onRangeChange?: (range: AdminDashboardRange) => void;
}) {
  const {t,locale,number,date:formatDate}=useStudioLocale();
 const pages=basePages.map(item=>({...item,label:t(item.label)}));
 const metrics=baseMetrics.map(item=>({...item,label:t(item.label)}));
  const router = useRouter();
  const theme = useStudioTheme(demo);
  const Content = demo ? "section" : "main";
  const Heading = demo ? "h2" : "h1";
  const mainId = demo ? "studio-preview-main" : "studio-main";
  const [datesOpen, setDatesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] =
    useState<AdminMetricSeriesId>("dishOpened");
  const [explore, setExplore] = useState<AdminMetricSeriesId | null>(null);
  const [dish, setDish] = useState<AdminMenuDish | null>(null);
  const [scheduleDish, setScheduleDish] = useState<AdminMenuDish | null>(null);
  const [notice, setNotice] = useState("");
  const active = pages.find((item) => item.id === page)!;
  const analytics = data.analytics;
  const real = analytics.kind === "real" ? analytics : null;
  const comparable = real?.panels.dailyComparison.kind === "supported";
  const selected = metrics.find((item) => item.series === selectedMetric)!;
  const rangeLabel =
    analytics.kind !== "unavailable"
      ? `${formatDate(analytics.observationWindow.startInclusive)} ${locale === "en" ? "to" : "au"} ${formatDate(new Date(Date.parse(analytics.observationWindow.endExclusive) - 1).toISOString())}`
      : t("Période indisponible");
  const metricValue = (id: string) =>
    real?.metrics.find((item) => item.id === id);
  const dishMap = useMemo(
    () => new Map(data.menu.dishes.map((item) => [item.slug, item])),
    [data.menu.dishes],
  );
  const ranking =
    real?.panels.ranking.kind === "supported" ? real.panels.ranking.data : [];
  const categories =
    real?.panels.categories.kind === "supported"
      ? real.panels.categories.data
      : [];
  const heatmap =
    real?.panels.hourWeekday.kind === "supported"
      ? real.panels.hourWeekday.data
      : null;
  function toggleTheme() {
    if (demo) {
      setPublicTheme(theme === "dark" ? "light" : "dark");
      return;
    }
    try {
      localStorage.setItem(
        "vistaire-studio-theme",
        theme === "dark" ? "light" : "dark",
      );
      window.dispatchEvent(new Event("vistaire-studio-theme"));
    } catch {
      setNotice(t("Le thème ne peut pas être enregistré dans ce navigateur."));
    }
  }
  async function copyMenu() {
    try {
      await navigator.clipboard.writeText(
        new URL(data.restaurant.publicMenuPath, window.location.origin).href,
      );
      setNotice(t("Lien du menu copié"));
    } catch {
      setNotice(
        t("Impossible de copier le lien. Vous pouvez ouvrir le menu puis copier son adresse."),
      );
    }
  }
  const trendPanel = (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <h2>
            {page === "overview"
              ? t("L’activité de votre menu")
              : t("Évolution dans le temps")}
          </h2>
          <p>{rangeLabel}{t("· heures UTC")}</p>
        </div>
        <select
          aria-label={t("Indicateur du graphique")}
          value={selectedMetric}
          onChange={(event) =>
            setSelectedMetric(event.target.value as AdminMetricSeriesId)
          }
        >
          {metrics.map((item) => (
            <option value={item.series} key={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </header>
      {real ? (
        <>
          <div className={styles.chartTotal}>
            <strong>{number(metricValue(selected.id)?.value)}</strong>
            <span>{selected.label.toLowerCase()}</span>
            <button
              aria-label={`${locale === "en" ? "Expand" : "Agrandir"} ${selected.label.toLowerCase()}`}
              onClick={() => setExplore(selectedMetric)}
            >
              <Expand size={16} />
            </button>
          </div>
          <div className={styles.chartBody}>
            <StudioTrend
              series={real.metricSeries[selectedMetric]}
              label={selected.label}
              comparison={Boolean(comparable)}
            />
          </div>
        </>
      ) : (
        <Evidence data={data} />
      )}
    </section>
  );
  const dishRanking = (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2>{t("Les plats les plus consultés")}</h2>
        {demo ? (
          <button onClick={() => onPageChange?.("dishes")}>{t("Tous les plats")}<ArrowUpRight size={15} />
          </button>
        ) : (
          <Link href={`/admin/availability?range=${range}`}>{t("Tous les plats")}<ArrowUpRight size={15} />
          </Link>
        )}
      </header>
      {ranking.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("Plat")}</th>
                <th>{t("Consultations")}</th>
                <th>{t("Évolution")}</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 8).map((row, index) => {
                const item = dishMap.get(row.slug);
                return (
                  <tr key={row.slug}>
                    <td>
                      <button onClick={() => item && setDish(item)}>
                        {index + 1}. {item?.name ?? row.label ?? row.slug}
                      </button>
                      <small>{item?.category}</small>
                    </td>
                    <td>{number(row.count)}</td>
                    <td>
                      <Delta
                        rate={
                          item
                            ? data.dishStatistics?.[item.id]?.changeRate
                            : null
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Evidence data={data} />
      )}
    </section>
  );
  return (
    <div
      className={styles.studio}
      data-theme={theme}
      data-admin-studio
      data-demo={demo || undefined}
    >
      <a className={styles.skip} href={`#${mainId}`}>{t("Aller au contenu")}</a>
      <aside className={styles.sidebar}>
        <div className={styles.wordmark}>
          vistaire<span>RESTAURANT STUDIO</span>
        </div>
        <div className={styles.restaurant}>
          <span className={styles.seal}>{data.restaurant.name[0]}</span>
          <div>
            <strong>{data.restaurant.name}</strong>
            <small>{t("ESPACE RESTAURATEUR")}</small>
          </div>
        </div>
        <div className={styles.navLabel}>{t("VOTRE RESTAURANT")}</div>
        <nav className={styles.nav} aria-label={t("Navigation principale")}>
          {pages.map(({ id, label, href, Icon }) =>
            demo ? (
              <button
                key={id}
                onClick={() => onPageChange?.(id)}
                aria-current={id === page ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ) : (
              <Link
                key={id}
                href={`${href}?range=${range}`}
                aria-current={id === page ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ),
          )}
        </nav>
        <div className={styles.sidebarFoot}>
          <Link
            href={data.restaurant.publicMenuPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />{t("Ouvrir le menu client")}</Link>
          {!demo && (
            <form action="/admin/logout" method="post">
              <button type="submit">
                <LogOut size={16} />{t("Déconnexion")}</button>
            </form>
          )}
        </div>
      </aside>
      <Content id={mainId} className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <span>{data.restaurant.name} /</span>
            <b>{active.label}</b>
          </div>
          <div className={styles.topActions}>
            <span className={styles.accountStatus}>
              {demo
                ? t("Démonstration")
                : canWrite
                  ? t("Espace privé")
                  : t("Lecture seule")}
            </span>
            <button onClick={copyMenu} aria-label={t("Copier le lien du menu")}>
              <Copy size={17} />
            </button>
            {!demo && (
              <form
                action="/admin/logout"
                method="post"
                className={styles.mobileLogout}
              >
                <button type="submit" aria-label={t("Déconnexion")}>
                  <LogOut size={17} />
                </button>
              </form>
            )}
            <button
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? t("Passer au thème clair")
                  : t("Passer au thème sombre")
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              href={data.restaurant.publicMenuPath}
              className={styles.button}
              aria-label={t("Ouvrir le menu client")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={17} />
            </Link>
          </div>
        </header>
        <div className={styles.content}>
          <header className={styles.pageHead}>
            <Heading>{active.label}</Heading>
            <div className={styles.toolbar}>
              <label>
                <span className={styles.srOnly}>{t(demo ? "Période fictive (UTC)" : "Période des statistiques")}</span>
                <select
                  value={range}
                  onChange={(event) =>
                    event.target.value === "custom"
                      ? setDatesOpen(true)
                      : demo
                        ? onRangeChange?.(
                            event.target.value as AdminDashboardRange,
                          )
                        : router.push(
                            `${active.href}?range=${encodeURIComponent(event.target.value)}`,
                          )
                  }
                >
                  {(!demo || demoRanges.includes("today-utc")) && (
                    <option value="today-utc">{t(demo ? "1 journée exemple" : "Aujourd’hui (UTC)")}</option>
                  )}
                  {(!demo || demoRanges.includes("7d")) && (
                    <option value="7d">{t(demo ? "7 jours exemple" : "7 derniers jours")}</option>
                  )}
                  {(!demo || demoRanges.includes("30d")) && (
                    <option value="30d">{t(demo ? "30 jours exemple" : "30 derniers jours")}</option>
                  )}
                  {(!demo || demoRanges.includes("90d")) && (
                    <option value="90d">{t("90 derniers jours")}</option>
                  )}
                  {(!demo || demoRanges.includes("365d")) && (
                    <option value="365d">{t("365 derniers jours")}</option>
                  )}
                  {(!demo || demoRanges.includes("month")) && (
                    <option value="month">{t("Ce mois-ci")}</option>
                  )}
                  {(!demo || demoRanges.includes("year")) && (
                    <option value="year">{t("Cette année")}</option>
                  )}
                  {range.startsWith("custom:") && (
                    <option value={range}>{rangeLabel}</option>
                  )}
                  {!demo && <option value="custom">{t("Choisir des dates…")}</option>}
                </select>
              </label>
              <button onClick={() => setExportOpen(true)}>
                <Download size={17} />
                <span>{t("Exporter")}</span>
              </button>
            </div>
          </header>
          {demo && (
            <p className={styles.demoBanner} data-studio-preview-banner>{t("Démonstration · données fictives. Aucun restaurant réel n’est connecté ; les disponibilités sont en lecture seule.")} {t("Données de démonstration uniquement. Les répartitions 3D/AR et comparaisons par plat sont illustratives.")}</p>
          )}
          {notice && (
            <p className={styles.feedback} role="status">
              {notice}
              <button onClick={() => setNotice("")}>{t("Fermer")}</button>
            </p>
          )}
          {page === "overview" && (
            <>
              <div className={styles.contextRow}>
                <p>{rangeLabel}{t("· données du menu")}</p>
                {demo ? (
                  <button onClick={() => onPageChange?.("dishes")}>{t("Gérer les plats · démonstration")}</button>
                ) : (
                  <Link href={`/admin/availability?range=${range}`}>
                    <strong>
                      {data.menu.readiness.counts.available} /{" "}
                      {data.menu.dishes.length}
                    </strong>{" "}{t("plats disponibles")}<small>{t("Gérer les plats")}</small>
                    <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
              <div className={styles.kpis}>
                {metrics.slice(0, 4).map(({ id, series, label, Icon }) => (
                  <button
                    key={id}
                    className={styles.kpi}
                    onClick={() => setExplore(series)}
                  >
                    <span className={styles.kpiLabel}>
                      <Icon size={15} />
                      {label}
                    </span>
                    <strong>{number(metricValue(id)?.value)}</strong>
                    <Delta
                      rate={comparable ? metricValue(id)?.changeRate : null}
                    />
                  </button>
                ))}
              </div>
              <div className={styles.grid}>
                {trendPanel}
                {dishRanking}
              </div>
              {heatmap && (
                <section className={styles.panel} style={{ marginTop: 18 }}>
                  <header className={styles.panelHead}>
                    <div>
                      <h2>{t("Quand votre menu est consulté")}</h2>
                      <p>{t("Événements enregistrés par jour et heure UTC")}</p>
                    </div>
                  </header>
                  <div className={styles.chartBody}>
                    <StudioHeatmap cells={heatmap} />
                  </div>
                </section>
              )}
            </>
          )}
          {page === "insights" && (
            <>
              <div className={styles.contextRow}>
                <p>{rangeLabel}{t("· comparaison à durée égale")}</p>
                <span>{t("Consultations et clics, sans estimation de ventes")}</span>
              </div>
              {trendPanel}
              <div className={styles.twoColumns}>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>{t("Par catégorie")}</h2>
                  </header>
                  {categories.length ? (
                    <div className={styles.chartBody}>
                      <StudioBars
                        rows={categories.map((row) => ({
                          label: row.label ?? row.slug,
                          count: row.count,
                        }))}
                        label={t("Consultations")}
                      />
                    </div>
                  ) : (
                    <Evidence data={data} />
                  )}
                </section>
                {dishRanking}
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>{t("Par moment de la journée")}</h2>
                  </header>
                  {real?.panels.serviceWindows.kind === "supported" ? (
                    <div className={styles.chartBody}>
                      <StudioBars
                        rows={real.panels.serviceWindows.data.windows.map(
                          (row) => ({ label: row.label, count: row.count }),
                        )}
                        label={t("Événements (UTC)")}
                      />
                    </div>
                  ) : (
                    <Evidence data={data} />
                  )}
                </section>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>{t("Recherches fréquentes")}</h2>
                  </header>
                  {real?.panels.searches.kind === "supported" ? (
                    <div className={styles.barList}>
                      {real.panels.searches.data.slice(0, 10).map((row) => (
                        <div
                          className={styles.barRow}
                          key={row.term}
                          style={
                            {
                              "--bar-width": `${(row.count / Math.max(...(real.panels.searches.kind === "supported" ? real.panels.searches.data.map((item) => item.count) : [1]))) * 100}%`,
                            } as React.CSSProperties
                          }
                        >
                          <span>{row.term}</span>
                          <strong>{number(row.count)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>
                      <p>{t("Aucune recherche suffisamment fréquente à afficher. Les termes personnels restent exclus.")}</p>
                    </div>
                  )}
                </section>
              </div>
              {heatmap && (
                <section className={styles.panel} style={{ marginTop: 18 }}>
                  <header className={styles.panelHead}>
                    <h2>{t("Jours et heures d’activité")}</h2>
                  </header>
                  <div className={styles.chartBody}>
                    <StudioHeatmap cells={heatmap} />
                  </div>
                </section>
              )}
              <StudioAnalysisCharts data={data} />
              <details className={styles.dataDisclosure}>
                <summary>{t("Comment lire ces chiffres")}</summary>
                <p>{t("Les ouvertures, consultations, recherches et clics 3D/AR sont des événements enregistrés sur ce menu. Ils ne représentent ni des personnes uniques ni des achats. Les heures sont en UTC. Les chiffres ne sont affichés que lorsque les sources sont complètes et le volume suffisant. Une comparaison sans période précédente exploitable reste N/A.")}</p>
              </details>
            </>
          )}
          {page === "dishes" && (
            <>
              <div className={styles.contextRow}>
                <p>{t("Les chiffres de chaque plat et leur disponibilité, au même endroit")}</p>
                <span>{data.menu.dishes.length}{t("plats au menu")}</span>
              </div>
              <StudioDishes
                key={`${data.restaurant.id}:${data.menu.id}`}
                data={data}
                canWrite={!demo && canWrite}
                demo={demo}
                onDish={setDish}
                onSchedule={setScheduleDish}
              />
            </>
          )}
          {page === "planning" && (
            <>
              <p className={styles.notice}>
                <strong>{t("Planning des disponibilités")}</strong>{t("· Les horaires automatiques nécessitent le service de planification du restaurant. Aucune règle simulée n’est enregistrée.")}</p>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <h2>{t("Les horaires de vos plats")}</h2>
                    <p>{t("Choisissez un plat pour consulter sa planification.")}</p>
                  </div>
                </header>
                <div className={styles.planningList}>
                  {data.menu.dishes.map((item) => (
                    <div key={item.id} className={styles.planningItem}>
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.category}</small>
                      </div>
                      <button onClick={() => setScheduleDish(item)}>
                        <CalendarDays size={16} />{t("Planifier")}</button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          <footer className={styles.footer}>
            <span>{data.restaurant.name} · Vistaire Studio</span>
            <span>
              {real?.lastUpdatedAt
                ? `${t(demo ? "Jeu de démonstration" : "Dernier événement")} : ${formatDate(real.lastUpdatedAt)} (UTC)`
                : t("Aucun événement récent confirmé")}
            </span>
          </footer>
        </div>
      </Content>
      {datesOpen && (
        <StudioDialog
          title={t("Choisir une période")}
          onClose={() => setDatesOpen(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const from = String(form.get("from"));
              const to = String(form.get("to"));
              if (
                from > to ||
                Date.parse(to) - Date.parse(from) >= 730 * 86400000
              ) {
                setNotice(
                  t("Choisissez une période de 730 jours maximum avec une fin après le début."),
                );
                return;
              }
              router.push(
                `${active.href}?range=${encodeURIComponent(`custom:${from}:${to}`)}`,
              );
              setDatesOpen(false);
            }}
          >
            <div className={styles.dialogBody}>
              <div className={styles.formGrid}>
                <label>{t("Du (inclus)")}<input
                    name="from"
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    defaultValue={
                      analytics.kind !== "unavailable"
                        ? analytics.observationWindow.startInclusive.slice(
                            0,
                            10,
                          )
                        : ""
                    }
                  />
                </label>
                <label>{t("Au (inclus)")}<input
                    name="to"
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    defaultValue={
                      analytics.kind !== "unavailable"
                        ? new Date(
                            Date.parse(
                              analytics.observationWindow.endExclusive,
                            ) - 1,
                          )
                            .toISOString()
                            .slice(0, 10)
                        : ""
                    }
                  />
                </label>
              </div>
              <p className={styles.muted}>{t("Dates en UTC · 730 jours maximum. Une période dépassant la limite de lecture sera indiquée comme indisponible.")}</p>
            </div>
            <div className={styles.dialogFooter}>
              <button type="button" onClick={() => setDatesOpen(false)}>{t("Annuler")}</button>
              <button className={styles.primary} type="submit">{t("Appliquer")}</button>
            </div>
          </form>
        </StudioDialog>
      )}
      {exportOpen && (
        <StudioExportDialog
          data={data}
          synthetic={demo}
          onClose={() => setExportOpen(false)}
        />
      )}
      {explore && (
        <StudioDialog
          title={metrics.find((item) => item.series === explore)!.label}
          onClose={() => setExplore(null)}
        >
          <div className={styles.dialogBody}>
            {real ? (
              <>
                <div className={styles.metricSummary}>
                  <div>
                    <span>{t("Période sélectionnée")}</span>
                    <strong>
                      {number(
                        metricValue(
                          metrics.find((item) => item.series === explore)!.id,
                        )?.value,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{t("Période précédente")}</span>
                    <strong>
                      {comparable
                        ? number(
                            real.metricSeries[explore].previous.reduce(
                              (sum, row) => sum + row.value,
                              0,
                            ),
                          )
                        : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span>{t("Évolution")}</span>
                    <strong>
                      <Delta
                        rate={
                          comparable
                            ? metricValue(
                                metrics.find((item) => item.series === explore)!
                                  .id,
                              )?.changeRate
                            : null
                        }
                      />
                    </strong>
                  </div>
                </div>
                <StudioTrend
                  series={real.metricSeries[explore]}
                  label={metrics.find((item) => item.series === explore)!.label}
                  comparison={Boolean(comparable)}
                />
              </>
            ) : (
              <Evidence data={data} />
            )}
          </div>
        </StudioDialog>
      )}
      {dish && (
        <StudioDialog title={dish.name} onClose={() => setDish(null)}>
          <div className={styles.dialogBody}>
            <p className={styles.muted}>
              {dish.category} · {rangeLabel}
            </p>
            <div className={styles.metricSummary}>
              {[
                [t("Consultations"), data.dishStatistics?.[dish.id]?.views],
                [t("Clics 3D"), data.dishStatistics?.[dish.id]?.three],
                [t("Clics AR"), data.dishStatistics?.[dish.id]?.ar],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>{number(value as number | undefined)}</strong>
                </div>
              ))}
            </div>
            <p>{dish.description}</p>
            <span
              className={styles.status}
              data-status={dish.available ? "available" : "unavailable"}
            >
              {dish.available ? t("Disponible") : t("Indisponible")}
            </span>
            <p className={styles.muted}>{t("Les clics ne sont pas des commandes. N/A signifie que les données ne sont pas suffisamment complètes ou nombreuses.")}</p>
          </div>
        </StudioDialog>
      )}
      {scheduleDish && (
        <StudioDialog
          title={`Planning · ${scheduleDish.name}`}
          onClose={() => setScheduleDish(null)}
        >
          <div className={styles.dialogBody}>
            <p>{t("La planification automatique doit être activée côté serveur pour enregistrer des horaires. La disponibilité actuelle reste inchangée.")}</p>
            <p className={styles.muted}>{t("Aucune règle de démonstration n’est utilisée sur votre menu.")}</p>
          </div>
          <div className={styles.dialogFooter}>
            <button onClick={() => setScheduleDish(null)}>{t("Fermer")}</button>
          </div>
        </StudioDialog>
      )}
    </div>
  );
}

