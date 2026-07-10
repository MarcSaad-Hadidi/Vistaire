import type { Metadata } from "next";
import styles from "@/components/admin/AdminDashboard.module.css";

export const metadata: Metadata = {
  title: "Dashboard restaurant | Vistaire",
  description: "Espace privé de gestion de la carte du restaurant.",
  robots: { index: false, follow: false, noarchive: true, noimageindex: true }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
