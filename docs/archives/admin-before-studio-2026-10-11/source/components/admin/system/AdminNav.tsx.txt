import Link from "next/link";
import { AvailabilityIcon, InsightsIcon, LogoutIcon, OverviewIcon } from "./AdminIcons";
import styles from "./AdminSystem.module.css";

export function AdminNav({ active }: { active: "overview" | "availability" | "insights" }) {
  return <nav className={styles.mobileNav} aria-label="Navigation du restaurant"><Link href="/admin" aria-current={active === "overview" ? "page" : undefined}><OverviewIcon /><span>Vue d’ensemble</span></Link><Link href="/admin/availability" aria-current={active === "availability" ? "page" : undefined}><AvailabilityIcon /><span>Disponibilités</span></Link><Link href="/admin/insights" aria-current={active === "insights" ? "page" : undefined}><InsightsIcon /><span>Analyses</span></Link></nav>;
}

export function AdminLogoutButton() {
  return <form action="/admin/logout" method="post"><button className={styles.iconButton} type="submit" aria-label="Déconnexion" title="Déconnexion"><LogoutIcon /></button></form>;
}

