"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./AdminReports.module.css";

export function ReportActions({ locale, range, service }: { locale: "fr" | "en"; range: "today" | "7d" | "30d"; service: "all" | "lunch" | "dinner" }) {
  const [message, setMessage] = useState("");
  const fr = locale === "fr";
  const exportHref = `/admin/api/reports/export?range=${range}&service=${service}`;

  function printReport() {
    if (typeof window.print !== "function") {
      setMessage(fr ? "L’impression n’est pas disponible dans ce navigateur." : "Printing is not available in this browser.");
      return;
    }
    window.print();
  }

  async function shareReport() {
    const title = fr ? "Vistaire — rapport privé" : "Vistaire — private report";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url: window.location.href });
        setMessage(fr ? "Lien partagé." : "Link shared.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setMessage(fr ? "Lien privé copié." : "Private link copied.");
        return;
      }
      setMessage(fr ? "Copiez l’adresse depuis la barre du navigateur." : "Copy the address from your browser bar.");
    } catch {
      setMessage(fr ? "Le partage a été annulé ou indisponible." : "Sharing was cancelled or unavailable.");
    }
  }

  return <div className={styles.actions} data-report-print-hidden>
    <button onClick={shareReport} type="button" aria-label={fr ? "Partager le lien privé" : "Share private link"}>{fr ? "Partager le bilan" : "Share report"}</button>
    <Link className={styles.actionPrimary} download href={exportHref}>{fr ? "Exporter le CSV" : "Export CSV"}</Link>
    <button onClick={printReport} type="button" aria-label={fr ? "Imprimer le rapport" : "Print report"}>{fr ? "Imprimer" : "Print"}</button>
    <span className={styles.actionMessage} aria-live="polite">{message}</span>
  </div>;
}
