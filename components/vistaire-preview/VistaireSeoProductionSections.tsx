import { InternalSeoLinks } from "../seo/InternalSeoLinks";
import { SeoFaq } from "../seo/SeoFaq";
import type { SeoPageData } from "@/lib/seoPages";
import styles from "./VistaireSeoProductionSections.module.css";

export function VistaireSeoProductionSections({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const copy =
    locale === "en"
      ? {
          eyebrow: "Vistaire guide",
          title: "Complete guide to choosing a premium digital menu",
          intro:
            "Visible reference points for restaurants, with answers, deeper sections, frequent questions and connected guides. Vistaire speaks here to high-end restaurants in Montreal, Quebec and Canada that want to replace a PDF or basic QR menu with a true mobile experience.",
          direct: "Direct answer",
        }
      : {
          eyebrow: "Guide Vistaire",
          title: "Guide complet pour choisir une carte digitale premium",
          intro:
            "Des repères visibles pour les restaurateurs, avec les réponses, les sections de fond, les questions fréquentes et les guides reliés. Vistaire parle ici aux restaurants haut de gamme de Montréal, du Québec et du Canada qui veulent remplacer un PDF ou un QR basique par une vraie expérience mobile.",
          direct: "Réponse directe",
        };

  return (
    <section
      aria-labelledby={`${page.slug}-seo-guide-title`}
      className={styles.appendix}
    >
      <div className={styles.inner}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id={`${page.slug}-seo-guide-title`} className={styles.title}>
            {copy.title}
          </h2>
          <p className={styles.lead}>{copy.intro}</p>
        </div>

        <div className={styles.readingGrid}>
          <section
            aria-labelledby={`${page.slug}-direct-answer-title`}
            className={styles.answer}
          >
            <p className={styles.eyebrow}>{copy.direct}</p>
            <h2
              id={`${page.slug}-direct-answer-title`}
              className={styles.sectionTitle}
            >
              {page.takeaway.heading}
            </h2>
            <p className={styles.paragraphs}>{page.takeaway.text}</p>
            <div className={styles.paragraphs}>
              {page.answer.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <div className={styles.sections}>
            {page.sections.map((section, index) => (
              <section
                aria-labelledby={`${page.slug}-section-${index}`}
                className={styles.section}
                key={section.heading}
              >
                <h2
                  id={`${page.slug}-section-${index}`}
                  className={styles.sectionTitle}
                >
                  {section.heading}
                </h2>
                <div className={styles.paragraphs}>
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.points ? (
                  <ul className={styles.points}>
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
