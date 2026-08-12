import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AdminEvidenceRecord } from "@/lib/admin/data/evidenceRegistry";
import styles from "./AdminInsights.module.css";

export function InsightsAttentionMap({ record, locale }: { record?: AdminEvidenceRecord; locale: AdminLocale }) {
  const fr = locale === "fr";
  const value = record?.state.kind === "available" && !Array.isArray(record.state.value) && "count" in record.state.value ? record.state.value.count : null;
  if (typeof value !== "number") return <div className={styles.emptyState}><strong>{fr ? "Preuve insuffisante" : "Insufficient evidence"}</strong><p>{fr ? "La carte n’invente aucune bulle sans valeur observée." : "The map creates no bubble without an observed value."}</p></div>;
  return <figure className={styles.attentionMap}><div className={styles.mapAxis} aria-hidden="true"/><div className={styles.attentionBubble} style={{ "--attention-size": `${Math.min(152, 78 + Math.log10(value + 1) * 24)}px` } as React.CSSProperties}><strong>{value.toLocaleString(fr ? "fr-CA" : "en-CA")}</strong><span>{fr ? "ouvertures" : "opens"}</span></div><figcaption>{fr ? "Taille de la bulle : volume d’ouvertures observées. Aucun score de conversion n’est inféré." : "Bubble size: observed menu opens. No conversion score is inferred."}</figcaption></figure>;
}
