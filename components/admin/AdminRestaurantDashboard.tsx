import Image from "next/image";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import { AdminDishWorklist } from "@/components/admin/AdminDishWorklist";
import { AdminMenuActions } from "@/components/admin/AdminMenuActions";
import { AdminSearchInsights } from "@/components/admin/AdminSearchInsights";
import { AdminServiceActivity } from "@/components/admin/AdminServiceActivity";
import { AdminTopDishes } from "@/components/admin/AdminTopDishes";
import styles from "@/components/vistaire-preview/VistaireRestaurateurDashboardPreview.module.css";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AdminAnalyticsState } from "@/lib/admin/analyticsState";
import type { DemoAdminInsights } from "@/lib/demoAdminInsights";

function AdminRealAnalytics({ insights }: { insights: DemoAdminInsights }) {
  const metrics = insights.summary.slice(0, 4);
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.id} className="rounded-[13px] border border-white/[0.12] bg-black/[0.09] p-4">
            <span className="text-xs text-[#a99a86]">{metric.label}</span>
            <strong className="mt-2 block font-display text-2xl text-cream">{metric.value}</strong>
          </article>
        ))}
      </div>
      {insights.topDishes.length > 0 ? (
        <AdminTopDishes dishes={insights.topDishes.slice(0, 5)} />
      ) : null}
      {insights.searchInsights.length > 0 || insights.serviceActivity.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminSearchInsights searches={insights.searchInsights.slice(0, 5)} />
          <AdminServiceActivity activity={insights.serviceActivity} />
        </div>
      ) : null}
    </div>
  );
}

function AdminAnalyticsEvidenceState({
  analytics
}: {
  analytics: Exclude<AdminAnalyticsState<DemoAdminInsights>, { kind: "real" | "partial" }>;
}) {
  return (
    <div className="rounded-[13px] border border-white/[0.12] bg-black/[0.09] p-5 sm:p-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-champagne/80">
        Données insuffisantes
      </p>
      <h2 className="mt-3 font-display text-2xl text-cream">{analytics.title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#b9aa95]">
        Pas encore assez d&apos;activité réelle. {analytics.message}
      </p>
    </div>
  );
}

export function AdminRestaurantDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={90}
        sizes="100vw"
        src={restaurantBackground}
        unoptimized
      />
      <section aria-labelledby="admin-dashboard-title" className={styles.hero}>
        <div className={`${styles.previewFrame} ${styles.adminFrame}`}>
          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <div className="max-w-3xl">
              <p className={styles.badge}>Dashboard restaurant</p>
              <h1 id="admin-dashboard-title" className="mt-3 font-display text-3xl leading-tight text-cream sm:text-5xl">
                {data.restaurant.name}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#cdbfa9] sm:text-base">
                Lisez l’état de votre carte et ajustez uniquement la disponibilité des plats pendant le service.
              </p>
              {data.restaurant.menuPath ? (
                <AdminMenuActions menuPath={data.restaurant.menuPath} />
              ) : null}
            </div>
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article>
                <span className="text-xs text-[#a99a86]">Préparation de la carte</span>
                <strong className="mt-2 block font-display text-3xl text-cream">{data.readiness.score} %</strong>
              </article>
              <article>
                <span className="text-xs text-[#a99a86]">Plats</span>
                <strong className="mt-2 block font-display text-3xl text-cream">{data.readiness.counts.dishes}</strong>
              </article>
              <article>
                <span className="text-xs text-[#a99a86]">Disponibles</span>
                <strong className="mt-2 block font-display text-3xl text-cream">{data.readiness.counts.available}</strong>
              </article>
              <article>
                <span className="text-xs text-[#a99a86]">Avec photo</span>
                <strong className="mt-2 block font-display text-3xl text-cream">{data.readiness.counts.withPhoto}</strong>
              </article>
            </div>
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            {data.analytics.kind === "real" || data.analytics.kind === "partial" ? (
              <div className="grid gap-4">
                {data.analytics.kind === "partial" ? (
                  <p className="rounded-[13px] border border-champagne/25 bg-black/[0.09] px-4 py-3 text-sm text-[#d6c4a8]">
                    Données réelles — échantillon encore limité. Les tendances seront plus fiables avec davantage de consultations.
                  </p>
                ) : null}
                <AdminRealAnalytics insights={data.analytics.insights} />
              </div>
            ) : (
              <AdminAnalyticsEvidenceState analytics={data.analytics} />
            )}
          </section>

          <section className={`${styles.card} ${styles.adminFullPanel}`}>
            <AdminDishWorklist dishes={data.dishes} />
          </section>
        </div>
      </section>
    </main>
  );
}
