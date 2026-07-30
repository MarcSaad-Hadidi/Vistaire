import Link from "next/link";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import styles from "./VistaireLanding.module.css";

export function LandingFinalCta({
  appointmentHref,
  copy
}: {
  appointmentHref: string;
  copy: LandingCopy["finalCta"];
}) {
  return (
    <section
      aria-labelledby="landing-final-cta-title"
      className={`${styles.section} ${styles.finalSection}`}
    >
      <div className={`${styles.sectionPanel} ${styles.finalCta}`}>
        <div>
          <h2 id="landing-final-cta-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <Link className={styles.primaryButton} href={appointmentHref} prefetch={false}>
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}
