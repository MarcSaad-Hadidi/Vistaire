import { AdminAvailabilityPage } from "@/components/admin/availability/AdminAvailabilityPage";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { detectAvailabilitySchedulingCapability } from "@/lib/admin/availability/capability";
import { readAvailabilityCapability, readAvailabilityOperations } from "@/lib/admin/availability/repository";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";

export const dynamic = "force-dynamic";
export default async function AvailabilityPage() {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <main className={styles.center}><section className={styles.panel}><h1>Accès dashboard restaurant requis</h1><p>Scannez le QR admin interne de votre restaurant.</p></section></main>;
  const [result, scoped] = await Promise.all([loadAdminDashboardData(access.restaurantId, "today-utc"), loadAdminDataBundle(access, "today")]);
  if (!result.ok || !scoped.ok) return <main className={styles.center}><section className={styles.panel}><h1>Carte indisponible</h1><p>Les disponibilités ne peuvent pas être chargées.</p></section></main>;
  const canWrite = access.capabilities.includes("dish:availability:write") && Boolean(access.qrId);
  const [detectedCapability, operations] = await Promise.all([
    detectAvailabilitySchedulingCapability({ enabled: process.env.ADMIN_AVAILABILITY_SCHEDULING_ENABLED === "1", readCapability: readAvailabilityCapability }),
    readAvailabilityOperations({ restaurantId: access.restaurantId, menuId: scoped.bundle.scope.menuId })
  ]);
  const capability = canWrite ? detectedCapability : { kind: "unavailable" as const, reason: "write-access-required" as const };
  return <AdminAvailabilityPage data={result.data} presentation={scoped.presentation} capability={capability} canWrite={canWrite} operations={operations} timezone={scoped.bundle.scope.timezone} observedAt={scoped.bundle.window.observedAt} />;
}
