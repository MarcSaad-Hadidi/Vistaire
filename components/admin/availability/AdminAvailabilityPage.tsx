import { AdminShell } from "@/components/admin/system/AdminShell";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AvailabilityOperationsState, AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { AdminAvailabilityList } from "./AdminAvailabilityList";

export function AdminAvailabilityPage({ data, presentation, capability, canWrite, operations, timezone }: { data: AdminDashboardData; presentation: { restaurantName: string; publicMenuPath: string }; capability: AvailabilitySchedulingCapability; canWrite: boolean; operations: AvailabilityOperationsState; timezone: string }) {
  return <AdminShell restaurantName={presentation.restaurantName} menuPath={presentation.publicMenuPath} pageTitle="Disponibilités — Gestion opérationnelle" pageDescription="Gérez la disponibilité de vos plats en temps réel et planifiez les retours avec précision." active="availability"><AdminAvailabilityList dishes={data.menu.dishes} capability={capability} canWrite={canWrite} operations={operations} timezone={timezone} /></AdminShell>;
}
