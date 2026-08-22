import Link from "next/link";
import styles from "@/components/owner/OwnerCockpit.module.css";
import { Badge, EmptyState, ModuleHeader, Panel } from "@/components/owner/OwnerUi";
import { getOwnerDashboard } from "@/lib/owner/dashboard";
import type { OwnerAction } from "@/lib/owner/types";

export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<OwnerAction["priority"], "danger" | "warn" | "muted"> = {
  high: "danger",
  medium: "warn",
  low: "muted"
};

const PRIORITY_LABEL: Record<OwnerAction["priority"], string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse"
};

export default async function OwnerTasksPage() {
  const data = await getOwnerDashboard();

  return (
    <>
      <ModuleHeader
        title="Tâches / Readiness"
        description="Actions dérivées des menus, QR, photos et assets immersifs. Chaque tâche pointe vers la zone concernée."
      />

      {data.actions.length === 0 ? (
        <EmptyState>Aucun signal urgent dans les données disponibles.</EmptyState>
      ) : (
        <Panel title={`${data.actions.length} tâche(s)`}>
          <div className={styles.aiList}>
            {data.actions.map((action) => (
              <article key={action.id} className={styles.aiItem}>
                <span
                  className={`${styles.aiPriority} ${
                    action.priority === "high"
                      ? styles.aiPriorityHigh
                      : action.priority === "medium"
                        ? styles.aiPriorityMedium
                        : styles.aiPriorityLow
                  }`}
                  aria-hidden="true"
                />
                <div className={styles.aiItemBody}>
                  <div className={styles.pillRow}>
                    <Badge tone={PRIORITY_TONE[action.priority]}>
                      {PRIORITY_LABEL[action.priority]}
                    </Badge>
                    <span className={styles.aiMeta}>{action.restaurantName}</span>
                  </div>
                  <p className={styles.aiItemTitle}>{action.title}</p>
                  <p className={styles.aiItemText}>{action.body}</p>
                  <Link className={styles.inlineLink} href={action.href} prefetch={false}>
                    Traiter
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
