import { InternalSeoLinks } from "@/components/seo/InternalSeoLinks";
import { SeoFaq } from "@/components/seo/SeoFaq";
import type { SeoPageData } from "@/lib/seoPages";

export function VistaireSeoProductionSections({
  page
}: {
  page: SeoPageData;
}) {
  const locale = page.locale ?? "fr";
  const copy =
    locale === "en"
      ? {
          eyebrow: "Vistaire guide",
          title: "Complete guide to choosing a premium digital menu",
          intro:
            "Visible reference points for restaurants, with answers, deeper sections, frequent questions and connected guides. Vistaire speaks here to high-end restaurants in Montreal, Quebec and Canada that want to replace a PDF or basic QR menu with a true mobile experience.",
          direct: "Direct answer"
        }
      : {
          eyebrow: "Guide Vistaire",
          title: "Guide complet pour choisir une carte digitale premium",
          intro:
            "Des repères visibles pour les restaurateurs, avec les réponses, les sections de fond, les questions fréquentes et les guides reliés. Vistaire parle ici aux restaurants haut de gamme de Montréal, du Québec et du Canada qui veulent remplacer un PDF ou un QR basique par une vraie expérience mobile.",
          direct: "Réponse directe"
        };

  return (
    <section
      aria-labelledby={`${page.slug}-seo-guide-title`}
      className="relative col-span-full overflow-hidden rounded-[15px] border border-[#fffaf0]/25 bg-transparent p-6 text-[#fff7ea] shadow-[0_24px_70px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,250,240,0.18),inset_0_-1px_0_rgba(255,250,240,0.1)] backdrop-blur-[5px] backdrop-saturate-[1.1] sm:p-7 lg:p-8"
    >
      <div className="relative z-[2] mx-auto grid max-w-7xl gap-10 lg:gap-12">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#e8cf9b]/75">
            {copy.eyebrow}
          </p>
          <h2
            id={`${page.slug}-seo-guide-title`}
            className="mt-4 font-display text-3xl font-normal leading-tight text-[#fffaf0] sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="mt-5 text-sm leading-7 text-[#d8c9b2] sm:text-base">
            {copy.intro}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <section
            aria-labelledby={`${page.slug}-direct-answer-title`}
            className="rounded-[8px] border border-[#f6e1b7]/12 bg-[#fff7ea]/[0.035] p-6 sm:p-7"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#e8cf9b]/70">
              {copy.direct}
            </p>
            <h2
              id={`${page.slug}-direct-answer-title`}
              className="mt-4 font-display text-2xl font-normal leading-tight text-[#fffaf0] sm:text-3xl"
            >
              {page.takeaway.heading}
            </h2>
            <p className="mt-4 text-sm leading-7 text-[#d8c9b2] sm:text-base">
              {page.takeaway.text}
            </p>
            <div className="mt-6 grid gap-4 text-sm leading-7 text-[#e6d7c1]">
              {page.answer.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <div className="grid gap-6">
            {page.sections.map((section, index) => (
              <section
                aria-labelledby={`${page.slug}-section-${index}`}
                className="rounded-[8px] border border-[#f6e1b7]/12 bg-[#080604]/70 p-6 sm:p-7"
                key={section.heading}
              >
                <h2
                  id={`${page.slug}-section-${index}`}
                  className="font-display text-2xl font-normal leading-tight text-[#fffaf0]"
                >
                  {section.heading}
                </h2>
                <div className="mt-4 grid gap-4 text-sm leading-7 text-[#d8c9b2] sm:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.points ? (
                  <ul className="mt-5 grid gap-2 text-sm leading-6 text-[#e8cf9b]">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>

        <SeoFaq faqs={page.faq} layout="stack" locale={locale} />
        <InternalSeoLinks currentSlug={page.slug} locale={locale} />
      </div>
    </section>
  );
}
