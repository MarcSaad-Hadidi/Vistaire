import Image from "next/image";
import Link from "next/link";
import restaurantBackground from "@/Framer/PhotoRestoComplet5.png";
import type { Locale } from "@/lib/i18n";
import { getPricingPage, type PricingCollection } from "@/lib/pricingPage";
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
    startingAt: "À partir de",
    setup: "Mise en place unique",
    collectionsLabel: "Collections physiques Vistaire",
    includedLabel: "Ce qui est inclus dans chaque offre Vistaire",
    pilotagePreview: "Aperçu du vrai dashboard Vistaire",
    pricingEquation: "Abonnement mensuel avec l’option Pilotage",
    dashboardLink: "Explorer l’aperçu restaurateur",
    extrasLabel: "Options complémentaires",
    variablesLabel: "Variables du devis"
  },
  en: {
    startingAt: "Starting at",
    setup: "One-time setup",
    collectionsLabel: "Vistaire physical collections",
    includedLabel: "What every Vistaire offer includes",
    pilotagePreview: "Preview of the real Vistaire dashboard",
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

function CollectionCard({
  collection,
  locale
}: {
  collection: PricingCollection;
  locale: Locale;
}) {
  const copy = UI_COPY[locale];
  const displayName = collection.name.replace(/^Vistaire\s/, "");

  return (
    <article
      className={
        collection.featured
          ? `${styles.collectionCard} ${styles.collectionCardFeatured}`
          : styles.collectionCard
      }
      data-pricing-collection={collection.id}
      id={`collection-${collection.id}`}
    >
      <header className={styles.collectionHeader}>
        <p>{collection.label}</p>
        <h2 aria-label={collection.name}>{displayName}</h2>
        <span>{collection.positioning}</span>
      </header>

      <figure className={styles.collectionVisual}>
        <Image
          alt={collection.imageAlt}
          className={styles.collectionImage}
          fill
          quality={90}
          sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1099px) 45vw, 24vw"
          src={collection.image}
          style={{ objectPosition: collection.imagePosition }}
        />
        <span aria-hidden="true" className={styles.collectionImageShade} />
      </figure>

      <div className={styles.collectionDetails}>
        <p className={styles.pricePrefix}>{copy.startingAt}</p>
        <p className={styles.setupPrice}>{collection.setupPrice}</p>
        <p className={styles.setupLabel}>{copy.setup}</p>
        <p className={styles.monthlyPrice}>{collection.monthlyPrice}</p>
        <p className={styles.collectionDescription}>{collection.description}</p>
        <Link className={styles.collectionLink} href={collection.cta.href} prefetch={false}>
          {collection.cta.label}
          <ArrowIcon />
        </Link>
      </div>
    </article>
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
          currentPath={page.path}
          locale={locale}
          routeMode={routeMode}
          variant="marketing"
        />
      </div>

      <section aria-labelledby="pricing-title" className={styles.hero}>
        <p className={styles.eyebrow}>{page.eyebrow}</p>
        <h1 id="pricing-title">{page.h1}</h1>
        <p className={styles.heroLead}>{page.subtitle}</p>
      </section>

      <section aria-label={copy.collectionsLabel} className={styles.collectionsSection}>
        <div className={styles.collectionGrid}>
          {page.collections.map((collection) => (
            <CollectionCard collection={collection} key={collection.id} locale={locale} />
          ))}
        </div>
      </section>

      <section aria-labelledby="pricing-included-title" className={styles.includedSection}>
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
                  <RestaurateurDashboardDemo initialPeriodId="30d" locale={locale} />
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
