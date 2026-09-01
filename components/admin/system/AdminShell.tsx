import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import {
  type AdminRouteId,
  type LegacyAdminRoute,
  normalizeLegacyAdminRoute
} from "@/lib/admin/foundationRoutes";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";
import { AdminCopyMenuButton, AdminMenuActions } from "../AdminMenuActions";
import { AdminLogoutButton, AdminNav } from "./AdminNav";
import { AdminPreferencesControls } from "./AdminPreferencesControls";
import { AdminTabs } from "./AdminPrimitives";
import styles from "./AdminSystem.module.css";

type AdminShellRouteProps =
  | { activeRoute: AdminRouteId; active?: never }
  | { active: LegacyAdminRoute; activeRoute?: never };

export type AdminShellProps = AdminShellRouteProps & {
  restaurantName: string;
  restaurantId?: string;
  menuPath: string;
  pageTitle?: string;
  pageDescription?: string;
  observedAt?: string;
  timezone?: string;
  headerDetails?: ReactNode;
  headerActions?: ReactNode;
  headerStatus?: ReactNode;
  children: ReactNode;
};

export async function AdminShell(props: AdminShellProps) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const {
    restaurantName, restaurantId, menuPath, pageTitle, pageDescription,
    observedAt, timezone, headerDetails, headerActions, headerStatus, children
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
        : canonicalActive === "reports"
          ? styles.reportsDashboard
          : "";

  return (
    <div className={`${styles.dashboard} ${routeClass}`}>
      <aside className={styles.sidebar} aria-label={preferences.locale === "fr" ? "Navigation Vistaire" : "Vistaire navigation"}>
        <Link className={styles.wordmark} href="/admin">VISTAIRE</Link>
        <AdminNav active={canonicalActive} locale={preferences.locale} variant="desktop" />
        <AdminPreferencesControls preferences={preferences} />
        <div className={styles.restaurantRail}>
          <span className={styles.restaurantMark} aria-hidden="true">V</span>
          <span>
            <strong>{restaurantName}</strong>
            <small title={restaurantId || undefined}>{restaurantId ? `ID : ${restaurantId}` : (preferences.locale === "fr" ? "Espace privé" : "Private workspace")}</small>
          </span>
          <AdminCopyMenuButton locale={preferences.locale} menuPath={menuPath} />
          <AdminLogoutButton locale={preferences.locale} />
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.header} {...(insights ? { "data-insights-header": true } : {})}>
          <div className={styles.headerIdentity}>
            <div className={styles.restaurantHeader}>
              <p className={styles.brand}>{pageTitle ? restaurantName : "Dashboard restaurant"}</p>
              <span className={styles.onlineStatus}>{preferences.locale === "fr" ? "Menu en ligne" : "Menu online"}</span>
            </div>
            <h1>{pageTitle ?? restaurantName}</h1>
            <div className={styles.headerLower}>
              <p className={styles.subtitle} data-admin-subtitle>
                {pageDescription ?? (insights
                  ? "Analyses détaillées et insights avancés sur l’activité de votre menu"
                  : "Insights en temps réel sur l’activité de votre menu")}
              </p>
              {observedAt ? (
                <p className={styles.headerMeta}>
                  <span className={styles.headerMetaDot} aria-hidden="true" />
                  <time dateTime={observedAt}>
                    {new Intl.DateTimeFormat(preferences.locale === "fr" ? "fr-FR" : "en-CA", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: timezone
                    }).format(new Date(observedAt))}
                  </time>
                </p>
              ) : null}
              {headerDetails}
            </div>
          </div>
          <div className={styles.headerControls}>
            {headerActions ?? <AdminMenuActions locale={preferences.locale} menuPath={menuPath} />}
            {headerStatus}
          </div>
        </header>
        {active ? <div hidden><AdminTabs active={active} /></div> : null}
        <main className={styles.main}>{children}</main>
        <footer className={styles.trustFooter}>
          <span><strong>{preferences.locale === "fr" ? "Données sécurisées" : "Secured data"}</strong><small>{preferences.locale === "fr" ? "Accès réservé au restaurant" : "Restaurant-only access"}</small></span>
          <span><strong>{preferences.locale === "fr" ? "Conformité RGPD" : "GDPR compliance"}</strong><small>HttpOnly · SameSite</small></span>
          <span><strong>{preferences.locale === "fr" ? "Piloté par Vistaire" : "Powered by Vistaire"}</strong><small>{preferences.locale === "fr" ? "Mesures fondées sur les preuves" : "Evidence-based measurements"}</small></span>
        </footer>
      </div>
      <div className={styles.mobilePreferences}>
        <AdminPreferencesControls preferences={preferences} />
      </div>
      <AdminNav active={canonicalActive} locale={preferences.locale} variant="mobile" />
    </div>
  );
}
