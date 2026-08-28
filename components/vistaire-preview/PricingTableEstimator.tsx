"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  INCLUDED_TABLE_COUNT,
  MIN_TABLE_COUNT,
  calculateEstimatedSetupPrice,
  calculateExtraTableCount,
  formatSetupAmount,
  normalizeTableCount
} from "@/lib/pricingCalculator";
import type { PricingCollection } from "@/lib/pricingPage";
import cardStyles from "./VistairePricingPreview.module.css";
import styles from "./PricingTableEstimator.module.css";

const COPY = {
  fr: {
    eyebrow: "Votre établissement",
    title: "Estimez votre mise en place",
    question: "Combien de tables souhaitez-vous équiper ?",
    tables: "tables",
    decrease: "Réduire le nombre de tables",
    increase: "Augmenter le nombre de tables",
    included: "20 supports personnalisés inclus",
    includedWithExtras: (extraTables: number) =>
      `20 supports inclus · ${extraTables} support${extraTables > 1 ? "s" : ""} supplémentaire${extraTables > 1 ? "s" : ""}`,
    disclaimer:
      "Estimation indicative — le prix final sera confirmé dans votre devis après analyse de votre établissement et de vos besoins.",
    startingAt: "À partir de",
    estimateFor: (tableCount: number) =>
      `Estimation pour ${tableCount} table${tableCount === 1 ? "" : "s"}`,
    setup: "Mise en place unique",
    estimatedSetup: "Mise en place estimée"
  },
  en: {
    eyebrow: "Your venue",
    title: "Estimate your setup",
    question: "How many tables would you like to equip?",
    tables: "tables",
    decrease: "Decrease the number of tables",
    increase: "Increase the number of tables",
    included: "20 personalized displays included",
    includedWithExtras: (extraTables: number) =>
      `20 displays included · ${extraTables} additional display${extraTables === 1 ? "" : "s"}`,
    disclaimer:
      "Indicative estimate — final pricing will be confirmed in your quote after reviewing your venue and project requirements.",
    startingAt: "Starting at",
    estimateFor: (tableCount: number) =>
      `Estimate for ${tableCount} table${tableCount === 1 ? "" : "s"}`,
    setup: "One-time setup",
    estimatedSetup: "Estimated setup"
  }
} as const;

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className={cardStyles.arrowIcon} fill="none" viewBox="0 0 14 14">
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

function CollectionCard({
  collection,
  locale,
  tableCount
}: {
  collection: PricingCollection;
  locale: Locale;
  tableCount: number;
}) {
  const copy = COPY[locale];
  const displayName = collection.name.replace(/^Vistaire\s/, "");
  const isIncludedQuantity = tableCount === INCLUDED_TABLE_COUNT;
  const estimatedSetupAmount = calculateEstimatedSetupPrice({
    collectionId: collection.id,
    baseSetupAmount: collection.setupAmount,
    tableCount
  });

  return (
    <article
      className={
        collection.featured
          ? `${cardStyles.collectionCard} ${cardStyles.collectionCardFeatured}`
          : cardStyles.collectionCard
      }
      data-pricing-collection={collection.id}
      data-table-count={tableCount}
      id={`collection-${collection.id}`}
    >
      <header className={cardStyles.collectionHeader}>
        <p>{collection.label}</p>
        <h2 aria-label={collection.name}>{displayName}</h2>
        <span>{collection.positioning}</span>
      </header>

      <figure className={cardStyles.collectionVisual}>
        <Image
          alt={collection.imageAlt}
          className={cardStyles.collectionImage}
          fill
          quality={90}
          sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1099px) 45vw, 24vw"
          src={collection.image}
          style={{ objectPosition: collection.imagePosition }}
        />
        <span aria-hidden="true" className={cardStyles.collectionImageShade} />
      </figure>

      <div className={cardStyles.collectionDetails}>
        <p className={`${cardStyles.pricePrefix} ${styles.dynamicPricePrefix}`}>
          {isIncludedQuantity ? copy.startingAt : copy.estimateFor(tableCount)}
        </p>
        <p
          className={`${cardStyles.setupPrice} ${styles.priceValue}`}
          data-pricing-estimated-setup
          data-setup-amount={estimatedSetupAmount}
        >
          {formatSetupAmount(estimatedSetupAmount, locale)}
        </p>
        <p className={`${cardStyles.setupLabel} ${styles.dynamicSetupLabel}`}>
          {isIncludedQuantity ? copy.setup : copy.estimatedSetup}
        </p>
        <p className={cardStyles.monthlyPrice}>{collection.monthlyPrice}</p>
        <p className={cardStyles.collectionDescription}>{collection.description}</p>
        <Link className={cardStyles.collectionLink} href={collection.cta.href} prefetch={false}>
          {collection.cta.label}
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}

