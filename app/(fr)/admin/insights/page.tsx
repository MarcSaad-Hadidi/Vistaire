import { AdminStudio } from "@/components/admin/studio/AdminStudio";
import { StudioState } from "@/components/admin/studio/StudioState";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDashboardData } from "@/lib/admin/dashboardData";
import { parseAdminPageSearchParams } from "@/lib/admin/pageSearchParams";

export const dynamic = "force-dynamic";

export default async function AdminInsightsRoute({ searchParams }: { searchParams?: Promise<{ range?: string | string[] }> }) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <StudioState kind="access" title="Accès dashboard restaurant requis" description="Scannez le QR admin interne de votre restaurant." localPreview={process.env.NODE_ENV !== "production"}/>;
  const range = parseAdminPageSearchParams(await searchParams);
  const result = await loadAdminDashboardData(access.restaurantId, range);
  if (!result.ok) return <StudioState kind="unavailable" title="Analyses indisponibles" description="Les données du restaurant ne peuvent pas être chargées." retryHref="/admin/insights"/>;
  return <AdminStudio data={result.data} range={range} page="insights" canWrite={access.capabilities.includes("dish:availability:write") && access.qrId !== null}/>;
}
