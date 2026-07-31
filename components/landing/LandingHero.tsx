import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { LandingCopy } from "@/lib/landing/landingCopy";
import { LandingHeroMedia } from "./LandingHeroMedia";
import {
  LandingPublicMenuLink,
  type LandingPublicMenuHref
} from "./LandingPublicMenuLink";
import styles from "./VistaireLanding.module.css";

export function LandingHero({
  copy,
  locale,
  maisonHref
}: {
  copy: LandingCopy["hero"];
  locale: Locale;
  maisonHref: LandingPublicMenuHref;
}) {
  return (
    <section
      aria-labelledby="landing-hero-title"
      className={styles.hero}
      id="accueil"
    >
      <div className={styles.heroGrid}>
        <article className={`${styles.glassCard} ${styles.heroMainCard}`}>
          <LandingHeroMedia locale={locale} />
          <div aria-hidden="true" className={styles.heroMediaShade} />
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 id="landing-hero-title">{copy.title}</h1>
            <p className={styles.heroBody}>{copy.body}</p>
            <div className={styles.heroActions}>
              <LandingPublicMenuLink
                className={styles.primaryButton}
                href={maisonHref}
                locale={locale}
                newTabLabelClassName={styles.srOnly}
              >
                {copy.primaryCta}
              </LandingPublicMenuLink>
              <a className={styles.secondaryButton} href="#experiences">
                {copy.secondaryCta}
              </a>
            </div>
          </div>
        </article>

        <div className={styles.heroAside}>
          <article className={`${styles.glassCard} ${styles.heroVisualCard}`}>
            <Image
              alt={
                locale === "en"
                  ? "Lobster plated as a premium restaurant dish"
                  : "Homard dressé dans une assiette gastronomique"
              }
              className={styles.coverImage}
              fill
              priority
              quality={90}
              sizes="(max-width: 920px) calc(100vw - 36px), 520px"
              src="/images/demo/dishes/homard-bleu-bisque-fenouil.png"
            />
            <div aria-hidden="true" className={styles.imageShade} />
            <div className={styles.heroVisualCopy}>
              <p className={styles.eyebrow}>{copy.visualEyebrow}</p>
              <h2>{copy.visualTitle}</h2>
              <LandingPublicMenuLink
                className={styles.compactButton}
                href={maisonHref}
                locale={locale}
                newTabLabelClassName={styles.srOnly}
              >
                {copy.visualCta}
              </LandingPublicMenuLink>
            </div>
          </article>

          <div className={styles.heroMiniGrid}>
            <article className={`${styles.glassCard} ${styles.heroMiniCard}`}>
              <span aria-hidden="true" className={styles.cardIndex}>
                01
              </span>
              <h2>{copy.mobileTitle}</h2>
              <p>{copy.mobileBody}</p>
            </article>
            <article className={`${styles.glassCard} ${styles.heroMiniCard}`}>
              <span aria-hidden="true" className={styles.cardIndex}>
                02
              </span>
              <h2>{copy.simpleTitle}</h2>
              <p>{copy.simpleBody}</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
