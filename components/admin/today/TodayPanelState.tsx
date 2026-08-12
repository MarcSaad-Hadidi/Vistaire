import { AlertIcon, InfoIcon } from "@/components/admin/system/AdminIcons";
import type { AdminEvidencePayload, AdminMetricState } from "@/lib/admin/data/contracts";
import styles from "./AdminToday.module.css";

export function TodayPanelState({
  state,
  message
}: {
  state: AdminMetricState<AdminEvidencePayload>;
  message: string | null;
}) {
  if (state.kind === "available") return null;
  const urgent = state.kind === "error" || state.kind === "unavailable";
  return (
    <div
      aria-live={urgent ? "assertive" : "polite"}
      className={styles.statePanel}
      data-evidence-kind={state.kind}
      role={urgent ? "alert" : "status"}
    >
      {urgent ? <AlertIcon /> : <InfoIcon />}
      <p>{message}</p>
    </div>
  );
}