export function PricingTableEstimator({
  collections,
  locale
}: {
  collections: PricingCollection[];
  locale: Locale;
}) {
  const copy = COPY[locale];
  const [tableCount, setTableCount] = useState(INCLUDED_TABLE_COUNT);
  const [inputValue, setInputValue] = useState(String(INCLUDED_TABLE_COUNT));
  const extraTables = calculateExtraTableCount(tableCount);

  const applyTableCount = (value: number) => {
    const normalized = normalizeTableCount(value);
    setTableCount(normalized);
    setInputValue(String(normalized));
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    setInputValue(rawValue);

    if (rawValue === "") return;

    const parsedValue = event.currentTarget.valueAsNumber;
    if (!Number.isFinite(parsedValue)) return;

    const normalized = normalizeTableCount(parsedValue);
    setTableCount(normalized);
    if (normalized !== parsedValue) setInputValue(String(normalized));
  };

  const handleInputBlur = () => {
    if (inputValue === "") {
      setInputValue(String(tableCount));
      return;
    }

    const parsedValue = Number(inputValue);
    if (!Number.isFinite(parsedValue)) {
      setInputValue(String(tableCount));
      return;
    }

    applyTableCount(parsedValue);
  };

  return (
    <>
      <section
        aria-labelledby="pricing-estimator-title"
        className={styles.estimator}
        data-pricing-table-estimator
      >
        <div className={styles.estimatorCopy}>
          <p className={cardStyles.eyebrow}>{copy.eyebrow}</p>
          <h2 id="pricing-estimator-title">{copy.title}</h2>
          <p className={styles.question}>{copy.question}</p>
        </div>

        <div className={styles.estimatorControl}>
          <div aria-label={copy.question} className={styles.stepper} role="group">
            <button
              aria-label={copy.decrease}
              className={styles.stepperButton}
              data-pricing-table-decrement
              disabled={tableCount <= MIN_TABLE_COUNT}
              onClick={() => applyTableCount(tableCount - 1)}
              type="button"
            >
              <span aria-hidden="true">−</span>
            </button>

            <label className={styles.inputLabel}>
              <span className={styles.srOnly}>{copy.question}</span>
              <input
                aria-describedby="pricing-table-summary pricing-table-disclaimer"
                aria-label={copy.question}
                className={styles.tableInput}
                data-pricing-table-input
                inputMode="numeric"
                min={MIN_TABLE_COUNT}
                onBlur={handleInputBlur}
                onChange={handleInputChange}
                step={1}
                type="number"
                value={inputValue}
              />
              <span aria-hidden="true" className={styles.tableUnit}>
                {copy.tables}
              </span>
            </label>

            <button
              aria-label={copy.increase}
              className={styles.stepperButton}
              data-pricing-table-increment
              onClick={() => applyTableCount(tableCount + 1)}
              type="button"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>

          <p
            aria-atomic="true"
            aria-live="polite"
            className={styles.summary}
            id="pricing-table-summary"
          >
            {extraTables === 0 ? copy.included : copy.includedWithExtras(extraTables)}
          </p>
        </div>

        <p className={styles.disclaimer} id="pricing-table-disclaimer">
          {copy.disclaimer}
        </p>
      </section>

      <div className={cardStyles.collectionGrid}>
        {collections.map((collection) => (
          <CollectionCard
            collection={collection}
            key={collection.id}
            locale={locale}
            tableCount={tableCount}
          />
        ))}
      </div>
    </>
  );
}
