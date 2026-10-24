"use client";

import { useId } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { Locale } from "../../lib/i18n";
import type { SeoPageData } from "../../lib/seoPages";
import { FaqAsk } from "./FaqAsk";
import styles from "./SeoFaq.module.css";

type SeoFaqProps = {
  faqs: SeoPageData["faq"];
  className?: string;
  layout?: "split" | "stack";
  locale?: Locale;
  compact?: boolean;
};

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function SeoFaq({ faqs, className = "", layout = "split", locale = "fr", compact = false }: SeoFaqProps) {
  // Use the native disclosure branch from the PR with its exact styling.
  // The shared name provides single-item opening without an extra UI library.
  const disclosureGroup = useId();
  const items = (
    <div className={`${styles.root} ${compact ? styles.compact : ""}`} data-seo-faq>
        <div data-faq-native>
          {faqs.map((item, index) => (
            <details key={item.question} className={styles.item} name={disclosureGroup} open={index === 0}>
              <summary className={styles.trigger} data-seo-faq-question>
                <ChevronRightIcon className={styles.chevron} aria-hidden="true" data-seo-faq-chevron />
                <span>{item.question}</span>
              </summary>
              <div className={styles.answer} data-seo-faq-answer>{item.answer}</div>
            </details>
          ))}
        </div>
      <FaqAsk locale={locale} compact={compact} />
    </div>
  );

  if (layout === "stack") return <div className={className}>{items}</div>;

  return (
    <section className={className}>
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <h2 className={styles.title}>
            {locale === "en" ? "Frequently asked questions" : "Questions fréquentes"}
          </h2>
          <p className={styles.intro}>
            {locale === "en"
              ? "Concrete answers for restaurants, without invented numbers or unproven promises."
              : "Réponses concrètes pour restaurateurs, sans chiffres inventés ni promesses non prouvées."}
          </p>
        </div>
        {items}
      </div>
    </section>
  );
}
