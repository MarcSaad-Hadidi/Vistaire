import { InfoIcon } from "@/components/admin/system/AdminIcons";
import type { AdminMoreQualityModel } from "@/lib/admin/more/contracts";
import styles from "./AdminMoreQuality.module.css";

export function SupportPanel({ model, href }: { model: AdminMoreQualityModel; href: string }) {
  return (
    <section className={styles.supportPanel} aria-labelledby="quality-support-title">
      <span className={styles.supportIcon}><InfoIcon /></span>
      <div><h2 id="quality-support-title">{model.copy.supportTitle}</h2><p>{model.copy.supportBody}</p></div>
      <a className={styles.supportAction} href={href}>{model.copy.supportAction}</a>
    </section>
  );
}
