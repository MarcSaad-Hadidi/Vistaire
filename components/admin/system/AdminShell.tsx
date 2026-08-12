import type { ReactNode } from "react";
import { headers } from "next/headers";
import {
  type AdminRouteId,
  type LegacyAdminRoute,
  normalizeLegacyAdminRoute
} from "@/lib/admin/foundationRoutes";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";
import { AdminMenuActions } from "../AdminMenuActions";
import { AdminNav } from "./AdminNav";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";

type AdminShellRouteProps =
  | { activeRoute: AdminRouteId; active?: never }
  | { active: LegacyAdminRoute; activeRoute?: never };

export type AdminShellProps = AdminShellRouteProps & {
  restaurantName: string;
  menuPath: string;
  pageTitle?: string;
  pageDescription?: string;
  headerDetails?: ReactNode;
  headerStatus?: ReactNode;
  children: ReactNode;
};

export async function AdminShell(props: AdminShellProps) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const {
    restaurantName, menuPath, pageTitle, pageDescription,
    headerDetails, headerStatus, children
  } = props;
  const active = "active" in props ? props.active : undefined;
  let canonicalActive: AdminRouteId;
  if ("activeRoute" in props && props.activeRoute) {
    canonicalActive = props.activeRoute;
  } else if (active) {
    canonicalActive = normalizeLegacyAdminRoute(active);
  } else {
    throw new Error("AdminShell requires one active route.");
  }
  const insights = canonicalActive === "intelligence";
  const routeClass = insights
    ? styles.insightsDashboard
    : canonicalActive === "today"
      ? styles.overviewDashboard
      : canonicalActive === "availability"
        ? styles.availabilityDashboard
        : "";

  return (
    <div className={`${styles.dashboard} ${routeClass}`}>
      <header className={styles.header} {...(insights ? { "data-insights-header": true } : {})}>
        <div className={styles.headerIdentity}>
          <p className={styles.brand}>{pageTitle ? restaurantName : "Dashboard restaurant"}</p>
          <h1>{pageTitle ?? restaurantName}</h1>
          <div className={styles.headerLower}>
            <p className={styles.subtitle} data-admin-subtitle>
              {pageDescription ?? (insights
                ? "Analyses détaillées et insights avancés sur l’activité de votre menu"
                : "Insights en temps réel sur l’activité de votre menu")}
            </p>
            {headerDetails}
          </div>
        </div>
        <div className={styles.headerControls}>
          <AdminMenuActions menuPath={menuPath} />
          {headerStatus}
        </div>
      </header>
      {active ? <div hidden><AdminTabs active={active} /></div> : null}
      <AdminNav active={canonicalActive} locale={preferences.locale} variant="desktop" />
      <main className={styles.main}>{children}</main>
      <AdminNav active={canonicalActive} locale={preferences.locale} variant="mobile" />
    </div>
  );
}
