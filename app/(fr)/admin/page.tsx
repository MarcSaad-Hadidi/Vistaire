import { AdminOverview } from "@/components/admin/overview/AdminOverview";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";
import { parseAdminPageSearchParams } from "@/lib/admin/pageSearchParams";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string | string[] }> }) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><p className={styles.eyebrow}>Espace privé</p><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p><form action="/admin/access" method="post" className={styles.accessForm}><label htmlFor="qrAccess">Code ou lien QR admin</label><input id="qrAccess" name="qrAccess" autoComplete="off" maxLength={2048} required/><button type="submit">Accéder au dashboard</button></form>{process.env.NODE_ENV !== "production" ? <form action="/admin/preview" method="post"><button type="submit">Ouvrir la prévisualisation locale</button></form> : null}</section></main>;
  const range = parseAdminPageSearchParams(await searchParams);
  const result = await loadAdminDashboardData(access.restaurantId, range);
  if (!result.ok) return <main className={styles.center}><section className={styles.panel}><h1>Dashboard indisponible</h1><p>La carte ne peut pas être chargée. Aucun plat ne peut être modifié.</p></section></main>;
  return <AdminOverview data={result.data} range={range} />;
}
