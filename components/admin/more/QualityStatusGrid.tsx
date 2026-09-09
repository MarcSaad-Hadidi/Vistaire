import {
  CheckIcon,
  ImmersiveIcon,
  InfoIcon,
  MenuOpenIcon,
  MoreIcon,
  OverviewIcon
} from "@/components/admin/system/AdminIcons";
import type { AdminMoreQualityModel, MoreQualityState } from "@/lib/admin/more/contracts";
import styles from "./AdminMoreQuality.module.css";

function stateText(state: MoreQualityState, model: AdminMoreQualityModel) {
  if (state.kind === "ready") return { value: model.copy.states.ready, detail: `${state.completed} / ${state.total}` };
  if (state.kind === "partial") return { value: `${Math.round((state.completed / state.total) * 100)} %`, detail: `${state.completed} / ${state.total} · ${model.copy.states.partial}` };
  if (state.kind === "unmeasured") return { value: model.copy.states.unmeasured, detail: model.copy.states.sourceNotConnected };
  return { value: state.reason === "not-applicable" ? model.copy.states.notApplicable : model.copy.states.unavailable, detail: "" };
}

function StatusCard({ label, state, model, icon }: { label: string; state: MoreQualityState; model: AdminMoreQualityModel; icon: React.ReactNode }) {
  const display = stateText(state, model);
  return (
    <article className={styles.statusCard} data-quality-state={state.kind}>
      <span className={styles.statusIcon}>{icon}</span>
      <div className={styles.statusBody}>
        <p className={styles.statusLabel}>{label}</p>
        <strong className={styles.statusValue}>{display.value}</strong>
        {display.detail ? <p className={styles.statusDetail}>{display.detail}</p> : null}
        {(state.kind === "ready" || state.kind === "partial") && state.total > 0 ? <progress className={styles.statusProgress} max={state.total} value={state.completed} aria-label={`${label}: ${state.completed} / ${state.total}`}/>: null}
      </div>
    </article>
  );
}

export function QualityStatusGrid({ model }: { model: AdminMoreQualityModel }) {
  const items = [
    { key: "qr", label: model.copy.labels.qr, state: model.qr, icon: <OverviewIcon /> },
    { key: "publication", label: model.copy.labels.publication, state: model.publication, icon: <MenuOpenIcon /> },
    { key: "photos", label: model.copy.labels.photos, state: model.photos, icon: <CheckIcon /> },
    { key: "translations", label: model.copy.labels.translations, state: model.translations, icon: <MoreIcon /> },
    { key: "immersive", label: model.copy.labels.immersiveAssets, state: model.immersiveAssets, icon: <ImmersiveIcon /> },
    { key: "mobile", label: model.copy.labels.mobilePerformance, state: model.mobilePerformance, icon: <InfoIcon /> }
  ];
  return <section className={styles.statusGrid} aria-label={model.copy.statusTitle}>{items.map(({ key, ...item }) => <StatusCard key={key} {...item} model={model} />)}</section>;
}
