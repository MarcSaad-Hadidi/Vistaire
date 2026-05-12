import Link from "next/link";
import { AdminAssistant } from "@/components/admin/AdminAssistant";
import { AdminInsightCard } from "@/components/admin/AdminInsightCard";
import { AdminSearchInsights } from "@/components/admin/AdminSearchInsights";
import { AdminServiceActivity } from "@/components/admin/AdminServiceActivity";
import { AdminTopDishes } from "@/components/admin/AdminTopDishes";
import { PrimaryButton } from "@/components/PrimaryButton";
import {
  getDemoRestaurantId,
  getRestaurantInsights
} from "@/lib/analytics/insights";

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

export default async function AdminPage({
  searchParams
}: {
  searchParams?: Promise<{ restaurantId?: string }>;
}) {
  const params = await searchParams;
  const demoRestaurantId = getDemoRestaurantId();
  const restaurantId =
    params?.restaurantId === demoRestaurantId ? params.restaurantId : demoRestaurantId;
  const result = await getRestaurantInsights(restaurantId);
  const insights = result.insights;
  const popularDish = insights.topDishes[0]?.dish;
  const summaryMetrics = insights.summary.filter((metric) =>
    SUMMARY_METRIC_IDS.includes(metric.id)
  );

  return (
    <div className="px-4 pb-20 pt-24 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#090705]/92 px-5 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.32)] sm:px-8 sm:py-9">
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_42%)]"
            aria-hidden
          />
          <div className="relative max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-champagne/85">
              {insights.serviceLabel}
            </p>
            <h1 className="mt-4 font-display text-4xl font-normal leading-[1] text-cream [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
              Signaux clients — {insights.generatedFor}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#cdbfa9] sm:text-lg">
              Comprenez les intentions, les moments d&apos;attention et les
              explorations immersives de vos clients.
            </p>
          </div>

          <div className="relative mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <PrimaryButton href="/demo" className="justify-center sm:w-auto">
              Voir le menu client
            </PrimaryButton>
            {popularDish ? (
              <Link
                href={`/demo/dishes/${popularDish.slug}`}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/14 px-6 text-center text-sm font-semibold text-cream transition hover:border-champagne/35 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
              >
                Explorer une fiche populaire
              </Link>
            ) : null}
          </div>
        </section>

        <section className="mt-9" aria-labelledby="quick-view-heading">
          <div>
            <h2 id="quick-view-heading" className="font-display text-2xl text-cream">
              Vue rapide du service
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#a99a86]">
              Les signaux essentiels pour comprendre l&apos;activité du menu en moins
              de 30 secondes.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric) => (
              <AdminInsightCard key={metric.id} metric={metric} />
            ))}
          </div>
        </section>

        <div className="mt-10">
          <AdminAssistant
            restaurantId={restaurantId}
            dailySummary={insights.dailySummary}
            recommendations={insights.recommendations}
          />
        </div>

        <div className="mt-10">
          <AdminTopDishes dishes={insights.topDishes.slice(0, 5)} />
        </div>

        <section className="mt-10" aria-labelledby="key-moments-heading">
          <div>
            <h2
              id="key-moments-heading"
              className="font-display text-2xl text-cream"
            >
              Recherches et moments clés
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#a99a86]">
              Les intentions les plus fréquentes et les moments où les clients
              consultent le plus le menu.
            </p>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <AdminSearchInsights searches={insights.searchInsights.slice(0, 5)} />
            <AdminServiceActivity activity={insights.serviceActivity} />
          </div>

          <p className="mt-5 rounded-xl border border-white/[0.07] bg-black/18 px-4 py-3 text-sm leading-relaxed text-[#b9aa94]">
            Le souper concentre la majorité de l&apos;activité. Les clients
            explorent davantage les plats signatures et les desserts à ce moment.
          </p>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-[#7f705f]">
          {result.note}
        </p>
      </div>
    </div>
  );
}
