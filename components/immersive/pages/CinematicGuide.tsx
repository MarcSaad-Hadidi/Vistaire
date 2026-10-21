import Link from "next/link";
import { SeoFaq } from "@/components/seo/SeoFaq";
import { getRelatedSeoPages, type SeoPageData } from "@/lib/seoPages";

// Free reading after a cinematic page's chapters, in the landing's language:
// the room stays visible behind glass panels, the landing FAQ and footer.
// Keeps every SEO block of the former appendix (answer, sections, comparison,
// FAQ, related pages) so the indexable content is unchanged.
export function CinematicGuide({ page }: { page: SeoPageData }) {
  const locale = page.locale ?? "fr";
  const en = locale === "en";
  const related = getRelatedSeoPages(page.slug, locale);
  return (
    <>
      <section className="cinematic-guide" aria-labelledby={`${page.slug}-guide-title`}>
        <div className="cinematic-panel cinematic-guide-intro">
          <span className="eyebrow">{en ? "Vistaire guide" : "Guide Vistaire"}</span>
          <h2 id={`${page.slug}-guide-title`}>{en ? "Direct answer" : "Réponse directe"}</h2>
          {page.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <div className="cinematic-guide-sections">
          {page.sections.map((section) => (
            <article className="cinematic-panel" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.points && <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            </article>
          ))}
        </div>
        <div className="cinematic-panel">
          <h3>{page.comparison.heading}</h3>
          <table className="cinematic-table">
            <thead>
              <tr><th scope="col"><span className="sr-only">{en ? "Criterion" : "Critère"}</span></th><th scope="col">{page.comparison.beforeLabel}</th><th scope="col">{page.comparison.afterLabel}</th></tr>
            </thead>
            <tbody>
              {page.comparison.rows.map((row) => (
                <tr key={row.label}><th scope="row">{row.label}</th><td data-label={page.comparison.beforeLabel}>{row.before}</td><td data-label={page.comparison.afterLabel}>{row.after}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="landing-faq cinematic-faq" aria-labelledby={`${page.slug}-faq-title`}>
          <div className="landing-faq-heading">
            <span className="pricing-eyebrow">FAQ</span>
            <h2 id={`${page.slug}-faq-title`}>{en ? "Your questions." : "Vos questions."}</h2>
          </div>
          <SeoFaq className="landing-faq-items" layout="stack" locale={locale} faqs={page.faq} />
        </section>
        <nav className="cinematic-related" aria-label={en ? "Related guides" : "Guides reliés"}>
          {related.map((item) => (
            <Link className="cinematic-panel" href={item.path} key={item.path}>
              <span className="eyebrow">{item.eyebrow}</span>
              <strong>{item.linkTitle ?? item.h1}</strong>
              <span>{item.relatedDescription}</span>
            </Link>
          ))}
        </nav>
      </section>
    </>
  );
}
