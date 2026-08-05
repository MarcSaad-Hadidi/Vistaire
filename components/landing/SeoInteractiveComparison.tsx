import type { Locale } from "@/lib/i18n";
import { getLandingCopy } from "@/lib/landing/landingCopy";
import { getLandingExperiences } from "@/lib/landing/menuExperiences";
import { LandingComparison } from "./comparison/LandingComparison";

/**
 * Reuses the verified public-menu comparison pipeline on SEO pages. The
 * client component keeps a single selected restaurant and lazy-loads its
 * matching renderer, rather than mounting three independent menu mocks.
 */
export async function SeoInteractiveComparison({
  locale,
  interaction
}: {
  locale: Locale;
  interaction: "slider" | "reveal";
}) {
  const experiences = await getLandingExperiences(locale);

  return (
    <LandingComparison
      copy={getLandingCopy(locale).comparison}
      experiences={experiences}
      interaction={interaction}
      locale={locale}
    />
  );
}
