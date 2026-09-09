import { headers } from "next/headers";
import { AdminShellState } from "@/components/admin/system/AdminShellState";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export default async function Loading() {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  return <AdminShellState kind="loading" locale={preferences.locale} />;
}
