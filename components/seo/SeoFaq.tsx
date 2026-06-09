import type { Locale } from "@/lib/i18n";
import type { SeoPageData } from "@/lib/seoPages";

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
  if (layout === "stack") {
    return (
      <div className={`divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0d0907] ${className}`}>
        {faqs.map((item) => (
          <article key={item.question} className="p-5 sm:p-6">
            <h3 className="font-display text-xl leading-tight text-cream">
              {item.question}
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#cdbfa9]">{item.answer}</p>
          </article>
        ))}
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
        <div className="divide-y divide-white/10 rounded-lg border border-white/10 bg-[#0d0907]">
          {faqs.map((item) => (
            <article key={item.question} className="p-5 sm:p-6">
              <h3 className="font-display text-xl leading-tight text-cream">
                {item.question}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#cdbfa9]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
