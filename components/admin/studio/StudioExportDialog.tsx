"use client";
import { useStudioLocale } from "./studioLocale";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Braces, Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/dashboardData";
import { createStudioExport, reportCSV, reportJSON } from "@/lib/admin/studioExport";
import { StudioDialog } from "./StudioDialog";
import styles from "./StudioExportDialog.module.css";

const baseFormats = [
  { id: "pdf", label: "PDF", description: "À lire ou imprimer", Icon: FileText, mime: "application/pdf" },
  { id: "xlsx", label: "Excel", description: "Tableaux Excel", Icon: FileSpreadsheet, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { id: "csv", label: "CSV", description: "Tableaux au format CSV", Icon: Table2, mime: "text/csv;charset=utf-8" },
  { id: "json", label: "JSON", description: "Format pour les logiciels", Icon: Braces, mime: "application/json;charset=utf-8" }
] as const;
type Format = typeof baseFormats[number]["id"];

function downloadFile(bytes: string | Uint8Array, mime: string, filename: string) {
  const blob = new Blob([typeof bytes === "string" ? bytes : new Uint8Array(bytes).buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  try { document.body.append(anchor); anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}

export function StudioExportDialog({ data, onClose, synthetic = false }: { data: AdminDashboardData; onClose: () => void; synthetic?: boolean }) {
  const {t,locale}=useStudioLocale();
  const formats=baseFormats.map(item=>({...item,description:t(item.description)}));
  const [format, setFormat] = useState<Format>("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const alive = useRef(true);
  const locked = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const close = () => { alive.current = false; onClose(); };
  const window = data.analytics.kind === "unavailable" ? null : data.analytics.observationWindow;
  const date = (value: string) => new Intl.DateTimeFormat(locale === "en" ? "en-CA" : "fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
  const selected = formats.find((item) => item.id === format)!;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setStatus("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (!alive.current) return;
      const report = createStudioExport(data, { synthetic });
      let bytes: string | Uint8Array;
      if (format === "json") bytes = reportJSON(report);
      else if (format === "csv") bytes = reportCSV(report);
      else {
        const engine = await import("@/lib/admin/studioExportFiles");
        if (!alive.current) return;
        bytes = await (format === "pdf" ? engine.buildPdf(report) : engine.buildXlsx(report));
      }
      if (!alive.current) return;
      const slug = data.restaurant.slug.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80) || "restaurant";
      const period = window ? `${window.startInclusive.slice(0, 10)}-${window.endExclusive.slice(0, 10)}` : "periode-indisponible";
      downloadFile(bytes, selected.mime, `${slug}-rapport-${period}.${format}`);
      setStatus(locale === "en" ? `${selected.label} ready · download started` : `${selected.label} prêt · téléchargement lancé`);
    } catch {
      if (alive.current) setError(t("Le fichier n’a pas pu être créé. Réessayez."));
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  }

  return <StudioDialog title={t("Exporter les données")} onClose={close}>
    <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      {synthetic && <p className={styles.intro}>{t("Données fictives de démonstration, sans activité réelle de restaurant.")}</p>}
      <p className={styles.intro}>{t("Les statistiques disponibles, tous les plats et leurs disponibilités sont inclus.")}</p>
      <fieldset disabled={busy}><legend>{t("Format du fichier")}</legend><div className={styles.formats}>
        {formats.map(({ id, label, description, Icon }) => <label key={id} className={format === id ? styles.selected : undefined}>
          <input type="radio" name="export-format" value={id} checked={format === id} onChange={() => setFormat(id)} />
          <Icon size={23} aria-hidden="true" /><span><b>{label}</b><small>{description}</small></span>
        </label>)}
      </div></fieldset>
      <div className={styles.period}><b>{t("Période des données")}</b><p>{window ? locale === "en" ? `${date(window.startInclusive)} (inclusive) to ${date(window.endExclusive)} (exclusive), UTC` : `${date(window.startInclusive)} (inclus) au ${date(window.endExclusive)} (exclu), UTC` : t("Période analytique indisponible. La carte chargée reste exportable.")}</p></div>
      <details className={styles.included}><summary>{t("Contenu du fichier")}</summary>
        <p>{t("Résumé, comparaison et agrégats disponibles par créneau, plat, catégorie et recherche. La carte et les disponibilités reflètent le menu déjà chargé, quelle que soit la période choisie.")}</p>
        <p>{t("N/A indique une valeur indisponible ou des preuves insuffisantes. Les seuils de confidentialité restent appliqués. Aucun journal individuel de visiteurs n’est exporté.")}</p>
        <p>{t("PDF et Excel contiennent tous les tableaux. En CSV, chaque ligne contient une seule valeur. Aucun historique supplémentaire n’est chargé.")}</p>
      </details>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.progress} role="status" aria-live="polite">{busy ? t("Préparation du fichier…") : status}</p>
      <div className={styles.footer}><button type="button" onClick={close}>{status ? t("Fermer") : t("Annuler")}</button><button type="submit" className={styles.primary} disabled={busy}><Download size={18} aria-hidden="true" />{busy ? t("Préparation…") : `${locale === "en" ? "Download" : "Télécharger"} ${selected.label}`}</button></div>
    </form>
  </StudioDialog>;
}
