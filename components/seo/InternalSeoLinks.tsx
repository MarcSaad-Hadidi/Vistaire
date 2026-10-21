import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getRelatedSeoPages, type SeoPageSlug } from "@/lib/seoPages";

type InternalSeoLinksProps = {
  currentSlug: SeoPageSlug;
  heading?: string;
  locale?: Locale;
  variant?: "grid" | "inline";
};

export function InternalSeoLinks({
  currentSlug,
  heading = "Guides Vistaire",
  locale = "fr",
  variant = "grid"
}: InternalSeoLinksProps) {
  const relatedPages = getRelatedSeoPages(currentSlug, locale);
  const resolvedHeading =
    heading === "Guides Vistaire" && locale === "en"
      ? "Vistaire guides"
      : heading;

  if (variant === "inline") {
    return (
      <nav aria-label={resolvedHeading} className="public-related-inline">
        {relatedPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            prefetch={false}
          >
            {page.footerLabel ?? page.eyebrow}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <section aria-labelledby={`${currentSlug}-guides`} className="public-related">
      <h2 id={`${currentSlug}-guides`}>
        {resolvedHeading}
      </h2>
      <div>
        {relatedPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            prefetch={false}
          >
            <p>{page.eyebrow}</p>
            <h3>{page.linkTitle ?? page.h1}</h3>
            <span>{page.relatedDescription}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
