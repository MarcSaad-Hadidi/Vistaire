import { AdminStatusBadge } from "@/components/admin/system/AdminPresentationPrimitives";
import type { AdminMoreQualityCopy, MoreQualityState } from "@/lib/admin/more/contracts";
import styles from "./AdminMoreQuality.module.css";

export function QualityStateRow({ label, state, copy }: { label: string; state: MoreQualityState; copy: AdminMoreQualityCopy }) {
  let value = copy.states.unavailable;
  let detail = "";
  let tone: "available" | "unavailable" | "neutral" | "accent" = "neutral";
  if (state.kind === "ready") { value = copy.states.ready; detail = `${state.completed} / ${state.total}`; tone = "available"; }
  if (state.kind === "partial") { value = copy.states.partial; detail = `${state.completed} / ${state.total}`; tone = "accent"; }
  if (state.kind === "unmeasured") { value = copy.states.unmeasured; detail = copy.states.sourceNotConnected; }
  if (state.kind === "unavailable" && state.reason === "not-applicable") value = copy.states.notApplicable;
  return (
    <div className={styles.stateRow} data-quality-state={state.kind}>
      <div><strong>{label}</strong>{detail ? <span>{detail}</span> : null}</div>
      <AdminStatusBadge tone={tone}>{value}</AdminStatusBadge>
    </div>
  );
}
