import type { Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import type { LandingExperience } from "@/lib/landing/menuExperiences";
import { LandingComparison } from "./comparison/LandingComparison";
import styles from "./VistaireLanding.module.css";

export function LandingComparisonSection({
  copy,
  experiences,
  locale
}: {
  copy: LandingCopy["comparison"];
  experiences: LandingExperience[];
  locale: Locale;
}) {
  return (
    <section
      aria-labelledby="landing-comparison-title"
      className={styles.section}
      id="comparaison"
    >
      <div className={`${styles.sectionPanel} ${styles.comparisonPanel}`}>
        <header className={styles.comparisonIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-comparison-title">{copy.title}</h2>
          <p>{copy.body}</p>
          <p className={styles.comparisonSupport}>{copy.support}</p>
        </header>
        <LandingComparison copy={copy} experiences={experiences} locale={locale} />
      </div>
    </section>
  );
}
