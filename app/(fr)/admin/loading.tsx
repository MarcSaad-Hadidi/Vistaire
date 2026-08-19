import { AdminSkeleton } from "@/components/admin/system/AdminPrimitives";
import styles from "@/components/admin/system/AdminSystem.module.css";

export default function Loading() {
  return <main className={styles.loading} aria-busy="true" aria-label="Chargement du tableau de bord"><AdminSkeleton className={styles.loadingHeader} /><AdminSkeleton className={styles.loadingTabs} /><div className={styles.loadingGrid}>{Array.from({ length: 5 }, (_, index) => <AdminSkeleton className={styles.loadingCard} key={index} />)}</div><AdminSkeleton className={styles.loadingPanel} /></main>;
}
