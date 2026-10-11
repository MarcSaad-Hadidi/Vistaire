"use client";

import { useSyncExternalStore } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { SeoPageData } from "@/lib/seoPages";
import { Accordion } from "@/components/ui/accordion";
import { FaqAsk } from "./FaqAsk";
import { SeoFaqItem } from "./SeoFaqItem";
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
  // Native disclosures keep every answer readable in SSR and without JS.
  // Hydration replaces this same inventory with the actual ReUI/Radix pattern.
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const items = (
    <div className={`${styles.root} ${compact ? styles.compact : ""}`} data-seo-faq>
      {hydrated ? (
        <Accordion type="single" collapsible defaultValue="item-0" data-reui="c-accordion-10">
          {faqs.map((item, index) => (
            <SeoFaqItem key={item.question} value={`item-${index}`} {...item} />
          ))}
        </Accordion>
      ) : (
        <div data-faq-native>
          {faqs.map((item, index) => (
            <details key={item.question} className={styles.item} open={index === 0}>
              <summary className={styles.trigger} data-seo-faq-question>
                <ChevronRightIcon className={styles.chevron} aria-hidden="true" data-seo-faq-chevron />
                <span>{item.question}</span>
              </summary>
              <div className={styles.answer} data-seo-faq-answer>{item.answer}</div>
            </details>
          ))}
        </div>
      )}
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
