import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import styles from "./AdminInsights.module.css";

type AttentionRank = Readonly<{ label: string; count: number; rank: number }>;

export function InsightsAttentionMap({ ranking, locale }: { ranking: readonly AttentionRank[]; locale: AdminLocale }) {
  const fr = locale === "fr";
  const rows = ranking.filter((row) => Number.isFinite(row.count) && row.count > 0).slice(0, 6);
  if (!rows.length) return <div className={styles.emptyState}><strong>{fr ? "Preuve insuffisante" : "Insufficient evidence"}</strong><p>{fr ? "La carte n’invente aucune bulle sans classement de plats observé." : "The map creates no bubble without an observed dish ranking."}</p></div>;
  const maximum = Math.max(...rows.map((row) => row.count));
  return <figure className={styles.attentionMap}>
    <div className={styles.mapAxis} aria-hidden="true"/>
    <ol className={styles.attentionCloud} aria-label={fr ? "Classement visuel des plats consultés" : "Visual ranking of viewed dishes"}>
      {rows.map((row) => {
        const size = 62 + Math.sqrt(row.count / maximum) * 48;
        return <li className={styles.attentionBubble} key={`${row.rank}-${row.label}`} style={{ "--attention-size": `${size}px` } as React.CSSProperties}>
          <span>{row.label}</span>
          <strong>{row.count.toLocaleString(fr ? "fr-CA" : "en-CA")}</strong>
        </li>;
      })}
    </ol>
    <figcaption>{fr ? "Taille des bulles : consultations de plats observées. Aucun score de conversion n’est inféré." : "Bubble size: observed dish views. No conversion score is inferred."}</figcaption>
  </figure>;
}
