import { headers } from "next/headers";
import { AdminInsightsPage } from "@/components/admin/insights/AdminInsightsPage";
import styles from "@/components/admin/AdminDashboard.module.css";
import { requireAdminRestaurantAccess } from "@/lib/admin/access";
import { loadAdminDataBundle } from "@/lib/admin/data/loadAdminData";
import type { AdminRange } from "@/lib/admin/data/contracts";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";
import { isAdminAssistantRuntimeEnabled } from "@/lib/admin/assistant";

export const dynamic = "force-dynamic";

function rangeFromSearchParam(value: string | string[] | undefined): AdminRange {
  return value === "7d" || value === "30d" ? value : "today";
}

export default async function AdminInsightsRoute({
  searchParams
}: {
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const access = await requireAdminRestaurantAccess("dashboard:read");
  if (!access.ok) {
    return <main className={styles.center}><section className={styles.panel}><h1>Accès admin requis</h1><p>Scannez le QR admin interne de votre restaurant.</p></section></main>;
  }
  const range = rangeFromSearchParam((await searchParams)?.range);
  const result = await loadAdminDataBundle(access, range);
  if (!result.ok) {
    return <main className={styles.center}><section className={styles.panel}><h1>Intelligence indisponible</h1><p>Les preuves du restaurant ne peuvent pas être chargées.</p></section></main>;
  }
  const preferences = readAdminPreferencesFromHeaders(await headers());
  return <AdminInsightsPage
    bundle={result.bundle}
    presentation={result.presentation}
    locale={preferences.locale}
    assistantEnabled={isAdminAssistantRuntimeEnabled()}
  />;
}
