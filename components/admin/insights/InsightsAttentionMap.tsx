import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import styles from "./AdminInsights.module.css";

type AttentionRank = Readonly<{ label: string; count: number; rank: number }>;

export function InsightsAttentionMap({ ranking, locale }: { ranking: readonly AttentionRank[]; locale: AdminLocale }) {
  const fr = locale === "fr";
  const rows = ranking.filter((row) => Number.isFinite(row.count) && row.count > 0).slice(0, 6);
  if (!rows.length) return <div className={styles.emptyState}><strong>{fr ? "Preuve insuffisante" : "Insufficient evidence"}</strong><p>{fr ? "La carte n’invente aucune bulle sans classement de plats observé." : "The map creates no bubble without an observed dish ranking."}</p></div>;
  const maximum = Math.max(...rows.map((row) => row.count));
  const maxRank = Math.max(...rows.map((row) => row.rank), 1);
  return <figure className={styles.attentionMap}>
    <div className={styles.mapAxis} aria-hidden="true">
      <span className={styles.mapY}>{fr ? "Consultations observées" : "Observed views"}</span>
      <span className={styles.mapX}>{fr ? "Rang observé" : "Observed rank"}</span>
    </div>
    <ol className={styles.attentionCloud} aria-label={fr ? "Carte des plats consultés, rang contre volume observé" : "Map of viewed dishes, rank versus observed volume"}>
      {rows.map((row) => {
        const size = 48 + Math.sqrt(row.count / maximum) * 36;
        const left = maxRank === 1 ? 50 : ((row.rank - 1) / (maxRank - 1)) * 68 + 10;
        const bottom = (row.count / maximum) * 58 + 16;
        return <li
          className={styles.attentionBubble}
          key={`${row.rank}-${row.label}`}
          style={{
            "--attention-size": `${size}px`,
            left: `calc(${left}% - ${size / 2}px)`,
            bottom: `calc(${bottom}% - ${size / 2}px)`
          } as React.CSSProperties}
        >
          <span>{row.label}</span>
          <strong>{row.count.toLocaleString(fr ? "fr-CA" : "en-CA")}</strong>
        </li>;
      })}
    </ol>
    <figcaption>{fr ? "Taille et position : consultations de plats observées et rang observé. Aucun score de conversion n’est inféré." : "Size and position: observed dish views and observed rank. No conversion score is inferred."}</figcaption>
  </figure>;
}
