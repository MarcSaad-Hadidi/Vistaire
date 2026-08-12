import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { CompletionIssuesPanel } from "./CompletionIssuesPanel";
import { ContentReadinessPanel } from "./ContentReadinessPanel";
import { ExperienceEvidencePanel } from "./ExperienceEvidencePanel";
import { QrHealthPanel } from "./QrHealthPanel";
import { QualityStatusGrid } from "./QualityStatusGrid";
import { RestaurantProfileCard } from "./RestaurantProfileCard";
import { SupportPanel } from "./SupportPanel";
import styles from "./AdminMoreQuality.module.css";

export function AdminMoreQualityPage({ model }: { model: AdminMoreQualityModel }) {
  const subject = model.locale === "fr" ? `Aide Vistaire — ${model.profile.name}` : `Vistaire help — ${model.profile.name}`;
  const supportHref = `mailto:contact@vistaire.ca?subject=${encodeURIComponent(subject)}`;
  return (
    <div className={styles.page}>
      <div className={styles.heroGrid}>
        <QualityStatusGrid model={model} />
        <RestaurantProfileCard model={model} />
      </div>
      <div className={styles.evidenceGrid}>
        <QrHealthPanel model={model} />
        <ContentReadinessPanel model={model} />
        <ExperienceEvidencePanel model={model} />
      </div>
      <CompletionIssuesPanel model={model} />
      <SupportPanel model={model} href={supportHref} />
    </div>
  );
}
