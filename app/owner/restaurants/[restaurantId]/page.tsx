import { notFound } from "next/navigation";
import { OwnerRestaurantDashboard } from "@/components/owner/OwnerRestaurantDashboard";
import { getOwnerRestaurantDashboardData } from "@/lib/owner/data";

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

  return <OwnerRestaurantDashboard restaurant={data.restaurant} />;
}
