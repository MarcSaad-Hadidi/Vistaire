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
      <nav aria-label={resolvedHeading} className="flex flex-wrap gap-x-4 gap-y-2">
        {relatedPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="text-sm text-champagne/90 underline decoration-champagne/30 underline-offset-4 transition hover:text-champagne hover:decoration-champagne/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            {page.footerLabel ?? page.eyebrow}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <section aria-labelledby={`${currentSlug}-guides`}>
      <h2
        id={`${currentSlug}-guides`}
        className="font-display text-3xl font-normal leading-tight text-cream sm:text-4xl"
      >
        {resolvedHeading}
      </h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {relatedPages.map((page) => (
          <Link
            key={page.path}
            href={page.path}
            className="group rounded-lg border border-white/10 bg-[#0d0907] p-5 transition hover:border-champagne/35 hover:bg-[#120d09] focus:outline-none focus-visible:ring-2 focus-visible:ring-champagne"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-champagne/70">
              {page.eyebrow}
            </p>
            <h3 className="mt-3 font-display text-xl leading-tight text-cream group-hover:text-champagne">
              {page.linkTitle ?? page.h1}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[#a99984]">
              {page.relatedDescription}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
