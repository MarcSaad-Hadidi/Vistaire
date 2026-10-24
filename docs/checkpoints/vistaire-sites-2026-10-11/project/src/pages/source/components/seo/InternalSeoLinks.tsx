import { getRelatedSeoPages } from "../../lib/seoPages.ts";
export function InternalSeoLinks({ currentSlug, locale = "fr", heading }: any) {
  return (
    <section className="public-related">
      <h2>
        {heading ?? (locale === "en" ? "Vistaire guides" : "Guides Vistaire")}
      </h2>
      <div>
        {getRelatedSeoPages(currentSlug, locale).map((page) => (
          <a key={page.path} href={page.path}>
            <p>{page.eyebrow}</p>
            <h3>{page.linkTitle ?? page.h1}</h3>
            <span>{page.relatedDescription}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
