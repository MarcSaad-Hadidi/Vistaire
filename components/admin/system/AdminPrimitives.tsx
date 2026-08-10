import Link from "next/link";
import { cloneElement, useId } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from "react";
import { AlertIcon, InfoIcon } from "./AdminIcons";
import { adminEvidenceReasonCopy } from "@/lib/adminPresentationCopy";
import styles from "./AdminSystem.module.css";

const classes = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

export function AdminPanel({ title, eyebrow, action, children, className, ...props }: HTMLAttributes<HTMLElement> & { title?: string; eyebrow?: string; action?: ReactNode }) {
  return <section className={classes(styles.panel, className)} {...props}>{title || eyebrow || action ? <header className={styles.panelHeader}><div>{eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}{title ? <h2 className={styles.panelTitle}>{title}</h2> : null}</div>{action}</header> : null}{children}</section>;
}

export function AdminKpiCard({ label, value, detail, icon, trend, definition, definitionAriaLabel, evidence, className, ...props }: HTMLAttributes<HTMLElement> & { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode; trend?: ReactNode; definition?: string; definitionAriaLabel?: string; evidence?: { kind: "insufficient" | "unavailable"; reason: string } }) {
  return <article className={classes(styles.kpi, className)} data-evidence-kind={evidence?.kind} {...props}>{icon ? <span className={styles.kpiIcon} data-kpi-icon>{icon}</span> : null}<div className={styles.kpiContent}><p className={styles.kpiLabel}>{label}{definition?<AdminTooltip label={definition}><button className={styles.definitionButton} type="button" aria-label={definitionAriaLabel ?? `Définition de ${label}`}><InfoIcon/></button></AdminTooltip>:null}</p><p className={styles.kpiValue}>{value}</p>{evidence ? <p className={styles.kpiEvidence} role={evidence.kind === "unavailable" ? "alert" : "status"}>{adminEvidenceReasonCopy(evidence.reason)}</p> : detail ? <p className={styles.kpiDetail}>{detail}</p> : null}</div>{!evidence && trend ? <div className={styles.kpiTrend}>{trend}</div> : null}</article>;
}

export function AdminEvidenceState({ kind, title, reason }: { kind: "insufficient" | "unavailable"; title?: string; reason: string }) {
  const unavailable = kind === "unavailable";
  return <div className={styles.evidence} role={unavailable ? "alert" : "status"}>{unavailable ? <AlertIcon /> : <InfoIcon />}<div><strong>{title ?? (unavailable ? "Données indisponibles" : "Données insuffisantes")}</strong><p>{adminEvidenceReasonCopy(reason)}</p></div></div>;
}

export function AdminStatusBadge({ tone = "neutral", children }: { tone?: "available" | "unavailable" | "neutral" | "accent"; children: ReactNode }) {
  return <span className={classes(styles.badge, styles[`badge_${tone}`])}>{children}</span>;
}

export function AdminTabs({ active, className }: { active: "overview" | "availability" | "insights"; className?: string }) {
  return <nav className={classes(styles.tabs, className)} aria-label="Sections principales"><Link href="/admin" aria-current={active === "overview" ? "page" : undefined}>Vue d’ensemble</Link><Link href="/admin/availability" aria-current={active === "availability" ? "page" : undefined}>Disponibilités</Link><Link href="/admin/insights" aria-current={active === "insights" ? "page" : undefined}>Analyses</Link></nav>;
}

export function AdminTooltip({ label, children }: { label: string; children: ReactElement<{ "aria-describedby"?: string }> }) {
  const reactId = useId();
  const id = `admin-tip-${reactId}`;
  const describedBy = [children.props["aria-describedby"], id].filter(Boolean).join(" ");
  return <span className={styles.tooltip}>{cloneElement(children, { "aria-describedby": describedBy })}<span className={styles.tooltipBubble} id={id} role="tooltip">{label}</span></span>;
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
