import Link from "next/link";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

export function LandingOwnerSection({
  copy,
  restaurateurDashboard
}: {
  copy: LandingCopy["owner"];
  restaurateurDashboard: string;
}) {
  return (
    <section
      aria-labelledby="landing-owner-title"
      className={styles.section}
      id="restaurateurs"
    >
      <div className={`${styles.sectionPanel} ${styles.ownerPanel}`}>
        <header className={styles.ownerIntro}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="landing-owner-title">{copy.title}</h2>
          <p>{copy.body}</p>
          <Link
            className={styles.secondaryButton}
            href={restaurateurDashboard}
            prefetch={false}
          >
            {copy.cta}
          </Link>
        </header>
        <ol className={styles.ownerGrid}>
          {copy.items.map((item, index) => (
            <li key={item.title}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
