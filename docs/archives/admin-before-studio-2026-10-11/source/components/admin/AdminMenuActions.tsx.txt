"use client";
import Link from "next/link";
import { useState } from "react";
import { CopyIcon, ExternalIcon, LogoutIcon } from "./system/AdminIcons";
import styles from "./system/AdminSystem.module.css";
export function AdminMenuActions({ menuPath }: { menuPath: string }) {
  const [copied,setCopied]=useState(false); const [copyError,setCopyError]=useState(false);
  async function copyMenuLink(){try{await navigator.clipboard.writeText(new URL(menuPath,window.location.origin).toString());setCopied(true);setCopyError(false);window.setTimeout(()=>setCopied(false),2000)}catch{setCopied(false);setCopyError(true)}}
  return <div className={styles.menuActions} aria-live="polite"><Link className={styles.primaryAction} href={menuPath} prefetch={false}><span className={styles.actionLabel}>Ouvrir le menu client</span><ExternalIcon/></Link><button className={styles.secondaryAction} onClick={copyMenuLink} type="button"><span className={styles.actionLabel}>{copied?"Lien copié":"Copier le lien du menu"}</span><CopyIcon/></button><form action="/admin/logout" method="post"><button className={styles.logoutAction} type="submit"><span className={styles.actionLabel}>Déconnexion</span><LogoutIcon/></button></form>{copyError?<p className={styles.actionError} role="alert">Impossible de copier le lien. Ouvrez le menu puis copiez son adresse.</p>:null}</div>;
}
