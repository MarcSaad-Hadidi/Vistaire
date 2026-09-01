"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import { CopyIcon, MenuOpenIcon, PeriodIcon } from "./system/AdminIcons";
import styles from "./system/AdminSystem.module.css";
export function AdminMenuActions({ locale = "fr", menuPath }: { locale?: AdminLocale; menuPath: string }) {
  const router = useRouter();
  const [refreshed,setRefreshed]=useState(false);
  const fr = locale === "fr";
  function refresh(){router.refresh();setRefreshed(true);window.setTimeout(()=>setRefreshed(false),1600)}
  return <div className={styles.menuActions} aria-live="polite"><Link className={styles.secondaryAction} href={menuPath} prefetch={false}><MenuOpenIcon/><span className={styles.actionLabel}>{fr?"Voir la carte":"View menu"}</span></Link><button className={styles.primaryAction} onClick={refresh} type="button"><PeriodIcon/><span className={styles.actionLabel}>{refreshed?(fr?"Actualisé":"Refreshed"):(fr?"Rafraîchir":"Refresh")}</span></button></div>;
}

export function AdminCopyMenuButton({ locale = "fr", menuPath }: { locale?: AdminLocale; menuPath: string }) {
  const [state,setState]=useState<"idle"|"copied"|"error">("idle");
  const fr = locale === "fr";
  async function copy(){try{await navigator.clipboard.writeText(new URL(menuPath,window.location.origin).toString());setState("copied");window.setTimeout(()=>setState("idle"),2000)}catch{setState("error")}}
  const label = state === "copied" ? (fr?"Lien copié":"Link copied") : state === "error" ? (fr?"Copie impossible":"Unable to copy") : (fr?"Copier le lien du menu":"Copy menu link");
  return <><button className={styles.iconButton} onClick={copy} type="button" aria-label={label} title={label}><CopyIcon/></button>{state === "error" ? <span className={styles.copyAlert} role="alert">{fr ? "Impossible de copier le lien du menu." : "Unable to copy the menu link."}</span> : null}</>;
}
