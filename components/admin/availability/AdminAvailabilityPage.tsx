import { AdminShell } from "@/components/admin/system/AdminShell";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import type { AvailabilitySchedulingCapability } from "@/lib/admin/availability/contracts";
import { AdminAvailabilityList } from "./AdminAvailabilityList";

export function AdminAvailabilityPage({ data, capability }: { data: AdminDashboardData; capability: AvailabilitySchedulingCapability }) {
  return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="availability"><AdminAvailabilityList dishes={data.menu.dishes} capability={capability} /></AdminShell>;
}
