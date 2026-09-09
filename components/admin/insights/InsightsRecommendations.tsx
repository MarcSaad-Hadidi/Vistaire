import type { AdminLocale } from "@/lib/admin/foundationRoutes";
import type { AssistantAnswer } from "@/lib/admin/assistant/contracts";
import styles from "./AdminInsights.module.css";

export function InsightsRecommendations({ answer, locale }: { answer: AssistantAnswer; locale: AdminLocale }) {
  if (!answer.blocks.length) return <p>{locale === "fr" ? "Aucune recommandation sans preuve exploitable." : "No recommendation without usable evidence."}</p>;
  return <ul className={styles.recommendationList}>{answer.blocks.map((block, index) => <li key={`${block.kind}-${index}`}><span>{index + 1}</span><div><strong>{block.label}</strong>{block.ranking ? <ol className={styles.answerRanking}>{block.ranking.slice(0, 3).map((entry) => <li key={`${entry.rank}-${entry.label}`}>{entry.rank}. {entry.label} · {entry.count}</li>)}</ol> : <p>{block.value ? `${block.value}${block.delta !== undefined ? ` · ${block.delta > 0 ? "+" : ""}${block.delta}` : ""}` : (locale === "fr" ? "Valeur indisponible" : "Value unavailable")}</p>}<small className={styles.srOnly}>{block.evidenceIds.join(", ")}</small></div></li>)}</ul>;
}
