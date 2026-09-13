import { AdminShell } from "@/components/admin/system/AdminShell";
import type { AdminMenuData } from "@/lib/admin/dashboardData";
import { AdminAvailabilityList } from "./AdminAvailabilityList";

export function AdminAvailabilityPage({ data }: { data: AdminMenuData }) {
  return <AdminShell restaurantName={data.restaurant.name} menuPath={data.restaurant.publicMenuPath} active="availability"><AdminAvailabilityList dishes={data.menu.dishes} /></AdminShell>;
}
