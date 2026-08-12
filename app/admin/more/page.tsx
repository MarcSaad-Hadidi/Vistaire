import { headers } from "next/headers";
import { AdminMoreQualityPage } from "@/components/admin/more/AdminMoreQualityPage";
import { AdminShell } from "@/components/admin/system/AdminShell";
import { AdminShellState } from "@/components/admin/system/AdminShellState";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import { loadMoreQualityData } from "@/lib/admin/more/loadMoreQuality";
import { moreQualityCopy } from "@/lib/admin/more/moreQualityCopy";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export const dynamic = "force-dynamic";

export default async function AdminMoreQualityRoute() {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) return <AdminShellState kind="forbidden" locale={preferences.locale} />;

  const dataResult = await loadAdminDataBundle(access, "today");
  if (!dataResult.ok) return <AdminShellState kind="error" locale={preferences.locale} />;
  const qualityResult = await loadMoreQualityData({ access, bundle: dataResult.bundle, locale: preferences.locale });
  if (!qualityResult.ok) return <AdminShellState kind="error" locale={preferences.locale} />;

  const copy = moreQualityCopy(preferences.locale);
  return (
    <AdminShell
      activeRoute="more"
      restaurantName={dataResult.presentation.restaurantName}
      menuPath={dataResult.presentation.publicMenuPath}
      pageTitle={copy.title}
      pageDescription={copy.description}
      headerDetails={<span>{preferences.locale === "fr" ? "Qualité du catalogue" : "Catalog quality"}</span>}
    >
      <AdminMoreQualityPage model={qualityResult.model} />
    </AdminShell>
  );
}
