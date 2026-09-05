import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import type { Locale } from "@/lib/i18n";
import { getPricingPage } from "@/lib/pricingPage";
import { PricingTableEstimator } from "./PricingTableEstimator";
import { RestaurateurDashboardDemo } from "./RestaurateurDashboardDemo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import styles from "./VistairePricingPreview.module.css";

const UI_COPY = {
  fr: {
    collectionsLabel: "Collections physiques Vistaire",
    includedLabel: "Ce qui est inclus dans chaque offre Vistaire",
    pilotagePreview: "Données de démonstration — aperçu du dashboard Vistaire",
    pricingEquation: "Abonnement mensuel avec l’option Pilotage",
    dashboardLink: "Explorer l’aperçu restaurateur",
    extrasLabel: "Options complémentaires",
    variablesLabel: "Variables du devis"
  },
  en: {
    collectionsLabel: "Vistaire physical collections",
    includedLabel: "What every Vistaire offer includes",
    pilotagePreview: "Demo data — Vistaire dashboard preview",
    pricingEquation: "Monthly subscription with the Pilotage option",
    dashboardLink: "Explore the restaurant preview",
    extrasLabel: "Additional options",
    variablesLabel: "Quote variables"
  }
} as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className={styles.arrowIcon} fill="none" viewBox="0 0 14 14">
      <path
        d="M3.5 10.5 10.6 3.4m0 0H4.8m5.8 0v5.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className={styles.checkIcon} fill="none" viewBox="0 0 18 18">
      <path
        d="m4.5 9.3 2.7 2.7 6.4-6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function VistairePricingPreview({
  locale = "fr",
  routeMode = "production"
}: {
  locale?: Locale;
  routeMode?: VistaireRouteMode;
}) {
  const page = getPricingPage(locale);
  const routes = getVistaireChromeRoutes(routeMode, locale);
  const copy = UI_COPY[locale];

  return (
    <main className={styles.page}>
      <Image
        alt=""
        aria-hidden="true"
        className={styles.backgroundImage}
        fill
        priority
        quality={90}
        sizes="100vw"
        src={restaurantBackground}
      />
      <div aria-hidden="true" className={styles.backgroundWash} />

      <div className={styles.topNav}>
        <PreviewNav
          activeSection="pricing"
          currentPath={page.path}
          locale={locale}
          routeMode={routeMode}
        />
      </div>

      <section aria-labelledby="pricing-title" className={styles.hero}>
        <p className={styles.eyebrow}>{page.eyebrow}</p>
        <h1 id="pricing-title">{page.h1}</h1>
        <p className={styles.heroLead}>{page.subtitle}</p>
      </section>

      <section aria-label={copy.collectionsLabel} className={styles.collectionsSection}>
        <PricingTableEstimator collections={page.collections} locale={locale} />
      </section>

      <section
        aria-labelledby="pricing-included-title"
        className={styles.includedSection}
        data-pricing-included-panel
      >
        <header className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{page.included.eyebrow}</p>
          <h2 id="pricing-included-title">{page.included.title}</h2>
          <p>{page.included.body}</p>
        </header>

        <div aria-label={copy.includedLabel} className={styles.includedGrid}>
          {page.includedGroups.map((group) => (
            <article className={styles.includedGroup} key={group.index}>
              <header>
                <span>{group.index}</span>
                <h3>{group.title}</h3>
              </header>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>
                    <CheckIcon />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className={styles.priceDifference}>{page.included.priceDifference}</p>
      </section>

      <section className={styles.pilotageSection} data-pricing-pilotage>
        <div className={styles.pilotageInner}>
          <div className={styles.pilotageCopy}>
            <div className={styles.pilotageLabelRow}>
              <p>{page.pilotage.eyebrow}</p>
              <span>{page.pilotage.optionLabel}</span>
            </div>
            <h2>{page.pilotage.title}</h2>
            <p className={styles.pilotagePrice}>{page.pilotage.price}</p>
            <p className={styles.pilotageLead}>{page.pilotage.body}</p>

            <ul className={styles.pilotageFeatures}>
              {page.pilotage.features.map((feature) => (
                <li key={feature}>
                  <CheckIcon />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className={styles.pilotageDisclosure}>{page.pilotage.disclosure}</p>

            <dl aria-label={copy.pricingEquation} className={styles.priceEquation}>
              <div>
                <dt>01</dt>
                <dd>{page.pilotage.standardLabel}</dd>
              </div>
              <div>
                <dt>02</dt>
                <dd>{page.pilotage.optionPriceLabel}</dd>
              </div>
              <div className={styles.priceEquationTotal}>
                <dt>=</dt>
                <dd>{page.pilotage.totalLabel}</dd>
              </div>
            </dl>
          </div>

          <div className={styles.pilotageVisual}>
            <p className={styles.dashboardCaption}>{copy.pilotagePreview}</p>
            <div
              aria-hidden="true"
              className={styles.laptop}
              data-pricing-dashboard
              inert
            >
              <div className={styles.laptopScreen}>
                <div className={styles.dashboardCanvas}>
                  <RestaurateurDashboardDemo
                    initialPeriodId="30d"
                    locale={locale}
                    presentation="pilotage"
                  />
                </div>
              </div>
              <div aria-hidden="true" className={styles.laptopBase} />
            </div>
            <Link className={styles.dashboardLink} href={routes.restaurateurDashboard} prefetch={false}>
              {copy.dashboardLink}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-additional-title" className={styles.additionalSection}>
        <div className={styles.additionalInner}>
          <div aria-label={copy.extrasLabel} className={styles.extrasList}>
            <p className={styles.eyebrow}>{page.additional.eyebrow}</p>
            {page.additional.extras.map((extra) => (
              <p className={styles.extraItem} key={extra}>
                <span aria-hidden="true">+</span>
                {extra}
              </p>
            ))}
          </div>
          <div className={styles.startingAtCopy}>
            <h2 id="pricing-additional-title">{page.additional.startingAtTitle}</h2>
            <p>{page.additional.startingAtBody}</p>
            <ul aria-label={copy.variablesLabel}>
              {page.additional.variables.map((variable) => (
                <li key={variable}>{variable}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-final-title" className={styles.finalCta}>
        <div>
          <p className={styles.eyebrow}>{page.finalCta.eyebrow}</p>
          <h2 id="pricing-final-title">{page.finalCta.title}</h2>
          <p>{page.finalCta.body}</p>
        </div>
        <div className={styles.finalActions}>
          <Link className={styles.primaryButton} href={page.finalCta.primary.href} prefetch={false}>
            {page.finalCta.primary.label}
            <ArrowIcon />
          </Link>
          <Link className={styles.secondaryButton} href={page.finalCta.secondary.href} prefetch={false}>
            {page.finalCta.secondary.label}
          </Link>
        </div>
      </section>

      <PreviewFooter
        currentPath={page.path}
        locale={locale}
        routeMode={routeMode}
        width="wide"
      />
    </main>
  );
}
