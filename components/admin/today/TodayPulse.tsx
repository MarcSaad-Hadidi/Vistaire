import {
  AvailableDishIcon,
  DishViewsIcon,
  ImmersiveIcon,
  MenuOpenIcon,
  OverviewIcon,
  SearchIcon
} from "@/components/admin/system/AdminIcons";
import { Sparkline } from "@/components/admin/charts/Sparkline";
import { AdminKpiCard } from "@/components/admin/system/AdminPrimitives";
import type { AdminMetricId } from "@/lib/admin/data/contracts";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY, todayStateCopy } from "./todayCopy";
import styles from "./AdminToday.module.css";

function metricIcon(metricId: AdminMetricId) {
  if (metricId === "observed-sessions") return <OverviewIcon />;
  if (metricId === "observed-menu-opens") return <MenuOpenIcon />;
  if (metricId === "observed-dish-opens") return <DishViewsIcon />;
  if (metricId === "observed-immersive-intents") return <ImmersiveIcon />;
  if (metricId === "private-search-ranking") return <SearchIcon />;
  return <AvailableDishIcon />;
}

function metricTrend(metricId: AdminMetricId, model: TodayViewModel): number[] {
  if (metricId === "observed-sessions" || metricId === "observed-menu-opens") {
    return model.activity.data?.points.map((point) => point.count) ?? [];
  }
  if (metricId === "observed-dish-opens") {
    return model.timeline.data?.map((point) => point.count) ?? [];
  }
  if (metricId === "private-search-ranking") {
    return model.searches.data?.map((item) => item.count) ?? [];
  }
  return [];
}

export function TodayPulse({ model }: { model: TodayViewModel }) {
  const copy = TODAY_COPY[model.locale];
  return (
    <section aria-label={copy.pulse} className={styles.pulse} data-today-region="pulse">
      <header className={styles.sectionBand}>
        <span>{copy.pulse}</span>
        <time dateTime={model.generatedAt}>{new Intl.DateTimeFormat(model.locale === "fr" ? "fr-CA" : "en-CA", { hour: "2-digit", minute: "2-digit" }).format(new Date(model.generatedAt))}</time>
      </header>
      <div className={styles.metricGrid}>
        {model.pulse.map((metric) => {
          const trend = metricTrend(metric.metricId, model);
          return <AdminKpiCard
            data-metric-id={metric.metricId}
            data-evidence-id={metric.evidenceId ?? undefined}
            data-evidence-kind={metric.state.kind}
            detail={metric.state.kind === "available"
              ? metric.changeLabel ?? metric.provenance
              : todayStateCopy(model.locale, metric.state)}
            icon={metricIcon(metric.metricId)}
            key={metric.metricId}
            label={metric.label}
            trend={metric.state.kind === "available" && trend.length > 1 ? (
              <span className={styles.kpiSparkline} data-kpi-sparkline>
                <Sparkline label={`${metric.label} · ${model.locale === "fr" ? "tendance observée" : "observed trend"}`} values={trend} />
              </span>
            ) : undefined}
            value={metric.displayValue}
          />
        })}
      </div>
    </section>
  );
}
