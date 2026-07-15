import { AdminInsightsPage } from "@/components/admin/insights/AdminInsightsPage";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";
import { parseAdminPageSearchParams } from "@/lib/admin/pageSearchParams";

export const dynamic = "force-dynamic";

export default async function AdminInsightsRoute({ searchParams }: { searchParams?: Promise<{ range?: string | string[] }> }) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p></section></main>;
  const range = parseAdminPageSearchParams(await searchParams);
  const result = await loadAdminDashboardData(access.restaurantId, range);
  if (!result.ok) return <main className={styles.center}><section className={styles.panel}><h1>Analyses indisponibles</h1><p>Les données du restaurant ne peuvent pas être chargées.</p></section></main>;
  return <AdminInsightsPage data={result.data} range={range}/>;
}
