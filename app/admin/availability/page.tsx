import { AdminAvailabilityPage } from "@/components/admin/availability/AdminAvailabilityPage";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";
import { detectAvailabilitySchedulingCapability } from "@/lib/admin/availability/capability";
import { readAvailabilityCapability } from "@/lib/admin/availability/repository";

export const dynamic = "force-dynamic";
export default async function AvailabilityPage() {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p></section></main>;
  const result = await loadAdminDashboardData(access.restaurantId, "today-utc");
  if (!result.ok) return <main className={styles.center}><section className={styles.panel}><h1>Carte indisponible</h1><p>Les disponibilités ne peuvent pas être chargées.</p></section></main>;
  const capability = await detectAvailabilitySchedulingCapability({ enabled: process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED === "1", readCapability: readAvailabilityCapability });
  return <AdminAvailabilityPage data={result.data} capability={capability} />;
}
