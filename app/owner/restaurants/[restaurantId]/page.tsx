import { notFound } from "next/navigation";
import { OwnerRestaurantDashboard } from "@/components/owner/OwnerRestaurantDashboard";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";
import { getOwnerMenuData } from "@/lib/owner/menuData";
import { buildOwnerRestaurantPreparation } from "@/lib/owner/restaurantPreparation";

export const dynamic = "force-dynamic";

export default async function OwnerRestaurantDashboardPage({
  params
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const data = await getOwnerRestaurantDashboardData(restaurantId);

  if (!data.restaurant) {
    notFound();
  }

  const menuData = await getOwnerMenuData(data.restaurant.id);
  const dishes = menuData.ok ? menuData.dishes : [];
  const preparation = buildOwnerRestaurantPreparation(data.restaurant, dishes);

  return (
    <OwnerRestaurantDashboard
      restaurant={data.restaurant}
      preparation={preparation}
    />
  );
}
