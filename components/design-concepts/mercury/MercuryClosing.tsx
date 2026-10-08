import Link from "next/link";
import { LANDING_COPY } from "@/lib/landing/landingCopy";
import shared from "./shared.module.css";
import styles from "./MercuryClosing.module.css";
import { Reveal } from "./MercuryReveal";

const copy = LANDING_COPY.fr;

const STATS = [
  { value: "Aucune", label: "application à télécharger" },
  { value: "2", label: "langues : français et anglais" },
  { value: "3D / AR", label: "sur les plats signatures" },
  { value: "1 scan", label: "du QR code à la carte" }
] as const;

const FOOTER_COLS = [
  {
    title: "Carte",
    links: [
      { label: "Expériences", href: "/demo" },
      { label: "Carte digitale", href: "/demo" },
      { label: "Tarifs", href: "/tarifs-menu-digital-restaurant" }
    ]
  },
  {
    title: "Restaurateurs",
    links: [
      { label: "Aperçu restaurateur", href: "/apercu-restaurateur" },
      { label: "Prendre rendez-vous", href: "/prendre-rendez-vous" }
    ]
  },
  {
    title: "Ressources",
    links: [
      { label: "Guides", href: "/guides" },
      { label: "À propos", href: "/a-propos" },
      { label: "Contact", href: "/contact" }
    ]
  }
] as const;

export function MercuryClosing() {
  return (
    <>
      <section
        data-mercury-theme="light"
        className={styles.quoteSection}
        aria-label="La promesse Vistaire"
      >
        <div className={styles.narrow}>
          <Reveal>
            <blockquote className={`${shared.serif} ${styles.quote}`}>
              «&nbsp;{copy.comparison.body}&nbsp;»
            </blockquote>
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.quoteAttr}>La promesse Vistaire</p>
          </Reveal>
        </div>
      </section>

      <section
        data-mercury-theme="light"
        className={styles.statsSection}
        aria-label="Vistaire en bref"
      >
        <div className={styles.inner}>
          <div className={styles.stats}>
            {STATS.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div className={styles.stat}>
                  <p className={`${shared.serif} ${styles.statValue}`}>
                    {stat.value}
                  </p>
                  <p className={styles.statLabel}>{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        data-mercury-theme="dark"
        className={styles.ctaSection}
        aria-labelledby="mercury-final-title"
      >
        <div className={styles.narrow}>
          <Reveal>
            <h2
              id="mercury-final-title"
              className={`${shared.serif} ${styles.ctaTitle}`}
            >
              {copy.finalCta.title}
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className={styles.ctaBody}>{copy.finalCta.body}</p>
          </Reveal>
          <Reveal delay={220}>
            <div className={styles.ctaActions}>
              <Link
                className={shared.btnPrimary}
                href="/prendre-rendez-vous"
              >
                {copy.finalCta.cta}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer data-mercury-theme="dark" className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.footerGrid}>
            <div>
              <p className={`${shared.serif} ${styles.footerLogo}`}>Vistaire</p>
              <p className={styles.footerTag}>
                Cartes digitales premium pour restaurants haut de gamme.
              </p>
            </div>
            {FOOTER_COLS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className={styles.footerTitle}>{col.title}</p>
                <ul className={styles.footerList}>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link className={styles.footerLink} href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className={styles.legal}>
            <p>© 2026 Vistaire — Page concept, non contractuelle.</p>
            <p className={styles.legalNote}>
              Contenu illustratif — les témoignages sont des reconstitutions.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
