import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./AdminIcons";
import styles from "./AdminSystem.module.css";

type ClassNameProps = { className?: string };
const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

export function AdminPanel({ title, eyebrow, action, children, className, ...props }: HTMLAttributes<HTMLElement> & { title?: string; eyebrow?: string; action?: ReactNode }) {
  return <section className={classes(styles.panel, className)} {...props}>{title || eyebrow || action ? <header className={styles.panelHeader}><div>{eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}{title ? <h2 className={styles.panelTitle}>{title}</h2> : null}</div>{action}</header> : null}{children}</section>;
}

export function AdminKpiCard({ label, value, detail, icon, trend, className }: ClassNameProps & { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; trend?: ReactNode }) {
  return <article className={classes(styles.kpi, className)}>{icon ? <span className={styles.kpiIcon}>{icon}</span> : null}<div className={styles.kpiContent}><p className={styles.kpiLabel}>{label}</p><p className={styles.kpiValue}>{value}</p>{detail ? <p className={styles.kpiDetail}>{detail}</p> : null}</div>{trend ? <div className={styles.kpiTrend}>{trend}</div> : null}</article>;
}

export function AdminEvidenceState({ kind, title, reason }: { kind: "insufficient" | "unavailable"; title?: string; reason: string }) {
  const unavailable = kind === "unavailable";
  return <div className={styles.evidence} role={unavailable ? "alert" : "status"}>{unavailable ? <AlertIcon /> : <InfoIcon />}<div><strong>{title ?? (unavailable ? "Données indisponibles" : "Données insuffisantes")}</strong><p>{reason}</p></div></div>;
}

export function AdminStatusBadge({ tone = "neutral", children }: { tone?: "available" | "unavailable" | "neutral" | "accent"; children: ReactNode }) {
  return <span className={classes(styles.badge, styles[`badge_${tone}`])}>{children}</span>;
}

export function AdminTabs({ active, className }: { active: "overview" | "availability"; className?: string }) {
  return <nav className={classes(styles.tabs, className)} aria-label="Sections principales"><Link href="/admin" aria-current={active === "overview" ? "page" : undefined}>Vue d’ensemble</Link><Link href="/admin/availability" aria-current={active === "availability" ? "page" : undefined}>Disponibilités</Link></nav>;
}

export function AdminTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = `admin-tip-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return <span className={styles.tooltip}><span className={styles.tooltipTrigger} tabIndex={0} aria-describedby={id}>{children}</span><span className={styles.tooltipBubble} id={id} role="tooltip">{label}</span></span>;
}

export function AdminToggle({ checked, label, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> & { checked: boolean; label: string }) {
  return <button type="button" className={styles.toggle} role="switch" aria-checked={checked} aria-label={label} {...props}><span /></button>;
}

export function AdminToast({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" }) {
  if (tone === "error") return <div className={classes(styles.toast, styles.toastError)} role="alert" aria-live="assertive">{children}</div>;
  return <div className={styles.toast} role="status" aria-live="polite">{children}</div>;
}

export function AdminSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classes(styles.skeleton, className)} aria-hidden="true" {...props} />;
}
