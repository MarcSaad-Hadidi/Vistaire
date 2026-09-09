import type { Metadata } from "next";
import { headers } from "next/headers";
import styles from "@/components/admin/system/AdminSystem.module.css";
import { readAdminPreferencesFromHeaders } from "@/lib/admin/preferences";

export const metadata: Metadata = {
  title: "Dashboard restaurant | Vistaire",
  description: "Espace privé de gestion de la carte du restaurant.",
  robots: { index: false, follow: true, noarchive: true, noimageindex: true }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const preferences = readAdminPreferencesFromHeaders(await headers());
  return (
    <div
      className={styles.adminRoot}
      data-admin-locale={preferences.locale}
      data-admin-theme={preferences.theme}
      lang={preferences.locale === "fr" ? "fr-CA" : "en-CA"}
    >
      {children}
    </div>
  );
}
