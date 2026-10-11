"use client";
import Link from "next/link";
import { useState, useMemo, useSyncExternalStore } from "react";
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

export type StudioPage = "overview" | "insights" | "dishes" | "planning";
const pages = [
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
const metrics = [
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
const number = (value: number | undefined) =>
  value === undefined ? "N/A" : new Intl.NumberFormat("fr-CA").format(value);
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
function subscribeTheme(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener("vistaire-studio-theme", notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener("vistaire-studio-theme", notify);
  };
}
function themeSnapshot() {
  try {
    return localStorage.getItem("vistaire-studio-theme") === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}
function Delta({ rate }: { rate: number | null | undefined }) {
  return (
    <span
      className={styles.delta}
      data-direction={
        rate == null || rate === 0 ? "neutral" : rate > 0 ? "up" : "down"
      }
    >
      {rate == null
        ? "Comparaison N/A"
        : `${rate > 0 ? "+" : ""}${Math.round(rate * 100)} %`}{" "}
      <span className={styles.muted}>
        {rate == null ? "" : "vs période précédente"}
      </span>
    </span>
  );
}
function Evidence({ data }: { data: AdminDashboardData }) {
  return (
    <div className={styles.empty}>
      <AlertCircle size={26} />
      <strong>
        {data.analytics.kind === "unavailable"
          ? "Données indisponibles"
          : "Pas encore assez de données"}
      </strong>
      <p>
        {data.analytics.kind === "unavailable"
          ? "La lecture est incomplète. Réessayez plus tard ; aucun chiffre partiel n’est présenté comme un total."
          : "Les premiers chiffres apparaîtront lorsque suffisamment de consultations auront été enregistrées."}
      </p>
    </div>
  );
}

export function AdminStudio({
  data,
  range,
  page,
  canWrite = false,
}: {
  data: AdminDashboardData;
  range: AdminDashboardRange;
  page: StudioPage;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const theme = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    () => "light",
  );
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
      ? `${formatDate(analytics.observationWindow.startInclusive)} au ${formatDate(new Date(Date.parse(analytics.observationWindow.endExclusive) - 1).toISOString())}`
      : "Période indisponible";
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
    try {
      localStorage.setItem(
        "vistaire-studio-theme",
        theme === "dark" ? "light" : "dark",
      );
      window.dispatchEvent(new Event("vistaire-studio-theme"));
    } catch {
      setNotice("Le thème ne peut pas être enregistré dans ce navigateur.");
    }
  }
  async function copyMenu() {
    try {
      await navigator.clipboard.writeText(
        new URL(data.restaurant.publicMenuPath, window.location.origin).href,
      );
      setNotice("Lien du menu copié");
    } catch {
      setNotice(
        "Impossible de copier le lien. Vous pouvez ouvrir le menu puis copier son adresse.",
      );
    }
  }
  const trendPanel = (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <h2>
            {page === "overview"
              ? "L’activité de votre menu"
              : "Évolution dans le temps"}
          </h2>
          <p>{rangeLabel} · heures UTC</p>
        </div>
        <select
          aria-label="Indicateur du graphique"
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
              aria-label={`Agrandir ${selected.label.toLowerCase()}`}
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
        <h2>Les plats les plus consultés</h2>
        <Link href={`/admin/availability?range=${range}`}>
          Tous les plats <ArrowUpRight size={15} />
        </Link>
      </header>
      {ranking.length ? (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Plat</th>
                <th>Consultations</th>
                <th>Évolution</th>
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
    <div className={styles.studio} data-theme={theme} data-admin-studio>
      <a className={styles.skip} href="#studio-main">
        Aller au contenu
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.wordmark}>
          vistaire<span>RESTAURANT STUDIO</span>
        </div>
        <div className={styles.restaurant}>
          <span className={styles.seal}>{data.restaurant.name[0]}</span>
          <div>
            <strong>{data.restaurant.name}</strong>
            <small>ESPACE RESTAURATEUR</small>
          </div>
        </div>
        <div className={styles.navLabel}>VOTRE RESTAURANT</div>
        <nav className={styles.nav} aria-label="Navigation principale">
          {pages.map(({ id, label, href, Icon }) => (
            <Link
              key={id}
              href={`${href}?range=${range}`}
              aria-current={id === page ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <Link
            href={data.restaurant.publicMenuPath}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} />
            Ouvrir le menu client
          </Link>
          <form action="/admin/logout" method="post">
            <button type="submit">
              <LogOut size={16} />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>
      <main id="studio-main" className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumbs}>
            <span>{data.restaurant.name} /</span>
            <b>{active.label}</b>
          </div>
          <div className={styles.topActions}>
            <span className={styles.accountStatus}>
              {canWrite ? "Espace privé" : "Lecture seule"}
            </span>
            <button onClick={copyMenu} aria-label="Copier le lien du menu">
              <Copy size={17} />
            </button>
            <form
              action="/admin/logout"
              method="post"
              className={styles.mobileLogout}
            >
              <button type="submit" aria-label="Déconnexion">
                <LogOut size={17} />
              </button>
            </form>
            <button
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Passer au thème clair"
                  : "Passer au thème sombre"
              }
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              href={data.restaurant.publicMenuPath}
              className={styles.button}
              aria-label="Ouvrir le menu client"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={17} />
            </Link>
          </div>
        </header>
        <div className={styles.content}>
          <header className={styles.pageHead}>
            <h1>{active.label}</h1>
            <div className={styles.toolbar}>
              <label>
                <span className={styles.srOnly}>Période des statistiques</span>
                <select
                  value={range}
                  onChange={(event) =>
                    event.target.value === "custom"
                      ? setDatesOpen(true)
                      : router.push(
                          `${active.href}?range=${encodeURIComponent(event.target.value)}`,
                        )
                  }
                >
                  <option value="today-utc">Aujourd’hui (UTC)</option>
                  <option value="7d">7 derniers jours</option>
                  <option value="30d">30 derniers jours</option>
                  <option value="90d">90 derniers jours</option>
                  <option value="365d">365 derniers jours</option>
                  <option value="month">Ce mois-ci</option>
                  <option value="year">Cette année</option>
                  {range.startsWith("custom:") && (
                    <option value={range}>{rangeLabel}</option>
                  )}
                  <option value="custom">Choisir des dates…</option>
                </select>
              </label>
              <button onClick={() => setExportOpen(true)}>
                <Download size={17} />
                <span>Exporter</span>
              </button>
            </div>
          </header>
          {notice && (
            <p className={styles.feedback} role="status">
              {notice}
              <button onClick={() => setNotice("")}>Fermer</button>
            </p>
          )}
          {page === "overview" && (
            <>
              <div className={styles.contextRow}>
                <p>{rangeLabel} · données du menu</p>
                <Link href={`/admin/availability?range=${range}`}>
                  <strong>
                    {data.menu.readiness.counts.available} /{" "}
                    {data.menu.dishes.length}
                  </strong>{" "}
                  plats disponibles<small>Gérer les plats</small>
                  <ArrowUpRight size={15} />
                </Link>
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
                      <h2>Quand votre menu est consulté</h2>
                      <p>Événements enregistrés par jour et heure UTC</p>
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
                <p>{rangeLabel} · comparaison à durée égale</p>
                <span>Consultations et clics, sans estimation de ventes</span>
              </div>
              {trendPanel}
              <div className={styles.twoColumns}>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>Par catégorie</h2>
                  </header>
                  {categories.length ? (
                    <div className={styles.chartBody}>
                      <StudioBars
                        rows={categories.map((row) => ({
                          label: row.label ?? row.slug,
                          count: row.count,
                        }))}
                        label="Consultations"
                      />
                    </div>
                  ) : (
                    <Evidence data={data} />
                  )}
                </section>
                {dishRanking}
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>Par moment de la journée</h2>
                  </header>
                  {real?.panels.serviceWindows.kind === "supported" ? (
                    <div className={styles.chartBody}>
                      <StudioBars
                        rows={real.panels.serviceWindows.data.windows.map(
                          (row) => ({ label: row.label, count: row.count }),
                        )}
                        label="Événements (UTC)"
                      />
                    </div>
                  ) : (
                    <Evidence data={data} />
                  )}
                </section>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <h2>Recherches fréquentes</h2>
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
                      <p>
                        Aucune recherche suffisamment fréquente à afficher. Les
                        termes personnels restent exclus.
                      </p>
                    </div>
                  )}
                </section>
              </div>
              {heatmap && (
                <section className={styles.panel} style={{ marginTop: 18 }}>
                  <header className={styles.panelHead}>
                    <h2>Jours et heures d’activité</h2>
                  </header>
                  <div className={styles.chartBody}>
                    <StudioHeatmap cells={heatmap} />
                  </div>
                </section>
              )}
              <StudioAnalysisCharts data={data} />
              <details className={styles.dataDisclosure}>
                <summary>Comment lire ces chiffres</summary>
                <p>
                  Les ouvertures, consultations, recherches et clics 3D/AR sont
                  des événements enregistrés sur ce menu. Ils ne représentent ni
                  des personnes uniques ni des achats. Les heures sont en UTC.
                  Les chiffres ne sont affichés que lorsque les sources sont
                  complètes et le volume suffisant. Une comparaison sans période
                  précédente exploitable reste N/A.
                </p>
              </details>
            </>
          )}
          {page === "dishes" && (
            <>
              <div className={styles.contextRow}>
                <p>
                  Les chiffres de chaque plat et leur disponibilité, au même
                  endroit
                </p>
                <span>{data.menu.dishes.length} plats au menu</span>
              </div>
              <StudioDishes
                key={`${data.restaurant.id}:${data.menu.id}`}
                data={data}
                canWrite={canWrite}
                onDish={setDish}
                onSchedule={setScheduleDish}
              />
            </>
          )}
          {page === "planning" && (
            <>
              <p className={styles.notice}>
                <strong>Planning des disponibilités</strong> · Les horaires
                automatiques nécessitent le service de planification du
                restaurant. Aucune règle simulée n’est enregistrée.
              </p>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <h2>Les horaires de vos plats</h2>
                    <p>Choisissez un plat pour consulter sa planification.</p>
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
                        <CalendarDays size={16} />
                        Planifier
                      </button>
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
                ? `Dernier événement : ${formatDate(real.lastUpdatedAt)} (UTC)`
                : "Aucun événement récent confirmé"}
            </span>
          </footer>
        </div>
      </main>
      {datesOpen && (
        <StudioDialog
          title="Choisir une période"
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
                  "Choisissez une période de 730 jours maximum avec une fin après le début.",
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
                <label>
                  Du (inclus)
                  <input
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
                <label>
                  Au (inclus)
                  <input
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
              <p className={styles.muted}>
                Dates en UTC · 730 jours maximum. Une période dépassant la
                limite de lecture sera indiquée comme indisponible.
              </p>
            </div>
            <div className={styles.dialogFooter}>
              <button type="button" onClick={() => setDatesOpen(false)}>
                Annuler
              </button>
              <button className={styles.primary} type="submit">
                Appliquer
              </button>
            </div>
          </form>
        </StudioDialog>
      )}
      {exportOpen && (
        <StudioExportDialog data={data} onClose={() => setExportOpen(false)} />
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
                    <span>Période sélectionnée</span>
                    <strong>
                      {number(
                        metricValue(
                          metrics.find((item) => item.series === explore)!.id,
                        )?.value,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Période précédente</span>
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
                    <span>Évolution</span>
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
                ["Consultations", data.dishStatistics?.[dish.id]?.views],
                ["Clics 3D", data.dishStatistics?.[dish.id]?.three],
                ["Clics AR", data.dishStatistics?.[dish.id]?.ar],
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
              {dish.available ? "Disponible" : "Indisponible"}
            </span>
            <p className={styles.muted}>
              Les clics ne sont pas des commandes. N/A signifie que les données
              ne sont pas suffisamment complètes ou nombreuses.
            </p>
          </div>
        </StudioDialog>
      )}
      {scheduleDish && (
        <StudioDialog
          title={`Planning · ${scheduleDish.name}`}
          onClose={() => setScheduleDish(null)}
        >
          <div className={styles.dialogBody}>
            <p>
              La planification automatique doit être activée côté serveur pour
              enregistrer des horaires. La disponibilité actuelle reste
              inchangée.
            </p>
            <p className={styles.muted}>
              Aucune règle de démonstration n’est utilisée sur votre menu.
            </p>
          </div>
          <div className={styles.dialogFooter}>
            <button onClick={() => setScheduleDish(null)}>Fermer</button>
          </div>
        </StudioDialog>
      )}
    </div>
  );
}
