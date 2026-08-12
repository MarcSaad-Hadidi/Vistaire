import Link from "next/link";
import {
  AvailabilityIcon,
  InsightsIcon,
  LogoutIcon,
  MoreIcon,
  OverviewIcon,
  ReportsIcon
} from "./AdminIcons";
import {
  ADMIN_ROUTES,
  type AdminLocale,
  type AdminRouteId
} from "@/lib/admin/foundationRoutes";
import styles from "./AdminSystem.module.css";

export type AdminNavProps = {
  active: AdminRouteId;
  locale: AdminLocale;
  variant: "desktop" | "mobile";
};

function iconForAdminRoute(route: AdminRouteId) {
  if (route === "today") return <OverviewIcon />;
  if (route === "availability") return <AvailabilityIcon />;
  if (route === "intelligence") return <InsightsIcon />;
  if (route === "reports") return <ReportsIcon />;
  return <MoreIcon />;
}

export function AdminNav({ active, locale, variant }: AdminNavProps) {
  const navigationLabels = {
    fr: { desktop: "Navigation principale du restaurant", mobile: "Navigation du restaurant" },
    en: { desktop: "Primary restaurant navigation", mobile: "Restaurant navigation" }
  } as const;

  return (
    <nav
      aria-label={navigationLabels[locale][variant]}
      className={variant === "desktop" ? styles.desktopNav : styles.mobileNav}
      data-admin-nav={variant}
    >
      {ADMIN_ROUTES.map((route) => (
        <Link
          aria-current={active === route.id ? "page" : undefined}
          data-route-availability={route.availability}
          href={route.href}
          key={route.id}
          prefetch={route.availability === "integrated" ? undefined : false}
        >
          {iconForAdminRoute(route.id)}
          <span>{route.label[locale]}</span>
        </Link>
      ))}
    </nav>
  );
}

export function AdminLogoutButton() {
  return <form action="/admin/logout" method="post"><button className={styles.iconButton} type="submit" aria-label="Déconnexion" title="Déconnexion"><LogoutIcon /></button></form>;
}

