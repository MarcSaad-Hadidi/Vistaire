import Link from "next/link";
import styles from "./AdminSystem.module.css";

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

export {
  AdminEvidenceState,
  AdminKpiCard,
  AdminPanel,
  AdminSkeleton,
  AdminStatusBadge,
  AdminToast,
  AdminToggle,
  AdminTooltip
} from "./AdminPresentationPrimitives";

export function AdminTabs({ active, className }: { active: "overview" | "availability" | "insights"; className?: string }) {
  return <nav className={classes(styles.tabs, className)} aria-label="Sections principales"><Link href="/admin" aria-current={active === "overview" ? "page" : undefined}>Vue d’ensemble</Link><Link href="/admin/availability" aria-current={active === "availability" ? "page" : undefined}>Disponibilités</Link><Link href="/admin/insights" aria-current={active === "insights" ? "page" : undefined}>Analyses</Link></nav>;
}
