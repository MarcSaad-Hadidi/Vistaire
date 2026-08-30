import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import { InteractiveDonut } from "@/components/admin/charts/InteractiveDonut";
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
  const issueLabels = model.locale === "fr"
    ? { photo: model.copy.labels.photos, description: model.copy.labels.descriptions, allergens: model.copy.labels.allergens, language: "Traductions", profile: "Profil", menu: "Menu et QR" }
    : { photo: model.copy.labels.photos, description: model.copy.labels.descriptions, allergens: model.copy.labels.allergens, language: "Languages", profile: "Profile", menu: "Menu and QR" };
  const issueCounts = model.completionIssues.reduce<Record<keyof typeof issueLabels, number>>((counts, issue) => {
    const group: keyof typeof issueLabels = issue.kind === "photo-missing" ? "photo"
      : issue.kind === "description-missing" ? "description"
        : issue.kind === "allergens-unknown" ? "allergens"
          : issue.locale ? "language"
            : issue.kind === "profile-field-missing" ? "profile"
              : "menu";
    counts[group] += 1;
    return counts;
  }, { photo: 0, description: 0, allergens: 0, language: 0, profile: 0, menu: 0 });
  const issueData = (Object.keys(issueLabels) as Array<keyof typeof issueLabels>).flatMap((key) => issueCounts[key] > 0 ? [{ label: issueLabels[key], value: issueCounts[key] }] : []);
  return (
    <div className={styles.page} id="quality">
      <div className={styles.heroGrid}>
        <QualityStatusGrid model={model} />
        <RestaurantProfileCard model={model} />
      </div>
      <div className={styles.evidenceGrid}>
        <QrHealthPanel model={model} />
        <ContentReadinessPanel model={model} />
        <ExperienceEvidencePanel model={model} />
      </div>
      <div className={styles.bottomGrid}>
        <CompletionIssuesPanel model={model} />
        <AdminPanel title={model.locale === "fr" ? "Demandes Vistaire" : "Vistaire requests"} className={styles.auxiliaryPanel}>
          <strong>{model.locale === "fr" ? "Aucune donnée de demande" : "No request data"}</strong>
          <p>{model.locale === "fr" ? "Aucune source de demandes d’assistance n’est connectée à ce tableau." : "No support-request source is connected to this dashboard."}</p>
        </AdminPanel>
        <AdminPanel className={`${styles.auxiliaryPanel} ${styles.issueOverview}`}>
          {issueData.length ? <InteractiveDonut
            data={issueData}
            title={model.locale === "fr" ? "Vue des problèmes" : "Issue overview"}
            description={model.locale === "fr" ? "Répartition exacte des points de complétion du catalogue." : "Exact distribution of catalog completion items."}
            period={model.locale === "fr" ? "Catalogue actuel" : "Current catalog"}
            unit={model.locale === "fr" ? "points" : "items"}
            summary={model.locale === "fr" ? `${model.completionIssues.length} points observés.` : `${model.completionIssues.length} observed items.`}
            numberLocale={model.locale === "fr" ? "fr-CA" : "en-CA"}
            variant="compact"
          /> : <><strong>0</strong><p>{model.locale === "fr" ? "Aucun point de complétion observé dans le catalogue" : "No observed catalog completion items"}</p></>}
        </AdminPanel>
      </div>
      <SupportPanel model={model} href={supportHref} />
    </div>
  );
}
