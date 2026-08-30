import { headers } from "next/headers";
import styles from "@/components/admin/AdminDashboard.module.css";
import { AdminTodayPage } from "@/components/admin/today/AdminTodayPage";
import { buildTodayViewModel } from "@/components/admin/today/todayViewModel";
import { AdminShellState } from "@/components/admin/system/AdminShellState";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import type { AdminRange } from "@/lib/admin/data/contracts";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { parseAdminPageSearchParams } from "@/lib/admin/pageSearchParams";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string | string[] }> }) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><p className={styles.eyebrow}>Espace privé</p><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p><form action="/admin/access" method="post" className={styles.accessForm}><label htmlFor="qrAccess">Code ou lien QR admin</label><input id="qrAccess" name="qrAccess" autoComplete="off" maxLength={2048} required/><button type="submit">Accéder au dashboard</button></form>{process.env.NODE_ENV !== "production" ? <form action="/admin/preview" method="post"><button type="submit">Ouvrir la prévisualisation locale</button></form> : null}</section></main>;
  const params = await searchParams;
  const parsedRange = parseAdminPageSearchParams(params && params.range !== undefined ? params : { range: "today-utc" });
  const range: AdminRange = parsedRange === "today-utc" ? "today" : parsedRange;
  const result = await loadAdminDataBundle(access, range);
  if (!result.ok) return <AdminShellState kind="error" locale={preferences.locale} />;
  const model = buildTodayViewModel({ locale: preferences.locale, bundle: result.bundle });
  return <AdminTodayPage
    menuPath={result.presentation.publicMenuPath}
    model={model}
    restaurantName={result.presentation.restaurantName}
  />;
}
