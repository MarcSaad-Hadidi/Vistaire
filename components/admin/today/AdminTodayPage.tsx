import { AdminShell } from "@/components/admin/system/AdminShell";
import type { TodayViewModel } from "./todayViewModel";
import { TODAY_COPY } from "./todayCopy";
import { TodayActivity } from "./TodayActivity";
import { TodayAlerts } from "./TodayAlerts";
import { TodayBriefing } from "./TodayBriefing";
import { TodayMenuHealth } from "./TodayMenuHealth";
import { TodayPulse } from "./TodayPulse";
import { TodayQuickActions } from "./TodayQuickActions";
import { TodaySearches } from "./TodaySearches";
import { TodayTimeline } from "./TodayTimeline";
import { TodayTopDishes } from "./TodayTopDishes";
import styles from "./AdminToday.module.css";

export type AdminTodayPageProps = Readonly<{
  model: TodayViewModel;
  restaurantName: string;
  menuPath: string;
}>;

export function AdminTodayPage({ model, restaurantName, menuPath }: AdminTodayPageProps) {
  const copy = TODAY_COPY[model.locale];
  return (
    <AdminShell activeRoute="today" menuPath={menuPath} restaurantName={restaurantName}>
      <div className={styles.today}>
        <header className={styles.pageIntro}>
          <h2 data-admin-today-title>{copy.pageTitle}</h2>
          <p>{copy.pageSubtitle}</p>
        </header>
        <TodayBriefing model={model} />
        <TodayPulse model={model} />
        <div className={styles.serviceGrid}>
          <TodayActivity model={model} />
          <TodayAlerts model={model} />
          <TodayTopDishes model={model} />
        </div>
        <div className={styles.detailGrid}>
          <TodayTimeline model={model} />
          <TodaySearches model={model} />
          <TodayMenuHealth model={model} />
          <TodayQuickActions locale={model.locale} />
        </div>
      </div>
    </AdminShell>
  );
}
