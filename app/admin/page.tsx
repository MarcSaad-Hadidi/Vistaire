import { AdminRestaurantDashboard } from "@/components/admin/AdminRestaurantDashboard";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";

export const dynamic = "force-dynamic";
type Range = "today-utc" | "7d" | "30d";
const ranges: readonly Range[] = ["today-utc", "7d", "30d"];
function parseRange(value: string | string[] | undefined): Range {
  return typeof value === "string" && ranges.includes(value as Range) ? value as Range : "7d";
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string | string[] }> }) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><p className={styles.eyebrow}>Espace privé</p><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p><form action="/admin/access" method="post" className={styles.accessForm}><label htmlFor="qrAccess">Code ou lien QR admin</label><input id="qrAccess" name="qrAccess" autoComplete="off" maxLength={2048} required/><button type="submit">Accéder au dashboard</button></form></section></main>;
  const range = parseRange((await searchParams)?.range);
  type RangeLoader = (restaurantId: string, range?: Range) => ReturnType<typeof loadAdminDashboardData>;
  const result = await (loadAdminDashboardData as RangeLoader)(access.restaurantId, range);
  if (!result.ok) return <main className={styles.center}><section className={styles.panel}><h1>Dashboard indisponible</h1><p>La carte ne peut pas être chargée. Aucun plat ne peut être modifié.</p></section></main>;
  return <AdminRestaurantDashboard data={result.data} range={range} />;
}
