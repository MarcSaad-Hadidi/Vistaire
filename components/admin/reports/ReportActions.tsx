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
      setMessage(fr ? "Lâ€™impression nâ€™est pas disponible dans ce navigateur." : "Printing is not available in this browser.");
      return;
    }
    window.print();
  }

  async function shareReport() {
    const title = fr ? "Vistaire â€” rapport privÃ©" : "Vistaire â€” private report";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url: window.location.href });
        setMessage(fr ? "Lien partagÃ©." : "Link shared.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setMessage(fr ? "Lien privÃ© copiÃ©." : "Private link copied.");
        return;
      }
      setMessage(fr ? "Copiez lâ€™adresse depuis la barre du navigateur." : "Copy the address from your browser bar.");
    } catch {
      setMessage(fr ? "Le partage a Ã©tÃ© annulÃ© ou indisponible." : "Sharing was cancelled or unavailable.");
    }
  }

  return <div className={styles.actions} data-report-print-hidden>
    <Link className={styles.actionPrimary} download href={exportHref}>{fr ? "Exporter le CSV" : "Export CSV"}</Link>
    <button onClick={printReport} type="button" aria-label={fr ? "Imprimer le rapport" : "Print report"}>{fr ? "Imprimer" : "Print"}</button>
    <button onClick={shareReport} type="button" aria-label={fr ? "Partager le lien privÃ©" : "Share private link"}>{fr ? "Partager" : "Share"}</button>
    <span className={styles.actionMessage} aria-live="polite">{message}</span>
  </div>;
}

