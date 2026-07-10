import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import lobsterPlate from "@/Framer/PlatHomard.png";
import { AdminAssistant } from "@/components/admin/AdminAssistant";
import { AdminSearchInsights } from "@/components/admin/AdminSearchInsights";
import { AdminServiceActivity } from "@/components/admin/AdminServiceActivity";
import { AdminTopDishes } from "@/components/admin/AdminTopDishes";
import {
  PreviewFooter,
  PreviewNav
} from "@/components/vistaire-preview/VistairePreviewChrome";
import styles from "@/components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { getRestaurantInsights } from "@/lib/analytics/insights";

export const dynamic = "force-dynamic";

const SUMMARY_METRIC_IDS = [
  "menu-opens",
  "anonymous-sessions",
  "dish-views",
  "searches",
  "immersive-views",
  "ar-option-used",
  "top-dish",
  "top-category"
];

export default async function AdminPage() {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) {
    return (
      <main className={styles.page}>
        <section aria-labelledby="admin-access-title" className={styles.hero}>
          <div className={`${styles.previewFrame} ${styles.adminFrame}`}>
            <section className={`${styles.card} ${styles.adminFullPanel}`}>
              <div className={styles.adminPanelHeader}>
                <h1 id="admin-access-title">Accès dashboard restaurant requis</h1>
                <p>Scannez le QR admin interne de votre restaurant.</p>
                <form action="/admin/access" method="post">
                  <label
                    style={{ display: "grid", gap: 8, margin: "20px 0 12px" }}
                  >
                    <span>Code ou lien QR admin</span>
                    <input
                      autoComplete="off"
                      maxLength={2048}
                      name="qrAccess"
                      required
                      style={{
                        border: "1px solid rgba(232, 207, 155, 0.4)",
                        borderRadius: 12,
                        background: "rgba(13, 8, 5, 0.7)",
                        color: "#fff7ea",
                        padding: "12px 14px"
                      }}
                    />
                  </label>
                  <button className={styles.primaryButton} type="submit">
                    Accéder au dashboard
                  </button>
                </form>
                <Link
                  className={styles.secondaryButton}
                  href="/owner/qr-codes"
                  prefetch={false}
                >
                  Générer ou gérer le QR admin
                </Link>
                {process.env.NODE_ENV !== "production" ? (
                  <form action="/admin/preview" method="post">
                    <button className={styles.primaryButton} type="submit">
                      Ouvrir la prévisualisation locale
                    </button>
                  </form>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const result = await getRestaurantInsights(access.restaurantId);
  const insights = result.insights;
  const popularDish = insights.topDishes[0]?.dish;
  const summaryMetrics = insights.summary.filter((metric) =>
    SUMMARY_METRIC_IDS.includes(metric.id)
  );
  const primaryMetrics = summaryMetrics.slice(0, 4);
  const secondaryMetrics = summaryMetrics.slice(4);
  const visibleRecommendations = insights.recommendations.slice(0, 3);

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={100}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
      />

      <div className={styles.topNav}>
        <PreviewNav activeSection="home" routeMode="production" />
      </div>

      <section aria-labelledby="admin-dashboard-title" className={styles.hero}>
        <div className={`${styles.previewFrame} ${styles.adminFrame}`}>
          <section
            className={`${styles.card} ${styles.heroPanel} ${styles.adminHeroPanel}`}
          >
            <div className={styles.heroCopy}>
              <p className={styles.badge}>
                Dashboard exemple - {insights.serviceLabel}
              </p>
              <h1 id="admin-dashboard-title">
                Le restaurateur voit ce que la carte provoque.
              </h1>
              <p className={styles.heroLead}>
                Cet exemple noindex montre comment Vistaire lit les signaux
                anonymes du menu client : plats consultés, recherches, vues
                immersives et prochaines actions utiles.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/demo" prefetch={false}>
                  Explorer le menu client
                </Link>
                {popularDish ? (
                  <Link
                    className={styles.secondaryButton}
                    href="/demo"
                    prefetch={false}
                  >
                    Ouvrir une fiche populaire
                  </Link>
                ) : null}
                <Link
                  className={styles.secondaryButton}
                  href="/apercu-restaurateur"
                  prefetch={false}
                >
                  Retour à la page restaurateur
                </Link>
              </div>
            </div>

            <div className={`${styles.dashboardShell} ${styles.adminDashboardShell}`}>
              <div className={styles.dashboardTopline}>
                <span>{insights.generatedFor}</span>
                <span>Données démonstratives</span>
              </div>
              <div className={styles.statsGrid}>
                {primaryMetrics.map((metric) => (
                  <article key={metric.id}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </article>
                ))}
              </div>
              <div className={styles.dashboardBody}>
                <div className={styles.signatureDish}>
                  <Image
                    alt="Plat signature homard Vistaire"
                    fill
                    quality={100}
                    sizes="260px"
                    src={lobsterPlate}
                    unoptimized
                  />
                  <div>
                    <span>Plat le plus suivi</span>
                    <strong>{popularDish?.name.split(",")[0] ?? "Homard bleu"}</strong>
                  </div>
                </div>
                <div className={styles.signalList}>
                  {visibleRecommendations.map((recommendation) => (
                    <p key={`${recommendation.type}-${recommendation.title}`}>
                      <strong>{recommendation.type}</strong>
                      {recommendation.title}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <div className={styles.adminPanelHeader}>
              <p className={styles.badge}>Lecture rapide</p>
              <h2>Les signaux essentiels restent visibles en premier.</h2>
              <p>
                Le dashboard exemple garde une lecture restaurant : attention,
                désirabilité des plats, recherches clients et usage immersif.
              </p>
            </div>
            <div className={styles.adminMetricGrid}>
              {secondaryMetrics.map((metric) => (
                <article key={metric.id}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <p>{metric.helper}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <AdminAssistant
              restaurantId={access.restaurantId}
              dailySummary={insights.dailySummary}
              recommendations={insights.recommendations}
            />
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <AdminTopDishes dishes={insights.topDishes.slice(0, 5)} />
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <div className={styles.adminPanelHeader}>
              <p className={styles.badge}>Moments clés</p>
              <h2>Ce que les clients cherchent pendant le service.</h2>
            </div>
            <div className={styles.adminSplitGrid}>
              <AdminSearchInsights searches={insights.searchInsights.slice(0, 5)} />
              <AdminServiceActivity activity={insights.serviceActivity} />
            </div>
            <p className={styles.adminNote}>
              Le souper concentre la majorité de l&apos;activité. Les clients
              explorent davantage les plats signatures et les desserts à ce moment.
            </p>
          </section>

          <p className={styles.adminSourceNote}>{result.note}</p>
        </div>
      </section>

      <PreviewFooter routeMode="production" width="wide" />
    </main>
  );
}
