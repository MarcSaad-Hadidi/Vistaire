import { AdminPanel } from "@/components/admin/system/AdminPresentationPrimitives";
import { CheckIcon, InfoIcon } from "@/components/admin/system/AdminIcons";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import { completionIssueCopy } from "@/lib/admin/more/moreQualityCopy";
import styles from "./AdminMoreQuality.module.css";

export function CompletionIssuesPanel({ model }: { model: AdminMoreQualityModel }) {
  const visible = model.completionIssues.slice(0, 3);
  const hiddenCount = model.completionIssues.length - visible.length;
  return (
    <AdminPanel title={model.copy.issuesTitle} className={styles.issuesPanel}>
      {visible.length === 0 ? <p className={styles.emptyIssues}><CheckIcon />{model.copy.noIssues}</p> : (
        <><ul className={styles.issueList}>{visible.map((issue, index) => <li key={`${issue.kind}-${issue.dishId ?? issue.field ?? index}-${issue.locale ?? ""}`}><InfoIcon /><span>{completionIssueCopy(issue, model.locale)}</span></li>)}</ul>{hiddenCount > 0 ? <p className={styles.issueRemainder}>{model.locale === "fr" ? `${hiddenCount} autre${hiddenCount > 1 ? "s" : ""} point${hiddenCount > 1 ? "s" : ""} à compléter` : `${hiddenCount} more item${hiddenCount > 1 ? "s" : ""} to complete`}</p> : null}</>
      )}
    </AdminPanel>
  );
}
