import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import type { Locale } from "@/lib/i18n";
import { getPricingPage } from "@/lib/pricingPage";
import { PricingLaunchWorkflow } from "./PricingLaunchWorkflow";
import { PricingTableEstimator } from "./PricingTableEstimator";
import { RestaurateurDashboardDemo } from "./RestaurateurDashboardDemo";
import {
  getVistaireChromeRoutes,
  PreviewFooter,
  PreviewNav,
  type VistaireRouteMode
} from "./VistairePreviewChrome";
import extensionStyles from "./PricingPageExtensions.module.css";
import styles from "./VistairePricingPreview.module.css";

const UI_COPY = {
  fr: {
    collectionsLabel: "Collections physiques Vistaire",
    includedLabel: "Ce qui est inclus dans l’offre Vistaire",
    pilotagePreview: "Aperçu du vrai dashboard Vistaire",
    pricingEquation: "Abonnement mensuel avec l’option Pilotage",
    dashboardLink: "Explorer l’aperçu restaurateur",
    extrasLabel: "Options complémentaires",
    variablesLabel: "Variables du devis",
    threeDPacksLabel: "Packs de productions 3D supplémentaires",
    commercialTermsLabel: "Conditions commerciales essentielles"
  },
  en: {
    collectionsLabel: "Vistaire physical collections",
    includedLabel: "What the Vistaire offer includes",
    pilotagePreview: "Preview of the real Vistaire dashboard",
    pricingEquation: "Monthly subscription with the Pilotage option",
    dashboardLink: "Explore the restaurant preview",
    extrasLabel: "Additional options",
    variablesLabel: "Quote variables",
    threeDPacksLabel: "Additional 3D production packs",
    commercialTermsLabel: "Essential commercial terms"
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

      <section
        aria-labelledby="pricing-3d-title"
        className={extensionStyles.threeDSection}
        data-pricing-3d-addons
      >
        <header className={extensionStyles.sectionIntro}>
          <p className={styles.eyebrow}>{page.threeDAddOns.eyebrow}</p>
          <h2 id="pricing-3d-title">{page.threeDAddOns.title}</h2>
          <p>{page.threeDAddOns.body}</p>
        </header>

        <div
          aria-label={copy.threeDPacksLabel}
          className={extensionStyles.threeDPackGrid}
        >
          {page.threeDAddOns.packs.map((pack) => (
            <article className={extensionStyles.threeDPack} key={pack.quantity}>
              <span>{pack.label}</span>
              <strong>{pack.price}</strong>
            </article>
          ))}
        </div>

        <div className={extensionStyles.threeDIndividual}>
          <div>
            <span>{page.threeDAddOns.individualLabel}</span>
            <p>{page.threeDAddOns.individualNote}</p>
          </div>
          <strong>{page.threeDAddOns.individualPrice}</strong>
        </div>

        <p className={extensionStyles.threeDNote}>{page.threeDAddOns.replacementNote}</p>
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

      <PricingLaunchWorkflow content={page.workflow} />

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

      <section
        aria-labelledby="pricing-terms-title"
        className={extensionStyles.termsSection}
        data-pricing-commercial-terms
      >
        <header className={extensionStyles.termsIntro}>
          <p className={styles.eyebrow}>{page.commercialTerms.eyebrow}</p>
          <h2 id="pricing-terms-title">{page.commercialTerms.title}</h2>
        </header>
        <ul
          aria-label={copy.commercialTermsLabel}
          className={extensionStyles.termsGrid}
        >
          {page.commercialTerms.items.map((item) => (
            <li key={item}>
              <span aria-hidden="true" />
              <p>{item}</p>
            </li>
          ))}
        </ul>
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
