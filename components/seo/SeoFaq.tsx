import type { Locale } from "@/lib/i18n";
import type { SeoPageData } from "@/lib/seoPages";
import { SeoFaqItem } from "@/components/seo/SeoFaqItem";

type SeoFaqProps = {
  faqs: SeoPageData["faq"];
  className?: string;
  layout?: "split" | "stack";
  locale?: Locale;
};

export function SeoFaq({
  faqs,
  className = "",
  layout = "split",
  locale = "fr"
}: SeoFaqProps) {
  const items = (
    <div
      className="divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0d0907]"
      data-seo-faq
    >
      {faqs.map((item, index) => (
        <SeoFaqItem
          key={item.question}
          question={item.question}
          answer={item.answer}
          initialOpen={index === 0}
        />
      ))}
    </div>
  );

  if (layout === "stack") {
    return (
      <div className={className}>
        {items}
      </div>
    );
  }

  return (
    <section className={className}>
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <h2 className="font-display text-4xl font-normal leading-[1] text-cream sm:text-5xl">
            {locale === "en" ? "Frequently asked questions" : "Questions fréquentes"}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#cdbfa9]">
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
