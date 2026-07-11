import { AdminShell } from "@/components/admin/system/AdminShell";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import { AdminAvailabilityList } from "./AdminAvailabilityList";

export function AdminAvailabilityPage({ data }: { data: AdminDashboardData }) {
  return <AdminShell restaurantName={data.restaurant.name} active="availability"><AdminAvailabilityList dishes={data.menu.dishes} /></AdminShell>;
}
